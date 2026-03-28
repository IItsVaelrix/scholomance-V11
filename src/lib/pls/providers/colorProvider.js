import { normalizeVowelFamily } from '../../phonology/vowelFamily.js';
import { resolvePlsVerseIRState } from '../verseIRBridge.js';

/**
 * ColorProvider — Scorer provider.
 * Scores candidates by vowel family continuity with the current line.
 */
export function colorProvider(context, engines, candidates) {
  const { currentLineWords } = context;
  const { phonemeEngine } = engines;
  if (!phonemeEngine || candidates.length === 0) return candidates;

  const familyCounts = new Map();
  const verseIRState = resolvePlsVerseIRState(context);
  const verseIRLine = verseIRState?.currentLine || null;

  if (Array.isArray(verseIRLine?.vowelFamilies) && verseIRLine.vowelFamilies.length > 0) {
    verseIRLine.vowelFamilies.forEach(({ id, count }) => {
      const family = normalizeVowelFamily(id);
      const safeCount = Number(count) || 0;
      if (!family || safeCount <= 0) return;
      familyCounts.set(family, (familyCounts.get(family) || 0) + safeCount);
    });
  }

  if (familyCounts.size === 0) {
    for (const word of (currentLineWords || [])) {
      const analysis = phonemeEngine.analyzeWord(word);
      if (!analysis) continue;
      const family = normalizeVowelFamily(analysis.vowelFamily);
      if (family) familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }
  }

  if (familyCounts.size === 0) return candidates;

  let dominantFamily = '';
  let maxCount = 0;
  for (const [family, count] of familyCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantFamily = family;
    }
  }

  return candidates.map((candidate) => {
    const analysis = phonemeEngine.analyzeWord(candidate.token);
    const candidateFamily = normalizeVowelFamily(analysis?.vowelFamily || '');

    let score = 0;
    if (candidateFamily === dominantFamily) {
      score = 1.0;
    } else if (familyCounts.has(candidateFamily)) {
      score = 0.5;
    }

    return {
      ...candidate,
      scores: { ...candidate.scores, color: score },
      badge: score >= 1.0 ? 'COLOR' : (candidate.badge || null),
    };
  });
}
