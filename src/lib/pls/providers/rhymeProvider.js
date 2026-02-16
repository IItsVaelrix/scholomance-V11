/**
 * RhymeProvider — Generator provider.
 * Detects the rhyme target from the previous line's last word,
 * returns candidates scored by rhyme strength.
 */
export function rhymeProvider(context, engines) {
  const { prevLineEndWord } = context;
  if (!prevLineEndWord) return [];

  const { phonemeEngine, rhymeIndex } = engines;
  const targetAnalysis = phonemeEngine.analyzeWord(prevLineEndWord);
  if (!targetAnalysis) return [];

  const targetRhymeKey = targetAnalysis.rhymeKey;
  const targetVowelFamily = targetAnalysis.vowelFamily;
  const targetUpper = String(prevLineEndWord).toUpperCase();
  const prefixUpper = String(context.prefix || '').toUpperCase();

  const seen = new Set();
  const results = [];

  const addCandidate = (entry, score) => {
    if (seen.has(entry.token)) return;
    if (entry.token === targetUpper) return; // don't suggest the target word itself
    if (prefixUpper && !entry.token.startsWith(prefixUpper)) return;
    seen.add(entry.token);
    results.push({
      token: entry.token.toLowerCase(),
      score,
      badge: score >= 0.7 ? 'RHYME' : null,
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

  // Sort by score descending, then frequency
  results.sort((a, b) => b.score - a.score || (b.frequency || 0) - (a.frequency || 0));
  return results;
}
