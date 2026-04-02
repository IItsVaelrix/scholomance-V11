/**
 * CLIENT-SIDE IMAGE ANALYSIS
 *
 * Decodes and analyses a reference image entirely in the browser using
 * the Canvas API. Works for PNG, JPEG, and BMP without any server call.
 *
 * This is the primary analysis path. The backend (/api/image/analyze) is an
 * optional enhancement — if it's unavailable or broken, this is sufficient.
 */

/**
 * Extract the top N dominant colors from pixel data via bucket quantization.
 * @param {Uint8ClampedArray} pixelData
 * @param {number} [step=4] - Sample every Nth pixel for speed
 * @returns {Array<{hex: string, percentage: number}>}
 */
function extractDominantColors(pixelData, step = 4) {
  const counts = new Map();
  for (let i = 0; i < pixelData.length; i += 4 * step) {
    if (pixelData[i + 3] < 128) continue;
    // Quantize to 16-step buckets to reduce noise
    const r = Math.round(pixelData[i] / 16) * 16;
    const g = Math.round(pixelData[i + 1] / 16) * 16;
    const b = Math.round(pixelData[i + 2] / 16) * 16;
    const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const total = [...counts.values()].reduce((s, v) => s + v, 0) || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, percentage: (count / total) * 100 }));
}

/**
 * Analyse image composition: dominant axis, edge density, complexity.
 * @param {Uint8ClampedArray} pixelData
 * @param {number} width
 * @param {number} height
 * @returns {Object}
 */
function analyzeComposition(pixelData, width, height) {
  let edgeH = 0, edgeV = 0, totalEdges = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i  = (y * width + x) * 4;
      const iR = (y * width + (x + 1)) * 4;
      const iD = ((y + 1) * width + x) * 4;
      const dH = Math.abs(pixelData[i] - pixelData[iR]) +
                 Math.abs(pixelData[i + 1] - pixelData[iR + 1]) +
                 Math.abs(pixelData[i + 2] - pixelData[iR + 2]);
      const dV = Math.abs(pixelData[i] - pixelData[iD]) +
                 Math.abs(pixelData[i + 1] - pixelData[iD + 1]) +
                 Math.abs(pixelData[i + 2] - pixelData[iD + 2]);
      if (dH > 30 || dV > 30) {
        totalEdges++;
        if (dH >= dV) edgeH++; else edgeV++;
      }
    }
  }
  const complexity = Math.min(1, totalEdges / (width * height * 0.3));
  return {
    dominantAxis: edgeH >= edgeV ? 'horizontal' : 'vertical',
    hasSymmetry: false,
    symmetryType: 'none',
    complexity,
    edgeDensity: complexity,
  };
}

/**
 * Decode a File/Blob using the browser's native image decoder (Canvas API),
 * resample to a working substrate of at most 256×256, and extract analysis.
 *
 * Returns the same shape as the server's /api/image/analyze response body
 * so the upload pipeline can treat both sources identically.
 *
 * @param {File} file
 * @returns {Promise<Object>} analysis object
 */
export function analyzeImageClientSide(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Resample to working substrate — max 256×256, preserve aspect ratio
      const MAX = 256;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      // Use willReadFrequently for faster getImageData() readbacks
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      const { data: pixelData } = ctx.getImageData(0, 0, w, h);
      const colors = extractDominantColors(pixelData);
      const composition = analyzeComposition(pixelData, w, h);

      resolve({
        colors,
        composition,
        dimensions: {
          width: w,
          height: h,
          original: { width: img.width, height: img.height },
        },
        // Plain Array so it survives JSON round-trips and structured-clone
        pixelData: Array.from(pixelData),
        semanticParams: {
          surface: { material: 'stone', reflectivity: 0.3, roughness: 0.5 },
          form: {
            complexity: composition.complexity,
            dominantAxis: composition.dominantAxis,
          },
        },
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image. Try PNG or JPEG.'));
    };

    img.src = url;
  });
}
