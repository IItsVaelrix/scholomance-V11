/**
 * @vitest-environment jsdom
 */

/**
 * QA TEST SUITE: PixelBrain Stress & Chaos
 * 
 * Theoretical problems, mathematical singularities, and extreme edge cases.
 * Testing the limits of the Microprocessor Factory and Unified Bridge.
 */

import { describe, it, expect, vi } from 'vitest';
import { verseIRMicroprocessors } from '../../../codex/core/microprocessors/index.js';
import { processorBridge } from '../../../src/lib/processor-bridge.js';

// Correctly Mock Worker class
class MockWorker {
  constructor() {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    this.onmessage = null;
    this.onerror = null;
  }
}
if (typeof window !== 'undefined') {
  window.Worker = MockWorker;
}

describe('PixelBrain — Stress & Chaos Suite', () => {

  // ===========================================================================
  // 1. BITSTREAM & MEMORY TORTURE
  // ===========================================================================
  describe('BitStream Corruption', () => {
    it('handles "The Dimension Bomb" (Header lies about size)', async () => {
      const buffer = Buffer.alloc(100);
      buffer.write('BM', 0);
      // Header claims image is 10,000 x 10,000, but safety limit is 4096
      buffer.writeInt32LE(10000, 18); 
      buffer.writeInt32LE(10000, 22);
      
      await expect(verseIRMicroprocessors.execute('pixel.decode', { 
        buffer, 
        mimetype: 'image/bmp' 
      })).rejects.toThrow(/safety limits/);
    });

    it('handles PNG stub gracefully', async () => {
      const buffer = Buffer.alloc(30);
      buffer.write('\x89PNG\r\n\x1a\n', 0); // PNG Signature
      buffer.write('IHDR', 12);
      buffer.writeUInt32BE(100, 16);
      buffer.writeUInt32BE(100, 20);

      await expect(verseIRMicroprocessors.execute('pixel.decode', { 
        buffer, 
        mimetype: 'image/png' 
      })).rejects.toThrow(/PNG_DECODE_NOT_IMPLEMENTED/);
    });

    it('handles "The Invisible Image" (100% Transparency)', async () => {
      const pixelData = new Uint8ClampedArray(16 * 16 * 4).fill(0); 
      const dimensions = { width: 16, height: 16 };
      
      const { coordinates } = await verseIRMicroprocessors.execute('pixel.trace', {
        pixelData,
        dimensions
      });
      
      expect(Array.isArray(coordinates)).toBe(true);
      expect(coordinates.length).toBe(0);
    });
  });

  // ===========================================================================
  // 2. MATHEMATICAL SINGULARITIES
  // ===========================================================================
  describe('Arithmetic Singularities', () => {
    it('handles "The Flatline" (Resampling to 0x0)', async () => {
      const pixelData = new Uint8ClampedArray(10 * 10 * 4).fill(255);
      const dimensions = { width: 10, height: 10 };
      
      const result = await verseIRMicroprocessors.execute('pixel.resample', {
        pixelData,
        dimensions,
        targetSize: { width: 0, height: 0 }
      });
      
      // Safety fix: Resampled to at least 1x1
      expect(result.dimensions.width).toBe(1);
      expect(result.dimensions.height).toBe(1);
    });

    it('handles "The Ghost Grid" (NaN coordinates in tracer)', async () => {
      const pixelData = new Uint8ClampedArray(4 * 4 * 4).fill(255);
      const dimensions = { width: NaN, height: Infinity };
      
      await expect(verseIRMicroprocessors.execute('pixel.trace', {
        pixelData,
        dimensions
      })).rejects.toThrow(/INVALID_TRACER_DIMENSIONS/);
    });
  });

  // ===========================================================================
  // 3. LINGUISTIC ENTROPY (NLU)
  // ===========================================================================
  describe('Linguistic Entropy', () => {
    it('handles "The Infinite Prompt" (Massive token volume)', async () => {
      const massivePrompt = "dragon ".repeat(500); 
      
      const { intent, confidence } = await verseIRMicroprocessors.execute('nlu.classifyIntent', { 
        tokens: massivePrompt.trim().split(' ') 
      });
      
      expect(intent).toBeDefined();
      expect(typeof confidence).toBe('number');
    });

    it('handles "The Base64 Cipher" (Non-human input)', async () => {
      const gibberish = "SGVsbG8gV29ybGQgaW4gQmFzZTY0IGZvcm0gdGVzdGluZyBwaXhlbGJyYWlu";
      
      const entities = await verseIRMicroprocessors.execute('nlu.extractEntities', { 
        tokens: [gibberish],
        fullText: gibberish 
      });
      
      expect(Object.values(entities).every(arr => arr.length === 0)).toBe(true);
    });
  });

  // ===========================================================================
  // 4. PIPELINE & WORKER STRESS
  // ===========================================================================
  describe('Orchestration Stress', () => {
    it('handles "The Recursive Loop" (Theoretical pipeline loop)', async () => {
      const sequence = ['pixel.resample', 'pixel.resample'];
      const payload = {
        pixelData: new Uint8ClampedArray(4 * 4 * 4),
        dimensions: { width: 4, height: 4 },
        targetSize: { width: 1, height: 1 }
      };
      
      const result = await verseIRMicroprocessors.executePipeline(sequence, payload);
      expect(result.dimensions.width).toBe(1);
    });

    it('handles bridge local execution fallback', async () => {
      // In Node environment, bridge fallback
      const result = await processorBridge.execute('nlu.classifyIntent', { tokens: ['test'] });
      expect(result.intent).toBeDefined();
    });
  });
});
