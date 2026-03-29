/**
 * Visual Bytecode Renderer
 *
 * Decodes per-token VisualBytecode into CSS classes and custom properties.
 * The bytecode is produced by Codex (or synthesized from legacy colorMap
 * entries during the transition period).
 *
 * ─── BYTECODE SCHEMA (spec for Codex producer) ──────────────────────────
 *
 * VisualBytecode {
 *   version: 1,
 *   school: "SONIC" | "PSYCHIC" | "VOID" | "ALCHEMY" | "WILL" | null,
 *   rarity: "NONE" | "COMMON" | "RARE" | "INEXPLICABLE",
 *   color: string | null,         // authoritative hex color from backend
 *   glowIntensity: 0.0–1.0,       // earned from connection score × rarity multiplier
 *   saturationBoost: 0.0–1.0,     // phonetic weight + stress + rarity
 *   syllableDepth: integer,       // syllables matched in best connection
 *   isAnchor: boolean,            // anchors a rhyme cluster
 *   isStopWord: boolean,
 *   effectClass: "INERT" | "RESONANT" | "HARMONIC" | "TRANSCENDENT"
 * }
 *
 * Effect class derivation (for Codex):
 *   INERT:         stop words or glowIntensity === 0
 *   RESONANT:      single-syllable match, common rarity
 *   HARMONIC:      2+ syllable match OR rare rarity
 *   TRANSCENDENT:  inexplicable rarity OR (3+ syllables + glowIntensity > 0.7)
 *
 * Rarity multipliers for glowIntensity:
 *   NONE: 0, COMMON: 1.0, RARE: 1.35, INEXPLICABLE: 1.7
 *
 * Producer attachment point: VerseTokenIR.visualBytecode
 * See: src/lib/truesight/compiler/compileVerseToIR.js
 * ──────────────────────────────────────────────────────────────────────────
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Decode a VisualBytecode object into inline style (CSS custom properties)
 * and a className string for the word element.
 *
 * @param {object} bytecode - VisualBytecode object
 * @param {object} options
 * @param {boolean} options.reducedMotion - halve glow intensity, suppress transitions
 * @param {string}  options.theme - "dark" | "light"
 * @returns {{ style: object, className: string, color: string | null }}
 */
export function decodeBytecode(bytecode, { reducedMotion = false, theme = "dark" } = {}) {
  const { 
    effectClass, 
    school, 
    rarity, 
    color,
    glowIntensity, 
    saturationBoost, 
    syllableDepth, 
    isAnchor 
  } = bytecode;    

  if (effectClass === "INERT") {
    return { style: {}, className: "", color: null };
  }

  const intensityScale = theme === "light" ? 0.7 : 1;
  const finalGlow = clamp01((reducedMotion ? glowIntensity * 0.5 : glowIntensity) * intensityScale);
  const finalSaturation = clamp01(saturationBoost);

  const style = {
    "--vb-glow-intensity": finalGlow,
    "--vb-saturation-boost": finalSaturation,
    "--vb-syllable-depth": syllableDepth,
  };

  const classes = [`vb-effect--${effectClass.toLowerCase()}`];
  if (school) classes.push(`vb-school--${school.toLowerCase()}`);
  if (rarity && rarity !== "NONE") classes.push(`vb-rarity--${rarity.toLowerCase()}`);
  if (isAnchor) classes.push("vb-anchor");

  return { style, className: classes.join(" "), color: color || null };
}

/**
 * Synthesize a VisualBytecode object from a legacy colorMap entry.
 * Used during the transition before Codex ships native bytecode on tokens.
 *
 * @param {object} codexEntry - colorMap entry from buildColorMap()
 *   { color, opacity, isMultiSyllable, syllablesMatched, bestScore,
 *     phoneticWeight, salience, isAnchor, isGhost, family, syntaxMultiplier }
 * @param {string|null} school - school ID from VOWEL_FAMILY_TO_SCHOOL lookup
 * @returns {object} VisualBytecode
 */
export function synthesizeBytecodeFromLegacy(codexEntry, school) {
  const {
    isMultiSyllable = false,
    syllablesMatched = 0,
    bestScore = 0,
    phoneticWeight = 0,
    isAnchor = false,
    syntaxMultiplier = 1,
    color = null,
  } = codexEntry;

  const isStopWord = syntaxMultiplier < 0.5;
  const glowIntensity = clamp01(bestScore * (isAnchor ? 1.2 : 0.7));
  const saturationBoost = clamp01((phoneticWeight * 0.5) + (isAnchor ? 0.3 : 0));

  let effectClass;
  if (isStopWord || glowIntensity === 0) {
    effectClass = "INERT";
  } else if (syllablesMatched >= 3 && glowIntensity > 0.7) {
    effectClass = "TRANSCENDENT";
  } else if (isMultiSyllable || syllablesMatched >= 2) {
    effectClass = "HARMONIC";
  } else if (bestScore > 0) {
    effectClass = "RESONANT";
  } else {
    effectClass = "INERT";
  }

  return {
    version: 1,
    school: school || null,
    rarity: bestScore > 0 ? "COMMON" : "NONE",
    color,
    glowIntensity,
    saturationBoost,
    syllableDepth: syllablesMatched,
    isAnchor,
    isStopWord,
    effectClass,
  };
}
