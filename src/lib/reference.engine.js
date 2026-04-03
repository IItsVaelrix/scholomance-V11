/**
 * ReferenceEngine — canonical server word lookup with in-memory cache.
 * Fetches from /api/word-lookup/:word and normalises the response shape.
 */

const cache = new Map();

async function fetchAll(word) {
  if (!word) return null;

  const key = String(word).toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(`/api/word-lookup/${encodeURIComponent(key)}`);
  if (!res.ok) return null;

  const payload = await res.json();
  const data = payload?.data ?? {};

  const result = {
    word: payload?.word ?? key,
    definition: data.definition ?? null,
    synonyms: data.synonyms ?? [],
    antonyms: data.antonyms ?? [],
    rhymes: data.rhymes ?? [],
    lore: data.lore ?? null,
    raw: data.raw ?? null,
  };

  cache.set(key, result);
  return result;
}

function clearCache() {
  cache.clear();
}

export const ReferenceEngine = { fetchAll, clearCache };
