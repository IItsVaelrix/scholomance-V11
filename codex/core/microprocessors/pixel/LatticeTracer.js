/**
 * PIXEL MICROPROCESSOR: Lattice Tracer
 * 
 * Extracts visual features (edges, landmarks) from pixel substrates
 * and transforms them into VerseIR-compatible coordinate hints.
 */

import { clamp01 } from '../../pixelbrain/shared.js';

/**
 * Trace visual lattice from substrate
 * @param {Object} payload - { pixelData, dimensions, threshold }
 * @returns {Object} { coordinates }
 */
export function traceLattice({ pixelData, dimensions, threshold = 30 }) {
  const { width, height } = dimensions;
  const coordinates = [];
  const visited = new Set();
  const edgeThreshold = threshold;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Skip transparent pixels
      if (pixelData[idx + 3] < 128) continue;
      
      // Detect edges using simple gradient
      const leftIdx = (y * width + (x - 1)) * 4;
      const topIdx = ((y - 1) * width + x) * 4;
      
      const leftDiff = Math.abs(pixelData[idx] - pixelData[leftIdx]) +
                       Math.abs(pixelData[idx + 1] - pixelData[leftIdx + 1]) +
                       Math.abs(pixelData[idx + 2] - pixelData[leftIdx + 2]);
      
      const topDiff = Math.abs(pixelData[idx] - pixelData[topIdx]) +
                      Math.abs(pixelData[idx + 1] - pixelData[topIdx + 1]) +
                      Math.abs(pixelData[idx + 2] - pixelData[topIdx + 2]);
      
      const isEdge = leftDiff > edgeThreshold || topDiff > edgeThreshold;
      
      if (isEdge) {
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];
        const colorHex = rgbToHex(r, g, b);
        
        coordinates.push({
          x,
          y,
          z: 0,
          color: colorHex,
          emphasis: clamp01((leftDiff + topDiff) / (2 * 255)),
          source: 'image_edge',
        });
      }
    }
  }

  // Fallback: if very sparse, add samples
  if (coordinates.length < 50) {
    const sampleStep = Math.max(2, Math.floor(width / 20));
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * 4;
        if (pixelData[idx + 3] < 128) continue;
        
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];
        const brightness = (r + g + b) / 3;
        
        if (brightness > 20 && brightness < 235) {
          coordinates.push({
            x,
            y,
            z: 0,
            color: rgbToHex(r, g, b),
            emphasis: clamp01(brightness / 255) * 0.5,
            source: 'image_sample',
          });
        }
      }
    }
  }

  return { coordinates };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}
