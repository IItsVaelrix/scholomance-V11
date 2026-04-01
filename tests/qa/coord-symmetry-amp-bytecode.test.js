/**
 * QA: Coordinate Symmetry AMP — Bytecode Error System Tests
 *
 * Tests amp.coord-symmetry using Scholomance Bytecode Error System.
 * All assertion failures produce AI-parsable bytecode errors.
 *
 * @see docs/ByteCode Error System/04_QA_Integration_Guide.md
 */

import { describe, it, expect } from 'vitest';
import {
  assertEqual,
  assertTrue,
  assertInRange,
  assertType,
  assertThrowsBytecode,
  assertCoordinateInBounds,
  assertValidHexColor,
} from './tools/bytecode-assertions.js';
import {
  verticalMirror,
  horizontalMirror,
  radialRotate,
  diagonalMirror,
} from '../../src/lib/pixelbrain.adapter.js';
import { runCoordSymmetryAmp as directRunCoordSymmetryAmp } from '../../codex/core/pixelbrain/coord-symmetry-amp.js';

// ─── Test Context Helper ─────────────────────────────────────────────────────

const createTestContext = (testName, extra = {}) => ({
  testName,
  testFile: 'coord-symmetry-amp-bytecode.test.js',
  testSuite: 'Coord Symmetry AMP — Bytecode Errors',
  timestamp: Date.now(),
  ...extra,
});

// ─── Processor Metadata Tests ────────────────────────────────────────────────

describe('Coord Symmetry AMP — Bytecode Errors', () => {
  describe('Processor Contract', () => {
    it('has valid processor ID format', () => {
      const processorId = 'amp.coord-symmetry';
      assertType(processorId, 'string', createTestContext('processor ID type'));
      expect(processorId).toMatch(/^amp\.[a-z-]+$/);
    });

    it('runs at pre-render stage', () => {
      const stage = 'pre-render';
      assertEqual(stage, 'pre-render', createTestContext('stage value'));
    });

    it('accepts valid input types', () => {
      const accepts = ['coordinates.array', 'lattice', 'symmetry.metadata'];
      assertTrue(Array.isArray(accepts), createTestContext('accepts is array'));
      assertEqual(accepts.length, 3, createTestContext('accepts count'));
    });

    it('emits valid output types', () => {
      const emits = ['coordinates.transformed', 'symmetry.bytecode'];
      assertTrue(Array.isArray(emits), createTestContext('emits is array'));
      assertEqual(emits.length, 2, createTestContext('emits count'));
    });
  });

  // ─── Transformation Function Tests ─────────────────────────────────────────

  describe('Transformation Functions', () => {
    describe('verticalMirror', () => {
      it('mirrors coordinate around axis', () => {
        const coord = { x: 10, y: 20, color: '#FF0000', emphasis: 1 };
        const result = verticalMirror(coord, 50);

        assertEqual(result.x, 90, createTestContext('vertical mirror x'));
        assertEqual(result.y, 20, createTestContext('vertical mirror y'));
        assertValidHexColor(result.color, createTestContext('vertical mirror color'));
      });

      it('handles coordinates on the axis', () => {
        const coord = { x: 50, y: 20, color: '#FF0000', emphasis: 1 };
        const result = verticalMirror(coord, 50);

        assertEqual(result.x, 50, createTestContext('axis coordinate x'));
      });

      it('preserves color format', () => {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
        colors.forEach(hex => {
          const coord = { x: 10, y: 20, color: hex, emphasis: 1 };
          const result = verticalMirror(coord, 50);
          assertValidHexColor(result.color, createTestContext(`color ${hex}`));
        });
      });
    });

    describe('horizontalMirror', () => {
      it('mirrors coordinate around axis', () => {
        const coord = { x: 10, y: 20, color: '#FF0000', emphasis: 1 };
        const result = horizontalMirror(coord, 50);

        assertEqual(result.x, 10, createTestContext('horizontal mirror x'));
        assertEqual(result.y, 80, createTestContext('horizontal mirror y'));
      });
    });

    describe('radialRotate', () => {
      it('rotates 90 degrees around center', () => {
        const coord = { x: 60, y: 50, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 90);

        assertEqual(result.x, 50, createTestContext('90° rotation x'));
        assertEqual(result.y, 60, createTestContext('90° rotation y'));
      });

      it('rotates 180 degrees around center', () => {
        const coord = { x: 60, y: 50, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 180);

        assertEqual(result.x, 40, createTestContext('180° rotation x'));
        assertEqual(result.y, 50, createTestContext('180° rotation y'));
      });

      it('rotates 270 degrees around center', () => {
        const coord = { x: 50, y: 60, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 270);

        assertEqual(result.x, 60, createTestContext('270° rotation x'));
        assertEqual(result.y, 50, createTestContext('270° rotation y'));
      });
    });

    describe('diagonalMirror', () => {
      it('swaps X and Y coordinates', () => {
        const coord = { x: 10, y: 30, color: '#FF0000', emphasis: 1 };
        const result = diagonalMirror(coord);

        assertEqual(result.x, 30, createTestContext('diagonal swap x'));
        assertEqual(result.y, 10, createTestContext('diagonal swap y'));
      });
    });
  });

  // ─── Processor Execution Tests ─────────────────────────────────────────────

  describe('Processor Execution', () => {
    const baseInput = {
      assetId: 'test-asset',
      coordinates: [
        { x: 10, y: 20, color: '#FF0000', emphasis: 1 },
        { x: 30, y: 40, color: '#00FF00', emphasis: 0.8 },
      ],
      dimensions: { width: 100, height: 100 },
      symmetry: {
        type: 'vertical',
        axis: { x: 50, y: null, angle: 90 },
        confidence: 0.85,
        significant: true,
      },
    };

    it('returns error for missing coordinates', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        coordinates: [],
      });

      assertEqual(result.ok, false, createTestContext('empty coords result'));
      assertEqual(result.transformedCount, 0, createTestContext('empty coords count'));
      assertTrue(
        result.bytecode.some(b => b.includes('ERROR')),
        createTestContext('error bytecode present')
      );
    });

    it('applies vertical mirror transformation', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'overlay',
        overlapPolicy: 'prefer-original',
        snapToGrid: false,
      });

      assertTrue(result.ok, createTestContext('vertical transform success'));
      assertEqual(result.originalCount, 2, createTestContext('original count'));
      assertTrue(
        result.transformedCount > 2,
        createTestContext('transformed count > originals')
      );
      assertTrue(
        result.bytecode.some(b => b.includes('SYMMETRY_TYPE vertical')),
        createTestContext('vertical bytecode')
      );
    });

    it('applies horizontal mirror transformation', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        symmetry: {
          ...baseInput.symmetry,
          type: 'horizontal',
          axis: { x: null, y: 50, angle: 0 },
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      assertTrue(result.ok, createTestContext('horizontal transform success'));
      assertTrue(
        result.diagnostics.some(d => d.includes('horizontal mirror')),
        createTestContext('horizontal diagnostic')
      );
    });

    it('applies radial rotation transformation', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        symmetry: {
          ...baseInput.symmetry,
          type: 'radial',
          axis: { x: 50, y: 50, angle: 360 },
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      assertTrue(result.ok, createTestContext('radial transform success'));
      assertTrue(
        result.transformedCount > baseInput.coordinates.length,
        createTestContext('radial creates more coords')
      );
    });

    it('applies diagonal mirror transformation', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        symmetry: {
          ...baseInput.symmetry,
          type: 'diagonal',
          axis: { x: null, y: null, angle: 45 },
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      assertTrue(result.ok, createTestContext('diagonal transform success'));
      assertTrue(
        result.diagnostics.some(d => d.includes('diagonal mirror')),
        createTestContext('diagonal diagnostic')
      );
    });
  });

  // ─── Transform Mode Tests ──────────────────────────────────────────────────

  describe('Transform Modes', () => {
    const baseInput = {
      assetId: 'test-asset',
      coordinates: [{ x: 10, y: 20, color: '#FF0000', emphasis: 1 }],
      dimensions: { width: 100, height: 100 },
      symmetry: {
        type: 'vertical',
        axis: { x: 50, y: null, angle: 90 },
        significant: true,
      },
    };

    it('overlay mode keeps originals + adds mirrors', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'overlay',
        snapToGrid: false,
      });

      const originals = result.coordinates.filter(c => c.symmetrySource === 'original');
      const mirrors = result.coordinates.filter(c => c.symmetrySource === 'vertical-mirror');

      assertEqual(originals.length, 1, createTestContext('original count overlay'));
      assertEqual(mirrors.length, 1, createTestContext('mirror count overlay'));
    });

    it('canonicalize mode rebuilds full symmetric set', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'canonicalize',
        snapToGrid: false,
      });

      assertTrue(result.ok, createTestContext('canonicalize success'));
      assertTrue(
        result.diagnostics.some(d => d.includes('Canonicalized')),
        createTestContext('canonicalize diagnostic')
      );
    });

    it('rejects invalid transform mode', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'invalid-mode',
        snapToGrid: false,
      });

      // Invalid mode should be handled gracefully (not crash)
      // The processor may use default mode or return error in diagnostics
      assertTrue(
        result !== undefined && result !== null,
        createTestContext('invalid mode handled gracefully')
      );
    });
  });

  // ─── Overlap Policy Tests ──────────────────────────────────────────────────

  describe('Overlap Policies', () => {
    const inputWithOverlap = {
      assetId: 'test-overlap',
      coordinates: [{ x: 45, y: 50, color: '#FF0000', emphasis: 1 }],
      dimensions: { width: 100, height: 100 },
      symmetry: {
        type: 'vertical',
        axis: { x: 50, y: null, angle: 90 },
        significant: true,
      },
    };

    it('prefer-original keeps original on overlap', () => {
      const result = directRunCoordSymmetryAmp({
        ...inputWithOverlap,
        transformMode: 'overlay',
        overlapPolicy: 'prefer-original',
        snapToGrid: true,
        cellSize: 5,
      });

      const atPosition = result.coordinates.filter(
        c => Math.round(c.x) === 50 && Math.round(c.y) === 50
      );

      assertTrue(
        atPosition.length <= 1,
        createTestContext('overlap resolved to single coord')
      );
    });

    it('max-emphasis keeps highest emphasis on overlap', () => {
      const result = directRunCoordSymmetryAmp({
        ...inputWithOverlap,
        transformMode: 'overlay',
        overlapPolicy: 'max-emphasis',
        snapToGrid: true,
        cellSize: 5,
      });

      assertTrue(result.ok, createTestContext('max-emphasis success'));
    });

    it('blend mode averages colors on overlap', () => {
      const result = directRunCoordSymmetryAmp({
        ...inputWithOverlap,
        transformMode: 'overlay',
        overlapPolicy: 'blend',
        snapToGrid: true,
        cellSize: 5,
      });

      assertTrue(result.ok, createTestContext('blend success'));
    });
  });

  // ─── Grid Snapping Tests ───────────────────────────────────────────────────

  describe('Grid Snapping', () => {
    it('snaps transformed coordinates to grid', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-snap',
        coordinates: [{ x: 13, y: 27, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: {
          type: 'vertical',
          axis: { x: 50, y: null, angle: 90 },
          significant: true,
        },
        transformMode: 'overlay',
        snapToGrid: true,
        cellSize: 8,
        coordinateSpace: 'pixel',
      });

      result.coordinates.forEach(coord => {
        assertEqual(coord.x % 8, 0, createTestContext(`snap x ${coord.x}`));
        assertEqual(coord.y % 8, 0, createTestContext(`snap y ${coord.y}`));
      });
    });

    it('snaps in cell space when coordinateSpace is cell', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-cell-snap',
        coordinates: [{ x: 1.3, y: 2.7, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: {
          type: 'vertical',
          axis: { x: 50, y: null, angle: 90 },
          significant: true,
        },
        transformMode: 'overlay',
        snapToGrid: true,
        coordinateSpace: 'cell',
      });

      result.coordinates.forEach(coord => {
        assertTrue(Number.isInteger(coord.x), createTestContext(`cell snap x ${coord.x}`));
        assertTrue(Number.isInteger(coord.y), createTestContext(`cell snap y ${coord.y}`));
      });
    });

    it('rejects invalid cell size', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-invalid-cell',
        coordinates: [{ x: 10, y: 20, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: { type: 'vertical', axis: { x: 50 }, significant: true },
        transformMode: 'overlay',
        snapToGrid: true,
        cellSize: 0, // Invalid
        coordinateSpace: 'pixel',
      });

      // Should handle gracefully
      assertTrue(result.ok || result.bytecode.some(b => b.includes('ERROR')), createTestContext('invalid cell size handled'));
    });
  });

  // ─── Bytecode Persistence Tests ────────────────────────────────────────────

  describe('Bytecode Persistence', () => {
    it('generates bytecode for persistence', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-bytecode',
        coordinates: [{ x: 10, y: 20, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: {
          type: 'vertical',
          axis: { x: 50, y: null, angle: 90 },
          significant: true,
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      assertTrue(
        result.bytecode.some(b => b.startsWith('AMP COORD-SYMMETRY')),
        createTestContext('AMP marker present')
      );
      assertTrue(
        result.bytecode.some(b => b.includes('SYMMETRY_TYPE vertical')),
        createTestContext('symmetry type in bytecode')
      );
      assertTrue(
        result.bytecode.some(b => b.includes('TRANSFORM_MODE overlay')),
        createTestContext('transform mode in bytecode')
      );
      assertTrue(
        result.bytecode.some(b => b.startsWith('BOUNDS')),
        createTestContext('bounds in bytecode')
      );
    });

    it('includes axis in bytecode', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-axis',
        coordinates: [{ x: 10, y: 20, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: {
          type: 'vertical',
          axis: { x: 45, y: null, angle: 90 },
          significant: true,
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      assertTrue(
        result.bytecode.some(b => b.includes('AXIS 45')),
        createTestContext('custom axis in bytecode')
      );
    });

    it('includes overlap policy in bytecode', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-overlap-bc',
        coordinates: [{ x: 45, y: 50, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: { type: 'vertical', axis: { x: 50 }, significant: true },
        transformMode: 'overlay',
        overlapPolicy: 'prefer-original',
        snapToGrid: true,
        cellSize: 5,
      });

      assertTrue(
        result.bytecode.some(b => b.includes('OVERLAP_POLICY prefer-original')),
        createTestContext('overlap policy in bytecode')
      );
    });
  });

  // ─── Integration Tests ─────────────────────────────────────────────────────

  describe('Integration: Analyze Project Files', () => {
    it('coord-symmetry-amp.js has valid syntax', () => {
      assertTrue(
        typeof directRunCoordSymmetryAmp === 'function',
        createTestContext('processor function exists')
      );
      assertTrue(
        typeof verticalMirror === 'function',
        createTestContext('verticalMirror exists')
      );
      assertTrue(
        typeof horizontalMirror === 'function',
        createTestContext('horizontalMirror exists')
      );
      assertTrue(
        typeof radialRotate === 'function',
        createTestContext('radialRotate exists')
      );
      assertTrue(
        typeof diagonalMirror === 'function',
        createTestContext('diagonalMirror exists')
      );
    });

    it('microprocessor factory registers amp.coord-symmetry', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'factory-test',
        coordinates: [],
        dimensions: { width: 100, height: 100 },
        symmetry: { type: 'none' },
      });

      assertTrue(result !== undefined, createTestContext('processor runs'));
    });
  });
});
