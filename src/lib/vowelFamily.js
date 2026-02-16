/**
 * Canonical vowel-family normalization used across grouping, analytics, and color rendering.
 * This avoids split buckets for equivalent family aliases.
 */

const FAMILY_ALIASES = Object.freeze({
  // Consolidations
  AA: "A",
  AX: "U",     // Schwa is neutral central, better in U family than A
  EH: "AE",    
  ER: "UR",    // Rhotic vowels
  AH: "U",
  UH: "U",
  UW: "U",
  
  // Keep core families distinct
  // Note: Test alignment previously forced AY -> EY.
  // We RESTORE distinction for engine accuracy.
  EE: "IY",
  OH: "OW",
  OO: "U",
  YOO: "U",
  YUW: "U",
  IN: "IH",
});

/**
 * Normalizes a vowel-family token into the app's canonical family ids.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeVowelFamily(value) {
  const family = String(value || "").trim().toUpperCase();
  if (!family) return "";
  return FAMILY_ALIASES[family] || family;
}
