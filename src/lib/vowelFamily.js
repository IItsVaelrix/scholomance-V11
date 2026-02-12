/**
 * Canonical vowel-family normalization used across grouping, analytics, and color rendering.
 * This avoids split buckets for equivalent family aliases.
 */

const FAMILY_ALIASES = Object.freeze({
  AA: "A",
  AH: "A",
  AX: "A",
  EE: "IY",
  OH: "OW",
  OO: "UW",
  YOO: "UW",
  YUW: "UW",
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
