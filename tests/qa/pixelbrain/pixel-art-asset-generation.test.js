/**
 * QA Test Suite: PixelBrain Asset Generation
 * 
 * Tests the complete pixel art generation pipeline from semantic input to visual output.
 * Covers coordinate mapping, color palettes, noise generation, and extension system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Layer 1: Linguistic Inference
import {
  SemanticController,
  extractVisualParameters,
  LEXICAL_VISUAL_DB,
  DEFAULT_VISUAL_PARAMS,
} from '../../../codex/core/semantic/visual-extractor.js';

import {
  applyPhoneticModifiers,
} from '../../../codex/core/semantic/phonetic-materials.js';

// Layer 2: Arithmetic Modeling
import {
  generateSpiralCoordinates,
  mapSemanticToCoordinateConstraints,
  resolveDominantAxis,
  applySymmetry,
  snapToPixelGrid,
} from '../../../codex/core/pixelbrain/coordinate-mapping.js';

import {
  bytecodeToPalette,
  getHexForByte,
  generatePaletteFromSemantics,
} from '../../../codex/core/pixelbrain/color-byte-mapping.js';

import {
  perlinNoiseGrid,
  noiseToTexture,
  applyDithering,
} from '../../../codex/core/pixelbrain/procedural-noise.js';

import {
  applyPixelArtAliasing,
  drawPixelatedLine,
} from '../../../codex/core/pixelbrain/anti-alias-control.js';

// Layer 3: Extensions
import {
  createExtensionRegistry,
} from '../../../codex/core/pixelbrain/extension-registry.js';

import {
  physicsStretchSquash,
  physicsGravity,
  PHYSICS_EXTENSIONS,
} from '../../../codex/core/pixelbrain/extensions/physics-extensions.js';

import {
  styleGameBoy,
  style8Bit,
  styleCRT,
} from '../../../codex/core/pixelbrain/extensions/style-extensions.js';

// Shared utilities
import {
  DEFAULT_PIXELBRAIN_CANVAS,
  GOLDEN_RATIO,
  GOLDEN_ANGLE,
  clamp01,
} from '../../../codex/core/pixelbrain/shared.js';

// ============================================================================
// LAYER 1: LINGUISTIC INFERENCE TESTS
// ============================================================================

describe('PixelBrain QA — Layer 1: Linguistic Inference', () => {
  describe('SemanticController', () => {
    it('extracts visual parameters from subject keywords', () => {
      const params = extractVisualParameters('dragon');
      
      expect(params).toBeDefined();
      expect(params.surface).toBeDefined();
      expect(params.form).toBeDefined();
      expect(params.light).toBeDefined();
      expect(params.color).toBeDefined();
    });

    it('applies semantic weight to parameters', () => {
      const params = extractVisualParameters('crystal');
      
      // Crystal should have high reflectivity and low roughness
      expect(params.surface.reflectivity).toBeGreaterThan(0.7);
      expect(params.surface.roughness).toBeLessThan(0.3);
    });

    it('falls back to defaults for unknown words', () => {
      const params = extractVisualParameters('xyzunknown123');
      
      expect(params).toEqual(DEFAULT_VISUAL_PARAMS);
    });

    it('applies school modifiers correctly', () => {
      const baseParams = extractVisualParameters('knight');
      const modified = SemanticController.applySchoolModifiers(baseParams, 'SONIC');
      
      expect(modified).toBeDefined();
      expect(modified.color).toBeDefined();
    });
  });

  describe('LEXICAL_VISUAL_DB', () => {
    it('contains expected subject entries', () => {
      const expectedSubjects = ['knight', 'dragon', 'forest', 'crystal', 'shadow', 'fire', 'water', 'stone'];
      
      for (const subject of expectedSubjects) {
        expect(LEXICAL_VISUAL_DB.has(subject)).toBe(true);
        const entry = LEXICAL_VISUAL_DB.get(subject);
        expect(entry.surface).toBeDefined();
        expect(entry.form).toBeDefined();
        expect(entry.light).toBeDefined();
      }
    });

    it('has valid parameter ranges', () => {
      for (const [_subject, params] of LEXICAL_VISUAL_DB.entries()) {
        // Surface parameters
        expect(params.surface.reflectivity).toBeGreaterThanOrEqual(0);
        expect(params.surface.reflectivity).toBeLessThanOrEqual(1);
        expect(params.surface.roughness).toBeGreaterThanOrEqual(0);
        expect(params.surface.roughness).toBeLessThanOrEqual(1);
        
        // Form parameters
        expect(params.form.scale).toBeGreaterThanOrEqual(0.5);
        expect(params.form.scale).toBeLessThanOrEqual(2.0);
        expect(params.form.complexity).toBeGreaterThanOrEqual(0);
        expect(params.form.complexity).toBeLessThanOrEqual(1);
        
        // Light parameters
        expect(params.light.angle).toBeGreaterThanOrEqual(0);
        expect(params.light.angle).toBeLessThan(360);
        expect(params.light.hardness).toBeGreaterThanOrEqual(0);
        expect(params.light.hardness).toBeLessThanOrEqual(1);
        expect(params.light.intensity).toBeGreaterThanOrEqual(0);
        expect(params.light.intensity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Phonetic Modifiers', () => {
    it('maps phonemes to materials', () => {
      const modifiers = applyPhoneticModifiers({ vowelFamily: 'AA', consonants: ['D', 'R'] });
      
      expect(modifiers).toBeDefined();
      expect(modifiers.material).toBeDefined();
    });

    it('handles empty phoneme data gracefully', () => {
      const modifiers = applyPhoneticModifiers({});
      expect(modifiers).toBeDefined();
    });
  });
});

// ============================================================================
// LAYER 2: ARITHMETIC MODELING TESTS
// ============================================================================

describe('PixelBrain QA — Layer 2: Arithmetic Modeling', () => {
  describe('Coordinate Mapping', () => {
    describe('generateSpiralCoordinates', () => {
      it('generates spiral coordinates with correct structure', () => {
        const center = { x: 80, y: 72 };
        const coords = generateSpiralCoordinates(center, 3, 8);
        
        expect(coords.length).toBe(24); // 3 turns * 8 points
        expect(coords[0]).toHaveProperty('x');
        expect(coords[0]).toHaveProperty('y');
        expect(coords[0]).toHaveProperty('z');
      });

      it('uses golden ratio in spiral calculation', () => {
        const coords = generateSpiralCoordinates({ x: 80, y: 72 }, 2, 4);
        
        // Coordinates should radiate outward from center
        const firstDist = Math.sqrt(
          Math.pow(coords[0].x - 80, 2) + Math.pow(coords[0].y - 72, 2)
        );
        const lastDist = Math.sqrt(
          Math.pow(coords[coords.length - 1].x - 80, 2) + Math.pow(coords[coords.length - 1].y - 72, 2)
        );
        
        expect(lastDist).toBeGreaterThan(firstDist);
      });
    });

    describe('mapSemanticToCoordinateConstraints', () => {
      it('converts semantic params to coordinate constraints', () => {
        const semanticParams = {
          form: { scale: 1.2, symmetry: 'radial', complexity: 0.7, dominantAxis: 'radial' },
          surface: { material: 'crystalline', roughness: 0.2, reflectivity: 0.9 },
          light: { angle: 90, hardness: 0.8, intensity: 0.7 },
        };
        
        const constraints = mapSemanticToCoordinateConstraints(semanticParams);
        
        expect(constraints.form).toBeDefined();
        expect(constraints.surface).toBeDefined();
        expect(constraints.light).toBeDefined();
        expect(constraints.coordinateDensity).toBeGreaterThan(0);
        expect(constraints.canvas).toBeDefined();
      });

      it('handles missing parameters with defaults', () => {
        const constraints = mapSemanticToCoordinateConstraints({});
        
        expect(constraints.form.dominantAxis).toBe('horizontal');
        expect(constraints.form.symmetry).toBe('none');
        expect(constraints.surface.material).toBe('stone');
      });
    });

    describe('resolveDominantAxis', () => {
      it('resolves horizontal axis', () => {
        const coords = [{ x: 10, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 50 }];
        const axis = resolveDominantAxis(coords);
        expect(axis).toBe('horizontal');
      });

      it('resolves vertical axis', () => {
        const coords = [{ x: 50, y: 10 }, { x: 50, y: 100 }, { x: 50, y: 50 }];
        const axis = resolveDominantAxis(coords);
        expect(axis).toBe('vertical');
      });
    });

    describe('applySymmetry', () => {
      it('applies vertical symmetry', () => {
        const coords = [{ x: 30, y: 40 }];
        const canvas = { width: 100, height: 100 };
        const symmetric = applySymmetry(coords, 'vertical', canvas);
        
        expect(symmetric.length).toBeGreaterThan(0);
      });

      it('applies radial symmetry', () => {
        const coords = [{ x: 60, y: 50 }];
        const canvas = { width: 100, height: 100, goldenPoint: { x: 61.8, y: 61.8 } };
        const symmetric = applySymmetry(coords, 'radial', canvas);
        
        expect(symmetric.length).toBeGreaterThan(0);
      });
    });

    describe('snapToPixelGrid', () => {
      it('snaps coordinates to pixel grid', () => {
        const coord = { x: 10.3, y: 20.7, z: 0 };
        const snapped = snapToPixelGrid(coord, 2);
        
        expect(snapped.x % 2).toBe(0);
        expect(snapped.y % 2).toBe(0);
      });

      it('handles gridSize of 1 (no snapping)', () => {
        const coord = { x: 10.3, y: 20.7, z: 0 };
        const snapped = snapToPixelGrid(coord, 1);
        
        expect(Math.round(snapped.x)).toBe(10);
        expect(Math.round(snapped.y)).toBe(21);
      });
    });
  });

  describe('Color Bytecode Mapping', () => {
    describe('getHexForByte', () => {
      it('converts bytecode to hex color', () => {
        const hex = getHexForByte('R1');
        expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
      });

      it('handles different vowel families', () => {
        const hexAA = getHexForByte('AA1');
        const hexEH = getHexForByte('EH1');
        
        expect(hexAA).toBeDefined();
        expect(hexEH).toBeDefined();
        expect(hexAA).not.toBe(hexEH);
      });
    });

    describe('bytecodeToPalette', () => {
      it('generates palette from bytecode array', () => {
        const bytecodes = ['R1', 'D1', 'AA1', 'EH1'];
        const palette = bytecodeToPalette(bytecodes);
        
        expect(Array.isArray(palette)).toBe(true);
        expect(palette.length).toBeGreaterThan(0);
        
        for (const color of palette) {
          expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        }
      });

      it('deduplicates colors', () => {
        const bytecodes = ['R1', 'R1', 'R1'];
        const palette = bytecodeToPalette(bytecodes);
        
        expect(palette.length).toBe(1);
      });
    });

    describe('generatePaletteFromSemantics', () => {
      it('generates palette from semantic parameters', () => {
        const semantics = {
          color: { primaryHue: 180, saturation: 0.7, brightness: 0.6 },
          light: { color: '#4169E1', intensity: 0.7 },
        };
        
        const palette = generatePaletteFromSemantics(semantics, 4);
        
        expect(Array.isArray(palette)).toBe(true);
        expect(palette.length).toBe(4);
      });
    });
  });

  describe('Procedural Noise Generation', () => {
    describe('perlinNoiseGrid', () => {
      it('generates noise grid with correct dimensions', () => {
        const width = 64;
        const height = 64;
        const grid = perlinNoiseGrid(width, height, 0);
        
        expect(grid.length).toBe(width);
        expect(grid[0].length).toBe(height);
      });

      it('produces values in [0, 1] range', () => {
        const grid = perlinNoiseGrid(32, 32, 42);
        
        for (let x = 0; x < grid.length; x++) {
          for (let y = 0; y < grid[x].length; y++) {
            expect(grid[x][y]).toBeGreaterThanOrEqual(0);
            expect(grid[x][y]).toBeLessThanOrEqual(1);
          }
        }
      });

      it('is deterministic with same seed', () => {
        const grid1 = perlinNoiseGrid(32, 32, 123);
        const grid2 = perlinNoiseGrid(32, 32, 123);
        
        expect(grid1).toEqual(grid2);
      });

      it('produces different output with different seeds', () => {
        const grid1 = perlinNoiseGrid(32, 32, 123);
        const grid2 = perlinNoiseGrid(32, 32, 456);
        
        expect(grid1).not.toEqual(grid2);
      });
    });

    describe('noiseToTexture', () => {
      it('converts noise grid to texture values', () => {
        const noiseGrid = perlinNoiseGrid(16, 16, 0);
        const texture = noiseToTexture(noiseGrid, 0.5, 0.5);
        
        expect(texture.length).toBe(16);
        expect(texture[0].length).toBe(16);
      });
    });

    describe('applyDithering', () => {
      it('applies Floyd-Steinberg dithering', () => {
        const image = [
          [0.1, 0.3, 0.5],
          [0.7, 0.9, 0.2],
          [0.4, 0.6, 0.8],
        ];
        
        const dithered = applyDithering(image, 'floydSteinberg', 4);
        
        expect(dithered.length).toBe(3);
        expect(dithered[0].length).toBe(3);
      });

      it('applies ordered 4x4 dithering', () => {
        const image = [
          [0.1, 0.3, 0.5],
          [0.7, 0.9, 0.2],
          [0.4, 0.6, 0.8],
        ];
        
        const dithered = applyDithering(image, 'ordered4x4', 4);
        
        expect(dithered.length).toBe(3);
      });
    });
  });

  describe('Anti-Alias Control', () => {
    describe('drawPixelatedLine', () => {
      it('draws a horizontal line', () => {
        const line = drawPixelatedLine({ x: 10, y: 50 }, { x: 30, y: 50 });
        
        expect(line.length).toBe(21); // Including both endpoints
        for (const point of line) {
          expect(point.y).toBe(50);
        }
      });

      it('draws a vertical line', () => {
        const line = drawPixelatedLine({ x: 50, y: 10 }, { x: 50, y: 30 });
        
        expect(line.length).toBe(21);
        for (const point of line) {
          expect(point.x).toBe(50);
        }
      });

      it('draws a diagonal line', () => {
        const line = drawPixelatedLine({ x: 10, y: 10 }, { x: 20, y: 20 });
        
        expect(line.length).toBe(11);
      });
    });

    describe('applyPixelArtAliasing', () => {
      it('applies aliasing to coordinate buffer', () => {
        const coords = [
          { x: 10.3, y: 20.7, color: '#FF0000' },
          { x: 15.8, y: 25.2, color: '#00FF00' },
        ];
        
        const aliased = applyPixelArtAliasing(coords, 160, 144, 1);
        
        expect(Array.isArray(aliased)).toBe(true);
      });
    });
  });
});

// ============================================================================
// LAYER 3: EXTENSION SYSTEM TESTS
// ============================================================================

describe('PixelBrain QA — Layer 3: Extension System', () => {
  describe('Extension Registry', () => {
    let registry;

    beforeEach(() => {
      registry = createExtensionRegistry();
    });

    afterEach(() => {
      registry.clear();
    });

    it('registers an extension', () => {
      const extension = {
        id: 'test-extension',
        type: 'CUSTOM_PROP',
        hooks: {
          onRender: (payload) => payload,
        },
      };

      const result = registry.register(extension);
      
      expect(result.id).toBe('test-extension');
      expect(result.type).toBe('CUSTOM_PROP');
    });

    it('prevents duplicate extension registration', () => {
      const extension = {
        id: 'duplicate-test',
        type: 'CUSTOM_PROP',
      };

      registry.register(extension);
      
      expect(() => registry.register(extension)).toThrow();
    });

    it('unregisters an extension', () => {
      const extension = {
        id: 'temp-extension',
        type: 'CUSTOM_PROP',
      };

      registry.register(extension);
      expect(registry.has('temp-extension')).toBe(true);
      
      registry.unregister('temp-extension');
      expect(registry.has('temp-extension')).toBe(false);
    });

    it('applies hooks in sequence order', () => {
      const results = [];
      
      registry.register({
        id: 'ext-1',
        type: 'CUSTOM_PROP',
        hooks: {
          onRender: (payload) => {
            results.push(1);
            return { ...payload, step: 1 };
          },
        },
      });

      registry.register({
        id: 'ext-2',
        type: 'CUSTOM_PROP',
        hooks: {
          onRender: (payload) => {
            results.push(2);
            return { ...payload, step: 2 };
          },
        },
      });

      const finalPayload = registry.applyHooks('render', {});
      
      expect(results).toEqual([1, 2]);
      expect(finalPayload.step).toBe(2);
    });

    it('lists registered extensions', () => {
      registry.register({ id: 'ext-a', type: 'CUSTOM_PROP' });
      registry.register({ id: 'ext-b', type: 'CUSTOM_PROP' });
      
      const list = registry.list();
      
      expect(list.length).toBe(2);
      expect(list[0].id).toBe('ext-a');
      expect(list[1].id).toBe('ext-b');
    });
  });

  describe('Physics Extensions', () => {
    it('applies stretch and squash effect', () => {
      const payload = {
        coordinates: [{ x: 50, y: 50, z: 0 }],
        frame: 0,
      };

      const result = physicsStretchSquash(payload, {
        extensionId: 'physics-stretch-squash',
        extensionType: 'PHYSICS',
      });

      expect(result).toBeDefined();
      expect(result.coordinates).toBeDefined();
    });

    it('applies gravity effect', () => {
      const payload = {
        coordinates: [{ x: 50, y: 50, z: 10 }],
        gravity: 0.5,
      };

      const result = physicsGravity(payload, {
        extensionId: 'physics-gravity',
        extensionType: 'PHYSICS',
      });

      expect(result).toBeDefined();
      expect(result.coordinates).toBeDefined();
    });

    it('has valid PHYSICS_EXTENSIONS constants', () => {
      expect(PHYSICS_EXTENSIONS).toBeDefined();
      expect(Array.isArray(PHYSICS_EXTENSIONS)).toBe(true);
    });
  });

  describe('Style Extensions', () => {
    it('applies GameBoy style', () => {
      const payload = {
        canvas: { width: 160, height: 144 },
        coordinates: [{ x: 50, y: 50, color: '#FF0000' }],
      };

      const result = styleGameBoy(payload, {
        extensionId: 'style-gameboy',
        extensionType: 'STYLE',
      });

      expect(result).toBeDefined();
      expect(result.canvas).toBeDefined();
    });

    it('applies 8-bit style', () => {
      const payload = {
        canvas: { width: 256, height: 240 },
        coordinates: [],
      };

      const result = style8Bit(payload, {
        extensionId: 'style-8bit',
        extensionType: 'STYLE',
      });

      expect(result).toBeDefined();
    });

    it('applies CRT style', () => {
      const payload = {
        canvas: { width: 320, height: 288 },
        coordinates: [],
      };

      const result = styleCRT(payload, {
        extensionId: 'style-crt',
        extensionType: 'STYLE',
      });

      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('PixelBrain QA — Integration Tests', () => {
  it('processes complete pipeline from semantics to coordinates', () => {
    // Layer 1: Extract semantics
    const semanticParams = extractVisualParameters('crystal dragon');
    
    // Layer 2: Map to coordinates
    const constraints = mapSemanticToCoordinateConstraints(semanticParams);
    
    // Generate coordinates
    const coords = generateSpiralCoordinates(
      constraints.canvas.goldenPoint,
      constraints.spiralTurns,
      8
    );
    
    // Apply symmetry
    const symmetricCoords = applySymmetry(
      coords,
      constraints.form.symmetry,
      constraints.canvas
    );
    
    // Snap to pixel grid
    const snappedCoords = symmetricCoords.map(c => 
      snapToPixelGrid(c, constraints.canvas.gridSize)
    );
    
    // Verify output
    expect(snappedCoords.length).toBeGreaterThan(0);
    expect(snappedCoords[0]).toHaveProperty('x');
    expect(snappedCoords[0]).toHaveProperty('y');
  });

  it('generates complete color palette from semantics', () => {
    const semanticParams = extractVisualParameters('fire phoenix');
    const palette = generatePaletteFromSemantics(semanticParams.color, 4);
    
    expect(palette.length).toBe(4);
    for (const color of palette) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('creates noise texture for surface material', () => {
    const semanticParams = extractVisualParameters('stone golem');
    const noiseGrid = perlinNoiseGrid(64, 64, 42);
    const texture = noiseToTexture(noiseGrid, semanticParams.surface.roughness, 0.5);
    
    expect(texture.length).toBe(64);
    expect(texture[0].length).toBe(64);
  });

  it('applies extension pipeline to rendered output', () => {
    const registry = createExtensionRegistry();
    
    // Register style extension
    registry.register({
      id: 'style-test',
      type: 'STYLE',
      hooks: {
        onRender: (payload) => ({ ...payload, styled: true }),
      },
    });
    
    // Register physics extension
    registry.register({
      id: 'physics-test',
      type: 'PHYSICS',
      hooks: {
        onRender: (payload) => ({ ...payload, physics: true }),
      },
    });
    
    // Apply pipeline
    const basePayload = { coordinates: [], canvas: { width: 160, height: 144 } };
    const result = registry.applyHooks('render', basePayload);
    
    expect(result.styled).toBe(true);
    expect(result.physics).toBe(true);
    
    registry.clear();
  });

  it('validates utility functions', () => {
    // clamp01
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
    
    // Golden ratio constant
    expect(GOLDEN_RATIO).toBeGreaterThan(1.618);
    expect(GOLDEN_RATIO).toBeLessThan(1.619);
    
    // Golden angle (derived from golden ratio)
    expect(GOLDEN_ANGLE).toBeGreaterThan(137);
    expect(GOLDEN_ANGLE).toBeLessThan(138);
    
    // Default canvas
    expect(DEFAULT_PIXELBRAIN_CANVAS.width).toBe(160);
    expect(DEFAULT_PIXELBRAIN_CANVAS.height).toBe(144);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('PixelBrain QA — Performance Tests', () => {
  it('generates coordinates within performance budget', () => {
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      generateSpiralCoordinates({ x: 80, y: 72 }, 3, 8);
    }
    
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(100); // 100 iterations in < 100ms
  });

  it('generates noise grid within performance budget', () => {
    const startTime = performance.now();
    
    for (let i = 0; i < 50; i++) {
      perlinNoiseGrid(64, 64, i);
    }
    
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(500); // 50 iterations in < 500ms
  });

  it('applies dithering within performance budget', () => {
    const image = Array(64).fill(null).map(() => 
      Array(64).fill(null).map(() => Math.random())
    );
    
    const startTime = performance.now();
    
    for (let i = 0; i < 20; i++) {
      applyDithering(image, 'floydSteinberg', 4);
    }
    
    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(200); // 20 iterations in < 200ms
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('PixelBrain QA — Edge Cases', () => {
  it('handles empty semantic parameters', () => {
    const constraints = mapSemanticToCoordinateConstraints({});
    expect(constraints).toBeDefined();
    expect(constraints.form).toBeDefined();
  });

  it('handles null center for spiral coordinates', () => {
    const coords = generateSpiralCoordinates(null, 2, 4);
    expect(coords.length).toBe(8);
  });

  it('handles zero-sized noise grid', () => {
    const grid = perlinNoiseGrid(0, 0, 0);
    expect(grid.length).toBe(0);
  });

  it('handles empty bytecode array', () => {
    const palette = bytecodeToPalette([]);
    expect(Array.isArray(palette)).toBe(true);
    expect(palette.length).toBe(0);
  });

  it('handles extreme parameter values', () => {
    const semanticParams = {
      form: { scale: 10, complexity: -5 },
      surface: { reflectivity: 5, roughness: -2 },
      light: { angle: 1000, hardness: 10, intensity: -5 },
    };
    
    const constraints = mapSemanticToCoordinateConstraints(semanticParams);
    
    // Values should be clamped to valid ranges
    expect(constraints.form.scale).toBeGreaterThanOrEqual(0);
    expect(constraints.form.scale).toBeLessThanOrEqual(1);
    expect(constraints.surface.reflectivity).toBeGreaterThanOrEqual(0);
    expect(constraints.surface.reflectivity).toBeLessThanOrEqual(1);
  });

  it('handles invalid extension type', () => {
    const registry = createExtensionRegistry();
    
    expect(() => {
      registry.register({
        id: 'invalid-ext',
        type: 'INVALID_TYPE',
      });
    }).toThrow();
    
    registry.clear();
  });

  it('handles missing extension id', () => {
    const registry = createExtensionRegistry();
    
    expect(() => {
      registry.register({
        type: 'CUSTOM_PROP',
      });
    }).toThrow();
    
    registry.clear();
  });
});
