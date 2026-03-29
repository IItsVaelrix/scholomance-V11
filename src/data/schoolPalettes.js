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
  IY: "#4470b8",   // Sapphire (Psychic)
  IH: "#6548b8",   // Tanzanite (Sonic)
  EY: "#b84882",   // Rhodolite (Alchemy)
  AE: "#b85c48",   // Carnelian (Will)
  A:  "#389468",   // Malachite (Necromancy)
  AO: "#a88440",   // Topaz (Divination)
  OW: "#38849c",   // Aquamarine (Abjuration)
  UW: "#6a5a78",   // Obsidian (Void)
};

const DEFAULT_LIGHT_COLORS = {
  IY: "#264280",
  IH: "#3e2580",
  EY: "#802654",
  AE: "#803626",
  A:  "#1e6240",
  AO: "#6e5424",
  OW: "#1e5668",
  UW: "#3c3048",
};

// ─── SONIC — Tanzanite (H:265) ─────────────────────────────────────────────
// Blue-violet trichroic crystal. Resonance and harmonic vibration.
const SONIC_COLORS = {
  IY: "#c8b8f0",   // hsl(265, 62%, 83%) — Crystalline chime
  UW: "#b09ee6",   // hsl(265, 64%, 76%) — Overtone shimmer
  EY: "#9580d9",   // hsl(265, 56%, 68%) — Harmonic body
  OW: "#7b63cc",   // hsl(265, 52%, 59%) — Resonance core
  IH: "#6548b8",   // hsl(265, 48%, 50%) — ANCHOR
  AO: "#5236a0",   // hsl(265, 52%, 42%) — Deep vibration
  AE: "#3e2580",   // hsl(265, 54%, 32%) — Subharmonic
  A:  "#221450",   // hsl(265, 60%, 20%) — Infrasonic void
};

const SONIC_LIGHT_COLORS = {
  IY: "#9580d9",
  UW: "#7b63cc",
  EY: "#6548b8",
  OW: "#5236a0",
  IH: "#3e2580",
  AO: "#321e6c",
  AE: "#261858",
  A:  "#160e38",
};

// ─── PSYCHIC — Sapphire (H:220) ────────────────────────────────────────────
// Deep blue mental clarity. Cool contemplation and third-eye focus.
const PSYCHIC_COLORS = {
  IY: "#b0cef0",   // hsl(220, 62%, 82%) — Thought-flash
  UW: "#94b8e8",   // hsl(220, 65%, 75%) — Clarity pulse
  EY: "#78a0dc",   // hsl(220, 58%, 67%) — Synapse arc
  OW: "#5c86cc",   // hsl(220, 52%, 58%) — Mind's eye
  IH: "#4470b8",   // hsl(220, 48%, 49%) — ANCHOR
  AO: "#34589e",   // hsl(220, 52%, 41%) — Deep cognition
  AE: "#264280",   // hsl(220, 54%, 33%) — Subconscious
  A:  "#162850",   // hsl(220, 56%, 20%) — Psychic void
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

// ─── VOID — Obsidian (H:310, Low Saturation S:12-22%) ──────────────────────
// Purple-smoke glass formed from destruction. Color draining into entropy.
const VOID_COLORS = {
  IY: "#d0c4d4",   // hsl(310, 12%, 80%) — Residual light
  UW: "#b8a8be",   // hsl(310, 14%, 70%) — Fading echo
  EY: "#9e8ca6",   // hsl(310, 12%, 60%) — Smoke veil
  OW: "#847290",   // hsl(310, 13%, 51%) — Entropy membrane
  IH: "#6a5a78",   // hsl(310, 15%, 41%) — ANCHOR
  AO: "#524460",   // hsl(310, 17%, 32%) — Deep absence
  AE: "#3c3048",   // hsl(310, 18%, 24%) — Near-void
  A:  "#221a2c",   // hsl(310, 22%, 14%) — True void
};

const VOID_LIGHT_COLORS = {
  IY: "#9e8ca6",
  UW: "#847290",
  EY: "#6a5a78",
  OW: "#524460",
  IH: "#3c3048",
  AO: "#302838",
  AE: "#261e30",
  A:  "#181220",
};

// ─── ALCHEMY — Rhodolite Garnet (H:330) ─────────────────────────────────────
// Color-change garnet. Rose-magenta transmutation energy.
const ALCHEMY_COLORS = {
  IY: "#f0b8d4",   // hsl(330, 64%, 83%) — Philosopher's flash
  UW: "#e89ec2",   // hsl(330, 66%, 76%) — Transmutation glow
  EY: "#dc80ae",   // hsl(330, 60%, 68%) — Mercury bloom
  OW: "#cc6098",   // hsl(330, 55%, 59%) — Elixir heart
  IH: "#b84882",   // hsl(330, 48%, 50%) — ANCHOR
  AO: "#a03468",   // hsl(330, 52%, 42%) — Crucible depth
  AE: "#802654",   // hsl(330, 54%, 33%) — Nigredo shadow
  A:  "#501838",   // hsl(330, 56%, 20%) — Prima materia
};

const ALCHEMY_LIGHT_COLORS = {
  IY: "#dc80ae",
  UW: "#cc6098",
  EY: "#b84882",
  OW: "#a03468",
  IH: "#802654",
  AO: "#6c1e46",
  AE: "#58183a",
  A:  "#380e24",
};

// ─── WILL — Carnelian (H:15) ────────────────────────────────────────────────
// Deep amber-red. Stone of courage, fierce determination, volcanic fire.
const WILL_COLORS = {
  IY: "#f0c4b0",   // hsl(15, 62%, 82%) — Ignition flash
  UW: "#e8ac94",   // hsl(15, 64%, 75%) — Ember glow
  EY: "#dc9078",   // hsl(15, 58%, 67%) — Forge heat
  OW: "#cc7460",   // hsl(15, 52%, 59%) — Molten core
  IH: "#b85c48",   // hsl(15, 48%, 50%) — ANCHOR
  AO: "#a04834",   // hsl(15, 52%, 42%) — Deep flame
  AE: "#803626",   // hsl(15, 54%, 33%) — Cooling iron
  A:  "#502018",   // hsl(15, 56%, 20%) — Volcanic stone
};

const WILL_LIGHT_COLORS = {
  IY: "#dc9078",
  UW: "#cc7460",
  EY: "#b85c48",
  OW: "#a04834",
  IH: "#803626",
  AO: "#6c2c1e",
  AE: "#582418",
  A:  "#38140e",
};

// ─── DIVINATION — Imperial Topaz (H:50) ─────────────────────────────────────
// Golden-amber oracular fire. Prophetic clarity and liquid gold sight.
const DIVINATION_COLORS = {
  IY: "#f0dca8",   // hsl(50, 64%, 80%) — Prophecy flash
  UW: "#e6cc8c",   // hsl(50, 62%, 72%) — Oracle light
  EY: "#d4b470",   // hsl(50, 55%, 64%) — Vision amber
  OW: "#c09c56",   // hsl(50, 50%, 55%) — Scrying flame
  IH: "#a88440",   // hsl(50, 46%, 46%) — ANCHOR
  AO: "#8c6c30",   // hsl(50, 50%, 37%) — Deep augury
  AE: "#6e5424",   // hsl(50, 52%, 29%) — Sealed prophecy
  A:  "#443416",   // hsl(50, 52%, 18%) — Buried oracle
};

const DIVINATION_LIGHT_COLORS = {
  IY: "#d4b470",
  UW: "#c09c56",
  EY: "#a88440",
  OW: "#8c6c30",
  IH: "#6e5424",
  AO: "#5c461e",
  AE: "#4a3816",
  A:  "#302410",
};

// ─── NECROMANCY — Malachite (H:155) ─────────────────────────────────────────
// Deep green toxic beauty with layered bands. Dangerous in raw form.
const NECROMANCY_COLORS = {
  IY: "#a8e0c4",   // hsl(155, 46%, 77%) — Ectoplasmic sheen
  UW: "#88d0ac",   // hsl(155, 44%, 67%) — Spectral mist
  EY: "#68bc94",   // hsl(155, 40%, 57%) — Lichen glow
  OW: "#4ca87c",   // hsl(155, 40%, 48%) — Toxic verdure
  IH: "#389468",   // hsl(155, 44%, 40%) — ANCHOR
  AO: "#2a7c54",   // hsl(155, 48%, 33%) — Grave moss
  AE: "#1e6240",   // hsl(155, 52%, 25%) — Crypt darkness
  A:  "#123c28",   // hsl(155, 54%, 15%) — Beneath the earth
};

const NECROMANCY_LIGHT_COLORS = {
  IY: "#68bc94",
  UW: "#4ca87c",
  EY: "#389468",
  OW: "#2a7c54",
  IH: "#1e6240",
  AO: "#185234",
  AE: "#12422a",
  A:  "#0c2c1c",
};

// ─── ABJURATION — Aquamarine (H:195) ────────────────────────────────────────
// Cool protective teal-blue. Crystallized water barriers and ward shimmer.
const ABJURATION_COLORS = {
  IY: "#a8d4e0",   // hsl(195, 42%, 77%) — Ward shimmer
  UW: "#88c2d2",   // hsl(195, 40%, 68%) — Shield refraction
  EY: "#68aec2",   // hsl(195, 38%, 58%) — Barrier core
  OW: "#4c98b0",   // hsl(195, 40%, 49%) — Aegis depth
  IH: "#38849c",   // hsl(195, 46%, 42%) — ANCHOR
  AO: "#286e84",   // hsl(195, 52%, 34%) — Deep ward
  AE: "#1e5668",   // hsl(195, 56%, 26%) — Sealed barrier
  A:  "#123642",   // hsl(195, 56%, 17%) — Fortress stone
};

const ABJURATION_LIGHT_COLORS = {
  IY: "#68aec2",
  UW: "#4c98b0",
  EY: "#38849c",
  OW: "#286e84",
  IH: "#1e5668",
  AO: "#184856",
  AE: "#123a46",
  A:  "#0c262e",
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
