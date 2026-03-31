/**
 * QA Validation: PixelBrain Core Logic
 * 
 * Tests the core generation logic for the Reference Image feature.
 * Validates:
 * - Image-to-Semantic Parameter bridge
 * - Semantic parameter merging
 * - Pixel art coordinate generation from image analysis
 */

import { describe, it, expect } from 'vitest';
import { 
  imageToPixelBrainParams, 
  mergeImageAndNLUParams,
  generatePaletteFromImage
} from '../../../codex/core/pixelbrain/image-to-semantic-bridge.js';
import {
  generatePixelArtFromImage
} from '../../../codex/core/pixelbrain/image-to-pixel-art.js';

describe('PixelBrain Core Logic QA', () => {
  const mockAnalysis = {
    dimensions: {
      original: { width: 100, height: 100, format: 'png' },
      analyzed: { width: 50, height: 50 }
    },
    colors: [
      { hex: '#FF0000', rgb: [255, 0, 0], percentage: 60 },
      { hex: '#0000FF', rgb: [0, 0, 255], percentage: 40 }
    ],
    composition: {
      brightness: 128,
      brightnessNormalized: 0.5,
      contrast: 200,
      contrastNormalized: 0.78,
      dominantAxis: 'vertical',
      edgeDensity: 0.05,
      complexity: 0.5,
      hasSymmetry: true,
      symmetryType: 'vertical'
    },
    pixelData: new Uint8ClampedArray(50 * 50 * 4).fill(0)
  };

  // Set some "edges" in pixelData
  for (let i = 0; i < 50; i++) {
    const idx = (i * 50 + 25) * 4;
    mockAnalysis.pixelData[idx] = 255;
    mockAnalysis.pixelData[idx + 3] = 255;
  }

  describe('Image-to-Semantic Bridge', () => {
    it('should convert analysis to semantic parameters', () => {
      const params = imageToPixelBrainParams(mockAnalysis);
      
      expect(params).toBeDefined();
      expect(params.surface.material).toBe('metal'); // 0.5 brightness
      expect(params.form.symmetry).toBe('vertical');
      expect(params.form.dominantAxis).toBe('vertical');
      expect(params.color.paletteSize).toBe(2);
    });

    it('should merge image and NLU parameters correctly', () => {
      const imageParams = imageToPixelBrainParams(mockAnalysis);
      const nluParams = {
        surface: { material: 'stone', roughness: 0.5, reflectivity: 0.1 },
        form: { scale: 1.0, symmetry: 'none', complexity: 0.2, dominantAxis: 'horizontal' },
        light: { angle: 90, hardness: 0.2, intensity: 0.5 },
        color: { paletteSize: 4 }
      };

      // 50/50 merge
      const merged = mergeImageAndNLUParams(imageParams, nluParams, 0.5);
      
      expect(merged.form.complexity).toBe((imageParams.form.complexity + nluParams.form.complexity) / 2);
      expect(merged.form.symmetry).toBe('vertical'); // weight 0.5 prefers image for symmetry
    });

    it('should generate palette from image colors', () => {
      const palette = generatePaletteFromImage(mockAnalysis.colors);
      
      expect(palette).toBeDefined();
      expect(palette.colors).toContain('#FF0000');
      expect(palette.weights).toContain(0.6);
      expect(palette.source).toBe('image');
    });
  });

  describe('Pixel Art Generation', () => {
    it('should generate coordinates and formula from analysis', () => {
      const canvasSize = { width: 160, height: 144, gridSize: 1 };
      const result = generatePixelArtFromImage(mockAnalysis, canvasSize);
      
      expect(result).toBeDefined();
      expect(result.coordinates.length).toBeGreaterThan(0);
      expect(result.formula).toBeDefined();
      expect(result.palettes.length).toBeGreaterThan(0);
      expect(result.bytecode).toMatch(/^0xF/);
    });

    it('should scale coordinates to fit canvas', () => {
      const canvasSize = { width: 160, height: 144, gridSize: 1 };
      const result = generatePixelArtFromImage(mockAnalysis, canvasSize);
      
      for (const coord of result.coordinates) {
        expect(coord.x).toBeGreaterThanOrEqual(0);
        expect(coord.x).toBeLessThan(canvasSize.width);
        expect(coord.y).toBeGreaterThanOrEqual(0);
        expect(coord.y).toBeLessThan(canvasSize.height);
      }
    });

    it('should apply extensions to coordinates', () => {
      const canvasSize = { width: 160, height: 144, gridSize: 1 };
      const result = generatePixelArtFromImage(mockAnalysis, canvasSize, 'style-8bit');
      
      // style-8bit quantizes emphasis to 4 levels
      for (const coord of result.coordinates) {
        const multiplied = coord.emphasis * 4;
        expect(Math.abs(multiplied - Math.round(multiplied))).toBeLessThan(0.001);
      }
    });
  });
});
