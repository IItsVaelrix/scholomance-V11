import { SCHOOLS } from '../../../src/data/schools.js';
import {
  clamp01,
  createByteMap,
  hslToHex,
  parseBytecodeString,
  roundTo,
} from './shared.js';

function resolveSchoolColor(schoolId, colorFeatures = {}) {
  const school = SCHOOLS[String(schoolId || 'VOID').trim().toUpperCase()] || SCHOOLS.VOID || {
    colorHsl: { h: 0, s: 0, l: 50 },
  };

  return Object.freeze({
    hue: Number.isFinite(Number(colorFeatures?.primaryHue))
      ? Number(colorFeatures.primaryHue)
      : Number(school?.colorHsl?.h) || 0,
    saturation: clamp01(
      Number.isFinite(Number(colorFeatures?.saturation))
        ? Number(colorFeatures.saturation)
        : (Number(school?.colorHsl?.s) || 50) / 100
    ),
    brightness: clamp01(
      Number.isFinite(Number(colorFeatures?.brightness))
        ? Number(colorFeatures.brightness)
        : (Number(school?.colorHsl?.l) || 50) / 100
    ),
  });
}

function paletteStepCount(rarity, effect, requestedSize) {
  const explicit = Number(requestedSize);
  if (Number.isInteger(explicit) && explicit >= 2) {
    return Math.min(6, explicit);
  }
  if (String(rarity || '').trim().toUpperCase() === 'INEXPLICABLE') return 5;
  if (String(effect || '').trim().toUpperCase() === 'TRANSCENDENT') return 5;
  if (String(rarity || '').trim().toUpperCase() === 'RARE') return 4;
  if (String(effect || '').trim().toUpperCase() === 'HARMONIC') return 4;
  return 3;
}

function buildPaletteColors({
  hue,
  saturation,
  brightness,
  paletteSize,
  rarity,
  effect,
} = {}) {
  const safePaletteSize = paletteStepCount(rarity, effect, paletteSize);
  const rarityShift = String(rarity || '').trim().toUpperCase() === 'INEXPLICABLE'
    ? 18
    : String(rarity || '').trim().toUpperCase() === 'RARE'
      ? 10
      : 6;
  const effectLift = String(effect || '').trim().toUpperCase() === 'TRANSCENDENT'
    ? 12
    : String(effect || '').trim().toUpperCase() === 'HARMONIC'
      ? 7
      : String(effect || '').trim().toUpperCase() === 'RESONANT'
        ? 4
        : 0;
  const baseSaturation = Math.max(0, Math.min(100, (saturation * 100) + effectLift));
  const baseBrightness = Math.max(18, Math.min(76, (brightness * 100) + effectLift));

  return Object.freeze(
    Array.from({ length: safePaletteSize }, (_, index) => {
      const ratio = safePaletteSize === 1 ? 0 : index / (safePaletteSize - 1);
      const lightness = Math.max(8, Math.min(92, baseBrightness - 18 + (ratio * 36)));
      const saturationShift = baseSaturation - 10 + (ratio * 12);
      const hueShift = hue + ((ratio - 0.5) * rarityShift);
      return hslToHex(hueShift, saturationShift, lightness);
    })
  );
}

export function generatePaletteFromSemantics(params = {}) {
  const hue = Number(params?.primaryHue) || 0;
  const saturation = clamp01(Number(params?.saturation) || 0);
  const brightness = clamp01(Number(params?.brightness) || 0.5);
  const paletteSize = paletteStepCount(params?.rarity, params?.effect, params?.paletteSize);
  const colors = buildPaletteColors({
    hue,
    saturation,
    brightness,
    paletteSize,
    rarity: params?.rarity,
    effect: params?.effect,
  });

  return Object.freeze({
    primaryHue: roundTo(hue, 2),
    saturation: roundTo(saturation),
    brightness: roundTo(brightness),
    paletteSize,
    colors,
  });
}

export function bytecodeToPalette(bytecode, options = {}) {
  const parsed = parseBytecodeString(bytecode);
  const baseColor = resolveSchoolColor(parsed.schoolId, options?.colorFeatures);
  const palette = generatePaletteFromSemantics({
    primaryHue: baseColor.hue,
    saturation: baseColor.saturation,
    brightness: baseColor.brightness,
    paletteSize: options?.colorFeatures?.paletteSize,
    rarity: parsed.rarity,
    effect: parsed.effect,
  });

  return Object.freeze({
    key: String(bytecode || '').trim().toUpperCase(),
    bytecode: String(bytecode || '').trim().toUpperCase(),
    schoolId: parsed.schoolId,
    rarity: parsed.rarity,
    effect: parsed.effect,
    colors: palette.colors,
    byteMap: createByteMap(palette.colors),
  });
}

export function getHexForByte(bytecode, byteIndex, options = {}) {
  const palette = bytecodeToPalette(bytecode, options);
  const paletteIndex = Math.max(0, Math.abs(Math.trunc(Number(byteIndex) || 0))) % Math.max(1, palette.colors.length);
  return palette.byteMap[String(paletteIndex)] || palette.colors[0] || '#808080';
}
