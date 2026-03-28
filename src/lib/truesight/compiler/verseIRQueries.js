import { normalizeVowelFamily } from '../../phonology/vowelFamily.js';

function getMapIndexEntries(indexes, key) {
  const index = indexes?.[key];
  if (!(index instanceof Map)) {
    return Object.freeze([]);
  }

  return index;
}

function toFrozenArray(values) {
  return Object.freeze(Array.isArray(values) ? [...values] : []);
}

function getTokenIdsFromMapIndex(verseIR, indexKey, lookupKey) {
  const index = getMapIndexEntries(verseIR?.indexes, indexKey);
  return toFrozenArray(index.get(lookupKey) || []);
}

export function getTokensByIds(verseIR, tokenIds) {
  const tokens = Array.isArray(verseIR?.tokens) ? verseIR.tokens : [];
  return Object.freeze(
    (Array.isArray(tokenIds) ? tokenIds : [])
      .map((tokenId) => tokens[Number(tokenId)])
      .filter(Boolean)
  );
}

export function getWindowsByIds(verseIR, windowIds) {
  const windows = Array.isArray(verseIR?.syllableWindows) ? verseIR.syllableWindows : [];
  return Object.freeze(
    (Array.isArray(windowIds) ? windowIds : [])
      .map((windowId) => windows[Number(windowId)])
      .filter(Boolean)
  );
}

export function getTokensByVowelFamily(verseIR, vowelFamily) {
  const normalizedFamily = normalizeVowelFamily(vowelFamily);
  if (!normalizedFamily) {
    return Object.freeze([]);
  }

  return getTokensByIds(
    verseIR,
    getTokenIdsFromMapIndex(verseIR, 'tokenIdsByVowelFamily', normalizedFamily)
  );
}

export function getTokensByRhymeTail(verseIR, rhymeTailSignature) {
  const lookupKey = String(rhymeTailSignature || '').trim();
  if (!lookupKey) {
    return Object.freeze([]);
  }

  return getTokensByIds(
    verseIR,
    getTokenIdsFromMapIndex(verseIR, 'tokenIdsByRhymeTail', lookupKey)
  );
}

export function getWindowsBySignature(verseIR, signature) {
  const lookupKey = String(signature || '').trim();
  if (!lookupKey) {
    return Object.freeze([]);
  }

  return getWindowsByIds(
    verseIR,
    getTokenIdsFromMapIndex(verseIR, 'windowIdsBySignature', lookupKey)
  );
}

export function getLineTokens(verseIR, lineIndex) {
  const lineTokenIds = Array.isArray(verseIR?.indexes?.tokenIdsByLineIndex)
    ? verseIR.indexes.tokenIdsByLineIndex[Number(lineIndex)] || []
    : [];

  return getTokensByIds(verseIR, lineTokenIds);
}

export function neighborsOf(verseIR, tokenId) {
  const numericTokenId = Number(tokenId);
  const tokens = Array.isArray(verseIR?.tokens) ? verseIR.tokens : [];
  const token = tokens[numericTokenId] || null;
  const neighborhoods = Array.isArray(verseIR?.featureTables?.tokenNeighborhoods)
    ? verseIR.featureTables.tokenNeighborhoods
    : [];
  const neighborhood = neighborhoods.find((entry) => Number(entry?.tokenId) === numericTokenId) || null;

  return Object.freeze({
    previous: neighborhood?.prevTokenId == null ? null : tokens[neighborhood.prevTokenId] || null,
    current: token,
    next: neighborhood?.nextTokenId == null ? null : tokens[neighborhood.nextTokenId] || null,
  });
}
