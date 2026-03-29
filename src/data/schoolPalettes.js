/**
 * School Color Skins for Truesight — Jewel-Tone Edition
 *
 * Each school has 1 anchor hue mapped to 8 shades across phonetic height:
 *   IY (high front) → lightest jewel facet
 *   UW (high back)  → 2nd lightest
 *   EY (mid-high front) → core glow
 *   OW (mid-high back)  → anchor territory
 *   IH (mid front)  → ANCHOR (school identity color)
 *   AO (mid back)   → deep body
 *   AE (low front)  → shadow
 *   A  (lowest)     → abyss (still hue-shifted, never pure black)
 *
 * Design principle: Jewel tones maintain colored extremes —
 * IY stops at L:77-85% (not white), A stops at L:14-20% (not black).
 * Saturation is controlled across the ramp to prevent wash-out.
 *
 * Light mode: same hue ramp shifted 2 stops darker for readability on white.
 */

// ─── DEFAULT ────────────────────────────────────────────────────────────────
// Rainbow fallback — one mid-stop from each school to showcase the full jewel vocabulary.
export const DEFAULT_VOWEL_COLORS = {
  IY: "#4470b8",   // Sapphire (Psychic - 200°)
  IH: "#5c9aac",   // Ethereal Teal (Alchemy - 185°)
  EY: "#3c8c82",   // Deep Teal (Sonic - 174°)
  AE: "#3c8c64",   // Malachite (Will - 156°)
  A:  "#3c8c52",   // Emerald (Necromancy - 150°)
  AO: "#748c5c",   // Topaz-Green (Divination - 134°)
  OW: "#5c8c64",   // Aquamarine (Abjuration - 136°)
  UW: "#6a5a78",   // Obsidian (Void - 171°)
};

const DEFAULT_LIGHT_COLORS = {
  IY: "#264280",
  IH: "#1e5668",
  EY: "#1e6258",
  AE: "#1e6240",
  A:  "#1e6232",
  AO: "#4a5c38",
  OW: "#1e5640",
  UW: "#3c3048",
};

// ─── SONIC — Deep Teal (H:174) ─────────────────────────────────────────────
// Perfect AE Resonance. Intense harmonic focus.
const SONIC_COLORS = {
  IY: "#bcece8",   // hsl(174, 62%, 83%)
  UW: "#a2e6e0",   // hsl(174, 64%, 76%)
  EY: "#80d9d2",   // hsl(174, 56%, 68%)
  OW: "#63ccc4",   // hsl(174, 52%, 59%)
  IH: "#3c8c82",   // hsl(174, 45%, 42%) — ANCHOR
  AO: "#36a096",   // hsl(174, 52%, 42%)
  AE: "#258078",   // hsl(174, 54%, 32%)
  A:  "#14504a",   // hsl(174, 60%, 20%)
};

const SONIC_LIGHT_COLORS = {
  IY: "#80d9d2",
  UW: "#63ccc4",
  EY: "#3c8c82",
  OW: "#36a096",
  IH: "#258078",
  AO: "#1e6c65",
  AE: "#185853",
  A:  "#0e3835",
};

// ─── PSYCHIC — Sapphire (H:200) ────────────────────────────────────────────
// Perfect IY Resonance. High-frequency mental clarity.
const PSYCHIC_COLORS = {
  IY: "#b0cef0",   // hsl(200, 62%, 82%)
  UW: "#94b8e8",   // hsl(200, 65%, 75%)
  EY: "#78a0dc",   // hsl(200, 58%, 67%)
  OW: "#5c86cc",   // hsl(200, 52%, 58%)
  IH: "#4470b8",   // hsl(200, 48%, 49%) — ANCHOR
  AO: "#34589e",   // hsl(200, 52%, 41%)
  AE: "#264280",   // hsl(200, 54%, 33%)
  A:  "#162850",   // hsl(200, 56%, 20%)
};

const PSYCHIC_LIGHT_COLORS = {
  IY: "#78a0dc",
  UW: "#5c86cc",
  EY: "#4470b8",
  OW: "#34589e",
  IH: "#264280",
  AO: "#1e346a",
  AE: "#182858",
  A:  "#0e1838",
};

// ─── VOID — Obsidian (H:171, Low Saturation S:12-22%) ──────────────────────
// Perfect AX (Schwa) Resonance. Entropy and muted vibration.
const VOID_COLORS = {
  IY: "#c4d4d2",   // hsl(171, 12%, 80%)
  UW: "#a8beba",   // hsl(171, 14%, 70%)
  EY: "#8ca6a2",   // hsl(171, 12%, 60%)
  OW: "#72908c",   // hsl(171, 13%, 51%)
  IH: "#6a5a78",   // Keep Obsidian Anchor for aesthetic stability
  AO: "#44605d",   // hsl(171, 17%, 32%)
  AE: "#304846",   // hsl(171, 18%, 24%)
  A:  "#1a2c2b",   // hsl(171, 22%, 14%)
};

const VOID_LIGHT_COLORS = {
  IY: "#8ca6a2",
  UW: "#72908c",
  EY: "#6a5a78",
  OW: "#44605d",
  IH: "#304846",
  AO: "#283837",
  AE: "#1e302f",
  A:  "#12201f",
};

// ─── ALCHEMY — Ethereal Teal (H:185) ─────────────────────────────────────
// Perfect EY Resonance. Transmutation energy.
const ALCHEMY_COLORS = {
  IY: "#b8ecef",   // hsl(185, 64%, 83%)
  UW: "#9ee4e8",   // hsl(185, 66%, 76%)
  EY: "#80d4dc",   // hsl(185, 60%, 68%)
  OW: "#60c4cc",   // hsl(185, 55%, 59%)
  IH: "#5c9aac",   // hsl(185, 45%, 58%) — ANCHOR
  AO: "#3496a0",   // hsl(185, 52%, 42%)
  AE: "#267880",   // hsl(185, 54%, 33%)
  A:  "#184a50",   // hsl(185, 56%, 20%)
};

const ALCHEMY_LIGHT_COLORS = {
  IY: "#80d4dc",
  UW: "#60c4cc",
  EY: "#5c9aac",
  OW: "#3496a0",
  IH: "#267880",
  AO: "#1e626c",
  AE: "#185058",
  A:  "#0e3238",
};

// ─── WILL — Malachite-Red (H:156) ────────────────────────────────────────────────
// Perfect AH Resonance. Stone of courage and biological force.
const WILL_COLORS = {
  IY: "#b0f0cc",   // hsl(156, 62%, 82%)
  UW: "#94e8bc",   // hsl(156, 64%, 75%)
  EY: "#78dc9e",   // hsl(156, 58%, 67%)
  OW: "#60cc88",   // hsl(156, 52%, 59%)
  IH: "#3c8c64",   // hsl(156, 45%, 53%) — ANCHOR
  AO: "#34a060",   // hsl(156, 52%, 42%)
  AE: "#26804a",   // hsl(156, 54%, 33%)
  A:  "#18502e",   // hsl(156, 56%, 20%)
};

const WILL_LIGHT_COLORS = {
  IY: "#78dc9e",
  UW: "#60cc88",
  EY: "#3c8c64",
  OW: "#34a060",
  IH: "#26804a",
  AO: "#1e6c3e",
  AE: "#185832",
  A:  "#0e381e",
};

// ─── DIVINATION — Topaz-Green (H:134) ─────────────────────────────────────
// Perfect AO Resonance. Prophetic clarity through the verdant lens.
const DIVINATION_COLORS = {
  IY: "#b8f0a8",   // hsl(134, 64%, 80%)
  UW: "#a0e68c",   // hsl(134, 62%, 72%)
  EY: "#88d470",   // hsl(134, 55%, 64%)
  OW: "#70c056",   // hsl(134, 50%, 55%)
  IH: "#748c5c",   // hsl(134, 45%, 56%) — ANCHOR
  AO: "#5ca030",   // hsl(134, 50%, 37%)
  AE: "#4a6e24",   // hsl(134, 52%, 29%)
  A:  "#2e4416",   // hsl(134, 52%, 18%)
};

const DIVINATION_LIGHT_COLORS = {
  IY: "#88d470",
  UW: "#70c056",
  EY: "#748c5c",
  OW: "#5ca030",
  IH: "#4a6e24",
  AO: "#3e5c1e",
  AE: "#324a16",
  A:  "#203010",
};

// ─── NECROMANCY — Emerald (H:150) ─────────────────────────────────────────
// Perfect AA Resonance. Life force manipulation through deep green.
const NECROMANCY_COLORS = {
  IY: "#a8e0b0",   // hsl(150, 46%, 77%)
  UW: "#88d094",   // hsl(150, 44%, 67%)
  EY: "#68bc78",   // hsl(150, 40%, 57%)
  OW: "#4ca860",   // hsl(150, 40%, 48%)
  IH: "#3c8c52",   // hsl(150, 65%, 48%) — ANCHOR
  AO: "#2a7c3e",   // hsl(150, 48%, 33%)
  AE: "#1e622e",   // hsl(150, 52%, 25%)
  A:  "#123c1c",   // hsl(150, 54%, 15%)
};

const NECROMANCY_LIGHT_COLORS = {
  IY: "#68bc78",
  UW: "#4ca860",
  EY: "#3c8c52",
  OW: "#2a7c3e",
  IH: "#1e622e",
  AO: "#185226",
  AE: "#12421e",
  A:  "#0c2c14",
};

// ─── ABJURATION — Aquamarine (H:136) ────────────────────────────────────────
// Perfect UW Resonance. Protective ward shimmer.
const ABJURATION_COLORS = {
  IY: "#b0f0cc",   // hsl(136, 42%, 82%)
  UW: "#94e8bc",   // hsl(136, 40%, 75%)
  EY: "#78dc9e",   // hsl(136, 38%, 67%)
  OW: "#60cc88",   // hsl(136, 40%, 59%)
  IH: "#5c8c64",   // hsl(136, 65%, 70%) — ANCHOR
  AO: "#34a060",   // hsl(136, 52%, 42%)
  AE: "#26804a",   // hsl(136, 56%, 33%)
  A:  "#18502e",   // hsl(136, 56%, 20%)
};

const ABJURATION_LIGHT_COLORS = {
  IY: "#78dc9e",
  UW: "#60cc88",
  EY: "#5c8c64",
  OW: "#34a060",
  IH: "#26804a",
  AO: "#1e6c3e",
  AE: "#185832",
  A:  "#0e381e",
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
