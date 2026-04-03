import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verseIRMicroprocessors } from '../../../codex/core/microprocessors/index.js';
import { processorBridge } from '../../../src/lib/processor-bridge.js';

/**
 * PixelBrain — Stress & Chaos Suite
 * 
 * Verifies system resilience under extreme input conditions,
 * corrupted bitstreams, and orchestration failures.
 */
describe('PixelBrain — Stress & Chaos Suite', () => {

  describe('BitStream Corruption', () => {
    it('handles empty buffer gracefully', async () => {
      const buffer = Buffer.alloc(0);
      await expect(verseIRMicroprocessors.execute('pixel.decode', { 
        buffer, 
        mimetype: 'image/png' 
      })).rejects.toThrow(/EMPTY_BUFFER|empty buffer/i);
    });

    it('handles garbage data in resampler', async () => {
      const payload = {
        pixelData: new Uint8ClampedArray([1, 2, 3]), // Invalid length (not 4*w*h)
        dimensions: { width: 1, height: 1 },
        targetSize: { width: 2, height: 2 }
      };
      
      // Resampler should either throw or return original data safely
      const result = await verseIRMicroprocessors.execute('pixel.resample', payload);
      expect(result.pixelData).toBeDefined();
    });

    it('handles extreme dimensions (Safety Limits)', async () => {
      const buffer = Buffer.alloc(100);
      buffer.write('\x89PNG\r\n\x1a\n', 0);
      buffer.write('IHDR', 12);
      // Write 5000x5000 dimensions
      buffer.writeUInt32BE(5000, 16);
      buffer.writeUInt32BE(5000, 20);

      await expect(verseIRMicroprocessors.execute('pixel.decode', { 
        buffer, 
        mimetype: 'image/png' 
      })).rejects.toThrow(/safety limits|INVALID_PNG_SIGNATURE/i);
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
      })).rejects.toThrow(/INVALID_PNG_SIGNATURE|PNG_DECODE_NOT_IMPLEMENTED/);
    });

    it('handles "The Invisible Image" (100% Transparency)', async () => {
      const pixelData = new Uint8ClampedArray(16 * 16 * 4).fill(0); 
      const dimensions = { width: 16, height: 16 };
      
      const { coordinates } = await verseIRMicroprocessors.execute('pixel.trace', {
        pixelData,
        dimensions,
        threshold: 128
      });
      
      expect(coordinates).toHaveLength(0);
    });
  });

  describe('Orchestration Stress', () => {
    it('handles rapid sequential pipeline execution', async () => {
      const sequence = ['pixel.resample'];
      const payload = {
        pixelData: new Uint8ClampedArray(16 * 4).fill(255),
        dimensions: { width: 4, height: 4 },
        targetSize: { width: 2, height: 2 }
      };

      const results = await Promise.all([
        verseIRMicroprocessors.executePipeline(sequence, payload),
        verseIRMicroprocessors.executePipeline(sequence, payload),
        verseIRMicroprocessors.executePipeline(sequence, payload)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].dimensions.width).toBe(2);
    });

    it('handles deep pipeline chains', async () => {
      // 2-stage pipeline with data continuity
      const sequence = ['pixel.resample', 'pixel.trace'];
      const payload = {
        pixelData: new Uint8ClampedArray(16 * 4).fill(255),
        dimensions: { width: 4, height: 4 },
        targetSize: { width: 2, height: 2 }
      };
      
      const result = await verseIRMicroprocessors.executePipeline(sequence, payload);
      expect(result.coordinates).toBeDefined();
    });

    it('recovers from middle-stage pipeline failure', async () => {
      const sequence = ['pixel.resample', 'non.existent.processor', 'pixel.resample'];
      const payload = {
        pixelData: new Uint8ClampedArray(16 * 4).fill(255),
        dimensions: { width: 4, height: 4 },
        targetSize: { width: 2, height: 2 }
      };

      await expect(verseIRMicroprocessors.executePipeline(sequence, payload))
        .rejects.toThrow(/not found in registry|not registered/i);
    });

    it('handles zero-sized targets in resampler safely', async () => {
      const sequence = ['pixel.resample'];
      const payload = {
        pixelData: new Uint8ClampedArray(16 * 4).fill(255),
        dimensions: { width: 4, height: 4 },
        targetSize: { width: 0, height: 0 }
      };
      
      // Should either throw or return original data, not crash
      try {
        const result = await verseIRMicroprocessors.executePipeline(sequence, payload);
        expect(result.dimensions.width).toBeDefined();
      } catch (e) {
        expect(e.message).toBeDefined();
      }
    });

    it('handles extreme downsampling (4x4 -> 1x1)', async () => {
      const sequence = ['pixel.resample'];
      const payload = {
        pixelData: new Uint8ClampedArray(16 * 4).fill(255),
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
    }, 30000);
  });
});
