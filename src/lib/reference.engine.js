/**
 * Reference Engine
 * Uses the backend canonical word lookup route as the default source.
 */

import { z } from 'zod';

const DefinitionObjectSchema = z.object({
  text: z.string(),
  partOfSpeech: z.string().optional(),
  source: z.string().optional(),
});

const WordLookupResponseSchema = z.object({
  word: z.string(),
  source: z.string().optional(),
  data: z.object({
    // The primary definition for the word.
    definition: DefinitionObjectSchema.nullable().optional(),
    // A list of additional definitions, which can be simple strings or full objects.
    definitions: z.array(z.union([z.string(), DefinitionObjectSchema])).optional(),
    synonyms: z.array(z.string()).optional(),
    antonyms: z.array(z.string()).optional(),
    rhymes: z.array(z.string()).optional(),
    lore: z.any().optional(),
    raw: z.any().optional(),
  }).nullable(),
});

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function sanitizeWord(word) {
  return String(word || '').trim();
}

export const ReferenceEngine = {
  getKeys() {
    console.warn('getKeys is deprecated. API keys are managed on the server.');
    return { dictKey: null, thesKey: null };
  },

  setKeys(_dictKey, _thesKey) {
    console.warn('setKeys is deprecated. API keys are managed on the server.');
  },

  async lookupWord(word) {
    const normalizedWord = sanitizeWord(word);
    if (!normalizedWord) return null;

    const response = await fetch(`/api/word-lookup/${encodeURIComponent(normalizedWord)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Word lookup failed (${response.status})`);
    }

    const payload = await response.json();
    const parsed = WordLookupResponseSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.data) {
      return null;
    }
    return parsed.data.data;
  },

  async fetchAll(word) {
    const normalizedWord = sanitizeWord(word);
    if (!normalizedWord) {
      return {
        rhymes: [],
        definition: null,
        synonyms: [],
        antonyms: [],
        lore: null,
        mud: null,
      };
    }

    const cached = cache.get(normalizedWord);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let lexicalEntry = null;
    try {
      lexicalEntry = await this.lookupWord(normalizedWord);
    } catch (error) {
      console.warn('ReferenceEngine lookup error:', error);
    }

    // Combine all available definitions into a single, structured list.
    const allDefinitions = [];
    if (lexicalEntry?.definition) {
      allDefinitions.push(lexicalEntry.definition);
    }
    if (lexicalEntry?.definitions) {
      for (const def of lexicalEntry.definitions) {
        if (typeof def === 'string') {
          // Promote simple string definitions to the standard object format.
          allDefinitions.push({ text: def, partOfSpeech: '', source: lexicalEntry.source || 'Unknown' });
        } else if (def && def.text) {
          // Add object-based definitions, avoiding duplicates if the primary `definition` is also in this list.
          if (!allDefinitions.some(existing => existing.text === def.text)) {
            allDefinitions.push(def);
          }
        }
      }
    }

    const result = {
      rhymes: lexicalEntry?.rhymes || [],
      definition: allDefinitions[0] || null, // The first definition is considered primary.
      definitions: allDefinitions, // The full list of all definitions.
      synonyms: lexicalEntry?.synonyms || [],
      antonyms: lexicalEntry?.antonyms || [],
      lore: lexicalEntry?.lore || null,
      mud: lexicalEntry?.raw || null,
    };

    cache.set(normalizedWord, { data: result, timestamp: Date.now() });
    return result;
  },

  async getRhymes(word) {
    const result = await this.fetchAll(word);
    return result.rhymes;
  },

  async getDefinition(word) {
    const result = await this.fetchAll(word);
    return result.definition;
  },

  async getDefinitions(word) {
    const result = await this.fetchAll(word);
    return result.definitions;
  },

  async getSynonyms(word) {
    const result = await this.fetchAll(word);
    return result.synonyms;
  },

  async getAntonyms(word) {
    const result = await this.fetchAll(word);
    return result.antonyms;
  },
};
