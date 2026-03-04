/**
 * RhymeProvider — Generator provider.
 * Detects the rhyme target from the previous line's last word,
 * returns candidates scored by rhyme strength.
 */
export async function rhymeProvider(context, engines) {
  const { prevLineEndWord } = context;
  if (!prevLineEndWord) return [];

  const { phonemeEngine, rhymeIndex, dictionaryAPI } = engines;
  const targetAnalysis = phonemeEngine.analyzeWord(prevLineEndWord);
  if (!targetAnalysis) return [];

  const targetRhymeKey = targetAnalysis.rhymeKey;
  const targetVowelFamily = targetAnalysis.vowelFamily;
  const targetUpper = String(prevLineEndWord).toUpperCase();
  const prefixUpper = String(context.prefix || '').toUpperCase();

  const seen = new Set();
  const results = [];

  const addCandidate = (entry, score) => {
    const tokenUpper = String(entry?.token || '').toUpperCase();
    if (!tokenUpper) return;
    if (seen.has(tokenUpper)) return;
    if (tokenUpper === targetUpper) return; // don't suggest the target word itself
    if (prefixUpper && !tokenUpper.startsWith(prefixUpper)) return;
    seen.add(tokenUpper);
    results.push({
      token: tokenUpper.toLowerCase(),
      score,
      badge: score >= 0.7 ? 'RHYME' : null,
      frequency: Number(entry?.frequency) || 0,
    });
  };

  // 1. Exact rhyme key matches (perfect rhyme)
  const exactMatches = rhymeIndex.getByRhymeKey(targetRhymeKey);
  for (const entry of exactMatches) {
    addCandidate(entry, 1.0);
  }

  // 2. Same vowel family (slant/assonance rhyme)
  const familyMatches = rhymeIndex.getByVowelFamily(targetVowelFamily);
  for (const entry of familyMatches) {
    if (seen.has(entry.token)) continue;
    // Score based on whether codas are related
    const candidateAnalysis = phonemeEngine.analyzeWord(entry.token);
    if (!candidateAnalysis) continue;

    let score = 0.5; // base assonance score
    if (candidateAnalysis.coda && targetAnalysis.coda) {
      // Check coda mutation (phonetically related codas)
      if (phonemeEngine.checkCodaMutation(candidateAnalysis.coda, targetAnalysis.coda)) {
        score = 0.75;
      }
    } else if (!candidateAnalysis.coda && !targetAnalysis.coda) {
      // Both open syllables — stronger match
      score = 0.7;
    }

    addCandidate(entry, score);
  }

  // 3. Dictionary-backed rhyme supplementation (optional)
  if (dictionaryAPI && typeof dictionaryAPI.lookup === 'function') {
    try {
      const apiResult = await dictionaryAPI.lookup(prevLineEndWord);
      const dbRhymes = Array.isArray(apiResult?.rhymes) ? apiResult.rhymes : [];

      for (const word of dbRhymes.slice(0, 30)) {
        const upper = String(word || '').trim().toUpperCase();
        if (!upper || seen.has(upper) || upper === targetUpper) continue;
        if (prefixUpper && !upper.startsWith(prefixUpper)) continue;

        let score = 0.6; // base DB rhyme score
        const candidateAnalysis = phonemeEngine.analyzeWord(upper);
        if (candidateAnalysis) {
          if (candidateAnalysis.rhymeKey === targetRhymeKey) score = 0.95;
          else if (candidateAnalysis.vowelFamily === targetVowelFamily) score = 0.75;
        }

        addCandidate({ token: upper, frequency: 0 }, score);
      }
    } catch (_error) {
      // Dictionary unavailable - local rhyme index results are still returned.
    }
  }

  // Sort by score descending, then frequency
  results.sort((a, b) => b.score - a.score || (b.frequency || 0) - (a.frequency || 0));
  return results.map(({ frequency: _frequency, ...candidate }) => candidate);
}
