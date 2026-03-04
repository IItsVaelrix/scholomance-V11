import { SCHOOLS } from "./schools.js";

// Vowel palette derived from the IPA vowel space (8 Core Families):
// - Front/back placement maps to hue (cool -> warm).
// - Close/open height maps to lightness (bright -> deep).
// - Optimized for visual distinction and phonetic accuracy.
//
// 8 Core Families:
// 1. IY - High front (machine, green, gene)
// 2. IH - Near-high front (obelisk, continent) + ER
// 3. EY - Mid front (bait, day) + AY
// 4. AE - Low front (bat, dragon) + EH
// 5. A  - Low back (obvious, monument) + AA, AH, AX, AW
// 6. AO - Mid back rounded (water, slaughter) - DISTINCT
// 7. OW - Mid-high back (soul, cold, boulder) + OH, OY
// 8. UW - High back (boot, true) + OO, YOO, YUW, UH
const VOWEL_POSITIONS = {
  // Front vowels (cool hues)
  IY: { front: 0.0, open: 0.05 },   // close front - brightest blue
  IH: { front: 0.1, open: 0.2 },    // near-close front - I sound + ER
  EY: { front: 0.18, open: 0.45 },  // close-mid front + AY
  AE: { front: 0.25, open: 0.75 },  // near-open front - includes EH

  // Back vowels (warm hues)
  A:  { front: 1.0, open: 0.95 },    // open back - deepest warm - includes AA, AH, AX, AW
  AO: { front: 0.85, open: 0.6 },   // open-mid back rounded - DISTINCT (water, slaughter)
  OW: { front: 0.92, open: 0.25 },  // close-mid back - includes OH, OY
  UW: { front: 0.5, open: 0.1 },    // High back - includes OO, YOO, YUW, UH
};

const PALETTE_CONFIG = {
  hueFront: 210, // cool cyan-blue
  hueBack: 30, // warm orange-red
  lightClose: 0.82,
  lightOpen: 0.56,
  chromaMax: 0.16,
  chromaMin: 0.08,
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;

function toOklch({ front, open }) {
  const f = clamp01(front);
  const o = clamp01(open);
  const hue = lerp(PALETTE_CONFIG.hueFront, PALETTE_CONFIG.hueBack, f);
  const light = lerp(PALETTE_CONFIG.lightClose, PALETTE_CONFIG.lightOpen, o);
  const centrality = 1 - Math.abs(f - 0.5) / 0.5;
  const chroma = lerp(PALETTE_CONFIG.chromaMax, PALETTE_CONFIG.chromaMin, centrality);
  return `oklch(${(light * 100).toFixed(1)}% ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

export const VOWEL_COLORS = Object.fromEntries(
  Object.entries(VOWEL_POSITIONS).map(([family, pos]) => [family, toOklch(pos)])
);

export function getVowelColor(family) {
  if (!family) return undefined;
  return VOWEL_COLORS[String(family).toUpperCase()];
}

export function getSchoolForVowel(family) {
  if (!family) return null;
  const target = String(family).toUpperCase();
  const match = Object.values(SCHOOLS).find((school) =>
    school.vowelAffinities?.includes(target)
  );
  return match?.id ?? null;
}

export function getVowelsBySchool(schoolId) {
  return SCHOOLS[schoolId]?.vowelAffinities ?? [];
}
