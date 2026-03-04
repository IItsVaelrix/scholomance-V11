/**
 * SynonymProvider - Generator provider.
 * Suggests semantically related words from the dictionary API.
 */
export async function synonymProvider(context, engines) {
  const { prevWord, prefix } = context;
  const { dictionaryAPI } = engines;
  if (!dictionaryAPI || typeof dictionaryAPI.lookup !== 'function') return [];

  const targetWord = prevWord || prefix;
  if (!targetWord || targetWord.length < 2) return [];

  try {
    const result = await dictionaryAPI.lookup(targetWord);
    const synonyms = Array.isArray(result?.synonyms) ? result.synonyms : [];
    if (synonyms.length === 0) return [];

    const prefixUpper = String(prefix || '').toUpperCase();

    return synonyms
      .filter((word) => {
        const tokenUpper = String(word || '').trim().toUpperCase();
        if (!tokenUpper) return false;
        return !prefixUpper || tokenUpper.startsWith(prefixUpper);
      })
      .slice(0, 15)
      .map((word, index) => ({
        token: String(word).toLowerCase(),
        score: Math.max(0.3, 0.8 - (index * 0.03)),
        badge: index < 3 ? 'SYNONYM' : null,
      }));
  } catch (_error) {
    return [];
  }
}
