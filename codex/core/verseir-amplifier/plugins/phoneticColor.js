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
import { resolveVerseIrColor } from '../../../../src/data/schoolPalettes.js';
import { clamp01, roundTo, createAmplifierResult } from '../shared.js';

const DEFAULT_SCHOOL = 'DEFAULT';

function resolveColorFamily(rawFamily, normalizedFamily) {
  const raw = String(rawFamily || '').trim().toUpperCase();
  if (raw && VOWEL_FAMILY_TO_SCHOOL[raw]) {
    return raw;
  }
  return normalizedFamily;
}

/**
 * Research-backed palettes
 */
const PALETTES = {
  FORENSIC: {
    VOWEL: '#3b82f6', // Accessible Blue (Voiced/High-energy)
    CONSONANT: '#f97316', // Accessible Orange (Unvoiced/Low-energy)
  },
  // Perceptually uniform HEATMAP (simplified Viridis/Plasma interpolation)
  HEATMAP: [
    '#440154', // Purple (Low energy)
    '#3b528b',
    '#21918c',
    '#5ec962',
    '#fde725', // Yellow (High energy)
  ]
};

const interpolateHeatmap = (signal) => {
  const t = clamp01(signal);
  const index = Math.floor(t * (PALETTES.HEATMAP.length - 1));
  const nextIndex = Math.min(index + 1, PALETTES.HEATMAP.length - 1);
  const factor = (t * (PALETTES.HEATMAP.length - 1)) - index;
  // Simple hex string return for now, actual color interpolation would be better
  return factor > 0.5 ? PALETTES.HEATMAP[nextIndex] : PALETTES.HEATMAP[index];
};

/**
 * Phonetic Color Amplifier
 *
 * Maps raw VerseIR phonemes to authoritative school colors and
 * calculates visual resonance (glow, saturation) based on phonetic data.
 * Supports multiple Visual Modes (Lenses).
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
   * Implements "Spectral Hygiene" to solve the Skittles problem.
   */
  async analyze(context = {}) {
    const { verseIR, options = {} } = context;
    const tokens = verseIR?.tokens || [];
    const tokenBytecodes = new Map();
    
    // Lens selection: AESTHETIC (default) | FORENSIC | HEATMAP
    const visualMode = (options.visualMode || 'AESTHETIC').toUpperCase();

    // 1. Global Spectral Analysis (for Hygiene)
    const familyFrequency = new Map();
    const lineFamilyDensity = new Map();
    const proximityResonance = new Map(); // Tracks if a word has a vowel peer within +/- 3 tokens

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const rawFamily = token.primaryStressedVowelFamily || token.terminalVowelFamily;
      const family = normalizeVowelFamily(rawFamily);
      if (!family) continue;

      familyFrequency.set(family, (familyFrequency.get(family) || 0) + 1);
      
      const lineIndex = token.lineIndex ?? 0;
      if (!lineFamilyDensity.has(lineIndex)) lineFamilyDensity.set(lineIndex, new Set());
      lineFamilyDensity.get(lineIndex).add(family);

      // --- PROXIMITY CHECK (The Anti-Skittles Rule) ---
      let hasPeer = false;
      const lookback = Math.max(0, i - 3);
      const lookahead = Math.min(tokens.length - 1, i + 3);
      
      for (let j = lookback; j <= lookahead; j++) {
        if (i === j) continue;
        const peer = tokens[j];
        const peerFamily = normalizeVowelFamily(peer.primaryStressedVowelFamily || peer.terminalVowelFamily);
        if (peerFamily === family) {
          hasPeer = true;
          break;
        }
      }
      proximityResonance.set(token.id, hasPeer);
    }

    const totalResonantTokens = [...familyFrequency.values()].reduce((a, b) => a + b, 0);
    const rhymeTailIndex = verseIR?.indexes?.tokenIdsByRhymeTail || new Map();

    for (const token of tokens) {
      // 1. Resolve Color based on Visual Mode
      const rawFamily = token.primaryStressedVowelFamily || token.terminalVowelFamily;
      const family = normalizeVowelFamily(rawFamily);
      const colorFamily = resolveColorFamily(rawFamily, family);
      const school = VOWEL_FAMILY_TO_SCHOOL[colorFamily] || DEFAULT_SCHOOL;
      
      let color;
      if (visualMode === 'FORENSIC') {
        // Blue/Orange contrast: Vowels are high-energy blue, Consonants (or low-vowel density) are orange
        const vowelRatio = (token.syllableCount / (token.phonemes?.length || 1));
        color = vowelRatio > 0.3 ? PALETTES.FORENSIC.VOWEL : PALETTES.FORENSIC.CONSONANT;
      } else if (visualMode === 'HEATMAP') {
        // Viridis/Plasma heatmap based on connection signal
        const rhymePeers = rhymeTailIndex.get(token.rhymeTailSignature) || [];
        const heat = Math.min(1, (rhymePeers.length - 1) * 0.25);
        color = interpolateHeatmap(heat);
      } else {
        // Default AESTHETIC: school identity projected through the shared PCA chroma basis
        color = resolveVerseIrColor(colorFamily || family || rawFamily, school, { theme: 'dark' }).hex;
      }

      // 2. Calculate Visual Resonance (Glow)
      const rhymePeers = rhymeTailIndex.get(token.rhymeTailSignature) || [];
      const connectionCount = Math.max(0, rhymePeers.length - 1);
      const connectionSignal = connectionCount > 0 ? clamp01(0.3 + (connectionCount * 0.15)) : 0;

      const isAnchor = connectionCount >= 2;
      const isStopWord = token.flags?.isStopWordLike || false;
      const hasProximity = proximityResonance.get(token.id) || false;
      
      // --- SPECTRAL HYGIENE RULES ---
      const familyCount = familyFrequency.get(family) || 0;
      const familyShare = totalResonantTokens > 0 ? familyCount / totalResonantTokens : 0;
      const isGlobalNoise = familyCount <= 1 || (tokens.length > 20 && familyShare < 0.02);
      const lineFamilies = lineFamilyDensity.get(token.lineIndex ?? 0);
      const isLineNoise = (lineFamilies?.size || 0) > 4 && familyShare < 0.1;

      // Anti-Skittles logic: if it's a isolated vowel sound (no proximity), severely dampen it
      let glowIntensity = isStopWord ? 0 : clamp01(connectionSignal * (isAnchor ? 1.2 : 1.0));
      if (!hasProximity && !isAnchor) glowIntensity *= 0.2; // The "Isolated Vowel" dampen
      if (isGlobalNoise || isLineNoise) glowIntensity *= 0.3;

      // 3. Calculate Saturation
      let saturationBoost = isStopWord ? 0 : clamp01((token.syllableCount * 0.1) + (isAnchor ? 0.2 : 0));
      if (!hasProximity && !isAnchor) saturationBoost = 0; // Gray out isolated Skittles
      if (isGlobalNoise || isLineNoise) saturationBoost *= 0.5;

      // 4. Determine Effect Tier
      let effectClass = 'INERT';
      if (!isStopWord && (glowIntensity > 0.15 || (hasProximity && !isLineNoise))) {
        if (token.syllableCount >= 3 && glowIntensity > 0.7 && !isGlobalNoise) {
          effectClass = 'TRANSCENDENT';
        } else if (token.syllableCount >= 2 || glowIntensity > 0.5) {
          effectClass = 'HARMONIC';
        } else if (hasProximity) {
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
