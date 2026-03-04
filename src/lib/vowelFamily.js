/**
 * Canonical vowel-family normalization used across grouping, analytics, and color rendering.
 * This avoids split buckets for equivalent family aliases.
 */

const FAMILY_ALIASES = Object.freeze({
  // Consolidations to 8 Core Families
  AA: "A",
  AH: "A",
  AX: "A",
  AW: "A",
  EH: "AE",
  AY: "EY",
  OY: "OW",
  OH: "OW",
  UH: "UW",
  OO: "UW",
  YOO: "UW",
  YUW: "UW",
  ER: "IH",
  UR: "IH",
  
  // Keep core families distinct
  EE: "IY",
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
