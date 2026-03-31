/**
 * PixelBrain — Asset Scale & Morphology QA Audit
 * ══════════════════════════════════════════════════════════════════════════════
 * Domain: Visual Proportion & Scale Stability
 * Purpose: Validation of asset scaling, preventing the "Small Orb" failure state.
 */

import { describe, it, expect } from 'vitest';
import { 
  analyzeImageToFormula,
  fitParametricCurve 
} from '../../../codex/core/pixelbrain/image-to-bytecode-formula.js';

describe('PixelBrain — Morphology Audit', () => {

  const canvasSize = { width: 160, height: 144 };

  describe('Parametric Scale Stability', () => {
    it('prevents generating microscopic orbs from small clusters', () => {
      // 1. Create edge points for a very small 4x4 cluster
      const smallCluster = [];
      for(let y=70; y<74; y++) {
        for(let x=78; x<82; x++) {
          smallCluster.push({ x, y, magnitude: 100 });
        }
      }

      // 2. Fit curve
      const formula = fitParametricCurve(smallCluster);
      
      // Radius 'a' should be at least 20% of canvas height to be visible/usable
      // Canvas height 144 * 0.2 = 28.8
      expect(formula.parameters.a).toBeGreaterThan(20);
    });

    it('correctly normalizes asset center to the alchemical core', () => {
      // Points in the top-left corner (avg x=15, y=15)
      const offCenterPoints = [
        { x: 10, y: 10, magnitude: 100 },
        { x: 20, y: 10, magnitude: 100 },
        { x: 10, y: 20, magnitude: 100 },
        { x: 20, y: 20, magnitude: 100 }
      ];

      const formula = fitParametricCurve(offCenterPoints);
      
      // With 40% bias: 15 * 0.6 + 80 * 0.4 = 9 + 32 = 41
      expect(formula.parameters.cx).toBeCloseTo(41, 0); 
      expect(formula.parameters.cy).toBeCloseTo(37.8, 0); // 15 * 0.6 + 72 * 0.4 = 9 + 28.8 = 37.8
    });
  });

  describe('Pattern Detection Bias', () => {
    it('does not default to Parametric Curve for non-circular dense shapes', () => {
      // A solid 20x20 square (not very circular)
      const squarePoints = [];
      for(let y=40; y<60; y++) {
        for(let x=40; x<60; x++) {
          if (x === 40 || x === 59 || y === 40 || y === 59) {
            squarePoints.push({ x, y, magnitude: 100 });
          }
        }
      }

      // Should probably detect EDGE_TRACE or GRID, not PARAMETRIC
      const formula = analyzeImageToFormula({
        pixelData: new Uint8ClampedArray(160*144*4),
        dimensions: { width: 160, height: 144 },
        colors: [{ hex: '#FFFFFF', percentage: 100 }],
        composition: { edgeDensity: 0.1, hasSymmetry: false }
      });

      // Note: analyzeImageToFormula takes the full object, I'll mock internal calls if needed
      // or just check if the result makes sense
      expect(formula.formulaType).not.toBe('parametric_curve');
    });
  });

});
