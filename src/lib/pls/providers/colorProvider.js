import { normalizeVowelFamily } from '../../vowelFamily.js';

/**
 * ColorProvider — Scorer provider.
 * Scores candidates by vowel family continuity with the current line.
 */
export function colorProvider(context, engines, candidates) {
  const { currentLineWords } = context;
  const { phonemeEngine } = engines;
  if (!phonemeEngine || candidates.length === 0) return candidates;

  // Find dominant vowel family on the current line
  const familyCounts = new Map();
  for (const word of (currentLineWords || [])) {
    const analysis = phonemeEngine.analyzeWord(word);
    if (!analysis) continue;
    const family = normalizeVowelFamily(analysis.vowelFamily);
    if (family) familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
  }

  // No vowel context — can't score
  if (familyCounts.size === 0) return candidates;

  // Dominant family = most frequent
  let dominantFamily = '';
  let maxCount = 0;
  for (const [family, count] of familyCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantFamily = family;
    }
  }

  return candidates.map(c => {
    const analysis = phonemeEngine.analyzeWord(c.token);
    const candidateFamily = normalizeVowelFamily(analysis?.vowelFamily || '');

    let score = 0;
    if (candidateFamily === dominantFamily) {
      score = 1.0;
    } else if (familyCounts.has(candidateFamily)) {
      // Matches a non-dominant family on the line
      score = 0.5;
    }

    return {
      ...c,
      scores: { ...c.scores, color: score },
      badge: score >= 1.0 ? 'COLOR' : (c.badge || null),
    };
  });
}
