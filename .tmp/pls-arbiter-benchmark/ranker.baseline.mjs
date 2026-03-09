/**
 * Ranker — Combines scores from multiple providers into a final ranked list.
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

  // Build unified score map: token → { rhyme, meter, color, prefix, synonym, validity, democracy, badges }
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
      });
    }
    return candidateMap.get(token);
  };

  // Populate from generator results
  for (const [providerName, results] of Object.entries(generatorResults)) {
    for (const r of results) {
      const entry = ensureEntry(r.token);
      entry.scores[providerName] = r.score;
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
      // Check badge thresholds
      const threshold = BADGE_THRESHOLDS[providerName];
      if (threshold && entry.scores[providerName] >= threshold) {
        const badgeName = providerName.toUpperCase();
        if (!entry.badges.includes(badgeName)) entry.badges.push(badgeName);
      }
    }
  }

  // Compute final scores and build ghost lines
  const currentLineText = (context?.currentLineWords || []).join(' ');
  const ranked = [];

  for (const entry of candidateMap.values()) {
    const finalScore =
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
      score: finalScore,
      scores: { ...entry.scores },
      badges: entry.badges,
      ghostLine,
    });
  }

  // Sort: finalScore desc → badge count desc → alphabetical
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.badges.length !== a.badges.length) return b.badges.length - a.badges.length;
    return a.token.localeCompare(b.token);
  });

  return ranked.slice(0, limit);
}

export { DEFAULT_WEIGHTS };
