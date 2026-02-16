/**
 * School Color Skins for Truesight
 *
 * Each school provides a full remapping of 12 core vowel families
 * into shades that match the school's aesthetic. This lets users
 * pick a "skin" that changes how Truesight colors look while
 * keeping the vowel-family analysis logic identical.
 *
 * 11 Core Vowel Families:
 * 1. IY - High front (machine, blue, gene)
 * 2. IH - Near-high front (obelisk, continent)
 * 3. EY - Mid front (bait, day)
 * 4. AE - Low front (bat, dragon) + EH
 * 5. AY - Wide diphthong (like, time)
 * 6. AW - Wide diphthong (mouth, loud)
 * 7. A - Low back (obvious, monument) + AA
 * 8. AO - Mid back rounded (water, slaughter) - DISTINCT
 * 9. OW - Mid-high back (soul, cold, boulder) + OY
 * 10. U - High/Mid back/central (boot, foot, strut, schwa) - GREEN CORE FAMILY
 * 11. UR - Rhotic mid (nurse, bird)
 *
 * The default skin uses the original rainbow VOWEL_COLORS.
 * Light-mode variants use darker/saturated colors for contrast on white.
 */

// Original rainbow palette (the default Truesight colors)
export const DEFAULT_VOWEL_COLORS = {
  IY: "#3b82f6",   // bright blue (FLEECE)
  IH: "#06b6d4",   // cyan (KIT)
  EY: "#a78bfa",   // violet (FACE)
  AE: "#f472b6",   // pink (TRAP)
  AY: "#22d3ee",   // bright cyan (PRICE/I)
  AW: "#ef4444",   // red
  A:  "#fb7185",   // rose
  AO: "#fbbf24",   // amber
  OW: "#facc15",   // yellow
  OY: "#d946ef",   // magenta
  UR: "#10b981",   // emerald
  U:  "#4ade80",   // green
};

// Light-mode default
const DEFAULT_LIGHT_COLORS = {
  IY: "#1d4ed8",
  IH: "#0891b2",
  EY: "#7c3aed",
  AE: "#db2777",
  AY: "#0e7490",
  AW: "#dc2626",
  A:  "#e11d48",
  AO: "#d97706",
  OW: "#ca8a04",
  OY: "#a21caf",
  UR: "#059669",
  U:  "#16a34a",
};

// Sonic: purples and violets
const SONIC_COLORS = {
  IY: "#ede9fe",
  IH: "#ddd6fe",
  EY: "#c4b5fd",
  AE: "#8b5cf6",
  A:  "#7c3aed",
  AO: "#6d28d9",
  OW: "#5b21b6",
  OY: "#4c1d95",
  UR: "#2e1065",
  AY: "#4c1d95",
  U:  "#9333ea",
};

const SONIC_LIGHT_COLORS = {
  IY: "#7c3aed",
  IH: "#6d28d9",
  EY: "#5b21b6",
  AE: "#6d28d9",
  A:  "#5b21b6",
  AO: "#4c1d95",
  OW: "#3b0764",
  OY: "#2e1065",
  UR: "#1e1b4b",
  AY: "#3b0764",
  U:  "#7e22ce",
};

// Psychic: cyans and teals
const PSYCHIC_COLORS = {
  IY: "#ecfeff",
  IH: "#cffafe",
  EY: "#a5f3fc",
  AE: "#22d3ee",
  A:  "#06b6d4",
  AO: "#0891b2",
  OW: "#0e7490",
  OY: "#155e75",
  UR: "#164e63",
  AY: "#0891b2",
  U:  "#14b8a6",
};

const PSYCHIC_LIGHT_COLORS = {
  IY: "#0891b2",
  IH: "#0e7490",
  EY: "#155e75",
  AE: "#0e7490",
  A:  "#155e75",
  AO: "#164e63",
  OW: "#134e4a",
  OY: "#042f2e",
  UR: "#083344",
  AY: "#164e63",
  U:  "#0d9488",
};

// Void: grays and silvers
const VOID_COLORS = {
  IY: "#fafafa",
  IH: "#e4e4e7",
  EY: "#d4d4d8",
  AE: "#71717a",
  A:  "#52525b",
  AO: "#3f3f46",
  OW: "#27272a",
  OY: "#18181b",
  UR: "#09090b",
  AY: "#3f3f46",
  U:  "#a3a3a3",
};

const VOID_LIGHT_COLORS = {
  IY: "#71717a",
  IH: "#52525b",
  EY: "#3f3f46",
  AE: "#52525b",
  A:  "#27272a",
  AO: "#18181b",
  OW: "#0a0a0a",
  OY: "#000000",
  UR: "#000000",
  AY: "#18181b",
  U:  "#525252",
};

// Alchemy: magentas and pinks
const ALCHEMY_COLORS = {
  IY: "#fdf4ff",
  IH: "#fae8ff",
  EY: "#f5d0fe",
  AE: "#d946ef",
  AY: "#c026d3",
  AW: "#a21caf",
  A:  "#c026d3",
  AO: "#a21caf",
  OW: "#86198f",
  OY: "#701a75",
  UR: "#4a044e",
  U:  "#e879f9",
};

const ALCHEMY_LIGHT_COLORS = {
  IY: "#a21caf",
  IH: "#86198f",
  EY: "#701a75",
  AE: "#86198f",
  AY: "#701a75",
  AW: "#581c87",
  A:  "#701a75",
  AO: "#581c87",
  OW: "#4a044e",
  OY: "#2e0030",
  UR: "#2e0030",
  U:  "#a21caf",
};

// Will: oranges and ambers
const WILL_COLORS = {
  IY: "#fff7ed",
  IH: "#ffedd5",
  EY: "#fed7aa",
  AE: "#fb923c",
  A:  "#f97316",
  AO: "#ea580c",
  OW: "#c2410c",
  OY: "#9a3412",
  UR: "#7c2d12",
  AY: "#ea580c",
  U:  "#fbbf24",
};

const WILL_LIGHT_COLORS = {
  IY: "#c2410c",
  IH: "#9a3412",
  EY: "#7c2d12",
  AE: "#9a3412",
  A:  "#7c2d12",
  AO: "#78350f",
  OW: "#713f12",
  OY: "#431407",
  UR: "#451a03",
  AY: "#78350f",
  U:  "#b45309",
};

/**
 * All available school skins (dark mode).
 */
export const SCHOOL_SKINS = {
  DEFAULT: DEFAULT_VOWEL_COLORS,
  SONIC: SONIC_COLORS,
  PSYCHIC: PSYCHIC_COLORS,
  VOID: VOID_COLORS,
  ALCHEMY: ALCHEMY_COLORS,
  WILL: WILL_COLORS,
};

/**
 * Light-mode school skins.
 */
export const SCHOOL_SKINS_LIGHT = {
  DEFAULT: DEFAULT_LIGHT_COLORS,
  SONIC: SONIC_LIGHT_COLORS,
  PSYCHIC: PSYCHIC_LIGHT_COLORS,
  VOID: VOID_LIGHT_COLORS,
  ALCHEMY: ALCHEMY_LIGHT_COLORS,
  WILL: WILL_LIGHT_COLORS,
};

/**
 * Returns the vowel color map for a given school skin, theme-aware.
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  const skins = theme === 'light' ? SCHOOL_SKINS_LIGHT : SCHOOL_SKINS;
  return skins[school?.toUpperCase()] || (theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS);
}
