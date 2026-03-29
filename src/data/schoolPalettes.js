import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from './schools.js';
import {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
} from '../lib/truesight/color/pcaChroma.js';

/**
 * Universal Phonetic Teaching Palette.
 * Maps every vowel family to a PERMANENT distinctive color based on its native school.
 * This consistency allows the user to learn that "Blue = Psychic family", etc.
 */

function buildVowelPalette(activeSkinId, theme = 'dark') {
  const palette = {};
  const activeSkin = String(activeSkinId || 'DEFAULT').toUpperCase();

  VERSE_IR_PALETTE_FAMILIES.forEach((family) => {
    const nativeSchoolId = VOWEL_FAMILY_TO_SCHOOL[family] || 'DEFAULT';
    const school = SCHOOLS[nativeSchoolId] || SCHOOLS.SONIC;
    
    // Base color from the native school (The 'Learning' color)
    let color = school.color;

    // Thematic Resonance: If the vowel belongs to the active skin, make it more vibrant.
    // Otherwise, keep it as the clear native color but slightly more ambient.
    if (activeSkin !== 'DEFAULT' && activeSkin !== 'NONE') {
      const isNativeToSkin = nativeSchoolId === activeSkin;
      
      if (!isNativeToSkin) {
        // Not native: slightly desaturate/dim to let the skin's core vowels pop
        // but keep the HUE distinctive for learning.
        const { h, s, l } = school.colorHsl;
        color = `hsl(${h}, ${Math.max(15, s - 30)}%, ${theme === 'dark' ? Math.max(25, l - 15) : Math.min(85, l + 15)}%)`;
      } else {
        // Native: ensure maximum vibrancy and brightness
        const { h, s, l } = school.colorHsl;
        color = `hsl(${h}, ${Math.min(100, s + 10)}%, ${theme === 'dark' ? Math.min(85, l + 10) : Math.max(20, l - 10)}%)`;
      }
    }

    palette[family] = color;
  });

  return Object.freeze(palette);
}

/** Rainbow fallback - resolved through each vowel family's mapped school basis. */
export const DEFAULT_VOWEL_COLORS = buildVowelPalette('DEFAULT', 'dark');
const DEFAULT_LIGHT_COLORS = buildVowelPalette('DEFAULT', 'light');

/** All school skins - dark mode. */
export const SCHOOL_SKINS = Object.freeze(Object.fromEntries(
  ['DEFAULT', ...Object.keys(SCHOOLS)].map(id => [id, buildVowelPalette(id, 'dark')])
));

/** All school skins - light mode. */
export const SCHOOL_SKINS_LIGHT = Object.freeze(Object.fromEntries(
  ['DEFAULT', ...Object.keys(SCHOOLS)].map(id => [id, buildVowelPalette(id, 'light')])
));

/**
 * Returns the vowel color map for a given school skin, theme-aware.
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  const skins = theme === 'light' ? SCHOOL_SKINS_LIGHT : SCHOOL_SKINS;
  const defaults = theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS;
  const schoolId = String(school || 'DEFAULT').trim().toUpperCase() || 'DEFAULT';
  return skins[schoolId] || defaults;
}

/**
 * Returns the full ritual palette (UI background slots) for a given school.
 * These derive from the school's base identity hue.
 */
export function getRitualPalette(school, theme = 'dark') {
  const schoolId = String(school || 'DEFAULT').trim().toUpperCase() || 'DEFAULT';
  const meta = SCHOOLS[schoolId] || { color: '#6548b8', colorHsl: { h: 265, s: 48, l: 50 } };
  const h = meta.colorHsl.h;

  if (theme === 'dark') {
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
  } else {
    return {
      abyss: `hsl(${h}, 15%, 95%)`,
      panel: `hsl(${h}, 20%, 90%)`,
      parchment: "#333333",
      ink: "#090916",
      primary: meta.color,
      secondary: `hsl(${(h + 72) % 360}, 50%, 45%)`,
      tertiary: `hsl(${(h + 148) % 360}, 40%, 35%)`,
      border: `hsl(${h}, 20%, 70%)`,
      glow: `hsl(${h}, 60%, 40%)`,
      aurora_start: `hsl(${h}, 50%, 50%)`,
      aurora_end: `hsl(${(h + 45) % 360}, 40%, 60%)`,
    };
  }
}

export {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
};
