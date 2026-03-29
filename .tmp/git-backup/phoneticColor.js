/**
 * Phonetic Color Amplifier — Spec v1
 *
 * CLASSIFICATION: Structural Transformation Amplifier
 * WHY: Generates authoritative VisualBytecode for tokens to ensure 100% phonetic
 *      fidelity in the Truesight UI, bypassing lossy frontend normalization.
 *      Moves color logic from "Heuristic Guessing" to "Immutable Bytecode".
 */

import { normalizeVowelFamily } from '../../../../src/lib/phonology/vowelFamily.js';
import { VOWEL_FAMILY_TO_SCHOOL } from '../../../../src/data/schools.js';
import { SCHOOL_SKINS } from '../../../../src/data/schoolPalettes.js';
import { clamp01, roundTo, createAmplifierResult } from '../shared.js';

const DEFAULT_SCHOOL = 'DEFAULT';

/**
 * Phonetic Color Amplifier
 * 
 * Maps raw VerseIR phonemes to authoritative school colors and 
 * calculates visual resonance (glow, saturation) based on phonetic data.
 */
export const phoneticColorAmplifier = {
  id: 'phonetic_color',
  label: 'Phonetic Spectral Resonance',
  tier: 'COMMON',
  claimedWeight: 0.10,

  /**
   * Routing logic: This amplifier is a structural requirement for Truesight.
   * It always runs if tokens are present.
   */
  route(context = {}) {
    const hasTokens = (context.verseIR?.tokens?.length || 0) > 0;
    return {
      score: hasTokens ? 1.0 : 0,
      shouldRun: hasTokens,
      reason: hasTokens ? 'structural_requirement' : 'no_tokens',
    };
  },

  /**
   * Analysis logic: Iterates through tokens and builds VisualBytecode.
   * Implements "Spectral Hygiene" to solve the Skittles problem by suppressing
   * visual noise and outliers.
   */
  async analyze(context = {}) {
    const { verseIR } = context;
    const tokens = verseIR?.tokens || [];
    const tokenBytecodes = new Map();

    // 1. Global Spectral Analysis
    const familyFrequency = new Map();
    const lineFamilyDensity = new Map(); // lineIndex -> Set of families

    for (const token of tokens) {
      const rawFamily = token.primaryStressedVowelFamily || token.terminalVowelFamily;
      const family = normalizeVowelFamily(rawFamily);
      if (!family) continue;

      familyFrequency.set(family, (familyFrequency.get(family) || 0) + 1);
      
      const lineIndex = token.lineIndex ?? 0;
      if (!lineFamilyDensity.has(lineIndex)) lineFamilyDensity.set(lineIndex, new Set());
      lineFamilyDensity.get(lineIndex).add(family);
    }

    const totalResonantTokens = [...familyFrequency.values()].reduce((a, b) => a + b, 0);

    // Use the VerseIR index to find rhyme connections for glow calculation
    const rhymeTailIndex = verseIR?.indexes?.tokenIdsByRhymeTail || new Map();

    for (const token of tokens) {
      // 1. Resolve School & Color
      const rawFamily = token.primaryStressedVowelFamily || token.terminalVowelFamily;
      const family = normalizeVowelFamily(rawFamily);
      const school = VOWEL_FAMILY_TO_SCHOOL[family] || DEFAULT_SCHOOL;
      const skin = SCHOOL_SKINS[school] || SCHOOL_SKINS.DEFAULT;
      
      const familyCount = familyFrequency.get(family) || 0;
      const familyShare = totalResonantTokens > 0 ? familyCount / totalResonantTokens : 0;
      
      // Authoritative hex color from the school skin
      const color = skin[family] || skin.A || '#888888';

      // 2. Calculate Visual Resonance (Glow)
      const rhymePeers = rhymeTailIndex.get(token.rhymeTailSignature) || [];
      const connectionCount = Math.max(0, rhymePeers.length - 1);
      
      // Base glow starts at 0.3 if connected, scaling up with group size
      const connectionSignal = connectionCount > 0 
        ? clamp01(0.3 + (connectionCount * 0.15)) 
        : 0;

      const isAnchor = connectionCount >= 2; // 3+ words in a group = anchor
      const isStopWord = token.flags?.isStopWordLike || false;
      
      // --- SPECTRAL HYGIENE RULES ---
      
      // A: Global Significance Filter
      // If a family appears only once in the whole verse, it's noise.
      // If its share is < 2% in a long verse, it's noise.
      const isGlobalNoise = familyCount <= 1 || (tokens.length > 20 && familyShare < 0.02);

      // B: Line Density Filter
      // If a line is too "Skittles" (> 4 unique families), dim the weaker ones.
      const lineFamilies = lineFamilyDensity.get(token.lineIndex ?? 0);
      const isLineNoise = (lineFamilies?.size || 0) > 4 && familyShare < 0.1;

      let glowIntensity = isStopWord ? 0 : clamp01(connectionSignal * (isAnchor ? 1.2 : 1.0));
      
      // Apply hygiene suppression
      if (isGlobalNoise || isLineNoise) {
        glowIntensity *= 0.3; // Aggressive dimming of noise
      }

      // 3. Calculate Saturation (Phonetic Weight)
      let saturationBoost = isStopWord ? 0 : clamp01((token.syllableCount * 0.1) + (isAnchor ? 0.2 : 0));
      
      if (isGlobalNoise || isLineNoise) {
        saturationBoost *= 0.5; // Desaturate noise
      }

      // 4. Determine Effect Tier
      let effectClass = 'INERT';
      // Hygiene check: Only Resonance/Harmony if the color is significant or strongly connected
      if (!isStopWord && glowIntensity > 0.15) {
        if (token.syllableCount >= 3 && glowIntensity > 0.7 && !isGlobalNoise) {
          effectClass = 'TRANSCENDENT';
        } else if (token.syllableCount >= 2 || glowIntensity > 0.5) {
          effectClass = 'HARMONIC';
        } else {
          effectClass = 'RESONANT';
        }
      }

      // 5. Build Bytecode
      tokenBytecodes.set(token.id, {
        version: 1,
        school: school === DEFAULT_SCHOOL ? null : school,
        rarity: 'COMMON', 
        color,
        glowIntensity: roundTo(glowIntensity),
        saturationBoost: roundTo(saturationBoost),
        syllableDepth: token.syllableCount,
        isAnchor,
        isStopWord,
        effectClass,
      });
    }

    return {
      ...createAmplifierResult({
        id: 'phonetic_color',
        label: 'Phonetic Spectral Resonance',
        tier: 'COMMON',
        signal: 1.0,
        semanticDepth: 0.1, // Structural, not semantic
        raritySignal: 0,
        commentary: 'Phonetic spectral resonance mapped to VerseIR bytecode.',
      }),
      // Attach the token-level data to the result
      tokenBytecodes,
    };
  }
};
