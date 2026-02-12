/**
 * Canonical backend word-lookup service.
 * Centralizes provider fallback, normalization, coalescing, and Redis cache behavior.
 */

import { createEmptyLexicalEntry } from '../../core/schemas.js';
import { coalescedLookup } from './wordLookupCoalescer.js';

const DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_CACHE_PREFIX = 'wordlookup:';
const DEFAULT_EXTERNAL_API_TIMEOUT_MS = 5000;

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map(toNonEmptyString).filter(Boolean);
  return [...new Set(normalized)];
}

function extractDefinitionsFromEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.senses)) continue;
    for (const sense of entry.senses) {
      if (!sense || typeof sense !== 'object') continue;
      const glosses = Array.isArray(sense.glosses) ? sense.glosses : [];
      for (const gloss of glosses) {
        const normalized = toNonEmptyString(gloss);
        if (normalized) out.push(normalized);
      }
    }
  }
  return [...new Set(out)];
}

function resolveScholomanceDictApiUrl(explicitUrl) {
  const raw = explicitUrl ??
    process.env.SCHOLOMANCE_DICT_API_URL ??
    process.env.VITE_SCHOLOMANCE_DICT_API_URL ??
    '';
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function resolvePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

async function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export function createWordLookupService(options = {}) {
  const redis = options.redis ?? null;
  const log = options.log ?? console;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheTtlSeconds = resolvePositiveInteger(options.cacheTtlSeconds, DEFAULT_CACHE_TTL_SECONDS);
  const externalApiTimeoutMs = resolvePositiveInteger(
    options.externalApiTimeoutMs,
    DEFAULT_EXTERNAL_API_TIMEOUT_MS,
  );
  const cachePrefix = toNonEmptyString(options.cachePrefix) ?? DEFAULT_CACHE_PREFIX;
  const scholomanceDictApiUrl = resolveScholomanceDictApiUrl(options.scholomanceDictApiUrl);

  async function lookupFromScholomanceDict(word) {
    if (!scholomanceDictApiUrl) return null;

    try {
      const res = await fetchWithTimeout(
        fetchImpl,
        `${scholomanceDictApiUrl}/lookup/${encodeURIComponent(word)}`,
        externalApiTimeoutMs,
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data !== 'object') return null;

      const entry = createEmptyLexicalEntry(word);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const firstEntry = entries[0] && typeof entries[0] === 'object' ? entries[0] : null;
      const fallbackPartOfSpeech = toNonEmptyString(firstEntry?.pos) || '';

      const definitionText = toNonEmptyString(data.definition?.text);
      if (definitionText) {
        entry.definition = {
          text: definitionText,
          partOfSpeech: toNonEmptyString(data.definition?.partOfSpeech) || fallbackPartOfSpeech,
          source: toNonEmptyString(data.definition?.source) || 'Scholomance Dictionary',
        };
      }

      const definitions = extractDefinitionsFromEntries(entries);
      if (definitions.length > 0) {
        entry.definitions = definitions;
      } else if (entry.definition?.text) {
        entry.definitions = [entry.definition.text];
      }

      entry.synonyms = normalizeStringArray(data.synonyms);
      entry.antonyms = normalizeStringArray(data.antonyms);
      entry.rhymes = normalizeStringArray(data.rhymes);
      entry.ipa = toNonEmptyString(firstEntry?.ipa) || undefined;
      entry.etymology = toNonEmptyString(firstEntry?.etymology) || undefined;
      entry.lore = data.lore ?? undefined;
      entry.pos = normalizeStringArray(entries.map((candidate) => candidate?.pos));
      entry.raw = data;

      if (!entry.definition && entry.definitions.length > 0) {
        entry.definition = {
          text: entry.definitions[0],
          partOfSpeech: entry.pos[0] || '',
          source: 'Scholomance Dictionary',
        };
      }

      const hasData = Boolean(
        entry.definition ||
        entry.definitions.length > 0 ||
        entry.synonyms.length > 0 ||
        entry.antonyms.length > 0 ||
        entry.rhymes.length > 0 ||
        entry.pos.length > 0 ||
        entry.ipa ||
        entry.etymology ||
        entry.lore
      );
      return hasData ? entry : null;
    } catch (error) {
      log?.warn?.({ err: error, word }, '[WordLookupService] Scholomance lookup failed, falling back');
      return null;
    }
  }

  async function lookupFromExternalApis(word) {
    const entry = createEmptyLexicalEntry(word);
    let foundData = false;

    try {
      const fdRes = await fetchWithTimeout(
        fetchImpl,
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        externalApiTimeoutMs,
      );
      if (fdRes.ok) {
        const fdData = await fdRes.json();
        if (Array.isArray(fdData) && fdData.length > 0) {
          const primary = fdData[0];
          const allDefs = [];
          const allPos = new Set();
          const allSynonyms = new Set();
          const allAntonyms = new Set();

          if (Array.isArray(primary.meanings)) {
            for (const meaning of primary.meanings) {
              const meaningPos = toNonEmptyString(meaning?.partOfSpeech);
              if (meaningPos) allPos.add(meaningPos);
              for (const definition of (meaning?.definitions || [])) {
                const definitionText = toNonEmptyString(definition?.definition);
                if (definitionText) allDefs.push(definitionText);
                for (const synonym of normalizeStringArray(definition?.synonyms)) allSynonyms.add(synonym);
                for (const antonym of normalizeStringArray(definition?.antonyms)) allAntonyms.add(antonym);
              }
              for (const synonym of normalizeStringArray(meaning?.synonyms)) allSynonyms.add(synonym);
              for (const antonym of normalizeStringArray(meaning?.antonyms)) allAntonyms.add(antonym);
            }
          }

          if (allDefs.length > 0) {
            entry.definition = {
              text: allDefs[0],
              partOfSpeech: [...allPos][0] || '',
              source: 'Free Dictionary API',
            };
            entry.definitions = allDefs;
            foundData = true;
          }

          entry.pos = [...allPos];
          entry.synonyms = [...allSynonyms];
          entry.antonyms = [...allAntonyms];

          const phonetic = Array.isArray(primary.phonetics)
            ? primary.phonetics.find((candidate) => toNonEmptyString(candidate?.text))
            : null;
          if (phonetic) entry.ipa = phonetic.text;
        }
      }
    } catch {
      // Free Dictionary failed; continue to Datamuse.
    }

    try {
      const [synRes, rhymeRes] = await Promise.all([
        fetchWithTimeout(
          fetchImpl,
          `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`,
          externalApiTimeoutMs,
        ),
        fetchWithTimeout(
          fetchImpl,
          `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}&max=20`,
          externalApiTimeoutMs,
        ),
      ]);

      if (synRes.ok) {
        const synData = await synRes.json();
        const synonyms = normalizeStringArray((Array.isArray(synData) ? synData : []).map((row) => row?.word));
        if (entry.synonyms.length === 0 && synonyms.length > 0) {
          entry.synonyms = synonyms;
          foundData = true;
        }
      }

      if (rhymeRes.ok) {
        const rhymeData = await rhymeRes.json();
        entry.rhymes = normalizeStringArray((Array.isArray(rhymeData) ? rhymeData : []).map((row) => row?.word));
        if (entry.rhymes.length > 0) foundData = true;
      }
    } catch {
      // Datamuse failed as well.
    }

    return foundData ? entry : null;
  }

  async function lookupWord(rawWord) {
    const normalizedWord = String(rawWord || '').trim().toLowerCase();
    if (!normalizedWord) {
      return { word: '', data: null, source: 'none' };
    }

    const cacheKey = `${cachePrefix}${normalizedWord}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return { word: normalizedWord, data: JSON.parse(cached), source: 'redis-cache' };
        }
      } catch (error) {
        log?.warn?.({ err: error }, '[WordLookupService] Redis GET failed, falling through');
      }
    }

    const lookupResult = await coalescedLookup(normalizedWord, async () => {
      const localResult = await lookupFromScholomanceDict(normalizedWord);
      if (localResult) {
        return { data: localResult, source: 'scholomance-local' };
      }

      const externalResult = await lookupFromExternalApis(normalizedWord);
      if (externalResult) {
        return { data: externalResult, source: 'external-api' };
      }
      return { data: null, source: 'not-found' };
    });

    const result = lookupResult?.data ?? null;
    const source = lookupResult?.source ?? (result ? 'external-api' : 'not-found');

    if (redis && result) {
      try {
        await redis.setEx(cacheKey, cacheTtlSeconds, JSON.stringify(result));
      } catch (error) {
        log?.warn?.({ err: error }, '[WordLookupService] Redis SET failed');
      }
    }

    return { word: normalizedWord, data: result, source };
  }

  async function lookupBatch(words) {
    const uniqueWords = [...new Set((Array.isArray(words) ? words : []).map((word) => String(word || '').trim().toLowerCase()))]
      .filter(Boolean);

    const results = {};
    await Promise.all(uniqueWords.map(async (word) => {
      const { data, source } = await lookupWord(word);
      results[word] = { data, source };
    }));

    return {
      results,
      count: Object.keys(results).length,
    };
  }

  return {
    lookupWord,
    lookupBatch,
    config: {
      cacheTtlSeconds,
      cachePrefix,
      externalApiTimeoutMs,
      scholomanceDictApiUrl,
    },
  };
}
