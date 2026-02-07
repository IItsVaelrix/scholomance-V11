/**
 * Scholomance Dictionary API
 *
 * This client targets a custom dictionary service that can grow into a
 * MUD-oriented knowledge layer. It is intentionally shaped for expansion.
 *
 * Expected endpoints (base URL):
 * - GET /lookup/{word}?include=definition,synonyms,rhymes,lore
 * - GET /search?q=...&limit=...
 * - GET /suggest?prefix=...&limit=...
 */

import { z } from "zod";

const RAW_BASE_URL = import.meta.env.VITE_SCHOLOMANCE_DICT_API_URL;
const BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/$/, "") : "";

const DEFAULT_INCLUDE = ["definition", "synonyms", "rhymes", "lore"];
const DEFAULT_TIMEOUT_MS = 5000;

const LookupPayloadSchema = z.object({
  definition: z.object({
    text: z.string().optional(),
    partOfSpeech: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  entries: z.array(z.object({
    senses: z.array(z.object({
      glosses: z.array(z.string()).optional()
    }).passthrough()).optional(),
    pos: z.string().optional(),
    source: z.string().optional()
  }).passthrough()).optional(),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  rhymes: z.array(z.string()).optional(),
  lore: z.unknown().optional(),
  mud: z.unknown().optional()
}).passthrough();

const ResultsPayloadSchema = z.object({
  results: z.array(z.unknown()).optional()
}).passthrough();

function buildUrl(base, params) {
  const url = new URL(base, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const error = new Error(`Scholomance API error: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function coerceDefinition(payload) {
  if (payload?.definition?.text) {
    return {
      text: payload.definition.text,
      partOfSpeech: payload.definition.partOfSpeech || "",
      source: payload.definition.source || "Scholomance",
    };
  }

  const entry = Array.isArray(payload?.entries) ? payload.entries[0] : null;
  if (!entry) return null;

  const senses = Array.isArray(entry.senses) ? entry.senses : [];
  const firstSense = senses.find((sense) => sense && typeof sense === "object") || {};
  const gloss = Array.isArray(firstSense.glosses)
    ? firstSense.glosses.find((g) => typeof g === "string")
    : null;

  if (!gloss) return null;

  return {
    text: gloss,
    partOfSpeech: entry.pos || "",
    source: entry.source || "Scholomance",
  };
}

function normalizeLookup(payload) {
  if (!payload) return null;
  return {
    definition: coerceDefinition(payload),
    synonyms: Array.isArray(payload.synonyms) ? payload.synonyms : [],
    antonyms: Array.isArray(payload.antonyms) ? payload.antonyms : [],
    rhymes: Array.isArray(payload.rhymes) ? payload.rhymes : [],
    lore: payload.lore || payload.mud || null,
    raw: payload,
  };
}

export const ScholomanceDictionaryAPI = {
  isEnabled() {
    return Boolean(BASE_URL);
  },

  async lookup(word, { include = DEFAULT_INCLUDE } = {}) {
    if (!BASE_URL || !word) return null;
    const encodedWord = encodeURIComponent(String(word).trim());
    const url = buildUrl(`${BASE_URL}/lookup/${encodedWord}`, {
      include: include.join(","),
    });
    const payload = await fetchJson(url);
    const parsed = LookupPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Invalid Scholomance lookup payload");
    }
    return normalizeLookup(parsed.data);
  },

  async search(query, { limit = 20, include = ["definition", "lore"] } = {}) {
    if (!BASE_URL || !query) return [];
    const url = buildUrl(`${BASE_URL}/search`, {
      q: query,
      limit,
      include: include.join(","),
    });
    const payload = await fetchJson(url);
    const parsed = ResultsPayloadSchema.safeParse(payload);
    if (!parsed.success) return [];
    return Array.isArray(parsed.data.results) ? parsed.data.results : [];
  },

  async suggest(prefix, { limit = 10 } = {}) {
    if (!BASE_URL || !prefix) return [];
    const url = buildUrl(`${BASE_URL}/suggest`, { prefix, limit });
    const payload = await fetchJson(url);
    const parsed = ResultsPayloadSchema.safeParse(payload);
    if (!parsed.success) return [];
    return Array.isArray(parsed.data.results) ? parsed.data.results : [];
  },
};
