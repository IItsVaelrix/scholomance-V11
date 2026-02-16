/**
 * CODEx Judiciary (Democracy System)
 * Orchestrates multiple analysis layers to reach a consensus choice.
 */
export class JudiciaryEngine {
  constructor() {
    this.layers = {
      PHONEME: { weight: 0.45, name: 'Phoneme Engine' },
      SPELLCHECK: { weight: 0.30, name: 'Spellchecker' },
      PREDICTOR: { weight: 0.25, name: 'Predictor' }
    };
    this.CONSENSUS_THRESHOLD = 0.65; // Must reach 65% weight for automatic pick
  }

  /**
   * Resolves a choice among conflicting suggestions.
   * @param {Array<{word: string, layer: string, confidence: number}>} candidates 
   * @returns {{word: string, confidence: number, consensus: boolean, breakdown: object}}
   */
  vote(candidates) {
    const votes = new Map(); // Map<word, totalScore>
    const breakdown = new Map();

    candidates.forEach(c => {
      const layerMeta = this.layers[c.layer];
      if (!layerMeta) return;

      const weightedScore = c.confidence * layerMeta.weight;
      
      const current = votes.get(c.word) || 0;
      votes.set(c.word, current + weightedScore);

      // Track breakdown for transparency
      if (!breakdown.has(c.word)) breakdown.set(c.word, []);
      breakdown.get(c.word).push({ layer: c.layer, score: weightedScore });
    });

    // Sort winners
    const sorted = Array.from(votes.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return null;

    const [winner, totalConfidence] = sorted[0];
    
    // TIE-BREAKING LOGIC:
    // If scores are within 0.05 of each other, prioritize Phoneme Engine's choice
    if (sorted.length > 1 && Math.abs(sorted[0][1] - sorted[1][1]) < 0.05) {
      const phonemeChoice = candidates.find(c => c.layer === 'PHONEME');
      if (phonemeChoice && phonemeChoice.word === sorted[1][0]) {
        return this.formatResult(sorted[1][0], sorted[1][1], breakdown);
      }
    }

    return this.formatResult(winner, totalConfidence, breakdown);
  }

  formatResult(word, confidence, breakdown) {
    return {
      word,
      confidence: Math.min(1, confidence),
      consensus: confidence >= this.CONSENSUS_THRESHOLD,
      breakdown: Object.fromEntries(breakdown)
    };
  }
}

export const judiciary = new JudiciaryEngine();
