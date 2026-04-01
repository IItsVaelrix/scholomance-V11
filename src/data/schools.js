/**
 * Scholomance School Configuration
 * 
 * Defines all schools of magic with their visual properties,
 * unlock requirements, and progression data.
 * 
 * Angle spacing: 360° / 8 positions = 45° per school
 * This leaves room for 8 schools (current 5 + 3 future)
 */

import { 
  SCHOOLS as CORE_SCHOOLS, 
  VOWEL_FAMILY_TO_SCHOOL as CORE_VOWEL_MAPPING 
} from '../../codex/core/constants/schools.js';

/**
 * Canonical mapping from ARPAbet vowel family to school of magic.
 */
export const VOWEL_FAMILY_TO_SCHOOL = CORE_VOWEL_MAPPING;

export const SCHOOLS = {
  ...CORE_SCHOOLS,
  // Add UI-only properties back to core schools
  SONIC: {
    ...CORE_SCHOOLS.SONIC,
    description: "The art of sonic manipulation and harmonic resonance",
    tracks: ["sonic_harmony"],
    vowelAffinities: ["AE", "EH"],
    atmosphere: {
      auroraIntensity: 0.9,
      saturation: 90,
      vignetteStrength: 0.70,
      scanlineOpacity: 0,
    },
  },
  PSYCHIC: {
    ...CORE_SCHOOLS.PSYCHIC,
    description: "Mental discipline and psychic energy projection",
    tracks: ["schism"],
    vowelAffinities: ["IY", "IH"],
    atmosphere: {
      auroraIntensity: 0.8,
      saturation: 85,
      vignetteStrength: 0.65,
      scanlineOpacity: 0,
    },
  },
  VOID: {
    ...CORE_SCHOOLS.VOID,
    description: "The space between spaces, where entropy reigns",
    tracks: ["void"],
    vowelAffinities: ["AX", "UH"],
    atmosphere: {
      auroraIntensity: 0.15,
      saturation: 15,
      vignetteStrength: 0.92,
      scanlineOpacity: 0.02,
    },
  },
  ALCHEMY: {
    ...CORE_SCHOOLS.ALCHEMY,
    description: "The transmutation of meaning through spoken word",
    tracks: ["alchemy"],
    vowelAffinities: ["EY", "OY"],
    atmosphere: {
      auroraIntensity: 1.1,
      saturation: 105,
      vignetteStrength: 0.60,
      scanlineOpacity: 0,
    },
  },
  WILL: {
    ...CORE_SCHOOLS.WILL,
    description: "Focusing raw will into reality-altering force",
    tracks: ["will"],
    vowelAffinities: ["AH"],
    atmosphere: {
      auroraIntensity: 1.0,
      saturation: 95,
      vignetteStrength: 0.62,
      scanlineOpacity: 0,
    },
  },
  NECROMANCY: {
    ...CORE_SCHOOLS.NECROMANCY,
    description: "Communication with and manipulation of life force",
    tracks: [],
    vowelAffinities: ["AA", "A"],
    atmosphere: {
      auroraIntensity: 0.6,
      saturation: 55,
      vignetteStrength: 0.82,
      scanlineOpacity: 0.01,
    },
  },
  ABJURATION: {
    ...CORE_SCHOOLS.ABJURATION,
    description: "Protective magic and negation of effects",
    tracks: [],
    vowelAffinities: ["UW", "OW"],
    atmosphere: {
      auroraIntensity: 0.5,
      saturation: 50,
      vignetteStrength: 0.50,
      scanlineOpacity: 0,
    },
  },
  DIVINATION: {
    ...CORE_SCHOOLS.DIVINATION,
    description: "Seeing across time and space",
    tracks: [],
    vowelAffinities: ["AO", "AW"],
    atmosphere: {
      auroraIntensity: 0.85,
      saturation: 88,
      vignetteStrength: 0.55,
      scanlineOpacity: 0,
    },
  },
};

/**
 * Get all schools sorted by unlock requirement
 * @returns {Array<School>} Sorted schools array
 */
export function getSchoolsByUnlock() {
  return Object.values(SCHOOLS).sort((a, b) => a.unlockXP - b.unlockXP);
}

/**
 * Get school by ID
 * @param {string} id - School ID (e.g., "SONIC")
 * @returns {School|undefined} School configuration
 */
export function getSchoolById(id) {
  return SCHOOLS[id];
}

/**
 * Check if a school is unlocked based on XP
 * @param {string} schoolId - School to check
 * @param {number} currentXP - Current experience points
 * @returns {boolean} Whether school is unlocked
 */
export function isSchoolUnlocked(schoolId, currentXP) {
  const school = SCHOOLS[schoolId];
  if (!school) return false;
  return currentXP >= school.unlockXP;
}

/**
 * Get lock tier for a school based on XP proximity
 * @param {string} schoolId - School to check
 * @param {number} currentXP - Current experience points
 * @returns {"unlocked"|"near"|"approaching"|"distant"} Lock tier
 */
export function getLockTier(schoolId, currentXP) {
  const school = SCHOOLS[schoolId];
  if (!school) return "distant";
  if (currentXP >= school.unlockXP) return "unlocked";
  const ratio = school.unlockXP > 0 ? currentXP / school.unlockXP : 0;
  if (ratio >= 0.75) return "near";
  if (ratio >= 0.25) return "approaching";
  return "distant";
}

/**
 * Get next unlockable school for a given XP
 * @param {number} currentXP - Current XP
 * @returns {School|null} Next school or null if all unlocked
 */
export function getNextSchool(currentXP) {
  const schools = getSchoolsByUnlock();
  for (const school of schools) {
    if (currentXP < school.unlockXP) {
      return school;
    }
  }
  return null;
}

/**
 * Generate color for schools without explicit color
 * @param {string} schoolId - School ID
 * @returns {string} Hex color
 */
export function generateSchoolColor(schoolId) {
  const school = SCHOOLS[schoolId];
  if (!school) return "#888888";
  
  // Use explicit color if defined
  if (school.color) return school.color;
  
  // Generate from HSL if defined
  if (school.colorHsl) {
    const { h, s, l } = school.colorHsl;
    return hslToHex(h, s, l);
  }
  
  // Fallback
  return "#888888";
}

/**
 * Convert HSL to Hex
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color
 */
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Calculate wheel position for a school
 * @param {string} schoolId - School ID
 * @returns {number} Angle in degrees
 */
export function getSchoolAngle(schoolId) {
  const school = SCHOOLS[schoolId];
  return school?.angle ?? 0;
}

/**
 * Get CSS class for school badge
 * @param {string} schoolId - School ID
 * @param {boolean} isLocked - Whether school is locked
 * @returns {string} CSS class name
 */
export function getSchoolBadgeClass(schoolId, isLocked = false) {
  const base = isLocked ? "badge--locked" : `badge--${schoolId.toLowerCase()}`;
  return base;
}
