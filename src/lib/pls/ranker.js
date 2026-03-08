/**
 * Ranker - Combines scores from multiple providers into a final ranked list.
 */

const DEFAULT_WEIGHTS = {
  rhyme: 0.23,
  meter: 0.14,
  color: 0.08,
  prefix: 0.08,
  synonym: 0.08,
  validity: 0.09,
  democracy: 0.15,
  predictability: 0.15,
};

const BADGE_THRESHOLDS = {
  rhyme: 0.7,
  meter: 0.8,
  color: 1.0,
  synonym: 0.5,
  democracy: 0.75,
  predictability: 0.75,
};

const ARBITER_SECOND_PASS = {
  ambiguityThreshold: 0.06,
  maxDelta: 0.08,
  badgeThreshold: 0.75,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toUnitInterval(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function sumWeightValues(weights) {
  return Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function sortRankedCandidates(ranked) {
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.badges.length !== a.badges.length) return b.badges.length - a.badges.length;
    return a.token.localeCompare(b.token);
  });
}

function applyArbiterSecondPass(ranked, context) {
  if (!Array.isArray(ranked) || ranked.length < 2) return ranked;

  const topGap = ranked[0].score - ranked[1].score;
  if (!Number.isFinite(topGap) || topGap > ARBITER_SECOND_PASS.ambiguityThreshold) {
    return ranked;
  }

  const ambiguityFactor = clamp(1 - (topGap / ARBITER_SECOND_PASS.ambiguityThreshold), 0, 1);
  let changed = false;

  for (const candidate of ranked) {
    const arbiter = candidate?.arbiter;
    if (!arbiter || typeof arbiter !== 'object') continue;

    const confidence = toUnitInterval(arbiter.confidence);
    if (confidence <= 0) continue;

    const predictability = toUnitInterval(candidate?.scores?.predictability);
    const lexicalFit = toUnitInterval(arbiter?.signals?.lexicalFit);
    const contextBias = context?.syntaxContext?.role
      ? lexicalFit * 0.18
      : lexicalFit * 0.06;
    const blendedSignal = (predictability * 0.62) + (confidence * 0.38);

    const delta = clamp(
      ambiguityFactor * ((blendedSignal * ARBITER_SECOND_PASS.maxDelta) + (contextBias * 0.02)),
      0,
      ARBITER_SECOND_PASS.maxDelta
    );

    if (delta <= 0) continue;

    candidate.score = clamp(candidate.score + delta, 0, 1);
    candidate.arbiter = {
      ...arbiter,
      secondPass: {
        applied: true,
        ambiguityFactor,
        delta,
      },
    };

    if (confidence >= ARBITER_SECOND_PASS.badgeThreshold && !candidate.badges.includes('ARBITER')) {
      candidate.badges.push('ARBITER');
    }

    changed = true;
  }

  if (changed) {
    sortRankedCandidates(ranked);
  }

  return ranked;
}

/**
 * Dynamically tunes ranker weights using Phonetic feature signals from the
 * panel-analysis pipeline. Adjustment is deterministic and scaled back into
 * the original total weight mass so score magnitudes remain stable.
 *
 * @param {Record<string, number>} baseWeights
 * @param {object} context
 * @returns {Record<string, number>}
 */
export function deriveFeatureAdjustedWeights(baseWeights, context) {
  const features = context?.plsPhoneticFeatures;
  if (!features || typeof features !== 'object') {
    return baseWeights;
  }

  const affinity = toUnitInterval(features.rhymeAffinityScore);
  const density = toUnitInterval(features.constellationDensity);
  const recurrence = toUnitInterval(features.internalRecurrenceScore);
  const novelty = toUnitInterval(features.phoneticNoveltyScore);

  const adjusted = {
    ...baseWeights,
    rhyme: Math.max(
      0,
      (Number(baseWeights.rhyme) || 0) + ((affinity - 0.5) * 0.18) + ((density - 0.5) * 0.07)
    ),
    meter: Math.max(
      0,
      (Number(baseWeights.meter) || 0) + ((recurrence - 0.5) * 0.06)
    ),
    prefix: Math.max(
      0,
      (Number(baseWeights.prefix) || 0) - ((affinity - 0.5) * 0.06)
    ),
    synonym: Math.max(
      0,
      (Number(baseWeights.synonym) || 0) + ((novelty - 0.5) * 0.14)
    ),
    validity: Math.max(
      0,
      (Number(baseWeights.validity) || 0) + ((density - 0.5) * 0.03)
    ),
    democracy: Math.max(
      0,
      (Number(baseWeights.democracy) || 0) + ((affinity - 0.5) * 0.05) + ((recurrence - 0.5) * 0.05)
    ),
    predictability: Math.max(
      0,
      (Number(baseWeights.predictability) || 0) + ((recurrence - 0.5) * 0.12)
    ),
  };

  const targetTotal = sumWeightValues(baseWeights);
  const adjustedTotal = sumWeightValues(adjusted);
  if (adjustedTotal <= 0 || targetTotal <= 0) {
    return baseWeights;
  }

  const scale = targetTotal / adjustedTotal;
  return Object.fromEntries(
    Object.entries(adjusted).map(([key, value]) => [key, (Number(value) || 0) * scale])
  );
}

/**
 * Merge and rank candidates from generator and scorer providers.
 *
 * @param {object} generatorResults - { rhyme: ProviderResult[], prefix: ProviderResult[], synonym?: ProviderResult[] }
 * @param {object} scorerResults - { meter: ScoredResult[], color: ScoredResult[], validity?: ScoredResult[], democracy?: ScoredResult[], predictability?: ScoredResult[] }
 * @param {object} [weights] - Override default weights
 * @param {object} [context] - PLSContext for ghost-line generation
 * @param {number} [limit=10] - Max results to return
 * @returns {ScoredCandidate[]}
 */
export function rankCandidates(generatorResults, scorerResults, weights, context, limit = 10) {
  const baseWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const w = deriveFeatureAdjustedWeights(baseWeights, context);

  // Build unified score map: token -> per-provider scores plus optional arbiter metadata.
  const candidateMap = new Map();

  const ensureEntry = (token) => {
    if (!candidateMap.has(token)) {
      candidateMap.set(token, {
        token,
        scores: {
          rhyme: 0,
          meter: 0,
          color: 0,
          prefix: 0,
          synonym: 0,
          validity: 0,
          democracy: 0,
          predictability: 0,
        },
        badges: [],
        arbiter: null,
      });
    }
    return candidateMap.get(token);
  };

  // Populate from generator results
  for (const [providerName, results] of Object.entries(generatorResults)) {
    for (const r of results) {
      const entry = ensureEntry(r.token);
      entry.scores[providerName] = r.score;
      if (r.arbiter && typeof r.arbiter === 'object') {
        entry.arbiter = r.arbiter;
      }
      if (r.badge && !entry.badges.includes(r.badge)) entry.badges.push(r.badge);
      const threshold = BADGE_THRESHOLDS[providerName];
      if (!r.badge && threshold && r.score >= threshold) {
        const badgeName = providerName.toUpperCase();
        if (!entry.badges.includes(badgeName)) entry.badges.push(badgeName);
      }
    }
  }

  // Populate from scorer results (these re-score existing candidates)
  for (const [providerName, results] of Object.entries(scorerResults)) {
    for (const r of results) {
      const entry = ensureEntry(r.token);
      if (r.scores?.[providerName] !== undefined) {
        entry.scores[providerName] = r.scores[providerName];
      }
      if (r.arbiter && typeof r.arbiter === 'object') {
        entry.arbiter = r.arbiter;
      }
      const threshold = BADGE_THRESHOLDS[providerName];
      if (threshold && entry.scores[providerName] >= threshold) {
        const badgeName = providerName.toUpperCase();
        if (!entry.badges.includes(badgeName)) entry.badges.push(badgeName);
      }
    }
  }

  // Compute first-pass weighted scores and build ghost lines.
  const currentLineText = (context?.currentLineWords || []).join(' ');
  const ranked = [];

  for (const entry of candidateMap.values()) {
    const firstPassScore =
      w.rhyme * entry.scores.rhyme +
      w.meter * entry.scores.meter +
      w.color * entry.scores.color +
      w.prefix * entry.scores.prefix +
      w.synonym * entry.scores.synonym +
      w.validity * entry.scores.validity +
      w.democracy * entry.scores.democracy +
      w.predictability * entry.scores.predictability;

    const ghostLine = currentLineText
      ? `${currentLineText} ${entry.token}`
      : entry.token;

    ranked.push({
      token: entry.token,
      score: firstPassScore,
      scores: { ...entry.scores },
      badges: entry.badges,
      ghostLine,
      ...(entry.arbiter ? { arbiter: { ...entry.arbiter } } : {}),
    });
  }

  // Sort first-pass results.
  sortRankedCandidates(ranked);

  // Second pass: if top results are close, let arbiter confidence resolve ambiguity.
  applyArbiterSecondPass(ranked, context);

  return ranked.slice(0, limit);
}

export { DEFAULT_WEIGHTS };
