/**
 * PrefixProvider — Generator provider.
 * Wraps existing Trie prefix prediction and bigram prediction.
 * Normalizes frequency-based scores to [0, 1].
 */
export function prefixProvider(context, engines) {
  const { prefix, prevWord } = context;
  const { trie } = engines;
  if (!trie) return [];

  const limit = 20;
  let words = [];

  if (prefix && prefix.length > 0) {
    words = trie.predict(prefix, limit);
  } else if (prevWord) {
    words = trie.predictNext(prevWord, limit);
  }

  if (words.length === 0) return [];

  // Trie returns words sorted by frequency (highest first).
  // Normalize scores: top word = 1.0, rest scaled relative to it.
  return words.map((word, i) => ({
    token: word.toLowerCase(),
    score: 1.0 - (i / words.length),
    badge: null,
  }));
}
