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
  const queryLimit = 50;
  const normalizedPrefix = String(prefix || '').toLowerCase();
  const normalizedPrevWord = String(prevWord || '').toLowerCase();
  const hasPrefix = normalizedPrefix.length > 0;
  const hasPrevWord = normalizedPrevWord.length > 0;

  const prefixWords = hasPrefix
    ? (trie.predict(normalizedPrefix, queryLimit) || [])
    : [];
  const nextWordsRaw = hasPrevWord
    ? (trie.predictNext(normalizedPrevWord, queryLimit) || [])
    : [];
  const nextWords = hasPrefix
    ? nextWordsRaw.filter((word) => String(word || '').toLowerCase().startsWith(normalizedPrefix))
    : nextWordsRaw;

  if (prefixWords.length === 0 && nextWords.length === 0) return [];

  const scoreByToken = new Map();
  const applyScore = (token, score) => {
    if (!token) return;
    const normalizedToken = String(token).toLowerCase();
    if (!normalizedToken) return;
    const current = scoreByToken.get(normalizedToken) || 0;
    if (score > current) {
      scoreByToken.set(normalizedToken, score);
    }
  };

  if (prefixWords.length > 0) {
    prefixWords.forEach((word, index) => {
      const rankScore = 1 - (index / Math.max(prefixWords.length, 1));
      applyScore(word, rankScore);
    });
  }

  if (nextWords.length > 0) {
    nextWords.forEach((word, index) => {
      const sequentialScore = 1 - (index / Math.max(nextWords.length, 1));
      const current = scoreByToken.get(String(word).toLowerCase()) || 0;
      // Blend prefix and sequential evidence when both are available.
      const merged = hasPrefix
        ? ((current * 0.58) + (sequentialScore * 0.42))
        : sequentialScore;
      applyScore(word, merged);
    });
  }

  return [...scoreByToken.entries()]
    .map(([token, score]) => ({ token, score, badge: null }))
    .sort((a, b) => b.score - a.score || a.token.localeCompare(b.token))
    .slice(0, limit);
}
