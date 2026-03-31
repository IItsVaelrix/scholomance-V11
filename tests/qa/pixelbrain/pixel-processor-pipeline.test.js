/**
 * QA Test: PixelProcessor Pipeline
 * 
 * Verifies the full image processing chain:
 * BitStream (Decode) -> Substrate (Resample) -> Lattice (Trace) -> Chroma (Quantize)
 */

import { describe, it, expect } from 'vitest';
import { verseIRMicroprocessors } from '../../../codex/core/microprocessors/index.js';

describe('PixelProcessor Pipeline', () => {
  it('processes a BMP bitstream through the full factory pipeline', async () => {
    // 1. Create a minimal 2x2 BMP buffer
    // Header (14) + DIB (40) + Data (16)
    const buffer = Buffer.alloc(70);
    buffer.write('BM', 0); // Signature
    buffer.writeUInt32LE(70, 2); // File size
    buffer.writeUInt32LE(54, 10); // Offset to pixel data
    buffer.writeUInt32LE(40, 14); // DIB header size
    buffer.writeInt32LE(2, 18); // Width
    buffer.writeInt32LE(2, 22); // Height
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(24, 28); // Bits per pixel
    
    // Pixel data (BGR format, 4-byte rows)
    // Row 1: Red (#FF0000), Green (#00FF00)
    buffer.writeUInt8(0, 54); // B
    buffer.writeUInt8(0, 55); // G
    buffer.writeUInt8(255, 56); // R
    buffer.writeUInt8(0, 57); // B
    buffer.writeUInt8(255, 58); // G
    buffer.writeUInt8(0, 59); // R
    
    // Row 2: Blue (#0000FF), White (#FFFFFF)
    buffer.writeUInt8(255, 62); // B
    buffer.writeUInt8(0, 63); // G
    buffer.writeUInt8(0, 64); // R
    buffer.writeUInt8(255, 65); // B
    buffer.writeUInt8(255, 66); // G
    buffer.writeUInt8(255, 67); // R

    // Step 1: Decode
    const { pixelData, dimensions } = await verseIRMicroprocessors.execute('pixel.decode', { 
      buffer, 
      mimetype: 'image/bmp' 
    });
    
    expect(dimensions.width).toBe(2);
    expect(dimensions.height).toBe(2);
    expect(pixelData instanceof Uint8ClampedArray).toBe(true);

    // Step 2: Resample (Scale up to 4x4)
    const { pixelData: upscaled, dimensions: newDims } = verseIRMicroprocessors.execute('pixel.resample', {
      pixelData,
      dimensions,
      targetSize: { width: 4, height: 4 }
    });
    
    expect(newDims.width).toBe(4);
    expect(upscaled.length).toBe(4 * 4 * 4);

    // Step 3: Trace Lattice
    const { coordinates } = verseIRMicroprocessors.execute('pixel.trace', {
      pixelData: upscaled,
      dimensions: newDims,
      threshold: 10
    });
    
    expect(Array.isArray(coordinates)).toBe(true);
    expect(coordinates.length).toBeGreaterThan(0);

    // Step 4: Quantize Chroma (to SONIC school)
    const colors = coordinates.slice(0, 2).map(c => c.color);
    const { quantizedColors } = verseIRMicroprocessors.execute('pixel.quantize', {
      colors,
      schoolId: 'SONIC'
    });
    
    expect(quantizedColors.length).toBe(2);
    expect(quantizedColors[0].schoolAffinity).toBe('SONIC');
  });
});
