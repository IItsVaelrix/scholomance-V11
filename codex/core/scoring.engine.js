/**
 * The CODEx Scoring Engine.
 * Factory-based: call createScoringEngine(heuristics) to get an isolated instance.
 * Each instance encapsulates its own heuristic registry.
 *
 * @see AI_Architecture_V2.md section 3.3 and 5.2
 */

/**
 * Creates a new scoring engine instance with encapsulated state.
 * @param {Array<{name: string, scorer: function(string): import('./schemas').ScoreTrace, weight: number}>} [initialHeuristics=[]]
 * @returns {{ calculateScore: function(string): {totalScore: number, traces: import('./schemas').ScoreTrace[]}, registerHeuristic: function, reset: function, getHeuristics: function }}
 */
export function createScoringEngine(initialHeuristics = []) {
  const heuristics = [...initialHeuristics];

  function registerHeuristic(heuristic) {
    heuristics.push(heuristic);
  }

  function calculateScore(line) {
    if (!line) {
      return { totalScore: 0, traces: [] };
    }

    const traces = heuristics.map((h) => {
      const raw = h.scorer(line);
      return {
        ...raw,
        weight: h.weight,
        contribution: raw.rawScore * h.weight * 100,
      };
    });

    const totalScore = traces.reduce((sum, t) => sum + t.contribution, 0);

    return {
      totalScore: Math.round(totalScore),
      traces,
    };
  }

  function reset() {
    heuristics.length = 0;
  }

  function getHeuristics() {
    return [...heuristics];
  }

  return { calculateScore, registerHeuristic, reset, getHeuristics };
}
