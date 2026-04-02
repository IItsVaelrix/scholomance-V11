import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from './schools.js';
import {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
} from '../lib/truesight/color/pcaChroma.js';
import { normalizeVowelFamily } from '../lib/phonology/vowelFamily.js';

/**
 * Universal Biophysical Teaching Palette.
 * Scholomance V11 is Dark Mode only.
 */
function buildUniversalVowelPalette() {
  const result = {};

  VERSE_IR_PALETTE_FAMILIES.forEach((family) => {
    const nativeSchoolId = VOWEL_FAMILY_TO_SCHOOL[family]
      || VOWEL_FAMILY_TO_SCHOOL[normalizeVowelFamily(family)]
      || 'VOID';
    const school = SCHOOLS[nativeSchoolId] || SCHOOLS.VOID;

    const hue = school.colorHsl.h;
    const saturation = nativeSchoolId === 'VOID' ? school.colorHsl.s : 85;
    const baseL = school.colorHsl.l;

    const lightness = Math.min(75, baseL + 10);

    result[family] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  });

  return Object.freeze(result);
}

/** The authoritative 7-color phonetic rainbow. */
export const DEFAULT_VOWEL_COLORS = buildUniversalVowelPalette();

/** 
 * School skins - dark mode only.
 */
export const SCHOOL_SKINS = Object.freeze(Object.fromEntries(
  ['DEFAULT', ...Object.keys(SCHOOLS)].map(id => [id, DEFAULT_VOWEL_COLORS])
));

/**
 * Returns the vowel color map for a given school skin.
 */
export function getVowelColorsForSchool(_school) {
  return DEFAULT_VOWEL_COLORS;
}

/**
 * Returns the full ritual palette (UI background slots) for a given school.
 */
export function getRitualPalette(school) {
  const schoolId = String(school || 'DEFAULT').trim().toUpperCase() || 'DEFAULT';
  const meta = SCHOOLS[schoolId] || { color: '#6548b8', colorHsl: { h: 265, s: 48, l: 50 } };
  const h = meta.colorHsl.h;

  return {
    abyss: `hsl(${h}, 20%, 6%)`,
    panel: `hsl(${h}, 25%, 12%)`,
    parchment: "#e6e4da",
    ink: "#f1efec",
    primary: meta.color,
    secondary: `hsl(${(h + 72) % 360}, 60%, 55%)`,
    tertiary: `hsl(${(h + 148) % 360}, 50%, 45%)`,
    border: `hsl(${h}, 30%, 30%)`,
    glow: `hsl(${h}, 80%, 75%)`,
    aurora_start: `hsl(${h}, 70%, 60%)`,
    aurora_end: `hsl(${(h + 45) % 360}, 60%, 50%)`,
  };
}

export {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
};
