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
  const w = { ...DEFAULT_WEIGHTS, ...weights };

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
