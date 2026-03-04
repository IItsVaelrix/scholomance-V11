/**
 * ValidityProvider - Scorer provider.
 * Boosts candidates that exist in the dictionary lexicon.
 */
export async function validityProvider(_context, engines, candidates) {
  const { dictionaryAPI } = engines;
  if (!dictionaryAPI || typeof dictionaryAPI.validateBatch !== 'function' || candidates.length === 0) {
    return candidates;
  }

  const words = candidates.map((candidate) => candidate.token);

  try {
    const validWords = await dictionaryAPI.validateBatch(words);
    const knownWords = new Set((Array.isArray(validWords) ? validWords : []).map((word) => String(word).toLowerCase()));

    return candidates.map((candidate) => {
      const isKnown = knownWords.has(String(candidate.token).toLowerCase());
      return {
        ...candidate,
        scores: {
          ...candidate.scores,
          validity: isKnown ? 1.0 : 0.2,
        },
      };
    });
  } catch (_error) {
    // API down - keep candidates unchanged.
    return candidates;
  }
}
