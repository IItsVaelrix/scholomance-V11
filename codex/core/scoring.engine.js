/**
 * The CODEx Scoring Engine.
 * Factory-based: call createScoringEngine(heuristics) to get an isolated instance.
 * Each instance encapsulates its own heuristic registry.
 *
 * @see AI_Architecture_V2.md section 3.3 and 5.2
 */

import { analyzeText } from './analysis.pipeline.js';

/**
 * Creates a new scoring engine instance with encapsulated state.
 * @param {Array<{name: string, scorer: function(import('./schemas').AnalyzedDocument): import('./schemas').ScoreTrace, weight: number}>} [initialHeuristics=[]]
 * @returns {{ calculateScore: function(string|import('./schemas').AnalyzedDocument): {totalScore: number, traces: import('./schemas').ScoreTrace[]}, registerHeuristic: function, reset: function, getHeuristics: function }}
 */
export function createScoringEngine(initialHeuristics = []) {
  const heuristics = [...initialHeuristics];

  function registerHeuristic(heuristic) {
    heuristics.push(heuristic);
  }

  async function calculateScore(input) {
    if (!input) {
      return { totalScore: 0, traces: [] };
    }

    /** @type {import('./schemas').AnalyzedDocument} */
    let doc;
    if (typeof input === 'string') {
      doc = analyzeText(input);
    } else {
      doc = input;
    }

    if (!doc.stats || doc.stats.wordCount === 0) {
       // Return early if empty doc, but run heuristics if they handle empty docs?
       // Most will fail or return 0. Let's let them run but they expect a doc.
    }

    const traces = await Promise.all(heuristics.map(async (h) => {
      const raw = await h.scorer(doc);
      return {
        ...raw,
        weight: h.weight,
        contribution: raw.rawScore * h.weight * 100,
      };
    }));

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
