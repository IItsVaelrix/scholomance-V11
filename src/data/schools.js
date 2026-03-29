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
  // Core 8 mappings — balanced across all 8 schools
  IY: 'PSYCHIC',      // High-front clarity
  IH: 'SONIC',        // Mid-front resonance
  EY: 'ALCHEMY',      // Diphthong transmutation
  AE: 'WILL',         // Low-front force
  A:  'NECROMANCY',   // Low-back death register
  AO: 'DIVINATION',   // Mid-back oracle vowel
  OW: 'ABJURATION',   // Rounded-back protective
  UW: 'ABJURATION',   // High-back closed/warding

  // ARPAbet Aliases — redistributed to 8 schools
  AA: 'NECROMANCY',   // Open-back death register
  AH: 'WILL',        // Low force vowel
  AX: 'VOID',        // Schwa → entropy (most common, muted by VOID's low saturation)
  AW: 'DIVINATION',  // Open-back oracle diphthong
  EH: 'WILL',        // Low-front force
  AY: 'PSYCHIC',     // Bright diphthong → mental clarity
  OY: 'ALCHEMY',     // Diphthong transmutation
  OH: 'ABJURATION',  // Rounded-back → protective
  UH: 'VOID',        // Reduced vowel → entropy
  OO: 'ABJURATION',  // Rounded-back → protective
  ER: 'SONIC',       // Rhotacized → resonance
  UR: 'SONIC',       // Rhotacized → resonance
});

export const SCHOOLS = {
  // === INITIAL 5 SCHOOLS ===
  SONIC: {
    id: "SONIC",
    name: "Sonic Thaumaturgy",
    color: "#a855f7", // Distinctive Purple
    colorHsl: { h: 275, s: 85, l: 55 },
    angle: 288,
    unlockXP: 0,
    description: "The art of sonic manipulation and harmonic resonance",
    tracks: ["sonic_harmony"],
    vowelAffinities: ["AE", "EH"],
    glyph: "♩",
    atmosphere: {
      auroraIntensity: 0.9,
      saturation: 90,
      vignetteStrength: 0.70,
      scanlineOpacity: 0,
    },
  },
  PSYCHIC: {
    id: "PSYCHIC",
    name: "Psychic Schism",
    color: "#3b82f6", // Distinctive Blue
    colorHsl: { h: 220, s: 90, l: 60 },
    angle: 72,
    unlockXP: 250,
    description: "Mental discipline and psychic energy projection",
    tracks: ["schism"],
    vowelAffinities: ["IY", "IH"],
    glyph: "◬",
    atmosphere: {
      auroraIntensity: 0.8,
      saturation: 85,
      vignetteStrength: 0.65,
      scanlineOpacity: 0,
    },
  },
  VOID: {
    id: "VOID",
    name: "The Void",
    color: "#94a3b8", // Neutral Slate/Grey
    colorHsl: { h: 215, s: 15, l: 41 },
    angle: 0,
    unlockXP: 1500,
    description: "The space between spaces, where entropy reigns",
    tracks: ["void"],
    vowelAffinities: ["AX", "UH"],
    glyph: "∅",
    atmosphere: {
      auroraIntensity: 0.15,
      saturation: 15,
      vignetteStrength: 0.92,
      scanlineOpacity: 0.02,
    },
  },
  ALCHEMY: {
    id: "ALCHEMY",
    name: "Verbal Alchemy",
    color: "#ec4899", // Distinctive Pink
    colorHsl: { h: 325, s: 80, l: 58 },
    angle: 144,
    unlockXP: 8000,
    description: "The transmutation of meaning through spoken word",
    tracks: ["alchemy"],
    vowelAffinities: ["EY", "OY"],
    glyph: "⚗",
    atmosphere: {
      auroraIntensity: 1.1,
      saturation: 105,
      vignetteStrength: 0.60,
      scanlineOpacity: 0,
    },
  },
  WILL: {
    id: "WILL",
    name: "Willpower Surge",
    color: "#ef4444", // Distinctive Red
    colorHsl: { h: 0, s: 85, l: 48 },
    angle: 216,
    unlockXP: 25000,
    description: "Focusing raw will into reality-altering force",
    tracks: ["will"],
    vowelAffinities: ["AH"],
    glyph: "⚡",
    atmosphere: {
      auroraIntensity: 1.0,
      saturation: 95,
      vignetteStrength: 0.62,
      scanlineOpacity: 0,
    },
  },

  // === UNLOCKABLE SCHOOLS ===
  NECROMANCY: {
    id: "NECROMANCY",
    name: "Necromancy",
    color: "#22c55e", // Distinctive Green
    colorHsl: { h: 120, s: 75, l: 40 },
    angle: 36,
    unlockXP: 100000,
    description: "Communication with and manipulation of life force",
    tracks: [],
    vowelAffinities: ["AA", "A"],
    glyph: "☠",
    atmosphere: {
      auroraIntensity: 0.6,
      saturation: 55,
      vignetteStrength: 0.82,
      scanlineOpacity: 0.01,
    },
  },
  ABJURATION: {
    id: "ABJURATION",
    name: "Abjuration",
    color: "#06b6d4", // Distinctive Cyan
    colorHsl: { h: 180, s: 80, l: 68 },
    angle: 108,
    unlockXP: 500000,
    description: "Protective magic and negation of effects",
    tracks: [],
    vowelAffinities: ["UW", "OW"],
    glyph: "◇",
    atmosphere: {
      auroraIntensity: 0.5,
      saturation: 50,
      vignetteStrength: 0.50,
      scanlineOpacity: 0,
    },
  },
  DIVINATION: {
    id: "DIVINATION",
    name: "Divination",
    color: "#eab308", // Distinctive Gold/Yellow
    colorHsl: { h: 45, s: 90, l: 68 },
    angle: 180,
    unlockXP: 2000000,
    description: "Seeing across time and space",
    tracks: [],
    vowelAffinities: ["AO", "AW"],
    glyph: "◉",
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
