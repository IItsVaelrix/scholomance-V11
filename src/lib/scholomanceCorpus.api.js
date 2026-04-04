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
  // We use the same base URL as the dictionary since they share the Fastify server
  const raw = readEnvVar("VITE_SCHOLOMANCE_DICT_API_URL") || readEnvVar("SCHOLOMANCE_DICT_API_URL");
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  
  // The dictionary URL usually ends in /api/lexicon, we want the root /api or just base
  // But our routes are registered at /api/corpus
  const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  return url.origin;
}

const SearchSchema = z.object({
  query: z.string(),
  results: z.array(z.object({
    id: z.number(),
    text: z.string(),
    title: z.string().optional(),
    author: z.string().optional(),
    type: z.string().optional(),
    url: z.string().optional()
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

  /**
   * Search the massive literary corpus for sentences matching a query.
   */
  async search(query, limit = 20) {
    const origin = resolveBaseUrl();
    if (!origin || !query) return [];
    
    const url = new URL(`${origin}/api/corpus/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    
    const payload = await fetchJson(url.toString());
    const parsed = SearchSchema.safeParse(payload);
    return parsed.success ? parsed.data.results : [];
  },

  /**
   * Get the surrounding context (sentences) for a specific corpus entry.
   */
  async getContext(id, windowSize = 2) {
    const origin = resolveBaseUrl();
    if (!origin || !id) return [];
    
    const url = new URL(`${origin}/api/corpus/context/${id}`);
    url.searchParams.set('window', String(windowSize));
    
    const payload = await fetchJson(url.toString());
    const parsed = ContextSchema.safeParse(payload);
    return parsed.success ? parsed.data.results : [];
  }
};
