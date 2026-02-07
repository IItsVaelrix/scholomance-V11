import { SCHOOLS } from "./schools.js";

// Vowel palette derived from the IPA vowel space:
// - Front/back placement maps to hue (cool -> warm).
// - Close/open height maps to lightness (bright -> deep).
// - Central vowels are slightly desaturated for cohesion.
const VOWEL_POSITIONS = {
  // Front vowels
  IY: { front: 0.0, open: 0.05 }, // close front
  IH: { front: 0.08, open: 0.2 }, // near-close front
  EY: { front: 0.12, open: 0.35 }, // close-mid front
  EH: { front: 0.18, open: 0.55 }, // open-mid front
  AE: { front: 0.2, open: 0.8 }, // near-open front

  // Central vowels
  ER: { front: 0.5, open: 0.45 }, // mid central

  // Diphthongs (averaged positions)
  AY: { front: 0.35, open: 0.5 }, // a->i glide
  AW: { front: 0.95, open: 0.5 }, // a->u glide
  OY: { front: 0.45, open: 0.325 }, // o->i glide

  // Back vowels
  A: { front: 1.0, open: 0.95 }, // open back/central
  AO: { front: 0.85, open: 0.6 }, // open-mid back
  OH: { front: 0.9, open: 0.35 }, // close-mid back
  OW: { front: 0.95, open: 0.2 }, // near-close back
  UH: { front: 0.8, open: 0.25 }, // near-close back (lax)
  UW: { front: 0.95, open: 0.05 }, // close back
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
