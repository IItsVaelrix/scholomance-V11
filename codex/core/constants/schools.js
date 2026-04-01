/**
 * SCHOLOMANCE SCHOOL CONSTANTS
 * 
 * Central definition of schools, vowel mappings, and visual properties.
 * Core logic units (codex/) should import from here.
 */

export const VOWEL_FAMILY_TO_SCHOOL = Object.freeze({
  IY: 'PSYCHIC',
  IH: 'SONIC',
  EY: 'ALCHEMY',
  AE: 'WILL',
  A:  'NECROMANCY',
  AO: 'DIVINATION',
  OW: 'ABJURATION',
  UW: 'ABJURATION',
  AA: 'NECROMANCY',
  AH: 'WILL',
  AX: 'VOID',
  AW: 'DIVINATION',
  EH: 'WILL',
  AY: 'PSYCHIC',
  OY: 'ALCHEMY',
  OH: 'ABJURATION',
  UH: 'VOID',
  OO: 'ABJURATION',
  ER: 'SONIC',
  UR: 'SONIC',
});

export const SCHOOLS = Object.freeze({
  SONIC: {
    id: "SONIC",
    name: "Sonic Thaumaturgy",
    color: "#1ab4a8",
    colorHsl: { h: 175, s: 85, l: 55 },
    angle: 288,
    unlockXP: 0,
    glyph: "♩",
  },
  PSYCHIC: {
    id: "PSYCHIC",
    name: "Psychic Schism",
    color: "#3b82f6",
    colorHsl: { h: 220, s: 90, l: 60 },
    angle: 72,
    unlockXP: 250,
    glyph: "◬",
  },
  VOID: {
    id: "VOID",
    name: "The Void",
    color: "#94a3b8",
    colorHsl: { h: 215, s: 15, l: 41 },
    angle: 0,
    unlockXP: 1500,
    glyph: "∅",
  },
  ALCHEMY: {
    id: "ALCHEMY",
    name: "Verbal Alchemy",
    color: "#ec4899",
    colorHsl: { h: 325, s: 80, l: 58 },
    angle: 144,
    unlockXP: 8000,
    glyph: "⚗",
  },
  WILL: {
    id: "WILL",
    name: "Willpower Surge",
    color: "#ef4444",
    colorHsl: { h: 0, s: 85, l: 48 },
    angle: 216,
    unlockXP: 25000,
    glyph: "⚡",
  },
  NECROMANCY: {
    id: "NECROMANCY",
    name: "Necromancy",
    color: "#22c55e",
    colorHsl: { h: 120, s: 75, l: 40 },
    angle: 36,
    unlockXP: 100000,
    glyph: "☠",
  },
  ABJURATION: {
    id: "ABJURATION",
    name: "Abjuration",
    color: "#06b6d4",
    colorHsl: { h: 180, s: 80, l: 68 },
    angle: 108,
    unlockXP: 500000,
    glyph: "◇",
  },
  DIVINATION: {
    id: "DIVINATION",
    name: "Divination",
    color: "#eab308",
    colorHsl: { h: 45, s: 90, l: 68 },
    angle: 180,
    unlockXP: 2000000,
    glyph: "◉",
  },
});
