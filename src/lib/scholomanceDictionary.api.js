/**
 * Scholomance Dictionary API
 */

import { z } from "zod";

const env = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? import.meta.env 
  : (typeof process !== 'undefined' ? process.env : {});

const RAW_BASE_URL = env.VITE_SCHOLOMANCE_DICT_API_URL;
const BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/$/, "") : "";

const DEFAULT_INCLUDE = ["definition", "synonyms", "rhymes", "lore"];
const DEFAULT_TIMEOUT_MS = 5000;

const LookupPayloadSchema = z.object({
  definition: z.object({
    text: z.string().optional(),
    partOfSpeech: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  rhymes: z.array(z.string()).optional(),
  rhymeFamily: z.string().nullable().optional(),
}).passthrough();

const BatchLookupSchema = z.object({
  families: z.record(z.string())
});

function buildUrl(base, params) {
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`Scholomance API error: ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timeout); }
}

export const ScholomanceDictionaryAPI = {
  isEnabled() { return Boolean(BASE_URL); },

  async lookup(word) {
    if (!BASE_URL || !word) return null;
    const url = buildUrl(`${BASE_URL}/lookup/${encodeURIComponent(word)}`);
    const payload = await fetchJson(url);
    return payload;
  },

  /**
   * Performs bulk lookup of rhyme families for a set of words.
   * @param {string[]} words
   * @returns {Promise<Record<string, string>>} word (upper) -> rhyme family
   */
  async lookupBatch(words) {
    if (!BASE_URL || !words?.length) return {};
    const url = buildUrl(`${BASE_URL}/lookup-batch`);
    const payload = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words })
    });
    const parsed = BatchLookupSchema.safeParse(payload);
    return parsed.success ? parsed.data.families : {};
  },

  async search(query, { limit = 20 } = {}) {
    if (!BASE_URL || !query) return [];
    const url = buildUrl(`${BASE_URL}/search`, { q: query, limit });
    const payload = await fetchJson(url);
    return payload.results || [];
  }
};
