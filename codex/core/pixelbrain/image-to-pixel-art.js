/**
 * IMAGE-TO-PIXEL-ART GENERATOR
 * 
 * Generates pixel art coordinates and colors from reference image analysis.
 * This module traces shapes, extracts features, and maps them to PixelBrain's coordinate system.
 */

import { clamp01, GOLDEN_RATIO } from './shared.js';
import { snapToPixelGrid } from './anti-alias-control.js';

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
 * @returns {Object} PixelBrain-compatible result
 */
export function generatePixelArtFromImage(imageAnalysis, canvasSize, extension = null) {
  const { colors, composition, semanticParams, pixelData, dimensions } = imageAnalysis;
  
  // Build palette from image colors
  const palettes = buildPaletteFromImageColors(colors, semanticParams);
  
  // Generate coordinates from image features
  const coordinates = extractFeaturesAsCoordinates(pixelData, dimensions, composition, canvasSize);
  
  // Apply extension if specified
  let finalCoordinates = coordinates;
  if (extension) {
    finalCoordinates = applyExtensionToCoordinates(coordinates, extension, canvasSize);
  }
  
  return {
    coordinates: finalCoordinates,
    palettes,
    canvas: canvasSize,
    dominantAxis: composition.dominantAxis || 'horizontal',
    dominantSymmetry: composition.hasSymmetry ? composition.symmetryType : 'none',
  };
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

/**
 * Extract image features as coordinates
 * This traces edges, detects shapes, and maps them to the canvas
 */
function extractFeaturesAsCoordinates(pixelData, dimensions, composition, canvasSize) {
  const { width: srcWidth, height: srcHeight } = dimensions;
  const { width: canvasWidth, height: canvasHeight } = canvasSize;
  
  // Calculate scale factors
  const scaleX = canvasWidth / srcWidth;
  const scaleY = canvasHeight / srcHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Offset to center image on canvas
  const offsetX = (canvasWidth - srcWidth * scale) / 2;
  const offsetY = (canvasHeight - srcHeight * scale) / 2;
  
  const coordinates = [];
  const visited = new Set();
  
  // Extract edge pixels
  const edgeThreshold = 30;
  const minFeatureSize = 4; // Minimum pixels to form a feature
  
  for (let y = 1; y < srcHeight - 1; y++) {
    for (let x = 1; x < srcWidth - 1; x++) {
      const idx = (y * srcWidth + x) * 4;
      
      // Skip transparent pixels
      if (pixelData[idx + 3] < 128) continue;
      
      // Detect edges using simple gradient
      const leftIdx = (y * srcWidth + (x - 1)) * 4;
      const rightIdx = (y * srcWidth + (x + 1)) * 4;
      const topIdx = ((y - 1) * srcWidth + x) * 4;
      const bottomIdx = ((y + 1) * srcWidth + x) * 4;
      
      const leftDiff = Math.abs(pixelData[idx] - pixelData[leftIdx]) +
                       Math.abs(pixelData[idx + 1] - pixelData[leftIdx + 1]) +
                       Math.abs(pixelData[idx + 2] - pixelData[leftIdx + 2]);
      
      const topDiff = Math.abs(pixelData[idx] - pixelData[topIdx]) +
                      Math.abs(pixelData[idx + 1] - pixelData[topIdx + 1]) +
                      Math.abs(pixelData[idx + 2] - pixelData[topIdx + 2]);
      
      const isEdge = leftDiff > edgeThreshold || topDiff > edgeThreshold;
      
      if (isEdge) {
        // Map to canvas coordinates
        const canvasX = Math.round(x * scale + offsetX);
        const canvasY = Math.round(y * scale + offsetY);
        
        const key = `${canvasX},${canvasY}`;
        if (!visited.has(key)) {
          visited.add(key);
          
          // Find color match in palette
          const r = pixelData[idx];
          const g = pixelData[idx + 1];
          const b = pixelData[idx + 2];
          const colorHex = rgbToHex(r, g, b);
          
          coordinates.push({
            x: canvasX,
            y: canvasY,
            z: 0,
            color: colorHex,
            emphasis: clamp01((leftDiff + topDiff) / (2 * 255)),
            source: 'image_edge',
            snappedX: canvasX,
            snappedY: canvasY,
          });
        }
      }
    }
  }
  
  // If no edges found, fall back to grid sampling
  if (coordinates.length === 0) {
    return sampleImageGrid(pixelData, srcWidth, srcHeight, canvasSize, scale, offsetX, offsetY);
  }
  
  // Snap to pixel grid
  return coordinates.map(coord => {
    const snapped = snapToPixelGrid(coord.x, coord.y, canvasSize.gridSize || 1);
    return {
      ...coord,
      snappedX: snapped.x,
      snappedY: snapped.y,
    };
  });
}

/**
 * Sample image on a grid (fallback when edge detection finds nothing)
 */
function sampleImageGrid(pixelData, srcWidth, srcHeight, canvasSize, scale, offsetX, offsetY) {
  const coordinates = [];
  const sampleStep = Math.max(1, Math.floor(srcWidth / 40)); // Sample every N pixels
  
  for (let y = 0; y < srcHeight; y += sampleStep) {
    for (let x = 0; x < srcWidth; x += sampleStep) {
      const idx = (y * srcWidth + x) * 4;
      
      // Skip transparent pixels
      if (pixelData[idx + 3] < 128) continue;
      
      const canvasX = Math.round(x * scale + offsetX);
      const canvasY = Math.round(y * scale + offsetY);
      
      const r = pixelData[idx];
      const g = pixelData[idx + 1];
      const b = pixelData[idx + 2];
      const brightness = (r + g + b) / 3;
      
      // Only sample non-background areas
      if (brightness > 20 && brightness < 235) {
        coordinates.push({
          x: canvasX,
          y: canvasY,
          z: 0,
          color: rgbToHex(r, g, b),
          emphasis: clamp01(brightness / 255),
          source: 'image_sample',
          snappedX: canvasX,
          snappedY: canvasY,
        });
      }
    }
  }
  
  return coordinates;
}

/**
 * Apply extension to coordinates
 */
function applyExtensionToCoordinates(coordinates, extension, canvasSize) {
  if (extension === 'style-8bit' || extension === 'style-gameboy') {
    // Reduce color depth and simplify coordinates
    return coordinates.map(coord => ({
      ...coord,
      emphasis: Math.round(coord.emphasis * 4) / 4, // Quantize to 4 levels
    }));
  }
  
  if (extension === 'style-crt') {
    // Add scanline effect by modulating y positions
    return coordinates.map(coord => ({
      ...coord,
      y: coord.y + (coord.y % 3 === 0 ? 0.5 : 0),
      snappedY: Math.round(coord.y),
    }));
  }
  
  return coordinates;
}

/**
 * Generate silhouette from image (simplified shape)
 * @param {ImageAnalysis} imageAnalysis
 * @param {Object} canvasSize
 * @returns {Array} Coordinates forming silhouette
 */
export function generateSilhouetteFromImage(imageAnalysis, canvasSize) {
  const { pixelData, dimensions } = imageAnalysis;
  const { width: srcWidth, height: srcHeight } = dimensions;
  const { width: canvasWidth, height: canvasHeight, gridSize } = canvasSize;
  
  // Calculate bounding box of non-transparent content
  let minX = srcWidth, maxX = 0, minY = srcHeight, maxY = 0;
  
  for (let y = 0; y < srcHeight; y++) {
    for (let x = 0; x < srcWidth; x++) {
      const idx = (y * srcWidth + x) * 4;
      if (pixelData[idx + 3] >= 128) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Scale bounding box to canvas
  const scaleX = canvasWidth / srcWidth;
  const scaleY = canvasHeight / srcHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (canvasWidth - srcWidth * scale) / 2;
  const offsetY = (canvasHeight - srcHeight * scale) / 2;
  
  const silhouetteMinX = Math.round(minX * scale + offsetX);
  const silhouetteMaxX = Math.round(maxX * scale + offsetX);
  const silhouetteMinY = Math.round(minY * scale + offsetY);
  const silhouetteMaxY = Math.round(maxY * scale + offsetY);
  
  // Generate outline coordinates
  const coordinates = [];
  
  // Top edge
  for (let x = silhouetteMinX; x <= silhouetteMaxX; x += gridSize) {
    coordinates.push({ x, y: silhouetteMinY, z: 0, emphasis: 1, source: 'silhouette' });
  }
  // Right edge
  for (let y = silhouetteMinY; y <= silhouetteMaxY; y += gridSize) {
    coordinates.push({ x: silhouetteMaxX, y, z: 0, emphasis: 1, source: 'silhouette' });
  }
  // Bottom edge
  for (let x = silhouetteMaxX; x >= silhouetteMinX; x -= gridSize) {
    coordinates.push({ x, y: silhouetteMaxY, z: 0, emphasis: 1, source: 'silhouette' });
  }
  // Left edge
  for (let y = silhouetteMaxY; y >= silhouetteMinY; y -= gridSize) {
    coordinates.push({ x: silhouetteMinX, y, z: 0, emphasis: 1, source: 'silhouette' });
  }
  
  return coordinates;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * Fill coordinates with flood-fill algorithm
 * @param {Array} outline - Outline coordinates
 * @param {Object} canvasSize
 * @param {string} fillColor - Hex color
 * @returns {Array} Filled coordinates
 */
export function fillShape(outline, canvasSize, fillColor) {
  const { width, height } = canvasSize;
  const grid = new Array(width * height).fill(0);
  
  // Mark outline pixels
  outline.forEach(coord => {
    if (coord.x >= 0 && coord.x < width && coord.y >= 0 && coord.y < height) {
      grid[coord.y * width + coord.x] = 1;
    }
  });
  
  // Find interior points using scanline fill
  const filled = [];
  
  for (let y = 0; y < height; y++) {
    let inside = false;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (grid[idx] === 1) {
        inside = !inside;
      } else if (inside) {
        filled.push({
          x,
          y,
          z: 0,
          color: fillColor,
          emphasis: 0.3,
          source: 'fill',
          snappedX: x,
          snappedY: y,
        });
      }
    }
  }
  
  return filled;
}
