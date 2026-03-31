import { SCHOOLS } from '../../../src/data/schools.js';
import {
  clamp01,
  createByteMap,
  hslToHex,
  parseBytecodeString,
  roundTo,
} from './shared.js';

/**
 * LAYER 2: COLOR-BYTE MAPPING WITH SEMANTIC INTEGRATION
 * Maps bytecode strings to color palettes using semantic parameters from Layer 1
 */

function resolveSchoolColor(schoolId, colorFeatures = {}) {
  const safeSchoolId = String(schoolId || 'VOID').trim().toUpperCase();
  const school = SCHOOLS[safeSchoolId] || SCHOOLS.VOID || {
    colorHsl: { h: 0, s: 0, l: 50 },
  };

  // For phoneme-based bytecodes (AA1, EH1) that aren't schools, generate unique hue
  let baseHue = Number(school?.colorHsl?.h) || 0;
  if (safeSchoolId !== 'VOID' && !SCHOOLS[safeSchoolId]) {
    // Generate deterministic hue from string
    let hash = 0;
    for (let i = 0; i < safeSchoolId.length; i++) {
      hash = safeSchoolId.charCodeAt(i) + ((hash << 5) - hash);
    }
    baseHue = Math.abs(hash % 360);
  }

  return Object.freeze({
    hue: Number.isFinite(Number(colorFeatures?.primaryHue))
      ? Number(colorFeatures.primaryHue)
      : baseHue,
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

/**
 * Generate palette from semantic parameters (Layer 1 → Layer 2 bridge)
 * @param {Object} semanticParams - SemanticParameters from visual-extractor
 * @returns {Object} Color palette with metadata
 */
export function generatePaletteFromSemanticParameters(semanticParams) {
  const safeParams = semanticParams || {};
  const colorProps = safeParams.color || {};
  const surfaceProps = safeParams.surface || {};
  const lightProps = safeParams.light || {};

  // Base hue from color properties or light color
  let baseHue = Number(colorProps.primaryHue) || 0;
  if (lightProps.color) {
    const hex = String(lightProps.color).replace('#', '');
    if (/^[0-9A-F]{6}$/i.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      baseHue = rgbToHue(r, g, b);
    }
  }

  // Saturation modified by surface reflectivity
  const baseSaturation = clamp01(
    Number(colorProps.saturation) || 0.5 + (surfaceProps.reflectivity || 0) * 0.3
  );

  // Brightness modified by light intensity
  const baseBrightness = clamp01(
    Number(colorProps.brightness) || 0.5 * (lightProps.intensity || 0.5) + 0.25
  );

  // Palette size from complexity
  const baseSize = Math.round(3 + (safeParams.form?.complexity || 0.5) * 3);
  const paletteSize = Math.max(3, Math.min(6, baseSize));

  const colors = buildSemanticPaletteColors({
    hue: baseHue,
    saturation: baseSaturation,
    brightness: baseBrightness,
    paletteSize,
    material: surfaceProps.material,
    texture: surfaceProps.texture,
  });

  return Object.freeze({
    primaryHue: roundTo(baseHue, 2),
    saturation: roundTo(baseSaturation),
    brightness: roundTo(baseBrightness),
    paletteSize,
    colors,
    material: surfaceProps.material || 'stone',
    texture: surfaceProps.texture || 'grained',
  });
}

/**
 * Build palette colors based on semantic properties
 */
function buildSemanticPaletteColors(params) {
  const { hue, saturation, brightness, paletteSize, material, texture } = params;
  const colors = [];

  // Material-specific color adjustments
  const materialMods = {
    metal: { satMod: -0.1, briMod: +0.15, hueShift: 0 },
    stone: { satMod: -0.2, briMod: 0, hueShift: 0 },
    organic: { satMod: +0.1, briMod: -0.1, hueShift: 15 },
    energy: { satMod: +0.2, briMod: +0.1, hueShift: -10 },
    crystalline: { satMod: +0.15, briMod: +0.2, hueShift: 20 },
    fabric: { satMod: -0.05, briMod: -0.05, hueShift: 5 },
  };

  const mod = materialMods[material] || materialMods.stone;

  // Texture-specific variation
  const textureVariation = {
    smooth: 0.05,
    grained: 0.12,
    crystalline: 0.08,
    fibrous: 0.15,
  }[texture] || 0.1;

  for (let i = 0; i < paletteSize; i++) {
    const ratio = paletteSize === 1 ? 0 : i / (paletteSize - 1);
    
    // Lightness gradient
    const lightness = Math.max(15, Math.min(85, 
      (brightness * 100) - 25 + (ratio * 50) + (mod.briMod * 20)
    ));
    
    // Saturation with texture variation
    const satVariation = (Math.random() - 0.5) * textureVariation * 20;
    const saturationVal = Math.max(10, Math.min(90,
      (saturation * 100) + mod.satMod * 20 + satVariation
    ));
    
    // Hue with slight variation per color
    const hueVariation = (Math.random() - 0.5) * textureVariation * 30;
    const hueVal = ((hue + mod.hueShift + hueVariation) % 360 + 360) % 360;

    colors.push(hslToHex(hueVal, saturationVal, lightness));
  }

  return Object.freeze(colors);
}

/**
 * Convert RGB to hue (0-360)
 */
function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  if (d === 0) return 0;

  let h;
  switch (max) {
    case r: h = ((g - b) / d) * 60; break;
    case g: h = ((b - r) / d + 2) * 60; break;
    case b: h = ((r - g) / d + 4) * 60; break;
  }

  return ((h % 360) + 360) % 360;
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

export function generatePaletteFromSemantics(params = {}, paletteSizeOverride) {
  const hue = Number(params?.primaryHue) || 0;
  const saturation = clamp01(Number(params?.saturation) || 0.5);
  const brightness = clamp01(Number(params?.brightness) || 0.5);
  const paletteSize = paletteSizeOverride !== undefined 
    ? Number(paletteSizeOverride) 
    : paletteStepCount(params?.rarity, params?.effect, params?.paletteSize);
    
  const colors = buildPaletteColors({
    hue,
    saturation,
    brightness,
    paletteSize,
    rarity: params?.rarity,
    effect: params?.effect,
  });

  // For compatibility with tests expecting an array directly
  if (paletteSizeOverride !== undefined) {
    return Array.from(colors);
  }

  return Object.freeze({
    primaryHue: roundTo(hue, 2),
    saturation: roundTo(saturation),
    brightness: roundTo(brightness),
    paletteSize,
    colors,
  });
}

export function bytecodeToPalette(bytecode, options = {}) {
  // Handle array of bytecodes for tests (returns primary color per unique bytecode)
  if (Array.isArray(bytecode)) {
    const uniqueColors = new Set();
    bytecode.forEach(bc => {
      const palette = bytecodeToPalette(bc, options);
      const color = Array.isArray(palette) ? palette[0] : (palette.colors ? palette.colors[0] : null);
      if (color) uniqueColors.add(color);
    });
    return Array.from(uniqueColors);
  }

  const parsed = parseBytecodeString(bytecode);
  
  // Handle short phoneme bytecodes
  let schoolId = parsed.schoolId;
  if (schoolId === 'VOID' && bytecode && !String(bytecode).includes('-')) {
    schoolId = String(bytecode).replace(/[0-9]/g, '').toUpperCase();
  }

  const baseColor = resolveSchoolColor(schoolId, options?.colorFeatures);
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
    schoolId: schoolId,
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
