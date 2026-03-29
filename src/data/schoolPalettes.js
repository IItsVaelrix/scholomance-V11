import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from './schools.js';
import {
  resolveVerseIrColor,
  VERSE_IR_PALETTE_FAMILIES,
} from '../lib/truesight/color/pcaChroma.js';
import palettePayload from '../../verseir_palette_payload.json';

/**
 * Universal Biophysical Teaching Palette.
 * Maps every vowel family to its PERMANENT distinctive color derived from its native school.
 * Consistency is key for phonetic learning: "Red always means WILL family", etc.
 */
function buildUniversalVowelPalette(theme = 'dark') {
  const result = {};
  
  VERSE_IR_PALETTE_FAMILIES.forEach((family) => {
    const nativeSchoolId = VOWEL_FAMILY_TO_SCHOOL[family] || 'VOID';
    // Access the authoritative biophysical color from the Python engine payload
    const schoolColors = palettePayload[nativeSchoolId] || palettePayload.VOID;
    const vowelData = schoolColors[family] || schoolColors.AX;
    
    // We use the HSL from the payload to ensure biophysical accuracy
    const { hue, metrics = {} } = vowelData;
    const { spreadNorm = 0.5, sharpnessNorm = 0.5 } = metrics;

    const saturation = nativeSchoolId === 'VOID' ? 15 : 85;
    
    // Identical lightness logic to phoneticColor.js for 100% fidelity
    const lightness = theme === 'dark' 
      ? 60 - (spreadNorm * 5) + (sharpnessNorm * 5)
      : 45 + (spreadNorm * 5);
    
    result[family] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  });
  
  return Object.freeze(result);
}

/** The authoritative 7-color phonetic rainbow. */
export const DEFAULT_VOWEL_COLORS = buildUniversalVowelPalette('dark');
const DEFAULT_LIGHT_COLORS = buildUniversalVowelPalette('light');

/** 
 * School skins now all use the SAME universal vowel colors to ensure
 * phonetic consistency. The "Skin" aspect is handled via UI variables
 * and localized resonance (glow/vibrancy) in the renderer.
 */
const UNIVERSAL_SKINS = Object.freeze(Object.fromEntries(
  ['DEFAULT', ...Object.keys(SCHOOLS)].map(id => [id, DEFAULT_VOWEL_COLORS])
));

const UNIVERSAL_SKINS_LIGHT = Object.freeze(Object.fromEntries(
  ['DEFAULT', ...Object.keys(SCHOOLS)].map(id => [id, DEFAULT_LIGHT_COLORS])
));

/** All school skins - dark mode. */
export const SCHOOL_SKINS = UNIVERSAL_SKINS;

/** All school skins - light mode. */
export const SCHOOL_SKINS_LIGHT = UNIVERSAL_SKINS_LIGHT;

/**
 * Returns the vowel color map for a given school skin, theme-aware.
 */
export function getVowelColorsForSchool(school, theme = 'dark') {
  return theme === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_VOWEL_COLORS;
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
