/**
 * IMAGE-TO-SEMANTIC BRIDGE
 * 
 * Converts image analysis results into PixelBrain semantic parameters.
 * This bridge allows reference images to drive pixel art generation.
 */

import { GOLDEN_RATIO } from './pixelbrain/shared.js';

/**
 * @typedef {Object} ImageAnalysis
 * @property {Object} dimensions - Image dimensions
 * @property {Array} colors - Dominant colors
 * @property {Object} composition - Composition metrics
 * @property {Object} semanticParams - Pre-computed semantic params from server
 */

/**
 * @typedef {Object} PixelBrainParameters
 * @property {Object} surface - Surface properties
 * @property {Object} form - Form properties
 * @property {Object} light - Lighting properties
 * @property {Object} color - Color properties
 * @property {string} ditherMethod - Dithering algorithm
 * @property {string|null} extension - Extension to apply
 */

/**
 * Convert image analysis to PixelBrain parameters
 * @param {ImageAnalysis} imageAnalysis - Result from image analysis service
 * @param {string} userDescription - Optional text description to refine semantics
 * @returns {PixelBrainParameters}
 */
export function imageToPixelBrainParams(imageAnalysis, userDescription = '') {
  const { colors, composition, semanticParams } = imageAnalysis;
  
  // Use server-computed semantic params if available
  if (semanticParams) {
    return refineSemanticParamsWithDescription(semanticParams, userDescription);
  }
  
  // Fallback: compute from scratch
  return computeSemanticParamsFromImage(colors, composition, userDescription);
}

/**
 * Refine server-computed semantic params with user description keywords
 */
function refineSemanticParamsWithDescription(params, description) {
  if (!description) return params;
  
  const desc = description.toLowerCase();
  const refined = { ...params };
  
  // Apply keyword-based refinements
  if (desc.includes('bright') || desc.includes('glowing')) {
    refined.light = { ...refined.light, intensity: Math.min(1, refined.light.intensity + 0.2) };
    refined.color = { ...refined.color, brightness: Math.min(1, refined.color.brightness + 0.15) };
  }
  
  if (desc.includes('dark') || desc.includes('shadow')) {
    refined.light = { ...refined.light, intensity: Math.max(0.2, refined.light.intensity - 0.2) };
    refined.color = { ...refined.color, brightness: Math.max(0.2, refined.color.brightness - 0.15) };
  }
  
  if (desc.includes('sharp') || desc.includes('crisp')) {
    refined.surface = { ...refined.surface, roughness: Math.max(0.1, refined.surface.roughness - 0.2) };
    refined.light = { ...refined.light, hardness: Math.min(1, refined.light.hardness + 0.15) };
  }
  
  if (desc.includes('soft') || desc.includes('blur')) {
    refined.surface = { ...refined.surface, roughness: Math.min(0.9, refined.surface.roughness + 0.2) };
    refined.light = { ...refined.light, hardness: Math.max(0.2, refined.light.hardness - 0.15) };
  }
  
  if (desc.includes('symmetric') || desc.includes('balanced')) {
    refined.form = { ...refined.form, symmetry: refined.form.symmetry || 'vertical' };
  }
  
  if (desc.includes('asymmetric') || desc.includes('dynamic')) {
    refined.form = { ...refined.form, symmetry: 'none' };
  }
  
  return refined;
}

/**
 * Compute semantic parameters from image colors and composition
 */
function computeSemanticParamsFromImage(colors, composition, description) {
  // Map dominant color to hue
  const primaryColor = colors[0]?.rgb || [128, 128, 128];
  const primaryHue = rgbToHue(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  // Map brightness to material
  const brightnessNorm = composition.brightnessNormalized || 0.5;
  const material = brightnessNorm > 0.6 ? 'crystalline'
    : brightnessNorm > 0.4 ? 'metal'
    : brightnessNorm > 0.2 ? 'stone'
    : 'energy';
  
  // Map contrast to surface properties
  const contrastNorm = composition.contrastNormalized || 0.5;
  const roughness = Math.max(0.1, Math.min(0.95, 1 - contrastNorm));
  const reflectivity = material === 'crystalline' ? 0.9
    : material === 'metal' ? 0.7
    : material === 'energy' ? 0.3
    : 0.2;
  
  // Map edge density to texture
  const edgeDensity = composition.edgeDensity || 0.1;
  const texture = edgeDensity > 0.15 ? 'crystalline'
    : edgeDensity > 0.08 ? 'grained'
    : 'smooth';
  
  // Map composition to form
  const complexity = composition.complexity || 0.5;
  const dominantAxis = composition.dominantAxis || 'horizontal';
  const hasSymmetry = composition.hasSymmetry || false;
  const symmetryType = composition.symmetryType || 'none';
  
  return {
    surface: {
      material,
      reflectivity,
      roughness,
      texture,
    },
    form: {
      scale: 1.0 + (complexity * 0.5),
      symmetry: hasSymmetry ? symmetryType : 'none',
      complexity,
      dominantAxis,
    },
    light: {
      angle: brightnessNorm > 0.5 ? 45 : 135,
      hardness: contrastNorm,
      color: colors[0]?.hex || '#FFFFFF',
      intensity: brightnessNorm,
    },
    color: {
      primaryHue,
      saturation: 0.5 + (contrastNorm * 0.5),
      brightness: brightnessNorm,
      paletteSize: Math.min(16, Math.max(4, colors.length)),
    },
    ditherMethod: edgeDensity > 0.1 ? 'floyd-steinberg' : 'ordered',
    extension: hasSymmetry ? 'style-8bit' : null,
  };
}

/**
 * Merge image-derived params with NLU-derived params
 * @param {PixelBrainParameters} imageParams - From image analysis
 * @param {PixelBrainParameters} nluParams - From NLU/text description
 * @param {number} imageWeight - 0-1, how much to favor image (default 0.6)
 * @returns {PixelBrainParameters}
 */
export function mergeImageAndNLUParams(imageParams, nluParams, imageWeight = 0.6) {
  if (!nluParams) return imageParams;
  if (!imageParams) return nluParams;
  
  const nluWeight = 1 - imageWeight;
  
  return {
    surface: {
      material: imageWeight > 0.5 ? imageParams.surface.material : nluParams.surface.material,
      reflectivity: lerp(nluParams.surface.reflectivity, imageParams.surface.reflectivity, imageWeight),
      roughness: lerp(nluParams.surface.roughness, imageParams.surface.roughness, imageWeight),
      texture: imageWeight > 0.5 ? imageParams.surface.texture : nluParams.surface.texture,
    },
    form: {
      scale: lerp(nluParams.form.scale, imageParams.form.scale, imageWeight),
      symmetry: imageWeight > 0.5 ? imageParams.form.symmetry : nluParams.form.symmetry,
      complexity: lerp(nluParams.form.complexity, imageParams.form.complexity, imageWeight),
      dominantAxis: imageWeight > 0.5 ? imageParams.form.dominantAxis : nluParams.form.dominantAxis,
    },
    light: {
      angle: Math.round(lerp(nluParams.light.angle, imageParams.light.angle, imageWeight)),
      hardness: lerp(nluParams.light.hardness, imageParams.light.hardness, imageWeight),
      color: imageWeight > 0.5 ? imageParams.light.color : nluParams.light.color,
      intensity: lerp(nluParams.light.intensity, imageParams.light.intensity, imageWeight),
    },
    color: {
      primaryHue: Math.round(lerp(nluParams.color.primaryHue, imageParams.color.primaryHue, imageWeight)),
      saturation: lerp(nluParams.color.saturation, imageParams.color.saturation, imageWeight),
      brightness: lerp(nluParams.color.brightness, imageParams.color.brightness, imageWeight),
      paletteSize: Math.round(lerp(nluParams.color.paletteSize, imageParams.color.paletteSize, imageWeight)),
    },
    ditherMethod: imageWeight > 0.5 ? imageParams.ditherMethod : nluParams.ditherMethod,
    extension: imageWeight > 0.5 ? imageParams.extension : nluParams.extension,
  };
}

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Convert RGB to hue angle (0-360)
 */
function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  if (delta === 0) return 0;
  
  let hue;
  switch (max) {
    case r:
      hue = ((g - b) / delta) % 6;
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    case b:
      hue = (r - g) / delta + 4;
      break;
  }
  
  hue = Math.round(hue * 60);
  return hue < 0 ? hue + 360 : hue;
}

/**
 * Generate a color palette from image analysis for PixelBrain
 * @param {ImageAnalysis} imageAnalysis
 * @returns {Array<{hex: string, weight: number}>}
 */
export function generatePaletteFromImage(imageAnalysis) {
  const { colors } = imageAnalysis;
  
  if (!colors || colors.length === 0) {
    return [{ hex: '#808080', weight: 1.0 }];
  }
  
  // Normalize percentages to weights
  const totalPercentage = colors.reduce((sum, c) => sum + c.percentage, 0);
  
  return colors.map(color => ({
    hex: color.hex,
    weight: color.percentage / totalPercentage,
  }));
}

/**
 * Extract key visual features for coordinate mapping
 * @param {ImageAnalysis} imageAnalysis
 * @returns {Object} Coordinate mapping hints
 */
export function extractCoordinateHints(imageAnalysis) {
  const { composition } = imageAnalysis;
  
  return {
    dominantAxis: composition.dominantAxis || 'horizontal',
    symmetry: composition.hasSymmetry ? composition.symmetryType : 'none',
    density: composition.edgeDensity || 0.1,
    complexity: composition.complexity || 0.5,
    goldenRatioPoint: {
      x: Math.round(composition.analyzedWidth * (1 - 1 / GOLDEN_RATIO)),
      y: Math.round(composition.analyzedHeight * (1 - 1 / GOLDEN_RATIO)),
    },
  };
}
