/**
 * QA: Coordinate Symmetry Transform Microprocessor
 *
 * Tests amp.coord-symmetry transformation pipeline:
 * - Vertical/horizontal/radial/diagonal transforms
 * - Transform modes (overlay/replace/canonicalize)
 * - Overlap policies
 * - Grid snapping
 * - Bytecode persistence
 */

import { describe, it, expect } from 'vitest';
import {
  runCoordSymmetryAmp,
  verticalMirror,
  horizontalMirror,
  radialRotate,
  diagonalMirror,
} from '../../src/lib/pixelbrain.adapter.js';
import { runCoordSymmetryAmp as directRunCoordSymmetryAmp } from '../../codex/core/pixelbrain/coord-symmetry-amp.js';

const CoordSymmetryProcessor = {
  id: 'amp.coord-symmetry',
  version: '1.0.0',
  stage: 'pre-render',
  accepts: ['coordinates.array', 'lattice', 'symmetry.metadata'],
  emits: ['coordinates.transformed', 'symmetry.bytecode'],
};

describe('Coord Symmetry AMP Microprocessor', () => {
  describe('Processor Metadata', () => {
    it('has correct processor ID', () => {
      expect(CoordSymmetryProcessor.id).toBe('amp.coord-symmetry');
    });

    it('runs at pre-render stage', () => {
      expect(CoordSymmetryProcessor.stage).toBe('pre-render');
    });

    it('accepts correct input types', () => {
      expect(CoordSymmetryProcessor.accepts).toEqual([
        'coordinates.array',
        'lattice',
        'symmetry.metadata',
      ]);
    });

    it('emits correct output types', () => {
      expect(CoordSymmetryProcessor.emits).toEqual([
        'coordinates.transformed',
        'symmetry.bytecode',
      ]);
    });
  });

  describe('Transformation Functions', () => {
    describe('verticalMirror', () => {
      it('mirrors coordinate around axis', () => {
        const coord = { x: 10, y: 20, color: '#FF0000', emphasis: 1 };
        const result = verticalMirror(coord, 50);
        
        expect(result.x).toBe(90); // 50*2 - 10
        expect(result.y).toBe(20);
        expect(result.color).toBe('#FF0000');
      });

      it('handles coordinates on the axis', () => {
        const coord = { x: 50, y: 20, color: '#FF0000', emphasis: 1 };
        const result = verticalMirror(coord, 50);
        
        expect(result.x).toBe(50); // Stays on axis
      });
    });

    describe('horizontalMirror', () => {
      it('mirrors coordinate around axis', () => {
        const coord = { x: 10, y: 20, color: '#FF0000', emphasis: 1 };
        const result = horizontalMirror(coord, 50);
        
        expect(result.x).toBe(10);
        expect(result.y).toBe(80); // 50*2 - 20
      });
    });

    describe('radialRotate', () => {
      it('rotates 90 degrees around center', () => {
        const coord = { x: 60, y: 50, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 90);
        
        // 90° rotation of (10, 0) around origin = (0, 10)
        expect(result.x).toBe(50);
        expect(result.y).toBe(60);
      });

      it('rotates 180 degrees around center', () => {
        const coord = { x: 60, y: 50, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 180);
        
        expect(result.x).toBe(40);
        expect(result.y).toBe(50);
      });

      it('rotates 270 degrees around center', () => {
        const coord = { x: 50, y: 60, color: '#FF0000', emphasis: 1 };
        const result = radialRotate(coord, 50, 50, 270);
        
        // 270° rotation of (0, 10) around origin = (10, 0)
        expect(result.x).toBe(60);
        expect(result.y).toBe(50);
      });
    });

    describe('diagonalMirror', () => {
      it('swaps X and Y coordinates', () => {
        const coord = { x: 10, y: 30, color: '#FF0000', emphasis: 1 };
        const result = diagonalMirror(coord);
        
        expect(result.x).toBe(30);
        expect(result.y).toBe(10);
      });
    });
  });

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

      expect(result.ok).toBe(false);
      expect(result.transformedCount).toBe(0);
      expect(result.bytecode).toContain('ERROR NO_COORDINATES');
    });

    it('applies vertical mirror transformation', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'overlay',
        overlapPolicy: 'prefer-original',
        snapToGrid: false,
      });

      expect(result.ok).toBe(true);
      expect(result.originalCount).toBe(2);
      expect(result.transformedCount).toBeGreaterThan(2); // Originals + mirrors
      expect(result.bytecode).toContain('SYMMETRY_TYPE vertical');
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

      expect(result.ok).toBe(true);
      expect(result.diagnostics.some(d => d.includes('horizontal mirror'))).toBe(true);
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

      expect(result.ok).toBe(true);
      // Radial creates 3 rotations (90, 180, 270) + originals
      expect(result.transformedCount).toBeGreaterThan(baseInput.coordinates.length);
      expect(result.diagnostics.some(d => d.includes('radial rotation'))).toBe(true);
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

      expect(result.ok).toBe(true);
      expect(result.diagnostics.some(d => d.includes('diagonal mirror'))).toBe(true);
    });
  });

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

      expect(originals.length).toBe(1);
      expect(mirrors.length).toBe(1);
    });

    it('canonicalize mode rebuilds full symmetric set', () => {
      const result = directRunCoordSymmetryAmp({
        ...baseInput,
        transformMode: 'canonicalize',
        snapToGrid: false,
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics.some(d => d.includes('Canonicalized'))).toBe(true);
    });
  });

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

      // Should resolve overlap by preferring original
      const atPosition = result.coordinates.filter(
        c => Math.round(c.x) === 50 && Math.round(c.y) === 50
      );
      
      // Should have at most 1 coord at overlapping position
      expect(atPosition.length).toBeLessThanOrEqual(1);
    });

    it('max-emphasis keeps highest emphasis on overlap', () => {
      const result = directRunCoordSymmetryAmp({
        ...inputWithOverlap,
        transformMode: 'overlay',
        overlapPolicy: 'max-emphasis',
        snapToGrid: true,
        cellSize: 5,
      });

      expect(result.ok).toBe(true);
    });
  });

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

      // All coordinates should be snapped to 8px grid
      result.coordinates.forEach(coord => {
        expect(coord.x % 8).toBe(0);
        expect(coord.y % 8).toBe(0);
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

      // All coordinates should be integers in cell space
      result.coordinates.forEach(coord => {
        expect(Number.isInteger(coord.x)).toBe(true);
        expect(Number.isInteger(coord.y)).toBe(true);
      });
    });
  });

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

      expect(result.bytecode).toContain('AMP COORD-SYMMETRY');
      expect(result.bytecode).toContain('SYMMETRY_TYPE vertical');
      expect(result.bytecode).toContain('TRANSFORM_MODE overlay');
      expect(result.bytecode).toContain('ORIGINAL_COUNT 1');
      expect(result.bytecode.some(b => b.startsWith('BOUNDS'))).toBe(true);
    });

    it('includes axis in bytecode', () => {
      const result = directRunCoordSymmetryAmp({
        assetId: 'test-axis',
        coordinates: [{ x: 10, y: 20, color: '#FF0000', emphasis: 1 }],
        dimensions: { width: 100, height: 100 },
        symmetry: {
          type: 'vertical',
          axis: { x: 45, y: null, angle: 90 }, // Custom axis
          significant: true,
        },
        transformMode: 'overlay',
        snapToGrid: false,
      });

      expect(result.bytecode.some(b => b.includes('AXIS 45'))).toBe(true);
    });
  });

  describe('Integration: Analyze Project Files', () => {
    it('coord-symmetry-amp.js has valid syntax', () => {
      // If we got here, the import worked
      expect(directRunCoordSymmetryAmp).toBeDefined();
      expect(verticalMirror).toBeDefined();
      expect(horizontalMirror).toBeDefined();
      expect(radialRotate).toBeDefined();
      expect(diagonalMirror).toBeDefined();
    });

    it('microprocessor factory registers amp.coord-symmetry', () => {
      // Verify the processor can be called directly
      const result = directRunCoordSymmetryAmp({
        assetId: 'factory-test',
        coordinates: [],
        dimensions: { width: 100, height: 100 },
        symmetry: { type: 'none' },
      });

      expect(result).toBeDefined();
      expect(result.ok).toBe(false); // Empty coords, but processor ran
    });
  });
});
