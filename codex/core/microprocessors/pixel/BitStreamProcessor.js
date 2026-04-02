/**
 * PIXEL MICROPROCESSOR: BitStream Processor
 *
 * Specialized image decoder for PNG, JPEG, and BMP formats.
 * Converts raw buffers into standardized Uint8ClampedArray substrates.
 */

// Node.js zlib for PNG DEFLATE decompression
import zlib from 'zlib';

/**
 * Decode image buffer to pixel data
 * @param {Object} payload - { buffer, mimetype }
 * @returns {Object} { pixelData, dimensions }
 */
export async function decodeBitStream({ buffer, mimetype }) {
  // Comprehensive buffer validation
  if (!buffer) {
    throw new Error('EMPTY_BUFFER: No buffer provided to decodeBitStream');
  }
  
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new Error(`INVALID_BUFFER_TYPE: Expected Buffer or Uint8Array, got ${typeof buffer}`);
  }
  
  if (buffer.length === 0) {
    throw new Error('EMPTY_BUFFER: Buffer has zero length');
  }

  // BMP is simple enough to decode directly
  if (mimetype === 'image/bmp' || (buffer[0] === 0x42 && buffer[1] === 0x4D)) {
    return decodeBMP(buffer);
  }

  // PNG requires zlib for DEFLATE (available in Node)
  if (mimetype === 'image/png' || (buffer[0] === 0x89 && buffer[1] === 0x50)) {
    return decodePNG(buffer);
  }

  // For others (JPEG), we'll need a lightweight helper or fallback
  throw new Error(`UNSUPPORTED_FORMAT: ${mimetype}`);
}

/**
 * Direct BMP decoder (Uncompressed)
 */
function decodeBMP(buffer) {
  if (buffer.length < 54) {
    throw new Error('CORRUPT_BMP_HEADER: Buffer too short');
  }

  const width = buffer.readInt32LE(18);
  const height = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const pixelDataOffset = buffer.readUInt32LE(10);
  
  // Safety: Prevent dimension bombs
  if (width <= 0 || width > 4096 || Math.abs(height) <= 0 || Math.abs(height) > 4096) {
    throw new Error(`INVALID_DIMENSIONS: ${width}x${height} exceeds safety limits`);
  }

  const absHeight = Math.abs(height);
  
  // Safety: Verify buffer length against claimed dimensions
  const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  const expectedSize = pixelDataOffset + (rowSize * absHeight);
  
  if (buffer.length < expectedSize) {
    throw new Error(`CORRUPT_BMP_DATA: Buffer length ${buffer.length} < expected ${expectedSize}`);
  }

  const data = new Uint8ClampedArray(width * absHeight * 4);
  
  for (let y = 0; y < absHeight; y++) {
    const srcY = height > 0 ? (absHeight - 1 - y) : y;
    for (let x = 0; x < width; x++) {
      const srcOffset = pixelDataOffset + (srcY * rowSize) + (x * (bitsPerPixel / 8));
      const dstOffset = (y * width + x) * 4;
      
      data[dstOffset] = buffer[srcOffset + 2];     // R
      data[dstOffset + 1] = buffer[srcOffset + 1]; // G
      data[dstOffset + 2] = buffer[srcOffset];     // B
      data[dstOffset + 3] = bitsPerPixel === 32 ? buffer[srcOffset + 3] : 255;
    }
  }
  
  return { pixelData: data, dimensions: { width, height: absHeight } };
}

/**
 * PNG decoder using Node zlib
 * PNG structure: Signature (8) + IHDR (13+4) + [IDAT chunks] + IEND
 */
async function decodePNG(buffer) {
  console.log('[PNG Decoder] Starting PNG decode, buffer length:', buffer.length);

  // Validate PNG signature
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== signature[i]) {
      throw new Error('INVALID_PNG_SIGNATURE');
    }
  }
  console.log('[PNG Decoder] Signature valid');

  // Parse IHDR chunk
  const ihdrLength = buffer.readUInt32BE(8);
  if (ihdrLength !== 13) {
    throw new Error('INVALID_IHDR_CHUNK_LENGTH');
  }
  
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const _compressionMethod = buffer[26];
  const _filterMethod = buffer[27];
  const _interlaceMethod = buffer[28];

  console.log('[PNG Decoder] IHDR parsed:', { width, height, bitDepth, colorType });

  // Safety checks
  if (width <= 0 || width > 4096 || height <= 0 || height > 4096) {
    throw new Error(`INVALID_DIMENSIONS: ${width}x${height} exceeds safety limits`);
  }

  // Calculate bytes per pixel based on color type and bit depth
  const channels = getChannelsForColorType(colorType);
  const bytesPerPixel = (channels * bitDepth) / 8;
  const scanlineLength = Math.ceil(width * bytesPerPixel);

  console.log('[PNG Decoder] Channels:', channels, 'bytesPerPixel:', bytesPerPixel, 'scanlineLength:', scanlineLength);

  // Collect and decompress IDAT chunks
  const idatChunks = [];
  let offset = 8 + 4 + ihdrLength; // Skip signature + IHDR length + IHDR data

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');

    if (chunkType === 'IDAT') {
      idatChunks.push(buffer.slice(offset + 8, offset + 8 + chunkLength));
      console.log('[PNG Decoder] Found IDAT chunk, length:', chunkLength);
    } else if (chunkType === 'IEND') {
      console.log('[PNG Decoder] Found IEND chunk');
      break;
    }

    offset += 12 + chunkLength; // 4 (length) + 4 (type) + length + 4 (crc)
  }

  if (idatChunks.length === 0) {
    throw new Error('NO_IDAT_CHUNKS_FOUND');
  }

  console.log('[PNG Decoder] Collected', idatChunks.length, 'IDAT chunks, decompressing...');

  // Decompress using zlib
  const compressedData = Buffer.concat(idatChunks);
  let decompressedData;
  
  try {
    decompressedData = zlib.inflateSync(compressedData);
    console.log('[PNG Decoder] Decompressed to', decompressedData.length, 'bytes');
  } catch (err) {
    console.error('[PNG Decoder] Decompression failed:', err);
    throw new Error(`PNG_DEFLATE_DECOMPRESSION_FAILED: ${err.message}`);
  }

  // Create output buffer
  const data = new Uint8ClampedArray(width * height * 4);

  // Decode scanlines with filter reconstruction
  const bytesPerScanline = scanlineLength + 1; // +1 for filter byte
  let priorScanline = null;
  
  console.log('[PNG Decoder] Processing', height, 'scanlines...');

  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * bytesPerScanline;
    const filterType = decompressedData[scanlineOffset];
    const scanlineData = decompressedData.slice(scanlineOffset + 1, scanlineOffset + 1 + scanlineLength);
    
    // Apply filter reconstruction
    const reconstructedScanline = reconstructScanline(
      scanlineData,
      filterType,
      y,
      width,
      channels,
      bitDepth,
      priorScanline
    );
    
    // Store this scanline for use in reconstructing the next one
    priorScanline = reconstructedScanline;

    // Convert to RGBA
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      const srcIdx = x * channels;

      if (colorType === 0) { // Grayscale
        const val = reconstructedScanline[srcIdx];
        data[dstIdx] = val;
        data[dstIdx + 1] = val;
        data[dstIdx + 2] = val;
        data[dstIdx + 3] = 255;
      } else if (colorType === 2) { // RGB
        data[dstIdx] = reconstructedScanline[srcIdx];
        data[dstIdx + 1] = reconstructedScanline[srcIdx + 1];
        data[dstIdx + 2] = reconstructedScanline[srcIdx + 2];
        data[dstIdx + 3] = 255;
      } else if (colorType === 3) { // Indexed (palette) - simplified, treat as grayscale
        const val = reconstructedScanline[srcIdx];
        data[dstIdx] = val;
        data[dstIdx + 1] = val;
        data[dstIdx + 2] = val;
        data[dstIdx + 3] = 255;
      } else if (colorType === 4) { // Grayscale + Alpha
        data[dstIdx] = reconstructedScanline[srcIdx];
        data[dstIdx + 1] = reconstructedScanline[srcIdx];
        data[dstIdx + 2] = reconstructedScanline[srcIdx];
        data[dstIdx + 3] = reconstructedScanline[srcIdx + 1];
      } else if (colorType === 6) { // RGBA
        data[dstIdx] = reconstructedScanline[srcIdx];
        data[dstIdx + 1] = reconstructedScanline[srcIdx + 1];
        data[dstIdx + 2] = reconstructedScanline[srcIdx + 2];
        data[dstIdx + 3] = reconstructedScanline[srcIdx + 3];
      }
    }
  }

  console.log('[PNG Decoder] Decode complete');

  return { pixelData: data, dimensions: { width, height } };
}

/**
 * Get number of channels for PNG color type
 */
function getChannelsForColorType(colorType) {
  switch (colorType) {
    case 0: return 1; // Grayscale
    case 2: return 3; // RGB
    case 3: return 1; // Indexed (palette)
    case 4: return 2; // Grayscale + Alpha
    case 6: return 4; // RGBA
    default: throw new Error(`UNSUPPORTED_PNG_COLOR_TYPE: ${colorType}`);
  }
}

/**
 * Reconstruct scanline based on PNG filter type
 * Filter types: 0=None, 1=Sub, 2=Up, 3=Average, 4=Paeth
 */
function reconstructScanline(scanlineData, filterType, row, width, channels, bitDepth, priorScanline) {
  const result = new Uint8Array(scanlineData.length);
  const bytesPerPixel = channels;

  for (let i = 0; i < scanlineData.length; i++) {
    let raw = scanlineData[i];
    let prior = priorScanline ? priorScanline[i] : 0;
    let left = 0;
    let priorLeft = priorScanline && i >= bytesPerPixel ? priorScanline[i - bytesPerPixel] : 0;

    // Get left pixel value (Sub filter)
    if (i >= bytesPerPixel) {
      left = result[i - bytesPerPixel];
    }

    // Apply filter reconstruction
    switch (filterType) {
      case 0: // None
        result[i] = raw;
        break;
      case 1: // Sub
        result[i] = (raw + left) & 0xFF;
        break;
      case 2: // Up
        result[i] = (raw + prior) & 0xFF;
        break;
      case 3: // Average
        result[i] = (raw + Math.floor((left + prior) / 2)) & 0xFF;
        break;
      case 4: // Paeth
        result[i] = (raw + paethPredictor(left, prior, priorLeft)) & 0xFF;
        break;
      default:
        throw new Error(`INVALID_PNG_FILTER_TYPE: ${filterType}`);
    }
  }

  return result;
}

/**
 * Paeth predictor function for PNG filter type 4
 */
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
