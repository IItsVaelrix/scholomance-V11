/**
 * Phonetic Weighting & Balance System
 * 
 * Implements a configurable weighting algorithm to ensure equitable distribution
 * of vowel families and prevent visual clustering (color bleeding) in the UI.
 */

import { normalizeVowelFamily } from "./vowelFamily.js";

/**
 * Equitable Distribution:
 * Measured by the variance of family frequencies relative to their target weights.
 * Target: Low variance (families stay within their visual budget).
 * 
 * Visual Clustering:
 * Measured by the proximity of identical or similar families in the text stream.
 * Target: Low cluster coefficient (colors are spaced out unless intentionally rhyming).
 */

const DEFAULT_WEIGHT_CONFIG = {
  baseWeights: {
    'UW': 0.82,  // High back (boot/true) - Green
    'IY': 1.15,  // High front (machine/green) - Blue
    'EY': 1.1,   // Mid front (bait/day) + AY (I) - Violet/Cyan
    'IH': 1.05,  // Near-high front (obelisk/continent) - Cyan
    'OW': 1.0,   // Mid-high back (soul/cold) - Yellow
    'AO': 1.0,   // Mid back rounded (water/slaughter) - Amber
    'AE': 0.88,  // Low front (bat/dragon) - Pink
    'A': 0.9,    // Low back (obvious/monument) - Rose/Warm
  },
  // Global sensitivity for dynamic adjustment
  dynamicSensitivity: 0.25,
  // Penalty for immediate adjacency of same color
  proximityPenalty: 0.4,
  // Distance threshold for clustering detection (in words)
  clusterThreshold: 3
};

export class PhoneticWeightBalancer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_WEIGHT_CONFIG, ...config };
  }

  /**
   * Calculates balanced weights for a sequence of analyzed words.
   * @param {Object[]} wordAnalyses 
   */
  calculateWeights(wordAnalyses) {
    if (!wordAnalyses?.length) return new Map();

    const familyFrequencies = this.computeFrequencies(wordAnalyses);
    const weightMap = new Map();

    // Pass 1: Frequency-based balancing (Global Equity)
    const avgFreq = 1 / Math.max(1, Object.keys(familyFrequencies).length);
    
    // Pass 2: Proximity-based adjustment (Local De-clustering)
    for (let i = 0; i < wordAnalyses.length; i++) {
      const current = wordAnalyses[i];
      const cs = current.charStart;
      const family = normalizeVowelFamily(current.vowelFamily);
      
      if (!family) continue;

      let weight = this.config.baseWeights[family] || 1.0;

      // Frequency adjustment: if a family is over-represented, dim its intensity
      const freq = familyFrequencies[family] || 0;
      const freqDiff = freq - avgFreq;
      if (freqDiff > 0) {
        weight -= freqDiff * this.config.dynamicSensitivity;
      }

      // Proximity penalty: check surrounding words
      let clusterImpact = 0;
      for (let j = Math.max(0, i - this.config.clusterThreshold); j < i; j++) {
        const prevFamily = normalizeVowelFamily(wordAnalyses[j].vowelFamily);
        if (prevFamily === family) {
          // Linear decay penalty based on distance
          const distance = i - j;
          clusterImpact += (this.config.proximityPenalty / distance);
        }
      }
      
      weight -= clusterImpact;

      // Clamp weight to sane range
      weightMap.set(cs, Math.max(0.3, Math.min(1.2, weight)));
    }

    return weightMap;
  }

  computeFrequencies(words) {
    const counts = {};
    let total = 0;
    words.forEach(w => {
      const f = normalizeVowelFamily(w.vowelFamily);
      if (f) {
        counts[f] = (counts[f] || 0) + 1;
        total++;
      }
    });
    
    if (total === 0) return {};
    const freqs = {};
    for (const f in counts) freqs[f] = counts[f] / total;
    return freqs;
  }

  /**
   * Evaluates the distribution health of the current document.
   * @returns {Object} Metric report
   */
  evaluateEquity(wordAnalyses) {
    const freqs = this.computeFrequencies(wordAnalyses);
    const values = Object.values(freqs);
    if (values.length === 0) return { variance: 0, clustering: 0 };

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;

    return {
      distributionVariance: variance, // Lower is more equitable
      dominantFamily: Object.entries(freqs).sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }
}

export const weightBalancer = new PhoneticWeightBalancer();
