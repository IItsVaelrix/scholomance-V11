import { SCHOOLS } from './schools.js';
import {
  buildVerseIrPalette,
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
} from '../lib/truesight/color/pcaChroma.js';

/**
 * VerseIR vowel palettes now derive from a shared PCA chroma basis instead of
 * hand-maintained ramps. Each school keeps its identity hue, but the per-vowel
 * offsets are standardized against the same acoustic projection.
 */

const PALETTE_SCHOOLS = Object.freeze(['DEFAULT', ...Object.keys(SCHOOLS)]);

function buildPaletteMap(theme) {
  return Object.freeze(Object.fromEntries(
    PALETTE_SCHOOLS.map((schoolId) => [schoolId, buildVerseIrPalette(schoolId, theme)])
  ));
}

/** Rainbow fallback - resolved through each vowel family's mapped school basis. */
export const DEFAULT_VOWEL_COLORS = buildVerseIrPalette('DEFAULT', 'dark');
const DEFAULT_LIGHT_COLORS = buildVerseIrPalette('DEFAULT', 'light');

/** All school skins - dark mode. */
export const SCHOOL_SKINS = buildPaletteMap('dark');

/** All school skins - light mode. */
export const SCHOOL_SKINS_LIGHT = buildPaletteMap('light');

/**
 * Returns the vowel color map for a given school skin, theme-aware.
 * Signature unchanged so existing callers need no update.
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  const skins = theme === 'light' ? SCHOOL_SKINS_LIGHT : SCHOOL_SKINS;
  const defaults = theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS;
  const schoolId = String(school || 'DEFAULT').trim().toUpperCase() || 'DEFAULT';
  return skins[schoolId] || defaults;
}

export {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
};
