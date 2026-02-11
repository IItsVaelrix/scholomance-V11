/**
 * Server-Side Word Lookup Routes
 * Provides cached, coalesced, rate-limited word lookups.
 * Sits between clients and external dictionary APIs to reduce redundant calls.
 *
 * Architecture:
 *   Client IndexedDB (L1) -> This endpoint (L2 Redis cache) -> External APIs (L3)
 *
 * @see ARCH.md section 1 - Fixes 1, 2, 4
 */

import { z } from 'zod';
import { coalescedLookup } from '../services/wordLookupCoalescer.js';
import { createEmptyLexicalEntry } from '../../core/schemas.js';

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CACHE_PREFIX = 'wordlookup:';
const EXTERNAL_API_TIMEOUT_MS = 5000;
const MAX_BATCH_SIZE = 50;

const batchSchema = z.object({
  words: z.array(z.string().min(1).max(80)).min(1).max(MAX_BATCH_SIZE),
});

/**
 * Fetches from an external URL with timeout.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs = EXTERNAL_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Performs a word lookup against external APIs (Free Dictionary + Datamuse).
 * Merges results from both sources.
 * @param {string} word - Normalized word.
 * @returns {Promise<Object|null>}
 */
async function lookupFromExternalAPIs(word) {
  const entry = createEmptyLexicalEntry(word);
  let foundData = false;

  // Try Free Dictionary API first (best for definitions)
  try {
    const fdRes = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (fdRes.ok) {
      const fdData = await fdRes.json();
      if (Array.isArray(fdData) && fdData.length > 0) {
        const d = fdData[0];
        const allDefs = [];
        const allPos = new Set();
        const allSyn = new Set();
        const allAnt = new Set();

        if (Array.isArray(d.meanings)) {
          for (const meaning of d.meanings) {
            if (meaning.partOfSpeech) allPos.add(meaning.partOfSpeech);
            for (const def of (meaning.definitions || [])) {
              if (def.definition) allDefs.push(def.definition);
              for (const s of (def.synonyms || [])) allSyn.add(s);
              for (const a of (def.antonyms || [])) allAnt.add(a);
            }
            for (const s of (meaning.synonyms || [])) allSyn.add(s);
            for (const a of (meaning.antonyms || [])) allAnt.add(a);
          }
        }

        if (allDefs.length > 0) {
          entry.definition = { text: allDefs[0], partOfSpeech: [...allPos][0] || '', source: 'Free Dictionary API' };
          entry.definitions = allDefs;
          foundData = true;
        }
        entry.pos = [...allPos];
        entry.synonyms = [...allSyn];
        entry.antonyms = [...allAnt];

        const phonetic = d.phonetics?.find(p => p.text);
        if (phonetic) entry.ipa = phonetic.text;
      }
    }
  } catch (e) {
    // Free Dictionary unavailable, continue to Datamuse
  }

  // Try Datamuse for rhymes and to fill gaps
  try {
    const [synRes, rhymeRes] = await Promise.all([
      fetchWithTimeout(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`),
      fetchWithTimeout(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}&max=20`),
    ]);

    if (synRes.ok) {
      const synData = await synRes.json();
      const syns = synData.map(s => s.word).filter(Boolean);
      if (entry.synonyms.length === 0 && syns.length > 0) {
        entry.synonyms = syns;
        foundData = true;
      }
    }

    if (rhymeRes.ok) {
      const rhymeData = await rhymeRes.json();
      entry.rhymes = rhymeData.map(r => r.word).filter(Boolean);
      if (entry.rhymes.length > 0) foundData = true;
    }
  } catch (e) {
    // Datamuse unavailable
  }

  return foundData ? entry : null;
}

/**
 * Performs a single word lookup with Redis cache + coalescing.
 * @param {string} word
 * @param {Object|null} redis - Redis client (null in dev = skip cache)
 * @param {Object} log - Logger
 * @returns {Promise<{data: Object|null, source: string}>}
 */
async function lookupWord(word, redis, log) {
  const normalized = word.toLowerCase().trim();
  if (!normalized) return { data: null, source: 'none' };

  // L2 cache check (Redis)
  if (redis) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}${normalized}`);
      if (cached) {
        return { data: JSON.parse(cached), source: 'redis-cache' };
      }
    } catch (e) {
      log.warn({ err: e }, '[WordLookup] Redis GET failed, falling through to API');
    }
  }

  // Coalesced external lookup
  const result = await coalescedLookup(normalized, () => lookupFromExternalAPIs(normalized));

  // Cache the result (even null results to prevent repeated misses)
  if (redis && result) {
    try {
      await redis.setEx(`${CACHE_PREFIX}${normalized}`, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (e) {
      log.warn({ err: e }, '[WordLookup] Redis SET failed');
    }
  }

  return { data: result, source: result ? 'external-api' : 'not-found' };
}

/**
 * Registers word lookup routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {Object} opts
 */
export async function wordLookupRoutes(fastify, _opts) {
  // Get Redis client from the parent server's decorated property if available
  const redis = fastify.redis || null;

  // Single word lookup
  fastify.get('/api/word-lookup/:word', {
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
    handler: async (request, reply) => {
      const { word } = request.params;
      if (!word || word.length > 80) {
        return reply.status(400).send({ error: 'Invalid word' });
      }

      const { data, source } = await lookupWord(word, redis, fastify.log);

      if (!data) {
        return reply.status(404).send({ error: 'Word not found', word });
      }

      return { word: word.toLowerCase(), data, source };
    },
  });

  // Batch word lookup
  fastify.post('/api/word-lookup/batch', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    handler: async (request, reply) => {
      const parsed = batchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parsed.error.issues,
        });
      }

      const { words } = parsed.data;
      const uniqueWords = [...new Set(words.map(w => w.toLowerCase().trim()))].filter(Boolean);

      const results = {};
      const lookupPromises = uniqueWords.map(async (word) => {
        const { data, source } = await lookupWord(word, redis, fastify.log);
        results[word] = { data, source };
      });

      await Promise.all(lookupPromises);

      return { results, count: Object.keys(results).length };
    },
  });
}
