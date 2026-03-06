/**
 * RhymeProvider — Generator provider.
 * Detects the rhyme target from the previous line's last word,
 * returns candidates scored by rhyme strength.
 */
export async function rhymeProvider(context, engines) {
  const { prevLineEndWord, prevWord } = context;
  if (!prevLineEndWord) return [];

  const { phonemeEngine, rhymeIndex, dictionaryAPI, trie } = engines;
  const targetAnalysis = phonemeEngine.analyzeWord(prevLineEndWord);
  if (!targetAnalysis) return [];

  const targetRhymeKey = targetAnalysis.rhymeKey;
  const targetVowelFamily = targetAnalysis.vowelFamily;
  const targetUpper = String(prevLineEndWord).toUpperCase();
  const prefixUpper = String(context.prefix || '').toUpperCase();
  const prevWordLower = String(prevWord || '').toLowerCase();

  const buildRankMap = (words = []) => {
    const out = new Map();
    const total = words.length || 1;
    words.forEach((token, index) => {
      const normalized = String(token || '').toUpperCase();
      if (!normalized || out.has(normalized)) return;
      out.set(normalized, Math.max(0, 1 - (index / total)));
    });
    return out;
  };

  const sequentialRankMap = (trie && prevWordLower && typeof trie.predictNext === 'function')
    ? buildRankMap(trie.predictNext(prevWordLower, 40))
    : new Map();

  const seen = new Set();
  const results = [];
  let maxFrequency = 1;

  const addCandidate = (entry, baseScore) => {
    const tokenUpper = String(entry?.token || '').toUpperCase();
    if (!tokenUpper) return;
    if (seen.has(tokenUpper)) return;
    if (tokenUpper === targetUpper) return; // don't suggest the target word itself
    if (prefixUpper && !tokenUpper.startsWith(prefixUpper)) return;

    const frequency = Number(entry?.frequency) || 0;
    const frequencySignal = Math.log10(frequency + 1.1) / Math.log10(maxFrequency + 1.1);
    const sequentialSignal = sequentialRankMap.get(tokenUpper) || 0;
    const score = Math.max(
      0,
      Math.min(1, (baseScore * 0.76) + (sequentialSignal * 0.17) + (frequencySignal * 0.07))
    );

    seen.add(tokenUpper);
    results.push({
      token: tokenUpper.toLowerCase(),
      score,
      badge: score >= 0.7 ? 'RHYME' : null,
      frequency,
    });
  };

  // 1. Exact rhyme key matches (perfect rhyme)
  const exactMatches = rhymeIndex.getByRhymeKey(targetRhymeKey);
  maxFrequency = Math.max(
    maxFrequency,
    ...exactMatches.map((entry) => Number(entry?.frequency) || 0)
  );
  for (const entry of exactMatches) {
    addCandidate(entry, 1.0);
  }

  // 2. Same vowel family (slant/assonance rhyme)
  const familyMatches = rhymeIndex.getByVowelFamily(targetVowelFamily);
  maxFrequency = Math.max(
    maxFrequency,
    ...familyMatches.map((entry) => Number(entry?.frequency) || 0)
  );
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
