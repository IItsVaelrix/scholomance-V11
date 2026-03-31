/**
 * QA Test: PixelBrain Upload & Bytecode Integration
 * 
 * Verifies the pipeline from image analysis to pixel art generation.
 */

import { describe, it, expect } from 'vitest';
import { generatePixelArtFromImage } from '../../../codex/core/pixelbrain/image-to-pixel-art.js';
import { parseBytecodeToFormula, formulaToBytecode } from '../../../codex/core/pixelbrain/image-to-bytecode-formula.js';
import { evaluateFormulaWithColor } from '../../../codex/core/pixelbrain/formula-to-coordinates.js';

describe('PixelBrain Upload QA', () => {
  it('correctly generates coordinates from image analysis', () => {
    // Mock image analysis result (as returned by /api/image/analyze)
    const mockAnalysis = {
      colors: [
        { hex: '#FF0000', percentage: 60 },
        { hex: '#00FF00', percentage: 40 }
      ],
      composition: {
        dominantAxis: 'horizontal',
        hasSymmetry: false,
        edgeDensity: 0.2,
        complexity: 0.5,
        contrastNormalized: 0.5
      },
      semanticParams: {
        surface: { reflectivity: 0.5, roughness: 0.5 },
        form: { complexity: 0.5 }
      },
      pixelData: new Uint8ClampedArray(100 * 100 * 4).fill(255), // White 100x100 image
      dimensions: { width: 100, height: 100 }
    };

    // Add some "edges" to pixel data
    // Edge at x=50
    for (let y = 0; y < 100; y++) {
      const idx = (y * 100 + 50) * 4;
      mockAnalysis.pixelData[idx] = 0; // Black line
      mockAnalysis.pixelData[idx+1] = 0;
      mockAnalysis.pixelData[idx+2] = 0;
    }

    const canvasSize = { width: 160, height: 144, gridSize: 1 };
    
    const result = generatePixelArtFromImage(mockAnalysis, canvasSize);
    
    expect(result).toBeDefined();
    expect(result.coordinates).toBeDefined();
    expect(result.coordinates.length).toBeGreaterThan(0);
    
    // Check if snapping worked (snappedX/snappedY should be numbers)
    const firstCoord = result.coordinates[0];
    expect(typeof firstCoord.snappedX).toBe('number');
    expect(typeof firstCoord.snappedY).toBe('number');
    expect(firstCoord.snappedX).not.toBeNaN();
    expect(firstCoord.snappedY).not.toBeNaN();
    
    // Check bytecode generation
    expect(result.bytecode).toBeDefined();
    expect(result.bytecode).toMatch(/^0xF/);
  });

  // Note: Server-side multipart handling fix was verified by code analysis.
  // Real multipart uploads are best tested via integration tests with a running server.

  it('correctly parses and evaluates bytecode', () => {
    // A valid bytecode for a parametric curve
    const bytecode = '0xFP_40x40_4c_d0_gg5';
    
    const formula = parseBytecodeToFormula(bytecode);
    expect(formula).toBeDefined();
    expect(formula.coordinateFormula.type).toBe('parametric_curve');
    
    const canvasSize = { width: 160, height: 144 };
    const coords = evaluateFormulaWithColor(formula, canvasSize);
    
    expect(coords).toBeDefined();
    expect(coords.length).toBeGreaterThan(0);
    expect(coords[0].color).toBeDefined();
    expect(coords[0].color).toMatch(/^hsl|^#/);
  });

  it('handles grid projection bytecode', () => {
    // A valid bytecode for a grid projection
    const bytecode = '0xFG_16x16_8c_d1_gg3';
    
    const formula = parseBytecodeToFormula(bytecode);
    expect(formula.coordinateFormula.type).toBe('grid_projection');
    
    const canvasSize = { width: 160, height: 144 };
    const coords = evaluateFormulaWithColor(formula, canvasSize);
    
    expect(coords).toBeDefined();
    expect(coords.length).toBeGreaterThan(0);
  });

  it('handles template-based bytecode', () => {
    // A valid bytecode for a template
    const bytecode = '0xFT_8x8_4c_d0_gg3';
    
    const formula = parseBytecodeToFormula(bytecode);
    expect(formula.coordinateFormula.type).toBe('template_based');
    
    const canvasSize = { width: 160, height: 144 };
    
    // Manually add some anchors to formula.template to simulate a real template
    formula.template.anchorPoints = [
      { x: 0, y: 0, label: 'test', locked: true }
    ];
    
    const coords = evaluateFormulaWithColor(formula, canvasSize);
    
    // If evaluateTemplateBased is buggy, this might be empty or crash
    expect(coords).toBeDefined();
    expect(coords.length).toBeGreaterThan(0);
  });
});
