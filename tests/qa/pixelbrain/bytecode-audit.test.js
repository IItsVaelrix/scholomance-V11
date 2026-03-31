/**
 * PixelBrain — Bytecode & Formula Logic Audit
 * ══════════════════════════════════════════════════════════════════════════════
 * Domain: Mathematical Visual DNA & Deterministic Graphics
 * Purpose: Comprehensive validation of the visual bytecode pipeline.
 */

import { describe, it, expect } from 'vitest';
import { 
  formulaToBytecode, 
  parseBytecodeToFormula,
  FORMULA_TYPES,
  COLOR_FORMULA_TYPES
} from '../../../codex/core/pixelbrain/image-to-bytecode-formula.js';
import { 
  evaluateFormula,
  evaluateFibonacciGrid 
} from '../../../codex/core/pixelbrain/formula-to-coordinates.js';
import { 
  createTemplateGrid,
  GRID_TYPES 
} from '../../../codex/core/pixelbrain/template-grid-engine.js';
import { 
  BytecodeError,
  decodeBytecodeError 
} from '../../../codex/core/pixelbrain/bytecode-error.js';
import { GOLDEN_RATIO } from '../../../codex/core/pixelbrain/shared.js';

describe('PixelBrain — Bytecode Audit', () => {

  // ── 1. FORMULA INTEGRITY AUDIT ───────────────────────────────────────────────
  
  describe('Formula Round-Trip Integrity', () => {
    it('successfully encodes a complex formula into a 0xF bytecode string', () => {
      const formula = {
        formulaType: FORMULA_TYPES.PARAMETRIC_CURVE,
        coordinateFormula: { type: FORMULA_TYPES.PARAMETRIC_CURVE, parameters: { a: 32 } },
        colorFormula: { type: COLOR_FORMULA_TYPES.PALETTE_INDEXED, paletteSize: 8, ditherPattern: 'bayer4x4' },
        idleAnimation: { baseSpeed: 0.4 },
        template: { gridWidth: 32, gridHeight: 32 }
      };

      const bytecode = formulaToBytecode(formula);
      expect(bytecode).toMatch(/^0xFP_32x32_8c_d1_gg4/);
    });

    it('faithfully reconstructs a formula object from a bytecode prompt', () => {
      const bytecode = '0xFG_16x16_4c_d0_gg2';
      const formula = parseBytecodeToFormula(bytecode);

      expect(formula.formulaType).toBe(FORMULA_TYPES.GRID_PROJECTION);
      expect(formula.colorFormula.paletteSize).toBe(4);
      expect(formula.template.gridWidth).toBe(16);
    });
  });

  // ── 2. LATTICE PHYSICS AUDIT ──────────────────────────────────────────────────

  describe('Procedural Lattice Evaluation', () => {
    const canvasSize = { width: 160, height: 144 };

    it('generates deterministic parametric coordinates', () => {
      const formula = {
        coordinateFormula: {
          type: FORMULA_TYPES.PARAMETRIC_CURVE,
          parameters: { n: 10, a: 50, cx: 80, cy: 72, b: 0, c: 0 }
        }
      };

      const coords = evaluateFormula(formula, canvasSize, 0);
      expect(coords).toHaveLength(10);
      // Center + radius (80 + 50 = 130)
      expect(coords[0].x).toBeCloseTo(130, 0);
      expect(coords[0].y).toBeCloseTo(72, 0);
    });

    it('maintains grid alignment during evaluation', () => {
      const formula = {
        coordinateFormula: {
          type: FORMULA_TYPES.GRID_PROJECTION,
          gridType: GRID_TYPES.RECTANGULAR,
          cellSize: 8
        }
      };

      const coords = evaluateFormula(formula, canvasSize, 0);
      // Rectangular grid should have points at multiples of 8
      coords.slice(0, 5).forEach(c => {
        expect(c.x % 1).toBe(0); // Snap should ensure clean numbers
      });
    });
  });

  // ── 3. GOLDEN RATIO (PHI) AUDIT ───────────────────────────────────────────────

  describe('Golden Ratio & Fibonacci Subdivision', () => {
    it('satisfies the Phi constant in subdivision logic', () => {
      const canvasSize = { width: 100, height: 100 };
      const formula = { iterations: 1, scale: 1 };
      
      const coords = evaluateFibonacciGrid(formula, canvasSize, 0);
      
      // First subdivision line at w / GOLDEN_RATIO
      const expectedX = 100 / GOLDEN_RATIO;
      const foundX = coords.find(c => c.x > 0).x;
      expect(foundX).toBeCloseTo(expectedX, 0);
    });

    it('generates recursive anchor nodes following the spiral path', () => {
      const grid = createTemplateGrid({ 
        gridType: GRID_TYPES.FIBONACCI,
        width: 160,
        height: 144
      });

      const phiAnchors = grid.anchorPoints.filter(p => p.label.startsWith('phi_'));
      expect(phiAnchors.length).toBe(7); // We generate 7 levels
      expect(phiAnchors[0].label).toBe('phi_0');
    });
  });

  // ── 4. BYTECODE ERROR AUDIT ──────────────────────────────────────────────────

  describe('Bytecode Error Integrity', () => {
    it('produces a valid PB-ERR signature with checksum', () => {
      const error = new BytecodeError(
        'FORMULA', 
        'CRIT', 
        'IMGFOR', 
        0x0B01, 
        { detail: 'TEST_FAIL' }
      );

      expect(error.bytecode).toContain('PB-ERR-v1-FORMULA-CRIT-IMGFOR-0B01');
      
      const decoded = decodeBytecodeError(error.bytecode);
      expect(decoded.valid).toBe(true);
      expect(decoded.context.detail).toBe('TEST_FAIL');
    });

    it('rejects tampered bytecode via checksum validation', () => {
      const error = new BytecodeError('TYPE', 'WARN', 'SHARED', 0x0001);
      const tampered = error.bytecode.replace('0001', '0002');
      
      const decoded = decodeBytecodeError(tampered);
      expect(decoded.valid).toBe(false);
      expect(decoded.error).toBe('CHECKSUM_MISMATCH');
    });
  });

});
