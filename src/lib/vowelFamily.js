/**
 * Canonical vowel-family normalization used across grouping, analytics, and color rendering.
 * This avoids split buckets for equivalent family aliases.
 * 
 * 12 Core Vowel Families:
 * 1. IY - High front (machine, green, gene)
 * 2. IH - Near-high front (obelisk, continent) + ER
 * 3. EY - Mid front (bait, day)
 * 4. AE - Low front (bat, dragon) + EH
 * 5. A - Low back (obvious, monument) + AA, AX, AW
 * 6. AO - Mid back rounded (water, slaughter, martyr) - DISTINCT
 * 7. OW - Mid-high back (soul, cold, boulder) + OH
 * 8. UW - High back (boot, true) + OO
 * 9. OY - Diphthong /ɔɪ/ (oil, boil, gargoyle)
 * 10. UR - Near-close near-back rounded (pure, cure, allure)
 * 11. AY - Diphthong /aɪ/ (like, time, fly)
 * 12. UH - STRUT/FOOT (but, thumb, book, full) - NEW CORE FAMILY (SHORT U)
 */

const FAMILY_ALIASES = Object.freeze({
  // Original aliases - merge to A
  AA: "A",
  AX: "A",
  
  // Consolidations
  EH: "AE",    // Low-mid front → Low front
  AW: "A",     // Diphthong /aʊ/ → Low back
  ER: "IH",    // R-colored central → Near-high front
  
  // SHORT U family
  AH: "UH",    // STRUT /ʌ/ -> SHORT U
  
  // Keep existing mappings
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
