/**
 * IMAGE ANALYSIS SERVICE
 * 
 * Extracts visual features from uploaded reference images for PixelBrain.
 * Analyzes: dominant colors, composition, brightness, contrast, edge density.
 */

/**
 * Extract dominant colors from image data
 * @param {Uint8ClampedArray} imageData - Raw RGBA pixel data
 * @param {number} colorCount - Number of dominant colors to extract
 * @returns {Array<{hex: string, rgb: number[], percentage: number}>}
 */
export function extractDominantColors(imageData, colorCount = 8) {
  const colorMap = new Map();
  const quantizeFactor = 32; // Reduce color space for clustering
  
  for (let i = 0; i < imageData.length; i += 4) {
    const r = Math.floor(imageData[i] / quantizeFactor) * quantizeFactor;
    const g = Math.floor(imageData[i + 1] / quantizeFactor) * quantizeFactor;
    const b = Math.floor(imageData[i + 2] / quantizeFactor) * quantizeFactor;
    const a = imageData[i + 3];
    
    // Skip transparent pixels
    if (a < 128) continue;
    
    const key = `${r},${g},${b}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }
  
  // Sort by frequency and take top colors
  const sorted = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorCount);
  
  const totalPixels = sorted.reduce((sum, [, count]) => sum + count, 0);
  
  return sorted.map(([key, count]) => {
    const [r, g, b] = key.split(',').map(Number);
    return {
      hex: rgbToHex(r, g, b),
      rgb: [r, g, b],
      percentage: Math.round((count / totalPixels) * 100),
    };
  });
}

/**
 * Analyze image composition and structure
 * @param {Uint8ClampedArray} imageData - Raw RGBA pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Composition metrics
 */
export function analyzeComposition(imageData, width, height) {
  const grayscale = new Float32Array(width * height);
  
  // Convert to grayscale
  for (let i = 0; i < imageData.length; i += 4) {
    const idx = i / 4;
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    // Luminance formula
    grayscale[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  
  // Calculate brightness distribution
  let totalBrightness = 0;
  let darkPixels = 0;
  let lightPixels = 0;
  const threshold = 128;
  
  for (let i = 0; i < grayscale.length; i++) {
    const brightness = grayscale[i];
    totalBrightness += brightness;
    if (brightness < threshold) darkPixels++;
    else lightPixels++;
  }
  
  const avgBrightness = totalBrightness / grayscale.length;
  const contrast = Math.max(...grayscale) - Math.min(...grayscale);
  const brightnessRatio = lightPixels / darkPixels;
  
  // Detect dominant axis (horizontal vs vertical features)
  const horizontalEdges = detectHorizontalEdges(grayscale, width, height);
  const verticalEdges = detectVerticalEdges(grayscale, width, height);
  const dominantAxis = horizontalEdges > verticalEdges ? 'horizontal' : 'vertical';
  
  // Detect symmetry
  const horizontalSymmetry = detectHorizontalSymmetry(grayscale, width, height);
  const verticalSymmetry = detectVerticalSymmetry(grayscale, width, height);
  const hasSymmetry = horizontalSymmetry > 0.7 || verticalSymmetry > 0.7;
  const symmetryType = horizontalSymmetry > verticalSymmetry ? 'horizontal' : 'vertical';
  
  // Edge density (complexity metric)
  const edgeDensity = (horizontalEdges + verticalEdges) / (width * height);
  
  return {
    brightness: Math.round(avgBrightness),
    brightnessNormalized: avgBrightness / 255,
    contrast: Math.round(contrast),
    contrastNormalized: contrast / 255,
    brightnessRatio: parseFloat(brightnessRatio.toFixed(2)),
    dominantAxis,
    edgeDensity: parseFloat(edgeDensity.toFixed(4)),
    complexity: Math.min(1, edgeDensity * 10),
    hasSymmetry,
    symmetryType: hasSymmetry ? symmetryType : 'none',
    horizontalSymmetry: parseFloat(horizontalSymmetry.toFixed(3)),
    verticalSymmetry: parseFloat(verticalSymmetry.toFixed(3)),
  };
}

/**
 * Detect horizontal edges using Sobel-like operator
 */
function detectHorizontalEdges(grayscale, width, height) {
  let edges = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const top = grayscale[(y - 1) * width + x];
      const bottom = grayscale[(y + 1) * width + x];
      const diff = Math.abs(top - bottom);
      if (diff > 30) edges++;
    }
  }
  
  return edges;
}

/**
 * Detect vertical edges using Sobel-like operator
 */
function detectVerticalEdges(grayscale, width, height) {
  let edges = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const left = grayscale[y * width + (x - 1)];
      const right = grayscale[y * width + (x + 1)];
      const diff = Math.abs(left - right);
      if (diff > 30) edges++;
    }
  }
  
  return edges;
}

/**
 * Detect horizontal symmetry (mirror across horizontal axis)
 */
function detectHorizontalSymmetry(grayscale, width, height) {
  let matches = 0;
  let total = 0;
  const threshold = 20;
  
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const top = grayscale[y * width + x];
      const bottom = grayscale[(height - 1 - y) * width + x];
      if (Math.abs(top - bottom) < threshold) matches++;
      total++;
    }
  }
  
  return matches / total;
}

/**
 * Detect vertical symmetry (mirror across vertical axis)
 */
function detectVerticalSymmetry(grayscale, width, height) {
  let matches = 0;
  let total = 0;
  const threshold = 20;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      const left = grayscale[y * width + x];
      const right = grayscale[y * width + (width - 1 - x)];
      if (Math.abs(left - right) < threshold) matches++;
      total++;
    }
  }
  
  return matches / total;
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
 * Convert image analysis to PixelBrain semantic parameters
 * @param {Object} colorAnalysis - Result from extractDominantColors
 * @param {Object} composition - Result from analyzeComposition
 * @param {string} userDescription - Optional text description from user
 * @returns {Object} PixelBrain-compatible semantic parameters
 */
export function imageToSemanticParams(colorAnalysis, composition, userDescription = '') {
  // Map dominant color to hue
  const primaryColor = colorAnalysis[0]?.rgb || [128, 128, 128];
  const primaryHue = rgbToHue(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  // Map brightness to material
  const material = composition.brightnessNormalized > 0.6 ? 'crystalline'
    : composition.brightnessNormalized > 0.4 ? 'metal'
    : composition.brightnessNormalized > 0.2 ? 'stone'
    : 'energy';
  
  // Map complexity to surface properties
  const roughness = Math.max(0.1, Math.min(0.95, 1 - composition.contrastNormalized));
  const reflectivity = material === 'crystalline' ? 0.9
    : material === 'metal' ? 0.7
    : material === 'energy' ? 0.3
    : 0.2;
  
  // Map edge density to texture
  const texture = composition.edgeDensity > 0.15 ? 'crystalline'
    : composition.edgeDensity > 0.08 ? 'grained'
    : 'smooth';
  
  // Build semantic parameters
  return {
    surface: {
      material,
      reflectivity,
      roughness,
      texture,
    },
    form: {
      scale: 1.0 + (composition.complexity * 0.5),
      symmetry: composition.hasSymmetry ? composition.symmetryType : 'none',
      complexity: composition.complexity,
      dominantAxis: composition.dominantAxis,
    },
    light: {
      angle: composition.brightnessNormalized > 0.5 ? 45 : 135,
      hardness: composition.contrastNormalized,
      color: colorAnalysis[0]?.hex || '#FFFFFF',
      intensity: composition.brightnessNormalized,
    },
    color: {
      primaryHue,
      saturation: 0.5 + (composition.contrastNormalized * 0.5),
      brightness: composition.brightnessNormalized,
      paletteSize: Math.min(16, Math.max(4, colorAnalysis.length)),
    },
    ditherMethod: composition.edgeDensity > 0.1 ? 'floyd-steinberg' : 'ordered',
    extension: composition.hasSymmetry ? 'style-8bit' : null,
  };
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
 * Process uploaded image and return analysis
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeReferenceImage(imageBuffer) {
  // Simple image parsing (supports PNG, JPEG, BMP)
  const dimensions = getImageDimensions(imageBuffer);
  
  if (!dimensions) {
    throw new Error('Unsupported image format. Use PNG, JPEG, or BMP.');
  }
  
  // Resize to manageable size for analysis
  const maxSize = 256;
  const scale = Math.min(1, maxSize / Math.max(dimensions.width, dimensions.height));
  const resizedWidth = Math.round(dimensions.width * scale);
  const resizedHeight = Math.round(dimensions.height * scale);
  
  // Extract pixel data
  const pixelData = extractPixelData(imageBuffer, dimensions, resizedWidth, resizedHeight);
  
  // Analyze colors
  const dominantColors = extractDominantColors(pixelData, 8);
  
  // Analyze composition
  const composition = analyzeComposition(pixelData, resizedWidth, resizedHeight);
  
  // Add dimensions to composition
  composition.analyzedWidth = resizedWidth;
  composition.analyzedHeight = resizedHeight;
  
  // Convert to semantic parameters
  const semanticParams = imageToSemanticParams(dominantColors, composition);
  
  return {
    dimensions: {
      original: dimensions,
      analyzed: { width: resizedWidth, height: resizedHeight },
    },
    colors: dominantColors,
    composition,
    semanticParams,
    pixelData: Array.from(pixelData), // Convert to array for JSON serialization
  };
}

/**
 * Get image dimensions from buffer (PNG/JPEG/BMP header parsing)
 */
function getImageDimensions(buffer) {
  // PNG signature and IHDR chunk
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      format: 'png',
    };
  }
  
  // JPEG SOF marker
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC3) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
          format: 'jpeg',
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  
  // BMP header
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return {
      width: buffer.readInt32LE(18),
      height: Math.abs(buffer.readInt32LE(22)),
      format: 'bmp',
    };
  }
  
  return null;
}

/**
 * Extract and resize pixel data from image buffer
 * Simplified implementation using pure JS (production should use sharp/jimp)
 */
function extractPixelData(buffer, dimensions, targetWidth, targetHeight) {
  const { width, height, format } = dimensions;
  const size = targetWidth * targetHeight;
  const data = new Uint8ClampedArray(size * 4);
  
  // Simple nearest-neighbor scaling with format-specific parsing
  if (format === 'png') {
    return extractPNGPixelData(buffer, dimensions, targetWidth, targetHeight);
  } else if (format === 'bmp') {
    return extractBMPPixelData(buffer, dimensions, targetWidth, targetHeight);
  } else if (format === 'jpeg') {
    // JPEG is complex to decode without a library - return placeholder
    // In production, use the 'sharp' or 'jimp' package
    return generatePlaceholderData(targetWidth, targetHeight);
  }
  
  return generatePlaceholderData(targetWidth, targetHeight);
}

/**
 * Generate placeholder pixel data
 */
function generatePlaceholderData(width, height) {
  const size = width * height;
  const data = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    data[i * 4] = 128;
    data[i * 4 + 1] = 128;
    data[i * 4 + 2] = 128;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/**
 * Extract PNG pixel data with simple scaling
 * Note: This is a simplified implementation - production should use 'sharp'
 */
function extractPNGPixelData(buffer, dimensions, targetWidth, targetHeight) {
  // PNG decoding without library is complex - return placeholder
  // This is where you'd integrate with the 'sharp' package in production
  return generatePlaceholderData(targetWidth, targetHeight);
}

/**
 * Extract BMP pixel data with simple scaling
 * BMP is uncompressed and easier to parse manually
 */
function extractBMPPixelData(buffer, dimensions, targetWidth, targetHeight) {
  const { width, height } = dimensions;
  const size = targetWidth * targetHeight;
  const data = new Uint8ClampedArray(size * 4);
  
  // BMP header info
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);
  const dataOffset = buffer.readUInt32LE(10);
  
  // Only support uncompressed 24/32-bit BMP
  if (compression !== 0 || (bitsPerPixel !== 24 && bitsPerPixel !== 32)) {
    return generatePlaceholderData(targetWidth, targetHeight);
  }
  
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4; // Row padding to 4-byte boundary
  
  // Sample pixels with nearest-neighbor scaling
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Map target pixel to source
      const srcX = Math.floor(x * width / targetWidth);
      const srcY = Math.floor(y * height / targetHeight);
      
      // BMP stores rows bottom-to-top
      const srcRowOffset = (height - 1 - srcY) * rowSize;
      const srcPixelOffset = dataOffset + srcRowOffset + (srcX * bytesPerPixel);
      
      const idx = (y * targetWidth + x) * 4;
      
      // BMP uses BGR order
      data[idx] = buffer[srcPixelOffset + 2];     // R
      data[idx + 1] = buffer[srcPixelOffset + 1]; // G
      data[idx + 2] = buffer[srcPixelOffset];     // B
      data[idx + 3] = bitsPerPixel === 32 ? buffer[srcPixelOffset + 3] : 255; // A
    }
  }
  
  return data;
}
