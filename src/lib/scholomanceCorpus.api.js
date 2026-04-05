/**
 * Scholomance Super Corpus API Client
 * Interfaces with the massive literary database on the backend.
 *
 * All errors use PB-ERR-v1 bytecode for AI-parsable diagnostics.
 */

import { z } from "zod";
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
} from "../../codex/core/pixelbrain/bytecode-error.js";

const MOD = MODULE_IDS.SHARED;
const CORPUS_BASE_PATH = "/api/corpus";

function readEnvVar(name) {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta.env)
    ? import.meta.env[name]
    : undefined;
  if (typeof viteEnv === "string") return viteEnv;

  if (typeof globalThis !== "undefined" && globalThis.process?.env) {
    const processEnvValue = globalThis.process.env[name];
    if (typeof processEnvValue === "string") return processEnvValue;
  }
  return "";
}

function resolveBaseUrl() {
  const raw =
    readEnvVar("VITE_SCHOLOMANCE_CORPUS_API_URL") ||
    readEnvVar("SCHOLOMANCE_CORPUS_API_URL") ||
    readEnvVar("VITE_SCHOLOMANCE_DICT_API_URL") ||
    readEnvVar("SCHOLOMANCE_DICT_API_URL");
  const trimmed = String(raw || "").trim();
  if (!trimmed) return CORPUS_BASE_PATH;

  const normalized = trimmed.replace(/\/+$/, "");
  if (!normalized || normalized === "/") {
    return CORPUS_BASE_PATH;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)) {
    const url = new URL(normalized);
    url.pathname = CORPUS_BASE_PATH;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  }

  return normalized.includes("/api/")
    ? normalized.replace(/\/api\/[^/]+$/, CORPUS_BASE_PATH)
    : CORPUS_BASE_PATH;
}

const SearchSchema = z.object({
  query: z.string(),
  results: z.array(z.object({
    id: z.number(),
    text: z.string(),
    title: z.string().optional(),
    author: z.string().optional(),
    type: z.string().optional(),
    url: z.string().optional(),
    // Enriched FTS5 fields (LexOracle S1)
    snippet: z.string().optional(),
    match_score: z.number().optional(),
    match_offsets: z.array(z.tuple([z.number(), z.number()])).optional()
  }))
});

const SemanticSchema = z.object({
  word: z.string(),
  results: z.array(z.object({
    word: z.string(),
    phoneme_distance: z.number().optional(),
    rhyme_key: z.string().optional(),
    school: z.string().optional(),
    score: z.number().optional(),
  }))
});

const ContextSchema = z.object({
  id: z.number(),
  results: z.array(z.object({
    id: z.number(),
    text: z.string()
  }))
});

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new BytecodeError(
      ERROR_CATEGORIES.EXT, ERROR_SEVERITY.WARN, MOD,
      ERROR_CODES.EXT_NOT_FOUND,
      { reason: 'Corpus API error', httpStatus: res.status, url },
    );
    return await res.json();
  } finally { clearTimeout(timeout); }
}

export const ScholomanceCorpusAPI = {
  isEnabled() { return Boolean(resolveBaseUrl()); },
  getBaseUrl() { return resolveBaseUrl(); },

  /**
   * Search the massive literary corpus for sentences matching a query.
   */
  async search(query, limit = 20) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !query) return [];

    const url = new URL(`${baseUrl}/search`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    
    const payload = await fetchJson(url.toString());
    const parsed = SearchSchema.safeParse(payload);
    return parsed.success ? parsed.data.results : [];
  },

  /**
   * Find phonemically similar words via the semantic endpoint (S2).
   */
  async semantic(word, limit = 8) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !word) return [];

    const url = new URL(`${baseUrl}/semantic`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    url.searchParams.set('word', word);
    url.searchParams.set('limit', String(limit));

    const payload = await fetchJson(url.toString());
    const parsed = SemanticSchema.safeParse(payload);
    return parsed.success ? parsed.data.results : [];
  },

  /**
   * Get the surrounding context (sentences) for a specific corpus entry.
   */
  async getContext(id, windowSize = 2) {
    const baseUrl = resolveBaseUrl();
    if (!baseUrl || !id) return [];

    const url = new URL(`${baseUrl}/context/${id}`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    url.searchParams.set('window', String(windowSize));
    
    const payload = await fetchJson(url.toString());
    const parsed = ContextSchema.safeParse(payload);
    return parsed.success ? parsed.data.results : [];
  }
};
