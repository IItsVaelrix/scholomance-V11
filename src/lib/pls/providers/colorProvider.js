import { normalizeVowelFamily } from '../../phonology/vowelFamily.js';
import {
  buildVerseIrColorCentroid,
  scoreVerseIrColorAlignment,
} from '../../truesight/color/pcaChroma.js';
import { resolvePlsVerseIRState } from '../verseIRBridge.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function resolveColorFamily(value) {
  const raw = String(value || '').trim().toUpperCase();
  return raw || normalizeVowelFamily(value || '');
}

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
      const family = resolveColorFamily(id);
      const safeCount = Number(count) || 0;
      if (!family || safeCount <= 0) return;
      familyCounts.set(family, (familyCounts.get(family) || 0) + safeCount);
    });
  }

  if (familyCounts.size === 0) {
    for (const word of (currentLineWords || [])) {
      const analysis = phonemeEngine.analyzeWord(word);
      if (!analysis) continue;
      const family = resolveColorFamily(analysis.vowelFamily);
      if (family) familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }
  }

  if (familyCounts.size === 0) return candidates;

  const totalFamilyWeight = [...familyCounts.values()].reduce((sum, count) => sum + count, 0);
  const centroid = buildVerseIrColorCentroid(
    [...familyCounts.entries()].map(([family, weight]) => ({ family, weight }))
  );
  if (!centroid) return candidates;

  return candidates.map((candidate) => {
    const analysis = phonemeEngine.analyzeWord(candidate.token);
    const candidateFamily = resolveColorFamily(analysis?.vowelFamily || '');
    if (!candidateFamily) {
      return {
        ...candidate,
        scores: { ...candidate.scores, color: 0 },
      };
    }

    const centroidScore = scoreVerseIrColorAlignment(candidateFamily, centroid);
    const familyShare = totalFamilyWeight > 0
      ? ((familyCounts.get(candidateFamily) || 0) / totalFamilyWeight)
      : 0;
    const score = clamp01((centroidScore * 0.82) + (familyShare * 0.18) + (familyCounts.has(candidateFamily) ? 0.12 : 0));

    return {
      ...candidate,
      scores: { ...candidate.scores, color: score },
      badge: score >= 0.78 ? 'COLOR' : (candidate.badge || null),
    };
  });
}
