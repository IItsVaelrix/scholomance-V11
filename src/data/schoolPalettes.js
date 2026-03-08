/**
 * School Color Skins for Truesight
 *
 * Each school has 1 anchor hue mapped to 8 shades across phonetic height:
 *   IY (high front) → lightest
 *   UW (high back)  → 2nd lightest
 *   EY (mid-high front) → 3rd
 *   OW (mid-high back)  → 4th
 *   IH (mid front)  → 5th
 *   AO (mid back)   → 6th
 *   AE (low front)  → 7th
 *   A  (lowest)     → darkest
 *
 * Light mode: same hue ramp shifted 2 stops darker for readability on white.
 */

// 8 Core Vowel Families:
// IY - High front (machine, blue)        → school: PSYCHIC
// IH - Near-high front (obelisk) + ER    → school: SONIC
// EY - Mid front (bait, day) + AY        → school: ALCHEMY / PSYCHIC
// AE - Low front (bat, dragon) + EH      → school: WILL
// A  - Low back (obvious) + AA, AH, AX   → school: WILL
// AO - Mid back rounded (water)          → school: SONIC
// OW - Mid-high back (soul, cold)        → school: ALCHEMY
// UW - High back (boot) + OO, YUW, UH   → school: VOID

// ─── DEFAULT ────────────────────────────────────────────────────────────────
// Rainbow fallback — used when no school is selected.
export const DEFAULT_VOWEL_COLORS = {
  IY: "#3b82f6",   // bright blue (FLEECE)
  IH: "#06b6d4",   // cyan (KIT)
  EY: "#a78bfa",   // violet (FACE)
  AE: "#f472b6",   // pink (TRAP)
  A:  "#fb7185",   // rose (LOT)
  AO: "#fbbf24",   // amber (THOUGHT)
  OW: "#facc15",   // yellow (GOAT)
  UW: "#4ade80",   // green (GOOSE)
};

const DEFAULT_LIGHT_COLORS = {
  IY: "#1d4ed8",
  IH: "#0891b2",
  EY: "#7c3aed",
  AE: "#db2777",
  A:  "#e11d48",
  AO: "#d97706",
  OW: "#ca8a04",
  UW: "#16a34a",
};

// ─── SONIC ──────────────────────────────────────────────────────────────────
// Anchor: violet-purple. Phonetic-height ramp light → dark.
const SONIC_COLORS = {
  IY: "#f5f3ff",   // near-white violet
  UW: "#ddd6fe",   // pale lavender
  EY: "#c4b5fd",   // medium lavender
  OW: "#a78bfa",   // medium violet
  IH: "#8b5cf6",   // mid violet
  AO: "#7c3aed",   // anchor
  AE: "#6d28d9",   // dark violet
  A:  "#4c1d95",   // deep violet
};

const SONIC_LIGHT_COLORS = {
  IY: "#ddd6fe",
  UW: "#c4b5fd",
  EY: "#a78bfa",
  OW: "#8b5cf6",
  IH: "#7c3aed",
  AO: "#6d28d9",
  AE: "#5b21b6",
  A:  "#3b0764",
};

// ─── PSYCHIC ─────────────────────────────────────────────────────────────────
// Anchor: cyan. Phonetic-height ramp light → dark.
const PSYCHIC_COLORS = {
  IY: "#ecfeff",
  UW: "#cffafe",
  EY: "#a5f3fc",
  OW: "#67e8f9",
  IH: "#22d3ee",
  AO: "#06b6d4",   // anchor
  AE: "#0891b2",
  A:  "#164e63",
};

const PSYCHIC_LIGHT_COLORS = {
  IY: "#cffafe",
  UW: "#a5f3fc",
  EY: "#67e8f9",
  OW: "#22d3ee",
  IH: "#06b6d4",
  AO: "#0891b2",
  AE: "#0e7490",
  A:  "#083344",
};

// ─── VOID ────────────────────────────────────────────────────────────────────
// Anchor: zinc-gray. Neutral ramp near-white → near-black.
const VOID_COLORS = {
  IY: "#fafafa",
  UW: "#e4e4e7",
  EY: "#d4d4d8",
  OW: "#a1a1aa",
  IH: "#71717a",   // anchor
  AO: "#52525b",
  AE: "#3f3f46",
  A:  "#18181b",
};

const VOID_LIGHT_COLORS = {
  IY: "#d4d4d8",
  UW: "#a1a1aa",
  EY: "#71717a",
  OW: "#52525b",
  IH: "#3f3f46",
  AO: "#27272a",
  AE: "#18181b",
  A:  "#09090b",
};

// ─── ALCHEMY ──────────────────────────────────────────────────────────────────
// Anchor: magenta. Phonetic-height ramp light → dark.
const ALCHEMY_COLORS = {
  IY: "#fdf4ff",
  UW: "#fae8ff",
  EY: "#f5d0fe",
  OW: "#e879f9",
  IH: "#d946ef",
  AO: "#c026d3",   // anchor
  AE: "#a21caf",
  A:  "#701a75",
};

const ALCHEMY_LIGHT_COLORS = {
  IY: "#fae8ff",
  UW: "#f5d0fe",
  EY: "#e879f9",
  OW: "#d946ef",
  IH: "#c026d3",
  AO: "#a21caf",
  AE: "#86198f",
  A:  "#4a044e",
};

// ─── WILL ─────────────────────────────────────────────────────────────────────
// Anchor: orange-amber. Phonetic-height ramp light → dark.
const WILL_COLORS = {
  IY: "#fff7ed",
  UW: "#ffedd5",
  EY: "#fed7aa",
  OW: "#fdba74",
  IH: "#fb923c",
  AO: "#f97316",   // anchor
  AE: "#ea580c",
  A:  "#7c2d12",
};

const WILL_LIGHT_COLORS = {
  IY: "#ffedd5",
  UW: "#fed7aa",
  EY: "#fdba74",
  OW: "#fb923c",
  IH: "#f97316",
  AO: "#ea580c",
  AE: "#c2410c",
  A:  "#431407",
};

// ─── DIVINATION ───────────────────────────────────────────────────────────────
// Anchor: gold/amber (oracle, prophetic sight). Glyph: ◉
const DIVINATION_COLORS = {
  IY: "#fffbeb",   // Starlight
  UW: "#fef3c7",   // Luminous Gold
  EY: "#fde68a",   // Solar Flare
  OW: "#fcd34d",   // Amber Vision
  IH: "#fbbf24",   // Oracle Anchor
  AO: "#f59e0b",   // Deep Prophecy
  AE: "#d97706",   // Bronze Secret
  A:  "#78350f",   // Ancient Earth
};

const DIVINATION_LIGHT_COLORS = {
  IY: "#fde68a",
  UW: "#fcd34d",
  EY: "#fbbf24",
  OW: "#f59e0b",
  IH: "#d97706",
  AO: "#b45309",
  AE: "#92400e",
  A:  "#451a03",
};

// ─── NECROMANCY ───────────────────────────────────────────────────────────────
// Anchor: sickly green/teal (decay, undeath). Glyph: ☽
const NECROMANCY_COLORS = {
  IY: "#f0fdf4",   // Ectoplasm
  UW: "#dcfce7",   // Ghostly Mist
  EY: "#bbf7d0",   // Lichen
  OW: "#86efac",   // Toxic Fume
  IH: "#4ade80",   // Anchor (Vitality Drain)
  AO: "#22c55e",   // Decay
  AE: "#16a34a",   // Mossy Grave
  A:  "#064e3b",   // Obsidian Soil
};

const NECROMANCY_LIGHT_COLORS = {
  IY: "#bbf7d0",
  UW: "#86efac",
  EY: "#4ade80",
  OW: "#22c55e",
  IH: "#16a34a",
  AO: "#15803d",
  AE: "#166534",
  A:  "#064e3b",
};

// ─── ABJURATION ───────────────────────────────────────────────────────────────
// Anchor: crystalline/ice blue (wards, barriers). Glyph: ⬡
const ABJURATION_COLORS = {
  IY: "#f0f9ff",   // Diamond White
  UW: "#e0f2fe",   // Prism Blue
  EY: "#bae6fd",   // Glacial
  OW: "#7dd3fc",   // Sapphire
  IH: "#38bdf8",   // Anchor (Shield)
  AO: "#0ea5e9",   // Deep Ward
  AE: "#0284c7",   // Cobalt Guard
  A:  "#0c4a6e",   // Midnight Obsidian
};

const ABJURATION_LIGHT_COLORS = {
  IY: "#bae6fd",
  UW: "#7dd3fc",
  EY: "#38bdf8",
  OW: "#0ea5e9",
  IH: "#0284c7",
  AO: "#0369a1",
  AE: "#075985",
  A:  "#0c4a6e",
};

// ─── Skin Maps ────────────────────────────────────────────────────────────────

/** All school skins — dark mode. */
export const SCHOOL_SKINS = {
  DEFAULT:    DEFAULT_VOWEL_COLORS,
  SONIC:      SONIC_COLORS,
  PSYCHIC:    PSYCHIC_COLORS,
  VOID:       VOID_COLORS,
  ALCHEMY:    ALCHEMY_COLORS,
  WILL:       WILL_COLORS,
  DIVINATION: DIVINATION_COLORS,
  NECROMANCY: NECROMANCY_COLORS,
  ABJURATION: ABJURATION_COLORS,
};

/** All school skins — light mode. */
export const SCHOOL_SKINS_LIGHT = {
  DEFAULT:    DEFAULT_LIGHT_COLORS,
  SONIC:      SONIC_LIGHT_COLORS,
  PSYCHIC:    PSYCHIC_LIGHT_COLORS,
  VOID:       VOID_LIGHT_COLORS,
  ALCHEMY:    ALCHEMY_LIGHT_COLORS,
  WILL:       WILL_LIGHT_COLORS,
  DIVINATION: DIVINATION_LIGHT_COLORS,
  NECROMANCY: NECROMANCY_LIGHT_COLORS,
  ABJURATION: ABJURATION_LIGHT_COLORS,
};

/**
 * Returns the vowel color map for a given school skin, theme-aware.
 * Signature unchanged — existing callers require no update.
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  const skins = theme === 'light' ? SCHOOL_SKINS_LIGHT : SCHOOL_SKINS;
  return skins[school?.toUpperCase()] || (theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS);
}
