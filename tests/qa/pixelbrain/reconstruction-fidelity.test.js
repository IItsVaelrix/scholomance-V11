/**
 * PixelBrain — Reconstruction Fidelity QA Audit
 * ══════════════════════════════════════════════════════════════════════════════
 * Domain: 1:1 Visual Transmutation
 * Purpose: Validation of pixel-perfect image reconstruction into bytecode lattice.
 */

import { describe, it, expect } from 'vitest';
import { transcribeFullPixelData } from '../../../codex/core/pixelbrain/image-to-pixel-art.js';

describe('PixelBrain — Reconstruction Fidelity Audit', () => {

  it('transcribes a high-density 16x16 image perfectly (256 individual pixels)', () => {
    const width = 16;
    const height = 16;
    const pixelData = new Uint8ClampedArray(width * height * 4).fill(255); // All white opaque pixels
    
    const dimensions = { width, height };
    const canvasSize = { width: 16, height: 16, gridSize: 1 }; // 1:1

    const coordinates = transcribeFullPixelData(pixelData, dimensions, canvasSize);

    // Should have EXACTLY 256 coordinates
    expect(coordinates).toHaveLength(256);
    
    // Verify specific boundary pixel
    const cornerPx = coordinates.find(c => c.x === 15 && c.y === 15);
    expect(cornerPx).toBeDefined();
    expect(cornerPx.color).toBe('#FFFFFF');
  });

  it('scales image data correctly while maintaining individual pixel mapping', () => {
    const width = 2;
    const height = 2;
    const pixelData = new Uint8ClampedArray(width * height * 4).fill(255); // All white
    
    const dimensions = { width, height };
    const canvasSize = { width: 4, height: 4, gridSize: 1 }; // 2x scale

    const coordinates = transcribeFullPixelData(pixelData, dimensions, canvasSize);

    // Should still have 4 source pixels, but mapped to scaled coordinates
    // Source (0,0) -> Canvas (0,0)
    // Source (1,1) -> Canvas (2,2) OR similar depending on scale math
    expect(coordinates).toHaveLength(4);
    
    // Check if they are distributed
    const xCoords = coordinates.map(c => c.x);
    expect(new Set(xCoords).size).toBeGreaterThan(1);
  });

});
