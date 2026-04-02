/**
 * IMAGE TEXTURING ENGINE
 * 
 * Pure JS implementation of image composition and blend modes.
 * Portable across Browser (WebWorker) and Node.js.
 */

/**
 * Apply texture to image substrate
 * @param {Uint8ClampedArray} basePixels - Base image data
 * @param {Uint8ClampedArray} texturePixels - Texture image data
 * @param {Object} options - { width, height, blendMode, opacity }
 * @returns {Uint8ClampedArray} Textured image data
 */
export function applyTexture(basePixels, texturePixels, { width: _width, height: _height, blendMode = 'multiply', opacity = 0.7 }) {
  const result = new Uint8ClampedArray(basePixels.length);
  
  for (let i = 0; i < basePixels.length; i += 4) {
    const r1 = basePixels[i];
    const g1 = basePixels[i + 1];
    const b1 = basePixels[i + 2];
    const _a1 = basePixels[i + 3] / 255;

    const r2 = texturePixels[i];
    const g2 = texturePixels[i + 1];
    const b2 = texturePixels[i + 2];
    const a2 = (texturePixels[i + 3] / 255) * opacity;

    let r, g, b;

    switch (blendMode) {
      case 'multiply':
        r = (r1 * r2) / 255;
        g = (g1 * g2) / 255;
        b = (b1 * b2) / 255;
        break;
      case 'screen':
        r = 255 - ((255 - r1) * (255 - r2)) / 255;
        g = 255 - ((255 - g1) * (255 - g2)) / 255;
        b = 255 - ((255 - b1) * (255 - b2)) / 255;
        break;
      case 'overlay':
        r = r1 < 128 ? (2 * r1 * r2) / 255 : 255 - 2 * (255 - r1) * (255 - r2) / 255;
        g = g1 < 128 ? (2 * g1 * g2) / 255 : 255 - 2 * (255 - g1) * (255 - g2) / 255;
        b = b1 < 128 ? (2 * b1 * b2) / 255 : 255 - 2 * (255 - b1) * (255 - b2) / 255;
        break;
      default: // Normal alpha blend
        r = r1 * (1 - a2) + r2 * a2;
        g = g1 * (1 - a2) + g2 * a2;
        b = b1 * (1 - a2) + b2 * a2;
    }

    // Alpha composition
    result[i] = Math.min(255, Math.max(0, r));
    result[i + 1] = Math.min(255, Math.max(0, g));
    result[i + 2] = Math.min(255, Math.max(0, b));
    result[i + 3] = basePixels[i + 3]; // Preserve base alpha
  }

  return result;
}
