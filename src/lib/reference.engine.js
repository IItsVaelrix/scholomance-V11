
/**
 * Reference Engine
 * Integrates external APIs for Dictionary, Thesaurus, and Rhymes via the application's own server proxy.
 */

import { z } from "zod";
import { ScholomanceDictionaryAPI } from "./scholomanceDictionary.api.js";

const RhymeItemSchema = z.union([
  z.string(),
  z.object({ word: z.string() }).passthrough()
]);
const RhymesSchema = z.array(RhymeItemSchema);
const SynonymsSchema = z.array(z.string());
const AntonymsSchema = z.array(z.string());
const DefinitionSchema = z.object({
  text: z.string(),
  partOfSpeech: z.string().optional(),
  source: z.string().optional()
}).transform((value) => ({
  text: value.text,
  partOfSpeech: value.partOfSpeech ?? "",
  source: value.source ?? "Unknown"
}));

function normalizeRhymes(items) {
  return items
    .map((item) => (typeof item === "string" ? item : item.word))
    .filter(Boolean);
}

// In-memory cache for word lookups
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const ReferenceEngine = {
  
  // The getKeys and setKeys methods are now deprecated as keys are handled server-side.
  // They are kept here to prevent breaking any components that might still call them,
  // but they no longer have any effect.
  getKeys() {
    console.warn("getKeys is deprecated. API keys are now managed on the server.");
    return { dictKey: null, thesKey: null };
  },

  setKeys(dictKey, thesKey) {
    console.warn("setKeys is deprecated. API keys are now managed on the server.");
  },

  async fetchAll(word) {
    // Check cache first
    const cached = cache.get(word);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let mudLookup = null;

    if (ScholomanceDictionaryAPI.isEnabled()) {
      try {
        mudLookup = await ScholomanceDictionaryAPI.lookup(word);
      } catch (e) {
        console.warn("Scholomance Dictionary error:", e);
      }
    }

    const safeWord = encodeURIComponent(word);
    const [rhymes, definition, synonyms, antonyms] = await Promise.allSettled([
      mudLookup?.rhymes?.length ? Promise.resolve(mudLookup.rhymes) : this.getRhymes(safeWord),
      mudLookup?.definition ? Promise.resolve(mudLookup.definition) : this.getDefinition(safeWord),
      mudLookup?.synonyms?.length ? Promise.resolve(mudLookup.synonyms) : this.getSynonyms(safeWord),
      mudLookup?.antonyms?.length ? Promise.resolve(mudLookup.antonyms) : this.getAntonyms(safeWord)
    ]);

    const result = {
      rhymes: rhymes.status === "fulfilled" ? rhymes.value : [],
      definition: definition.status === "fulfilled" ? definition.value : null,
      synonyms: synonyms.status === "fulfilled" ? synonyms.value : [],
      antonyms: antonyms.status === "fulfilled" ? antonyms.value : [],
      lore: mudLookup?.lore || null,
      mud: mudLookup?.raw || null
    };

    // Store in cache
    cache.set(word, { data: result, timestamp: Date.now() });

    return result;
  },

  async getRhymes(word) {
    try {
      const res = await fetch(`/api/rhymes/${word}`);
      if (!res.ok) throw new Error('Rhyme fetch failed');
      const payload = await res.json();
      const parsed = RhymesSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Invalid rhymes payload");
      }
      return normalizeRhymes(parsed.data);
    } catch (e) {
      console.warn("Rhyme fetch error:", e);
      return [];
    }
  },

  async getDefinition(word) {
    try {
      const res = await fetch(`/api/definition/${word}`);
      if (!res.ok) throw new Error('Definition fetch failed');
      const payload = await res.json();
      const parsed = DefinitionSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Invalid definition payload");
      }
      return parsed.data;
    } catch (e) {
      console.warn("Definition fetch error:", e);
      return null;
    }
  },

  async getSynonyms(word) {
    try {
      const res = await fetch(`/api/synonyms/${word}`);
      if (!res.ok) throw new Error('Synonym fetch failed');
      const payload = await res.json();
      const parsed = SynonymsSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Invalid synonyms payload");
      }
      return parsed.data;
    } catch (e) {
      console.warn("Synonym fetch error:", e);
      return [];
    }
  },

  async getAntonyms(word) {
    try {
      const res = await fetch(`/api/antonyms/${word}`);
      if (!res.ok) throw new Error('Antonym fetch failed');
      const payload = await res.json();
      const parsed = AntonymsSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Invalid antonyms payload");
      }
      return parsed.data;
    } catch (e) {
      console.warn("Antonym fetch error:", e);
      return [];
    }
  }
};
