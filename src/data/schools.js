/**
 * Scholomance School Configuration
 * 
 * Defines all schools of magic with their visual properties,
 * unlock requirements, and progression data.
 * 
 * Angle spacing: 360° / 8 positions = 45° per school
 * This leaves room for 8 schools (current 5 + 3 future)
 */

/**
 * Canonical mapping from ARPAbet vowel family to school of magic.
 * This is the single source of truth — all consumers should import from here.
 */
export const VOWEL_FAMILY_TO_SCHOOL = Object.freeze({
  // Core 8 mappings
  IY: 'PSYCHIC',
  IH: 'SONIC',
  EY: 'ALCHEMY',
  AE: 'WILL',
  A:  'WILL',
  AO: 'SONIC',
  OW: 'ALCHEMY',
  UW: 'VOID',

  // ARPAbet Aliases
  AA: 'WILL',    // -> A
  AH: 'WILL',    // -> A
  AX: 'WILL',    // -> A
  AW: 'WILL',    // -> A
  EH: 'WILL',    // -> AE
  AY: 'PSYCHIC', // -> EY (Psychic affinity)
  OY: 'ALCHEMY', // -> OW
  OH: 'ALCHEMY', // -> OW
  UH: 'VOID',    // -> UW
  OO: 'VOID',    // -> UW
  ER: 'SONIC',   // -> IH
  UR: 'SONIC',   // -> IH
});

export const SCHOOLS = {
  // === INITIAL 5 SCHOOLS ===
  SONIC: {
    id: "SONIC",
    name: "Sonic Thaumaturgy",
    color: "#651fff",
    colorHsl: { h: 251, s: 100, l: 50 },
    angle: 288,       // Position on the wheel
    unlockXP: 0,      // Available immediately (Level 1)
    description: "The art of sonic manipulation and harmonic resonance",
    tracks: ["sonic_harmony"],
    vowelAffinities: ["AO", "IH", "OW"],
    glyph: "♩",
    atmosphere: {
      auroraIntensity: 1.0,
      saturation: 100,
      vignetteStrength: 0.7,
      scanlineOpacity: 0,
    },
  },
  PSYCHIC: {
    id: "PSYCHIC", 
    name: "Psychic Schism",
    color: "#00E5FF",
    colorHsl: { h: 185, s: 100, l: 50 },
    angle: 72,
    unlockXP: 250, // Level ~3
    description: "Mental discipline and psychic energy projection",
    tracks: ["schism"],
    vowelAffinities: ["EY", "IY", "UW"],
    glyph: "◬",
    atmosphere: {
      auroraIntensity: 1.0,
      saturation: 100,
      vignetteStrength: 0.6,
      scanlineOpacity: 0,
    },
  },
  VOID: {
    id: "VOID",
    name: "The Void",
    color: "#a1a1aa",
    colorHsl: { h: 240, s: 5, l: 63 },
    angle: 0,
    unlockXP: 1500, // Level ~10
    description: "The space between spaces, where entropy reigns",
    tracks: ["void"],
    vowelAffinities: ["UW", "IH"],
    glyph: "∅",
    atmosphere: {
      auroraIntensity: 0.2,
      saturation: 10,
      vignetteStrength: 0.9,
      scanlineOpacity: 0,
    },
  },
  ALCHEMY: {
    id: "ALCHEMY",
    name: "Verbal Alchemy",
    color: "#D500F9",
    colorHsl: { h: 286, s: 100, l: 52 },
    angle: 144,
    unlockXP: 8000, // Level ~20 (End of Neophyte)
    description: "The transmutation of meaning through spoken word",
    tracks: ["alchemy"],
    vowelAffinities: ["EY", "A", "OW"],
    glyph: "⚗",
    atmosphere: {
      auroraIntensity: 1.2,
      saturation: 110,
      vignetteStrength: 0.65,
      scanlineOpacity: 0,
    },
  },
  WILL: {
    id: "WILL",
    name: "Willpower Surge", 
    color: "#FF8A00",
    colorHsl: { h: 33, s: 100, l: 50 },
    angle: 216,
    unlockXP: 25000, // Level ~30 (Early Adept)
    description: "Focusing raw will into reality-altering force",
    tracks: ["will"],
    vowelAffinities: ["AE", "A"],
    glyph: "⚡",
    atmosphere: {
      auroraIntensity: 1.1,
      saturation: 100,
      vignetteStrength: 0.6,
      scanlineOpacity: 0,
    },
  },
  
  // === FUTURE UNLOCKABLE SCHOOLS (examples) ===
  // These can be added without code changes
  NECROMANCY: {
    id: "NECROMANCY",
    name: "Necromancy",
    color: null, // Will be computed if null
    colorHsl: { h: 120, s: 60, l: 30 }, // Dark green
    angle: 36,
    unlockXP: 100000, // Level ~45 (Expert)
    description: "Communication with and manipulation of life force",
    tracks: [],
    vowelAffinities: ["OY"],
    glyph: "☠",
    atmosphere: {
      auroraIntensity: 0.8,
      saturation: 80,
      vignetteStrength: 0.8,
      scanlineOpacity: 0,
    },
  },
  ABJURATION: {
    id: "ABJURATION",
    name: "Abjuration",
    color: null,
    colorHsl: { h: 0, s: 0, l: 90 }, // White/silver
    angle: 108,
    unlockXP: 500000, // Level ~60 (Master)
    description: "Protective magic and negation of effects",
    tracks: [],
    vowelAffinities: [],
    glyph: "◇",
    atmosphere: {
      auroraIntensity: 0.6,
      saturation: 30,
      vignetteStrength: 0.5,
      scanlineOpacity: 0,
    },
  },
  DIVINATION: {
    id: "DIVINATION",
    name: "Divination",
    color: null,
    colorHsl: { h: 50, s: 90, l: 60 }, // Gold
    angle: 180,
    unlockXP: 2000000, // Level ~80 (Godlike)
    description: "Seeing across time and space",
    tracks: [],
    vowelAffinities: [],
    glyph: "◉",
    atmosphere: {
      auroraIntensity: 0.9,
      saturation: 90,
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
