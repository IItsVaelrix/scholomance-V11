/**
 * Scholomance Dictionary API
 */

import { z } from "zod";

function readEnvVar(name) {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta.env)
    ? import.meta.env[name]
    : undefined;
  if (typeof viteEnv === "string") {
    return viteEnv;
  }

  if (typeof globalThis !== "undefined" && globalThis.process?.env) {
    const processEnvValue = globalThis.process.env[name];
    if (typeof processEnvValue === "string") {
      return processEnvValue;
    }
  }

  return "";
}

function resolveBaseUrl() {
  const raw = readEnvVar("VITE_SCHOLOMANCE_DICT_API_URL") || readEnvVar("SCHOLOMANCE_DICT_API_URL");
  const trimmed = String(raw || "").trim();
  return trimmed ? trimmed.replace(/\/$/, "") : "";
}

const DEFAULT_TIMEOUT_MS = 5000;

const BatchLookupSchema = z.object({
  families: z.record(z.string())
});

const ValidateBatchSchema = z.object({
  valid: z.array(z.string())
});

const SuggestSchema = z.object({
  results: z.array(z.object({
    headword: z.string(),
    pos: z.string().nullable().optional(),
  })),
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
  isEnabled() { return Boolean(resolveBaseUrl()); },
  getBaseUrl() { return resolveBaseUrl(); },

  async lookup(word) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !word) return null;
    const url = buildUrl(`${baseUrl}/lookup/${encodeURIComponent(word)}`);
    const payload = await fetchJson(url);
    return payload;
  },

  /**
   * Performs bulk lookup of rhyme families for a set of words.
   * @param {string[]} words
   * @returns {Promise<Record<string, string>>} word (upper) -> rhyme family
   */
  async lookupBatch(words) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !words?.length) return {};
    const url = buildUrl(`${baseUrl}/lookup-batch`);
    const payload = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words })
    });
    const parsed = BatchLookupSchema.safeParse(payload);
    return parsed.success ? parsed.data.families : {};
  },

  /**
   * Validates whether words exist in the dictionary lexicon.
   * @param {string[]} words
   * @returns {Promise<string[]>} lowercased valid words
   */
  async validateBatch(words) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !words?.length) return [];
    const url = buildUrl(`${baseUrl}/validate-batch`);
    const payload = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words })
    });
    const parsed = ValidateBatchSchema.safeParse(payload);
    return parsed.success ? parsed.data.valid : [];
  },

  /**
   * Returns dictionary suggestions for a prefix.
   * @param {string} prefix
   * @param {{ limit?: number }} [options]
   * @returns {Promise<string[]>}
   */
  async suggest(prefix, { limit = 20 } = {}) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !prefix) return [];
    const url = buildUrl(`${baseUrl}/suggest`, { prefix, limit });
    const payload = await fetchJson(url);
    const parsed = SuggestSchema.safeParse(payload);
    if (!parsed.success) return [];

    const deduped = [];
    const seen = new Set();
    for (const row of parsed.data.results) {
      const headword = String(row?.headword || '').trim().toLowerCase();
      if (!headword || seen.has(headword)) continue;
      seen.add(headword);
      deduped.push(headword);
    }
    return deduped;
  },

  async search(query, { limit = 20 } = {}) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !query) return [];
    const url = buildUrl(`${baseUrl}/search`, { q: query, limit });
    const payload = await fetchJson(url);
    return payload.results || [];
  }
};
