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
  IY: "#fffbeb",
  UW: "#fef3c7",
  EY: "#fde68a",
  OW: "#fcd34d",
  IH: "#fbbf24",
  AO: "#f59e0b",   // anchor
  AE: "#d97706",
  A:  "#78350f",
};

const DIVINATION_LIGHT_COLORS = {
  IY: "#fef3c7",
  UW: "#fde68a",
  EY: "#fcd34d",
  OW: "#fbbf24",
  IH: "#f59e0b",
  AO: "#d97706",
  AE: "#b45309",
  A:  "#451a03",
};

// ─── NECROMANCY ───────────────────────────────────────────────────────────────
// Anchor: forest green (decay, undeath). Glyph: ☽
const NECROMANCY_COLORS = {
  IY: "#f0fdf4",
  UW: "#dcfce7",
  EY: "#bbf7d0",
  OW: "#6ee7b7",
  IH: "#34d399",
  AO: "#10b981",   // anchor
  AE: "#059669",
  A:  "#064e3b",
};

const NECROMANCY_LIGHT_COLORS = {
  IY: "#dcfce7",
  UW: "#bbf7d0",
  EY: "#6ee7b7",
  OW: "#34d399",
  IH: "#10b981",
  AO: "#059669",
  AE: "#047857",
  A:  "#022c22",
};

// ─── ABJURATION ───────────────────────────────────────────────────────────────
// Anchor: ice blue (wards, barriers). Glyph: ⬡
const ABJURATION_COLORS = {
  IY: "#eff6ff",
  UW: "#dbeafe",
  EY: "#bfdbfe",
  OW: "#93c5fd",
  IH: "#60a5fa",
  AO: "#3b82f6",   // anchor
  AE: "#2563eb",
  A:  "#1e3a8a",
};

const ABJURATION_LIGHT_COLORS = {
  IY: "#dbeafe",
  UW: "#bfdbfe",
  EY: "#93c5fd",
  OW: "#60a5fa",
  IH: "#3b82f6",
  AO: "#2563eb",
  AE: "#1d4ed8",
  A:  "#1e3a8a",
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
