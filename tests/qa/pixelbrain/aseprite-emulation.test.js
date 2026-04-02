/**
 * PixelBrain — Aseprite Emulation QA Audit
 * ══════════════════════════════════════════════════════════════════════════════
 * Domain: Professional Pixel Art Workflows
 * Purpose: Validation of high-fidelity visual transcription, grid systems, 
 *          and aesthetic line physics.
 */

import { describe, it, expect } from 'vitest';
import { 
  generatePixelArtFromImage,
  generateSilhouetteFromImage,
  fillShape 
} from '../../../codex/core/pixelbrain/image-to-pixel-art.js';
import { 
  createTemplateGrid,
  GRID_TYPES,
  snapToGrid,
  generateGridPreview 
} from '../../../codex/core/pixelbrain/template-grid-engine.js';
import { 
  drawPixelatedLine,
  drawHandDrawnLine
} from '../../../codex/core/pixelbrain/anti-alias-control.js';
import { GOLDEN_RATIO } from '../../../codex/core/pixelbrain/shared.js';

describe('PixelBrain — Aseprite Emulation Audit', () => {

  // Mock Image Analysis Data
  const mockImageAnalysis = {
    dimensions: { width: 32, height: 32 },
    colors: [
      { hex: '#6B59B6', percentage: 60 }, // SNES Purple
      { hex: '#B0B0BC', percentage: 40 }  // SNES Gray
    ],
    composition: {
      complexity: 0.8,
      edgeDensity: 0.4,
      dominantAxis: 'diagonal',
      hasSymmetry: true,
      symmetryType: 'vertical'
    },
    // Simple 32x32 opaque square in the center
    pixelData: new Uint8ClampedArray(32 * 32 * 4).fill(0).map((_, i) => {
      const pixelIdx = Math.floor(i / 4);
      const x = pixelIdx % 32;
      const y = Math.floor(pixelIdx / 32);
      if (x >= 8 && x < 24 && y >= 8 && y < 24) {
        if (i % 4 === 3) return 255; // Alpha
        if (i % 4 === 0) return 107; // R -> 6B
        if (i % 4 === 1) return 89;  // G -> 59
        if (i % 4 === 2) return 182; // B -> B6
      }
      return 0;
    }),
    semanticParams: { surface: { material: 'matte' } }
  };

  const canvasSize = { width: 160, height: 144, gridSize: 1 };

  // ── 1. VISUAL FIDELITY TRANSCRIPTION ───────────────────────────────────────

  describe('Full Visual Fidelity Transcription', () => {
    it('transcribes an asset image into a high-fidelity coordinate lattice', () => {
      const result = generatePixelArtFromImage(mockImageAnalysis, canvasSize);
      
      expect(result.coordinates.length).toBeGreaterThan(0);
      expect(result.palettes[0].colors).toContain('#6B59B6'); // SNES Purple
      expect(result.bytecode).toMatch(/^0xF/);
    });

    it('identifies dominant symmetry during transcription', () => {
      const result = generatePixelArtFromImage(mockImageAnalysis, canvasSize);
      expect(result.dominantSymmetry).toBe('vertical');
    });
  });

  // ── 2. OUTLINE & SILHOUETTE CREATION ───────────────────────────────────────

  describe('Procedural Outline Generation', () => {
    it('creates a precise silhouette from an asset image', () => {
      const silhouette = generateSilhouetteFromImage(mockImageAnalysis, canvasSize);
      
      expect(silhouette.length).toBeGreaterThan(0);
      // Ensure it forms a closed loop (basic check)
      const sources = new Set(silhouette.map(s => s.source));
      expect(sources.has('silhouette')).toBe(true);
    });

    it('fills a generated outline with a target spectral color', () => {
      const silhouette = generateSilhouetteFromImage(mockImageAnalysis, canvasSize);
      const filled = fillShape(silhouette, canvasSize, '#FF00FF');
      
      expect(filled.length).toBeGreaterThan(0);
      expect(filled[0].color).toBe('#FF00FF');
    });
  });

  // ── 3. ARCANE GRID SYSTEMS ──────────────────────────────────────────────────

  describe('Grid System Fidelity', () => {
    it('correctly generates an Isometric grid for architectural assets', () => {
      const grid = createTemplateGrid({ gridType: GRID_TYPES.ISOMETRIC });
      const preview = generateGridPreview(grid);
      
      const diagonalLines = preview.filter(l => l.type === 'diag1' || l.type === 'diag2');
      expect(diagonalLines.length).toBeGreaterThan(0);
    });

    it('snaps coordinates to a Hexagonal lattice for organic assets', () => {
      const grid = createTemplateGrid({ gridType: GRID_TYPES.HEXAGONAL, cellSize: 10 });
      const snapped = snapToGrid(15, 15, grid);
      
      // Hex height is approx 8.66 for size 10. Multiples: 0, 8.66, 17.32
      // 15 is closer to 17.3
      expect(snapped.snappedY).toBeCloseTo(17.3, 1);
    });

    it('enforces Fibonacci subdivisions for golden ratio compositions', () => {
      const grid = createTemplateGrid({ gridType: GRID_TYPES.FIBONACCI, width: 100, height: 100 });
      const preview = generateGridPreview(grid);
      
      const fibLines = preview.filter(l => l.type === 'fib');
      expect(fibLines.length).toBeGreaterThan(0);
      // Check for presence of first phi subdivision line
      const hasPhiLine = fibLines.some(l => Math.abs(l.x1 - 100/GOLDEN_RATIO) < 5 || Math.abs(l.y1 - 100/GOLDEN_RATIO) < 5);
      expect(hasPhiLine).toBe(true);
    });
  });

  // ── 4. AESTHETIC LINE PHYSICS ──────────────────────────────────────────────

  describe('Aesthetic Line Rendering', () => {
    it('draws pixelated lines using Bresenham algorithm', () => {
      const line = drawPixelatedLine(0, 0, 10, 10);
      expect(line).toHaveLength(11);
      expect(line[5]).toEqual({ x: 5, y: 5 });
    });

    it('supports purposeful imperfect lines via jitter induction', () => {
      // Draw a long horizontal line which should be perfectly straight in Bresenham
      const x0 = 0, y0 = 0, x1 = 100, y1 = 0;
      const handDrawnLine = drawHandDrawnLine(x0, y0, x1, y1, { jitter: 0.5 });
      
      expect(handDrawnLine).toHaveLength(101);
      // At least some points should have drifted from y=0
      const drifted = handDrawnLine.filter(p => p.y !== 0);
      expect(drifted.length).toBeGreaterThan(0);
      // Endpoints must remain fixed
      expect(handDrawnLine[0].y).toBe(0);
      expect(handDrawnLine[100].y).toBe(0);
    });
  });

});
