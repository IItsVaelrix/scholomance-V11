import { commonElementAmplifier } from './plugins/commonElements.js';
import { rareElementAmplifier } from './plugins/rareElements.js';
import { inexplicableElementAmplifier } from './plugins/inexplicableElements.js';
import {
  clamp01,
  createAmplifierDiagnostic,
  createAmplifierResult,
  normalizeAmplifierTier,
  roundTo,
  VERSEIR_AMPLIFIER_NOVELTY_BUDGET,
  VERSEIR_AMPLIFIER_VERSION,
} from './shared.js';

const MIN_PRECISION_SCALAR = 0.72;
const PRECISION_DECAY_PER_ACTIVE_AMPLIFIER = 0.08;
const MAX_MATCHES_PER_TIER = 6;
const MAX_DIAGNOSTICS = 8;

export const DEFAULT_VERSEIR_AMPLIFIERS = Object.freeze([
  commonElementAmplifier,
  rareElementAmplifier,
  inexplicableElementAmplifier,
]);

function getAmplifierId(amplifier, index) {
  const resolved = String(amplifier?.id || amplifier?.label || '').trim();
  return resolved || `verseir_amplifier_${index + 1}`;
}

function createTimeoutError(amplifierId, timeoutMs) {
  const error = new Error(`${amplifierId} exceeded the ${timeoutMs}ms execution budget.`);
  error.code = 'VERSEIR_AMPLIFIER_TIMEOUT';
  error.amplifierId = amplifierId;
  error.timeoutMs = timeoutMs;
  return error;
}

function hasScopedOption(config, amplifierId) {
  if (!config) return false;
  if (config instanceof Map) return config.has(amplifierId);
  if (typeof config === 'object') {
    return Object.prototype.hasOwnProperty.call(config, amplifierId);
  }
  return false;
}

function readScopedOption(config, amplifierId) {
  if (!config) return undefined;
  if (config instanceof Map) return config.get(amplifierId);
  if (typeof config === 'object') return config[amplifierId];
  return undefined;
}

function resolveAmplifierTimeoutMs(options, amplifierId) {
  const scopedTimeout = hasScopedOption(options?.amplifierTimeouts, amplifierId)
    ? readScopedOption(options?.amplifierTimeouts, amplifierId)
    : options?.timeoutMs ?? options?.amplifierTimeoutMs;
  const numericTimeout = Number(scopedTimeout);
  return Number.isFinite(numericTimeout) && numericTimeout > 0 ? numericTimeout : null;
}

function withAmplifierTimeout(task, amplifierId, timeoutMs) {
  if (!timeoutMs) {
    return Promise.resolve().then(task);
  }

  let timeoutHandle;
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(createTimeoutError(amplifierId, timeoutMs)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}

function normalizeAmplifierMatch(match) {
  const id = String(match?.id || '').trim();
  const label = String(match?.label || match?.id || '').trim();
  if (!id || !label) return null;

  return Object.freeze({
    id,
    label,
    hits: Math.max(0, Math.round(Number(match?.hits) || 0)),
    score: roundTo(clamp01(Number(match?.score) || 0)),
    coverage: roundTo(clamp01(Number(match?.coverage) || 0)),
    lineSpread: roundTo(clamp01(Number(match?.lineSpread) || 0)),
    tokens: Object.freeze(
      [...new Set(
        (Array.isArray(match?.tokens) ? match.tokens : [])
          .map((token) => String(token || '').trim())
          .filter(Boolean)
      )]
    ),
  });
}

function normalizeAmplifierArchetype(archetype) {
  const id = String(archetype?.id || '').trim();
  const label = String(archetype?.label || archetype?.id || '').trim();
  if (!id || !label) return null;

  return Object.freeze({
    id,
    label,
    score: roundTo(clamp01(Number(archetype?.score) || 0)),
  });
}

function normalizeAmplifierDiagnostics(diagnostics, amplifierId) {
  return Object.freeze(
    (Array.isArray(diagnostics) ? diagnostics : [])
      .map((diagnostic) => createAmplifierDiagnostic({
        message: diagnostic?.message,
        severity: diagnostic?.severity,
        source: diagnostic?.source || `verseir_amplifier:${amplifierId}`,
        metadata: diagnostic?.metadata,
      }))
      .slice(0, MAX_DIAGNOSTICS)
  );
}

function sortMatches(matches) {
  return matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.hits !== left.hits) return right.hits - left.hits;
    return left.label.localeCompare(right.label);
  });
}

function sortArchetypes(archetypes) {
  return archetypes.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.label.localeCompare(right.label);
  });
}

function createExecutionFailureResult(amplifier, index, message, code, metadata = {}) {
  const amplifierId = getAmplifierId(amplifier, index);
  const amplifierLabel = String(amplifier?.label || amplifierId).trim();

  return createAmplifierResult({
    id: amplifierId,
    label: amplifierLabel,
    tier: normalizeAmplifierTier(amplifier?.tier),
    claimedWeight: Number(amplifier?.claimedWeight) || 0,
    diagnostics: [
      createAmplifierDiagnostic({
        message,
        severity: 'error',
        source: `verseir_amplifier:${amplifierId}`,
        metadata: {
          amplifierId,
          code,
          ...metadata,
        },
      }),
    ],
    commentary: `${amplifierLabel} could not stabilize its signal.`,
  });
}

function normalizeAmplifierResult(rawResult, amplifier, index) {
  if (!rawResult || typeof rawResult !== 'object') {
    return createExecutionFailureResult(
      amplifier,
      index,
      `${String(amplifier?.label || getAmplifierId(amplifier, index)).trim()} returned an invalid payload.`,
      'VERSEIR_AMPLIFIER_INVALID_PAYLOAD'
    );
  }

  const amplifierId = getAmplifierId(rawResult?.id ? rawResult : amplifier, index);
  const amplifierLabel = String(rawResult?.label || amplifier?.label || amplifierId).trim();
  const matches = sortMatches(
    (Array.isArray(rawResult?.matches) ? rawResult.matches : [])
      .map(normalizeAmplifierMatch)
      .filter(Boolean)
  ).slice(0, MAX_MATCHES_PER_TIER);
  const archetypes = sortArchetypes(
    (Array.isArray(rawResult?.archetypes) ? rawResult.archetypes : [])
      .map(normalizeAmplifierArchetype)
      .filter(Boolean)
  ).slice(0, MAX_MATCHES_PER_TIER);

  return createAmplifierResult({
    id: amplifierId,
    label: amplifierLabel,
    tier: normalizeAmplifierTier(rawResult?.tier || amplifier?.tier),
    claimedWeight: Number(rawResult?.claimedWeight ?? amplifier?.claimedWeight) || 0,
    signal: rawResult?.signal,
    semanticDepth: rawResult?.semanticDepth,
    raritySignal: rawResult?.raritySignal,
    matches,
    archetypes,
    diagnostics: normalizeAmplifierDiagnostics(rawResult?.diagnostics, amplifierId),
    commentary: String(rawResult?.commentary || `${amplifierLabel} found no viable signal.`),
  });
}

function freezeMatchesByTier(results) {
  const common = [];
  const rare = [];
  const inexplicable = [];

  for (const result of results) {
    const target = result?.tier === 'INEXPLICABLE'
      ? inexplicable
      : result?.tier === 'RARE'
        ? rare
        : common;
    if (Array.isArray(result?.matches)) {
      target.push(...result.matches);
    }
  }

  return Object.freeze({
    common: Object.freeze(sortMatches(common).slice(0, MAX_MATCHES_PER_TIER)),
    rare: Object.freeze(sortMatches(rare).slice(0, MAX_MATCHES_PER_TIER)),
    inexplicable: Object.freeze(sortMatches(inexplicable).slice(0, MAX_MATCHES_PER_TIER)),
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
    sortArchetypes(
      [...aggregate.values()].map((entry) => Object.freeze({
        ...entry,
        score: roundTo(clamp01(entry.score)),
      }))
    ).slice(0, 6)
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
      .slice(0, MAX_DIAGNOSTICS)
  );
}

function isAmplifierActive(result) {
  return (Number(result?.signal) || 0) > 0 || (Array.isArray(result?.matches) && result.matches.length > 0);
}

function computePrecisionScalar(activeAmplifiers) {
  if (activeAmplifiers <= 1) return 1;
  return roundTo(Math.max(
    MIN_PRECISION_SCALAR,
    1 - ((activeAmplifiers - 1) * PRECISION_DECAY_PER_ACTIVE_AMPLIFIER)
  ));
}

async function executeAmplifier(amplifier, verseIR, options, index) {
  if (!amplifier || typeof amplifier.analyze !== 'function') {
    return createExecutionFailureResult(
      amplifier,
      index,
      `${getAmplifierId(amplifier, index)} is missing an analyze() function.`,
      'VERSEIR_AMPLIFIER_INVALID_PLUGIN'
    );
  }

  const amplifierId = getAmplifierId(amplifier, index);

  try {
    const rawResult = await withAmplifierTimeout(
      () => amplifier.analyze({ verseIR, options }),
      amplifierId,
      resolveAmplifierTimeoutMs(options, amplifierId)
    );
    return normalizeAmplifierResult(rawResult, amplifier, index);
  } catch (error) {
    const code = error?.code || 'VERSEIR_AMPLIFIER_EXECUTION_FAILED';
    const message = code === 'VERSEIR_AMPLIFIER_TIMEOUT'
      ? `${String(amplifier?.label || amplifierId).trim()} timed out before it could resolve.`
      : `${String(amplifier?.label || amplifierId).trim()} failed during execution.`;
    return createExecutionFailureResult(amplifier, index, message, code, {
      error: String(error?.message || error || 'unknown error'),
      timeoutMs: Number(error?.timeoutMs) || undefined,
    });
  }
}

export async function runVerseIRAmplifiers(verseIR, options = {}) {
  const amplifiers = Array.isArray(options?.amplifiers) && options.amplifiers.length > 0
    ? options.amplifiers
    : DEFAULT_VERSEIR_AMPLIFIERS;
  const latencyMultiplier = roundTo(1 + (Math.max(0, amplifiers.length - 1) * 0.18));
  const normalizedResults = Object.freeze(
    await Promise.all(
      amplifiers.map((amplifier, index) => executeAmplifier(amplifier, verseIR, options, index))
    )
  );
  const activeAmplifiers = normalizedResults.filter(isAmplifierActive).length;
  const precisionScalar = computePrecisionScalar(activeAmplifiers);
  const results = Object.freeze(
    normalizedResults.map((rawResult) => {
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
  );

  const weightedResults = results.filter((result) => isAmplifierActive(result) && (Number(result?.claimedWeight) || 0) > 0);
  const claimedWeight = roundTo(Math.min(
    VERSEIR_AMPLIFIER_NOVELTY_BUDGET,
    weightedResults.reduce((sum, result) => sum + (Number(result?.claimedWeight) || 0), 0)
  ));
  const noveltySignal = claimedWeight > 0
    ? clamp01(
      weightedResults.reduce((sum, result) => sum + ((Number(result?.effectiveSignal) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;
  const semanticDepth = claimedWeight > 0
    ? clamp01(
      weightedResults.reduce((sum, result) => sum + ((Number(result?.effectiveSemanticDepth) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;
  const raritySignal = claimedWeight > 0
    ? clamp01(
      weightedResults.reduce((sum, result) => sum + ((Number(result?.effectiveRaritySignal) || 0) * (Number(result?.claimedWeight) || 0)), 0)
      / claimedWeight
    )
    : 0;

  const matchesByTier = freezeMatchesByTier(results);
  const archetypeResonance = mergeArchetypes(results, precisionScalar);
  const dominantArchetype = archetypeResonance[0] || null;

  return Object.freeze({
    version: VERSEIR_AMPLIFIER_VERSION,
    activeAmplifiers,
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
