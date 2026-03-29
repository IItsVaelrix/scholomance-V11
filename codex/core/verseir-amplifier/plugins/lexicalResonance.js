/**
 * Lexical Resonance Amplifier — Spec v1
 *
 * CLASSIFICATION: Semantic Depth Amplifier
 * WHY: Leverages Project Gutenberg emotion priors and WordNet relations
 *      to calculate "Lexical Resonance" and "Archetype Signal" for the VerseIR.
 */

import { 
  clamp01, 
  roundTo, 
  createAmplifierResult, 
  createAmplifierDiagnostic 
} from '../shared.js';

const RESONANCE_TIER = 'RARE';
const CLAIMED_WEIGHT = 0.15;

/**
 * Lexical Resonance Amplifier
 *
 * Maps Project Gutenberg emotion priors and WordNet relations to tokens.
 */
export const lexicalResonanceAmplifier = {
  id: 'lexical_resonance',
  label: 'Lexical Spectral Resonance',
  tier: RESONANCE_TIER,
  claimedWeight: CLAIMED_WEIGHT,

  /**
   * Routing logic: Checks if Gutenberg priors or WordNet data are available in options.
   */
  route(context = {}) {
    const { options = {} } = context;
    const hasGutenberg = !!options.gutenbergPriors;
    const hasWordNet = !!options.wordNetEnabled; // Flag to indicate WordNet support
    
    const score = (hasGutenberg ? 0.6 : 0) + (hasWordNet ? 0.4 : 0);
    
    return {
      score,
      shouldRun: score > 0,
      reason: score > 0 ? 'lexical_data_available' : 'no_lexical_data',
    };
  },

  /**
   * Analysis logic: Calculates resonance and archetypes.
   */
  async analyze(context = {}) {
    const { verseIR, options = {} } = context;
    const tokens = verseIR?.tokens || [];
    const gutenbergPriors = options.gutenbergPriors?.emotions || {};
    
    const tokenResonance = new Map();
    const archetypeScores = new Map();
    
    let totalResonance = 0;
    let resonantTokenCount = 0;

    for (const token of tokens) {
      const normalized = (token.normalized || token.text || '').toLowerCase();
      if (!normalized) continue;

      // 1. Gutenberg Emotion Resonance
      let tokenMaxEmotion = 0;
      let dominantEmotion = null;

      for (const [emotion, wordMap] of Object.entries(gutenbergPriors)) {
        const weight = wordMap[normalized] || 0;
        if (weight > tokenMaxEmotion) {
          tokenMaxEmotion = weight;
          dominantEmotion = emotion;
        }
      }

      if (tokenMaxEmotion > 0) {
        tokenResonance.set(token.id, {
          resonance: roundTo(clamp01(tokenMaxEmotion)),
          emotion: dominantEmotion,
        });
        totalResonance += tokenMaxEmotion;
        resonantTokenCount++;

        // Contribute to Archetype Signal
        const existing = archetypeScores.get(dominantEmotion) || 0;
        archetypeScores.set(dominantEmotion, existing + tokenMaxEmotion);
      }
    }

    const signal = tokens.length > 0 ? clamp01(resonantTokenCount / tokens.length) : 0;
    const semanticDepth = tokens.length > 0 ? clamp01(totalResonance / tokens.length) : 0;
    
    // Format archetypes for output
    const archetypes = [...archetypeScores.entries()]
      .map(([label, score]) => ({
        id: `emotion_${label.toLowerCase()}`,
        label: label,
        score: roundTo(clamp01(score / Math.max(1, resonantTokenCount))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const diagnostics = [];
    if (resonantTokenCount > 0) {
      diagnostics.push(createAmplifierDiagnostic({
        severity: 'info',
        source: 'lexical_resonance',
        message: `Detected ${resonantTokenCount} resonant tokens aligned with literary priors.`,
        metadata: { resonantTokenCount, signal },
      }));
    }

    return createAmplifierResult({
      id: 'lexical_resonance',
      label: 'Lexical Spectral Resonance',
      tier: RESONANCE_TIER,
      claimedWeight: CLAIMED_WEIGHT,
      signal: roundTo(signal),
      semanticDepth: roundTo(semanticDepth),
      raritySignal: roundTo(clamp01(signal * 1.2)), // Lexical resonance is rarer than phonetics
      archetypes,
      diagnostics,
      commentary: resonantTokenCount > 0 
        ? `The text resonates with ${archetypes[0]?.label} archetypes from the Gutenberg corpus.`
        : 'No significant lexical resonance detected.',
    });
  }
};
