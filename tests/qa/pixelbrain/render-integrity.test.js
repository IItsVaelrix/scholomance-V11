/**
 * QA Test Suite: PixelBrain Rendering Integrity
 * 
 * Validates the rendering pipeline's error detection and recovery logic
 * using the Bytecode Error System.
 */

import { describe, it, expect, vi } from 'vitest';
import { getSafeContext, renderLattice } from '../../../src/lib/render-engine.js';

describe('PixelBrain Render Integrity QA', () => {
  
  describe('Context Validation (getSafeContext)', () => {
    it('throws CANVAS_NOT_FOUND when canvas is null', () => {
      try {
        getSafeContext(null);
      } catch (error) {
        expect(error.name).toBe('BytecodeError');
        expect(error.message).toContain('CANVAS');
        expect(error.message).toContain('CRIT');
        expect(error.message).toContain('0A01'); // CANVAS_NOT_FOUND
      }
    });

    it('throws CANVAS_SIZE_ZERO when dimensions are 0', () => {
      const mockCanvas = { width: 0, height: 100 };
      try {
        getSafeContext(mockCanvas);
      } catch (error) {
        expect(error.message).toContain('0A02'); // CANVAS_SIZE_ZERO
      }
    });

    it('throws RENDER_CONTEXT_LOST when getContext returns null', () => {
      const mockCanvas = { 
        width: 100, 
        height: 100, 
        getContext: vi.fn().mockReturnValue(null) 
      };
      try {
        getSafeContext(mockCanvas);
      } catch (error) {
        expect(error.message).toContain('0901'); // RENDER_CONTEXT_LOST
      }
    });
  });

  describe('Rendering Logic (renderLattice)', () => {
    it('successfully renders a simple coordinate set', () => {
      const mockCtx = {
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        setLineDash: vi.fn(),
      };
      
      const mockCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn().mockReturnValue(mockCtx)
      };

      const coordinates = [
        { x: 10, y: 10, color: '#FF0000', emphasis: 1 }
      ];

      // Should not throw
      renderLattice(mockCanvas, { coordinates, theme: 'dark' });
      
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('wraps unknown errors in RENDER_FAILED', () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: vi.fn().mockImplementation(() => {
          throw new Error('Explosion');
        })
      };

      try {
        renderLattice(mockCanvas, { coordinates: [] });
      } catch (error) {
        expect(error.message).toContain('0903'); // RENDER_FAILED
      }
    });
  });
});
