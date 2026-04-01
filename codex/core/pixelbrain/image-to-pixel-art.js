/**
 * IMAGE-TO-PIXEL-ART GENERATOR
 * 
 * Generates pixel art coordinates and colors from reference image analysis.
 * This module traces shapes, extracts features, and maps them to PixelBrain's coordinate system.
 */

import { clamp01, roundTo } from './shared.js';
import { snapToPixelGrid } from './anti-alias-control.js';
import { analyzeImageToFormula, formulaToBytecode } from './image-to-bytecode-formula.js';
import { processorBridge } from '../../../src/lib/processor-bridge.js';

/**
 * @typedef {Object} ImageAnalysis
 * @property {Array} colors - Dominant colors
 * @property {Object} composition - Composition metrics
 * @property {Object} semanticParams - Semantic parameters
 * @property {Uint8ClampedArray} pixelData - Raw pixel data
 * @property {Object} dimensions - Image dimensions
 */

/**
 * Generate pixel art from image analysis
 * @param {ImageAnalysis} imageAnalysis - Result from image analysis
 * @param {Object} canvasSize - Canvas dimensions
 * @param {string} extension - Extension ID to apply
 * @returns {Promise<Object>} PixelBrain-compatible result
 */
export async function generatePixelArtFromImage(imageAnalysis, canvasSize, extension = null) {
  const { colors, composition, semanticParams, pixelData, dimensions } = imageAnalysis;
  
  // 1. Extract mathematical formula from image
  const formula = analyzeImageToFormula(imageAnalysis);
  const bytecode = formulaToBytecode(formula);

  // 2. Build palette from image colors
  const palettes = buildPaletteFromImageColors(colors, semanticParams);
  
  // 3. Generate coordinates from image features
  // FIX: If coordinates were already extracted (e.g. by a WebWorker), use them!
  const coordinates = Array.isArray(imageAnalysis.coordinates) && imageAnalysis.coordinates.length > 0
    ? imageAnalysis.coordinates
    : (await processorBridge.execute('pixel.trace', { pixelData, dimensions, composition, canvasSize })).coordinates;
  
  // Snap all coordinates to pixel grid
  const finalCoordinates = coordinates.map(coord => {
    const snapped = snapToPixelGrid(coord, canvasSize.gridSize || 1);
    return {
      ...coord,
      snappedX: snapped.x,
      snappedY: snapped.y,
    };
  });
  
  // Apply extension if specified
  let processedCoordinates = finalCoordinates;
  if (extension) {
    processedCoordinates = applyExtensionToCoordinates(finalCoordinates, extension, canvasSize);
  }
  
  return {
    coordinates: processedCoordinates,
    palettes,
    canvas: canvasSize,
    formula,
    bytecode,
    dominantAxis: composition?.dominantAxis || 'horizontal',
    dominantSymmetry: composition?.hasSymmetry ? (composition?.symmetryType || 'none') : 'none',
  };
}

/**
 * Direct transcription of pixel data to coordinates
 * (Used for high-fidelity reconstruction)
 */
export function transcribeFullPixelData(pixelData, dimensions, canvasSize) {
  const { width: srcWidth, height: srcHeight } = dimensions;
  const { width: canvasWidth, height: canvasHeight } = canvasSize;
  const coordinates = [];

  const scaleX = canvasWidth / srcWidth;
  const scaleY = canvasHeight / srcHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvasWidth - srcWidth * scale) / 2;
  const offsetY = (canvasHeight - srcHeight * scale) / 2;

  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const idx = (y * srcWidth + x) * 4;
      if (pixelData[idx + 3] < 128) continue;

      coordinates.push({
        x: x * scale + offsetX,
        y: y * scale + offsetY,
        z: 0,
        color: rgbToHex(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]),
        emphasis: 0.5,
        source: 'direct_transcription',
      });
    }
  }

  // Snap to pixel grid
  return coordinates.map(coord => {
    const snapped = snapToPixelGrid(coord, canvasSize.gridSize || 1);
    return {
      ...coord,
      snappedX: snapped.x,
      snappedY: snapped.y,
    };
  });
}

/**
 * Build palette from image colors
 */
function buildPaletteFromImageColors(colors, semanticParams) {
  if (!colors || colors.length === 0) {
    return [];
  }
  
  // Create color key from dominant color
  const dominantColor = colors[0];
  const key = `img_${dominantColor.hex.replace('#', '')}`;
  
  // Build color array with weights
  const paletteColors = colors.map(color => ({
    hex: color.hex,
    weight: color.percentage / 100,
  }));
  
  return [{
    key,
    colors: paletteColors.map(c => c.hex),
    weights: paletteColors.map(c => c.weight),
    source: 'image',
  }];
}

function applyExtensionToCoordinates(coordinates, extensionId, canvasSize) {
  // Simple extension routing for now
  if (extensionId === 'physics-gravity') {
    return coordinates.map(c => ({
      ...c,
      y: Math.min(canvasSize.height, c.y + 10),
      emphasis: c.emphasis * 0.8
    }));
  }
  return coordinates;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}
