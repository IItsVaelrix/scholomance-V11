import { commonElementAmplifier } from './plugins/commonElements.js';
import { rareElementAmplifier } from './plugins/rareElements.js';
import { inexplicableElementAmplifier } from './plugins/inexplicableElements.js';
import {
  clamp01,
  roundTo,
  VERSEIR_AMPLIFIER_NOVELTY_BUDGET,
  VERSEIR_AMPLIFIER_VERSION,
} from './shared.js';

export const DEFAULT_VERSEIR_AMPLIFIERS = Object.freeze([
  commonElementAmplifier,
  rareElementAmplifier,
  inexplicableElementAmplifier,
]);

function freezeMatchesByTier(results) {
  return Object.freeze({
    common: Object.freeze(results.find((result) => result.tier === 'COMMON')?.matches || []),
    rare: Object.freeze(results.find((result) => result.tier === 'RARE')?.matches || []),
    inexplicable: Object.freeze(results.find((result) => result.tier === 'INEXPLICABLE')?.matches || []),
  });
}

function mergeArchetypes(results, precisionScalar) {
  const aggregate = new Map();

  for (const result of results) {
    const dampedSignal = clamp01((Number(result?.signal) || 0) * precisionScalar);
    const archetypes = Array.isArray(result?.archetypes) ? result.archetypes : [];
    for (const archetype of archetypes) {
      if (!archetype?.id || !archetype?.label) continue;
      const existing = aggregate.get(archetype.id) || {
        id: archetype.id,
        label: archetype.label,
        score: 0,
      };
      existing.score += dampedSignal * clamp01(archetype.score);
      aggregate.set(archetype.id, existing);
    }
  }

  return Object.freeze(
    [...aggregate.values()]
      .map((entry) => Object.freeze({
        ...entry,
        score: roundTo(clamp01(entry.score)),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 6)
  );
}

function determineDominantTier(matchesByTier) {
  if ((matchesByTier.inexplicable?.[0]?.score || 0) > 0) return 'INEXPLICABLE';
  if ((matchesByTier.rare?.[0]?.score || 0) > 0) return 'RARE';
  if ((matchesByTier.common?.[0]?.score || 0) > 0) return 'COMMON';
  return 'NONE';
}

function collectDiagnostics(results) {
  return Object.freeze(
    results
      .flatMap((result) => Array.isArray(result?.diagnostics) ? result.diagnostics : [])
      .slice(0, 8)
  );
}

export async function runVerseIRAmplifiers(verseIR, options = {}) {
  const amplifiers = Array.isArray(options?.amplifiers) && options.amplifiers.length > 0
    ? options.amplifiers
    : DEFAULT_VERSEIR_AMPLIFIERS;

  const precisionScalar = roundTo(Math.pow(0.9, amplifiers.length));
  const latencyMultiplier = roundTo(1 + (Math.max(0, amplifiers.length - 1) * 0.18));

  const results = Object.freeze(
    await Promise.all(
      amplifiers.map(async (amplifier) => {
        const rawResult = await amplifier.analyze({ verseIR, options });
        const effectiveSignal = clamp01((Number(rawResult?.signal) || 0) * precisionScalar);
        const effectiveSemanticDepth = clamp01((Number(rawResult?.semanticDepth) || 0) * precisionScalar);
        const effectiveRaritySignal = clamp01((Number(rawResult?.raritySignal) || 0) * precisionScalar);
        return Object.freeze({
          ...rawResult,
          claimedWeight: roundTo(Number(rawResult?.claimedWeight) || 0),
          effectiveSignal: roundTo(effectiveSignal),
          effectiveSemanticDepth: roundTo(effectiveSemanticDepth),
          effectiveRaritySignal: roundTo(effectiveRaritySignal),
          matches: Object.freeze(Array.isArray(rawResult?.matches) ? rawResult.matches : []),
          archetypes: Object.freeze(Array.isArray(rawResult?.archetypes) ? rawResult.archetypes : []),
          diagnostics: Object.freeze(Array.isArray(rawResult?.diagnostics) ? rawResult.diagnostics : []),
        });
      })
    )
  );

  const claimedWeight = roundTo(Math.min(
    VERSEIR_AMPLIFIER_NOVELTY_BUDGET,
    results.reduce((sum, result) => sum + (Number(result?.claimedWeight) || 0), 0)
  ));
  const noveltySignal = claimedWeight > 0
    ? clamp01(
      results.reduce((sum, result) => sum + ((Number(result?.effectiveSignal) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;
  const semanticDepth = claimedWeight > 0
    ? clamp01(
      results.reduce((sum, result) => sum + ((Number(result?.effectiveSemanticDepth) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;
  const raritySignal = claimedWeight > 0
    ? clamp01(
      results.reduce((sum, result) => sum + ((Number(result?.effectiveRaritySignal) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;

  const matchesByTier = freezeMatchesByTier(results);
  const archetypeResonance = mergeArchetypes(results, precisionScalar);
  const dominantArchetype = archetypeResonance[0] || null;

  return Object.freeze({
    version: VERSEIR_AMPLIFIER_VERSION,
    activeAmplifiers: amplifiers.length,
    noveltyBudget: VERSEIR_AMPLIFIER_NOVELTY_BUDGET,
    claimedWeight,
    precisionScalar,
    latencyMultiplier,
    noveltySignal: roundTo(noveltySignal),
    semanticDepth: roundTo(semanticDepth),
    raritySignal: roundTo(raritySignal),
    impactMultiplier: roundTo(1 + (noveltySignal * semanticDepth * 0.12)),
    dominantTier: determineDominantTier(matchesByTier),
    dominantArchetype,
    archetypeResonance,
    elementMatches: matchesByTier,
    diagnostics: collectDiagnostics(results),
    amplifiers: results,
  });
}

export async function enhanceVerseIR(verseIR, options = {}) {
  if (!verseIR || typeof verseIR !== 'object') {
    return verseIR;
  }

  if (verseIR?.verseIRAmplifier && typeof verseIR.verseIRAmplifier === 'object') {
    return verseIR;
  }

  const verseIRAmplifier = await runVerseIRAmplifiers(verseIR, options);

  return Object.freeze({
    ...verseIR,
    semanticDepth: verseIRAmplifier.semanticDepth,
    archetypeResonance: verseIRAmplifier.archetypeResonance,
    elementMatches: verseIRAmplifier.elementMatches,
    verseIRAmplifier,
  });
}

export function attachVerseIRAmplifier(analyzedDoc, verseIRAmplifier) {
  if (!analyzedDoc || typeof analyzedDoc !== 'object' || !verseIRAmplifier || typeof verseIRAmplifier !== 'object') {
    return analyzedDoc;
  }

  return {
    ...analyzedDoc,
    parsed: {
      ...(analyzedDoc.parsed && typeof analyzedDoc.parsed === 'object' ? analyzedDoc.parsed : {}),
      verseIRAmplifier,
    },
  };
}
