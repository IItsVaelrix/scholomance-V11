// src/data/progression_constants.js

/**
 * Progression Constants & Formulas
 * Modeled after OSRS-style exponential scaling to ensure long-term viability.
 */

// Base configuration
export const XP_CONFIG = {
  // The exponent controls how steep the curve is. 
  // ~2.0 is standard quadratic (Runescape is closer to varying exponential).
  // We use a custom formula to match the "Early Rush" feel.
  BASE_XP: 100, // XP needed for level 2
  GROWTH_FACTOR: 1.15, // Each level requires ~15% more XP than the last (compounding)
  MAX_LEVEL: 99,
};

/**
 * Tiers of Mastery
 * Maps numerical levels to lore-friendly titles.
 */
export const MASTERY_TIERS = [
  { name: "Neophyte", minLevel: 1, maxLevel: 20, id: "neophyte" },
  { name: "Adept", minLevel: 21, maxLevel: 45, id: "adept" },
  { name: "Expert", minLevel: 46, maxLevel: 70, id: "expert" },
  { name: "Master", minLevel: 71, maxLevel: 90, id: "master" },
  { name: "Godlike", minLevel: 91, maxLevel: 999, id: "godlike" },
];

/**
 * XP Sources
 * Rewards novelty and exploration over repetition.
 */
export const XP_SOURCES = {
  // Discovery Actions (High Value)
  NEW_RHYME_SCHEME: 150,
  COMPLEX_WORD_ANALYSIS: 50,
  FIRST_SCHOOL_DISCOVERY: 500,
  
  // Standard Actions (Base Value)
  WORD_ANALYZED: 10,
  SCROLL_CREATED: 40,
  SCROLL_COMPLETED: 75,
  SESSION_COMPLETE: 25,
  
  // Milestones
  ACHIEVEMENT_UNLOCKED: 250,
  TIER_UP: 1000,
};
