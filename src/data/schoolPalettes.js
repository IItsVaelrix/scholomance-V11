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
// Perfect Resonance Matrix. Intense harmonic focus.
const SONIC_COLORS = {
  IY: "#bcece8", IH: "#a6dfd9", EY: "#8ed2cc", EH: "#76c5be", AE: "#3c8c82", 
  AA: "#52a096", AH: "#6ea096", AO: "#86ccc4", OW: "#9ed9d2", UH: "#b2e6e0", 
  UW: "#c8f0ec", ER: "#8ed2cc", AX: "#76c5be", AY: "#a6dfd9", AW: "#3c8c82", 
  OY: "#52a096", UR: "#6ea096", OH: "#86ccc4", OO: "#9ed9d2", YUW: "#b2e6e0"
};

const SONIC_LIGHT_COLORS = {
  IY: "#8ed2cc", IH: "#76c5be", EY: "#3c8c82", EH: "#258078", AE: "#14504a",
  AA: "#1e6c65", AH: "#2a7c74", AO: "#36a096", OW: "#63ccc4", UH: "#80d9d2",
  UW: "#a2e6e0", ER: "#3c8c82", AX: "#258078", AY: "#76c5be", AW: "#14504a",
  OY: "#1e6c65", UR: "#2a7c74", OH: "#36a096", OO: "#63ccc4", YUW: "#80d9d2"
};

// ─── PSYCHIC — Sapphire (H:200) ────────────────────────────────────────────
// Perfect Resonance Matrix. High-frequency mental clarity.
const PSYCHIC_COLORS = {
  IY: "#b0cef0", IH: "#94b8e8", EY: "#78a0dc", EH: "#5c86cc", AE: "#4470b8",
  AA: "#34589e", AH: "#264280", AO: "#162850", OW: "#0e1838", UH: "#0a1020",
  UW: "#c8e0f8", ER: "#78a0dc", AX: "#5c86cc", AY: "#94b8e8", AW: "#4470b8",
  OY: "#34589e", UR: "#264280", OH: "#162850", OO: "#0e1838", YUW: "#0a1020"
};

const PSYCHIC_LIGHT_COLORS = {
  IY: "#78a0dc", IH: "#5c86cc", EY: "#4470b8", EH: "#34589e", AE: "#264280",
  AA: "#1e346a", AH: "#182858", AO: "#0e1838", OW: "#0a1020", UH: "#080c18",
  UW: "#94b8e8", ER: "#4470b8", AX: "#34589e", AY: "#5c86cc", AW: "#264280",
  OY: "#1e346a", UR: "#182858", OH: "#0e1838", OO: "#0a1020", YUW: "#080c18"
};

// ─── VOID — Obsidian (H:171, Low Saturation) ──────────────────────────────
const VOID_COLORS = {
  IY: "#c4d4d2", IH: "#a8beba", EY: "#8ca6a2", EH: "#72908c", AE: "#6a5a78",
  AA: "#44605d", AH: "#304846", AO: "#1a2c2b", OW: "#121818", UH: "#0a0c0c",
  UW: "#d0e0de", ER: "#8ca6a2", AX: "#72908c", AY: "#a8beba", AW: "#6a5a78",
  OY: "#44605d", UR: "#304846", OH: "#1a2c2b", OO: "#121818", YUW: "#0a0c0c"
};

const VOID_LIGHT_COLORS = {
  IY: "#8ca6a2", IH: "#72908c", EY: "#6a5a78", EH: "#44605d", AE: "#304846",
  AA: "#283837", AH: "#1e302f", AO: "#12201f", OW: "#0a0c0c", UH: "#080808",
  UW: "#a8beba", ER: "#6a5a78", AX: "#44605d", AY: "#72908c", AW: "#304846",
  OY: "#283837", UR: "#1e302f", OH: "#12201f", OO: "#0a0c0c", YUW: "#080808"
};

// ─── ALCHEMY — Ethereal Teal (H:185) ─────────────────────────────────────
const ALCHEMY_COLORS = {
  IY: "#b8ecef", IH: "#9ee4e8", EY: "#80d4dc", EH: "#60c4cc", AE: "#5c9aac",
  AA: "#3496a0", AH: "#267880", AO: "#184a50", OW: "#103238", UH: "#0a2024",
  UW: "#d0f4f8", ER: "#80d4dc", AX: "#60c4cc", AY: "#9ee4e8", AW: "#5c9aac",
  OY: "#3496a0", UR: "#267880", OH: "#184a50", OO: "#103238", YUW: "#0a2024"
};

const ALCHEMY_LIGHT_COLORS = {
  IY: "#80d4dc", IH: "#60c4cc", EY: "#5c9aac", EH: "#3496a0", AE: "#267880",
  AA: "#1e626c", AH: "#185058", AO: "#0e3238", OW: "#0a2024", UH: "#081418",
  UW: "#9ee4e8", ER: "#5c9aac", AX: "#3496a0", AY: "#60c4cc", AW: "#267880",
  OY: "#1e626c", UR: "#185058", OH: "#0e3238", OO: "#0a2024", YUW: "#081418"
};

// ─── WILL — Malachite (H:156) ─────────────────────────────────────────────
const WILL_COLORS = {
  IY: "#b0f0cc", IH: "#94e8bc", EY: "#78dc9e", EH: "#60cc88", AE: "#3c8c64",
  AA: "#34a060", AH: "#26804a", AO: "#18502e", OW: "#10381e", UH: "#0a2412",
  UW: "#ccf8e0", ER: "#78dc9e", AX: "#60cc88", AY: "#94e8bc", AW: "#3c8c64",
  OY: "#34a060", UR: "#26804a", OH: "#18502e", OO: "#10381e", YUW: "#0a2412"
};

const WILL_LIGHT_COLORS = {
  IY: "#78dc9e", IH: "#60cc88", EY: "#3c8c64", EH: "#34a060", AE: "#26804a",
  AA: "#1e6c3e", AH: "#185832", AO: "#0e381e", OW: "#0a2412", UH: "#08180c",
  UW: "#94e8bc", ER: "#3c8c64", AX: "#34a060", AY: "#60cc88", AW: "#26804a",
  OY: "#1e6c3e", UR: "#185832", OH: "#0e381e", OO: "#0a2412", YUW: "#08180c"
};

// ─── NECROMANCY — Emerald (H:150) ─────────────────────────────────────────
const NECROMANCY_COLORS = {
  IY: "#a8e0b0", IH: "#88d094", EY: "#68bc78", EH: "#4ca860", AE: "#3c8c52",
  AA: "#2a7c3e", AH: "#1e622e", AO: "#123c1c", OW: "#0c2812", UH: "#081c0c",
  UW: "#c8f8d0", ER: "#68bc78", AX: "#4ca860", AY: "#88d094", AW: "#3c8c52",
  OY: "#2a7c3e", UR: "#1e622e", OH: "#123c1c", OO: "#0c2812", YUW: "#081c0c"
};

const NECROMANCY_LIGHT_COLORS = {
  IY: "#68bc78", IH: "#4ca860", EY: "#3c8c52", EH: "#2a7c3e", AE: "#1e622e",
  AA: "#185226", AH: "#12421e", AO: "#0c2c14", OW: "#081c0c", UH: "#061208",
  UW: "#88d094", ER: "#3c8c52", AX: "#2a7c3e", AY: "#4ca860", AW: "#1e622e",
  OY: "#185226", UR: "#12421e", OH: "#0c2c14", OO: "#081c0c", YUW: "#061208"
};

// ─── ABJURATION — Aquamarine (H:136) ────────────────────────────────────────
const ABJURATION_COLORS = {
  IY: "#b0f0cc", IH: "#94e8bc", EY: "#78dc9e", EH: "#60cc88", AE: "#5c8c64",
  AA: "#34a060", AH: "#26804a", AO: "#18502e", OW: "#10381e", UH: "#0a2412",
  UW: "#ccf8e0", ER: "#78dc9e", AX: "#60cc88", AY: "#94e8bc", AW: "#5c8c64",
  OY: "#34a060", UR: "#26804a", OH: "#18502e", OO: "#10381e", YUW: "#0a2412"
};

const ABJURATION_LIGHT_COLORS = {
  IY: "#78dc9e", IH: "#60cc88", EY: "#5c8c64", EH: "#34a060", AE: "#26804a",
  AA: "#1e6c3e", AH: "#185832", AO: "#0e381e", OW: "#0a2412", UH: "#08180c",
  UW: "#94e8bc", ER: "#5c8c64", AX: "#34a060", AY: "#60cc88", AW: "#26804a",
  OY: "#1e6c3e", UR: "#185832", OH: "#0e381e", OO: "#0a2412", YUW: "#08180c"
};

// ─── DIVINATION — Topaz-Green (H:134) ─────────────────────────────────────
const DIVINATION_COLORS = {
  IY: "#b8f0a8", IH: "#a0e68c", EY: "#88d470", EH: "#70c056", AE: "#748c5c",
  AA: "#5ca030", AH: "#4a6e24", AO: "#2e4416", OW: "#1e2c0e", UH: "#141c0a",
  UW: "#ccf8c0", ER: "#88d470", AX: "#70c056", AY: "#a0e68c", AW: "#748c5c",
  OY: "#5ca030", UR: "#4a6e24", OH: "#2e4416", OO: "#1e2c0e", YUW: "#141c0a"
};

const DIVINATION_LIGHT_COLORS = {
  IY: "#88d470", IH: "#70c056", EY: "#748c5c", EH: "#5ca030", AE: "#4a6e24",
  AA: "#3e5c1e", AH: "#324a16", AO: "#203010", OW: "#141c0a", UH: "#0c1206",
  UW: "#a0e68c", ER: "#748c5c", AX: "#5ca030", AY: "#70c056", AW: "#4a6e24",
  OY: "#3e5c1e", UR: "#324a16", OH: "#203010", OO: "#141c0a", YUW: "#0c1206"
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
  const defaults = theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS;
  const skin = skins[school?.toUpperCase()];
  
  if (!skin) return defaults;
  
  // Merge to ensure all 20 vowels have a mapping even if the skin is partial
  return { ...defaults, ...skin };
}
