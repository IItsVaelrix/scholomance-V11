/**
 * School Color Skins for Truesight
 *
 * Each school provides a full remapping of all 16 vowel families
 * into shades that match the school's aesthetic. This lets users
 * pick a "skin" that changes how Truesight colors look while
 * keeping the vowel-family analysis logic identical.
 *
 * The default skin uses the original rainbow VOWEL_COLORS.
 * Light-mode variants use darker/more saturated colors for contrast on white.
 */

// Original rainbow palette (the default Truesight colors)
export const DEFAULT_VOWEL_COLORS = {
  IY: "#60a5fa",
  IH: "#818cf8",
  EY: "#a78bfa",
  EH: "#c084fc",
  AE: "#f472b6",
  A:  "#fb7185",
  AA: "#fb7185",
  AO: "#fbbf24",
  OW: "#facc15",
  UH: "#a3e635",
  UW: "#4ade80",
  AH: "#2dd4bf",
  ER: "#22d3ee",
  AY: "#f97316",
  AW: "#ef4444",
  OY: "#ec4899",
};

// Light-mode default: darker/saturated for contrast on white
const DEFAULT_LIGHT_COLORS = {
  IY: "#2563eb",
  IH: "#4f46e5",
  EY: "#7c3aed",
  EH: "#9333ea",
  AE: "#db2777",
  A:  "#e11d48",
  AA: "#e11d48",
  AO: "#d97706",
  OW: "#ca8a04",
  UH: "#65a30d",
  UW: "#16a34a",
  AH: "#0d9488",
  ER: "#0891b2",
  AY: "#ea580c",
  AW: "#dc2626",
  OY: "#be185d",
};

// Sonic: purples and violets
const SONIC_COLORS = {
  IY: "#ede9fe",
  IH: "#ddd6fe",
  EY: "#c4b5fd",
  EH: "#a78bfa",
  AE: "#8b5cf6",
  A:  "#7c3aed",
  AA: "#7c3aed",
  AO: "#6d28d9",
  OW: "#5b21b6",
  UH: "#4c1d95",
  UW: "#9333ea",
  AH: "#a855f7",
  ER: "#d8b4fe",
  AY: "#c084fc",
  AW: "#7e22ce",
  OY: "#581c87",
};

// Sonic light: mid-to-dark purples for white backgrounds
const SONIC_LIGHT_COLORS = {
  IY: "#7c3aed",
  IH: "#6d28d9",
  EY: "#5b21b6",
  EH: "#7c3aed",
  AE: "#6d28d9",
  A:  "#5b21b6",
  AA: "#5b21b6",
  AO: "#4c1d95",
  OW: "#3b0764",
  UH: "#2e1065",
  UW: "#7e22ce",
  AH: "#8b5cf6",
  ER: "#9333ea",
  AY: "#7c3aed",
  AW: "#5b21b6",
  OY: "#3b0764",
};

// Psychic: cyans and teals
const PSYCHIC_COLORS = {
  IY: "#ecfeff",
  IH: "#cffafe",
  EY: "#a5f3fc",
  EH: "#67e8f9",
  AE: "#22d3ee",
  A:  "#06b6d4",
  AA: "#06b6d4",
  AO: "#0891b2",
  OW: "#0e7490",
  UH: "#155e75",
  UW: "#14b8a6",
  AH: "#2dd4bf",
  ER: "#99f6e4",
  AY: "#5eead4",
  AW: "#0d9488",
  OY: "#134e4a",
};

// Psychic light: mid-to-dark cyans for white backgrounds
const PSYCHIC_LIGHT_COLORS = {
  IY: "#0891b2",
  IH: "#0e7490",
  EY: "#155e75",
  EH: "#0891b2",
  AE: "#0e7490",
  A:  "#155e75",
  AA: "#155e75",
  AO: "#164e63",
  OW: "#134e4a",
  UH: "#0f3d3e",
  UW: "#0d9488",
  AH: "#0f766e",
  ER: "#0d9488",
  AY: "#0f766e",
  AW: "#115e59",
  OY: "#134e4a",
};

// Void: grays and silvers
const VOID_COLORS = {
  IY: "#fafafa",
  IH: "#e4e4e7",
  EY: "#d4d4d8",
  EH: "#a1a1aa",
  AE: "#71717a",
  A:  "#52525b",
  AA: "#52525b",
  AO: "#3f3f46",
  OW: "#27272a",
  UH: "#18181b",
  UW: "#a3a3a3",
  AH: "#737373",
  ER: "#d4d4d4",
  AY: "#525252",
  AW: "#404040",
  OY: "#262626",
};

// Void light: already has good dark values, use darker end
const VOID_LIGHT_COLORS = {
  IY: "#71717a",
  IH: "#52525b",
  EY: "#3f3f46",
  EH: "#52525b",
  AE: "#3f3f46",
  A:  "#27272a",
  AA: "#27272a",
  AO: "#18181b",
  OW: "#0a0a0a",
  UH: "#0a0a0a",
  UW: "#525252",
  AH: "#404040",
  ER: "#52525b",
  AY: "#27272a",
  AW: "#18181b",
  OY: "#0a0a0a",
};

// Alchemy: magentas and pinks
const ALCHEMY_COLORS = {
  IY: "#fdf4ff",
  IH: "#fae8ff",
  EY: "#f5d0fe",
  EH: "#e879f9",
  AE: "#d946ef",
  A:  "#c026d3",
  AA: "#c026d3",
  AO: "#a21caf",
  OW: "#86198f",
  UH: "#701a75",
  UW: "#e879f9",
  AH: "#f0abfc",
  ER: "#f5d0fe",
  AY: "#d946ef",
  AW: "#9333ea",
  OY: "#581c87",
};

// Alchemy light: darker magentas for white backgrounds
const ALCHEMY_LIGHT_COLORS = {
  IY: "#a21caf",
  IH: "#86198f",
  EY: "#701a75",
  EH: "#a21caf",
  AE: "#86198f",
  A:  "#701a75",
  AA: "#701a75",
  AO: "#581c87",
  OW: "#4a044e",
  UH: "#3b0764",
  UW: "#a21caf",
  AH: "#86198f",
  ER: "#701a75",
  AY: "#86198f",
  AW: "#5b21b6",
  OY: "#3b0764",
};

// Will: oranges and ambers
const WILL_COLORS = {
  IY: "#fff7ed",
  IH: "#ffedd5",
  EY: "#fed7aa",
  EH: "#fdba74",
  AE: "#fb923c",
  A:  "#f97316",
  AA: "#f97316",
  AO: "#ea580c",
  OW: "#c2410c",
  UH: "#9a3412",
  UW: "#fbbf24",
  AH: "#f59e0b",
  ER: "#fcd34d",
  AY: "#d97706",
  AW: "#b45309",
  OY: "#78350f",
};

// Will light: darker oranges/ambers for white backgrounds
const WILL_LIGHT_COLORS = {
  IY: "#c2410c",
  IH: "#9a3412",
  EY: "#7c2d12",
  EH: "#c2410c",
  AE: "#9a3412",
  A:  "#7c2d12",
  AA: "#7c2d12",
  AO: "#78350f",
  OW: "#713f12",
  UH: "#451a03",
  UW: "#b45309",
  AH: "#92400e",
  ER: "#a16207",
  AY: "#78350f",
  AW: "#713f12",
  OY: "#431407",
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
 * Light-mode school skins (darker/saturated for contrast on white).
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
 * @param {string} school - School ID or 'DEFAULT'
 * @param {string} [theme='dark'] - 'dark' or 'light'
 * @returns {Record<string, string>} Vowel family → hex color mapping
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  const skins = theme === 'light' ? SCHOOL_SKINS_LIGHT : SCHOOL_SKINS;
  return skins[school?.toUpperCase()] || (theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS);
}
