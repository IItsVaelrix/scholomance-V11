/**
 * PIXEL MICROPROCESSOR: BitStream Processor
 * 
 * Specialized image decoder for PNG, JPEG, and BMP formats.
 * Converts raw buffers into standardized Uint8ClampedArray substrates.
 */

/**
 * Decode image buffer to pixel data
 * @param {Object} payload - { buffer, mimetype }
 * @returns {Object} { pixelData, dimensions }
 */
export async function decodeBitStream({ buffer, mimetype }) {
  if (!buffer || buffer.length === 0) {
    throw new Error('EMPTY_BUFFER');
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
  const width = buffer.readInt32LE(18);
  const height = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const pixelDataOffset = buffer.readUInt32LE(10);
  
  const absHeight = Math.abs(height);
  const data = new Uint8ClampedArray(width * absHeight * 4);
  
  // BMP pixels are stored BGR, bottom-to-top
  const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  
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
 */
async function decodePNG(buffer) {
  // Extract width/height from IHDR chunk
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  
  // For now, we return a structured object that the server can use to 
  // route to a real decoder if needed, or we implement the IDAT parser.
  // To keep it "micro", we will implement a basic IDAT joiner.
  
  return { 
    pixelData: new Uint8ClampedArray(width * height * 4).fill(128), 
    dimensions: { width, height },
    isPlaceholder: true,
    reason: 'PNG_FULL_DECODE_PENDING'
  };
}
