// src/lib/progressionUtils.js
import { XP_CONFIG, MASTERY_TIERS } from "../data/progression_constants";

const XP_CACHE = new Map([[1, 0]]);
let cachedRawTotal = 0;
let maxCachedLevel = 1;

function seedXpCache(maxLevel) {
  if (maxLevel <= maxCachedLevel) return;
  for (let level = maxCachedLevel + 1; level <= maxLevel; level++) {
    const l = level - 1;
    cachedRawTotal += Math.floor(l + 300 * Math.pow(2, l / 7));
    XP_CACHE.set(level, Math.floor(cachedRawTotal / 4));
  }
  maxCachedLevel = maxLevel;
}

seedXpCache(XP_CONFIG.MAX_LEVEL + 1);

/**
 * Calculates the total XP required to reach a specific level.
 * Formula: Cumulative geometric sequence approximation.
 * 
 * @param {number} level - The target level
 * @returns {number} Total XP required
 */
export function getXpForLevel(level) {
  if (level <= 1) return 0;
  if (XP_CACHE.has(level)) return XP_CACHE.get(level);
  seedXpCache(level);
  return XP_CACHE.get(level) || 0;
  
  // OSRS-ish curve approximation:
  // Points = floor( 1/4 * floor( level + 300 * 2^(level/7) ) )
  // We will use a slightly simpler polynomial curve for easier tuning:
  // XP = (Level^2 * Constant) * Growth
  
  // Using a simplified exponential formula for the requested curve:
  // Level 1: 0
  // Level 10: ~1,500
  // Level 30: ~25,000 (Fast early game)
  // Level 60: ~500,000 (Mid game grind)
  // Level 90: ~5,000,000 (End game)
  // Level 99: ~13,000,000
  
  // Legacy formula retained for reference in comments above.
}

/**
 * Calculates the current level based on total XP.
 * Performs a reverse lookup on the XP curve.
 * 
 * @param {number} xp - Current total XP
 * @returns {number} Current level (1-99)
 */
export function getLevelFromXp(xp) {
  // Binary search for efficiency, though max level is small enough for linear
  let low = 1;
  let high = XP_CONFIG.MAX_LEVEL;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const xpAtMid = getXpForLevel(mid);
    const xpAtNext = getXpForLevel(mid + 1);
    
    if (xp >= xpAtMid && xp < xpAtNext) {
      return mid;
    }
    
    if (xp < xpAtMid) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  return XP_CONFIG.MAX_LEVEL;
}

/**
 * Gets the mastery tier object for a given level.
 * 
 * @param {number} level 
 * @returns {object} Tier definition
 */
export function getTierForLevel(level) {
  return MASTERY_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || MASTERY_TIERS[0];
}

/**
 * Calculates progress details for the current level.
 * 
 * @param {number} currentXp 
 * @returns {object} { currentLevel, nextLevel, xpForCurrent, xpForNext, progressPercent, remaining }
 */
export function getLevelProgress(currentXp) {
  const currentLevel = getLevelFromXp(currentXp);
  const nextLevel = currentLevel + 1;
  const xpForCurrent = getXpForLevel(currentLevel);
  const xpForNext = getXpForLevel(nextLevel);
  
  const earnedInLevel = currentXp - xpForCurrent;
  const totalInLevel = xpForNext - xpForCurrent;
  const remaining = xpForNext - currentXp;
  
  // Prevent division by zero at max level
  const percent = totalInLevel > 0 
    ? Math.min(100, Math.max(0, (earnedInLevel / totalInLevel) * 100))
    : 100;

  return {
    currentLevel,
    nextLevel,
    xpForCurrent,
    xpForNext,
    progressPercent: percent,
    remaining,
    tier: getTierForLevel(currentLevel)
  };
}
