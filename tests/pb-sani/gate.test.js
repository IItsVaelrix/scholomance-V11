/**
 * PixelBrain QA — Deletion Gate Tests
 *
 * Tests for:
 * - Deletion safety rules
 * - Archive allowances
 * - Gate escalation (DELETE → REVIEW when blocked)
 */

import { describe, it, expect } from 'vitest';
import { canDelete, canArchive, gateDecision, DELETION_GATE_RULES } from '../../scripts/pb-sani/gate.js';

function makeRecord(overrides = {}) {
  return {
    fingerprint: 'PB-SANI-v1-ORPHANED-WARN-TEST-OTHER-NONE-LOW-ABC12345',
    path: 'src/test.js',
    symbolName: 'testFn',
    symbolType: 'function',
    inertClass: 'ORPHANED',
    severity: 'WARN',
    moduleId: 'TEST',
    intendedRole: 'OTHER',
    reachability: 'NONE',
    strategicValue: 'LOW',
    evidence: {
      importsIn: [],
      callsIn: [],
      referencedByConfig: [],
      referencedByTests: [],
      registeredInRuntime: [],
      exported: true,
    },
    inferredPurpose: 'Test function',
    whyFlagged: ['No active execution path detected'],
    archiveRecommendation: false,
    deleteRecommendation: true,
    confidence: 0.8,
    aiSummary: {
      whatItWasSupposedToDo: 'Test function',
      isStillValuable: 'Unlikely',
      recommendation: 'DELETE',
      rationale: ['No active execution path detected'],
    },
    checksum: 'ABC12345',
    ...overrides,
  };
}

describe('PB-SANI Deletion Gate', () => {
  describe('canDelete', () => {
    it('allows deletion of clean orphans with low value', () => {
      const record = makeRecord();
      const result = canDelete(record);
      expect(result.allowed).toBe(true);
    });

    it('blocks deletion when symbol has import references', () => {
      const record = makeRecord({
        evidence: {
          importsIn: ['src/consumer.js'],
          callsIn: [],
          referencedByConfig: [],
          referencedByTests: [],
          registeredInRuntime: [],
          exported: true,
        },
      });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
      expect(result.reasons.some(r => r.includes('import'))).toBe(true);
    });

    it('blocks deletion when symbol has call references', () => {
      const record = makeRecord({
        evidence: {
          importsIn: [],
          callsIn: ['src/caller.js'],
          referencedByConfig: [],
          referencedByTests: [],
          registeredInRuntime: [],
          exported: true,
        },
      });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
    });

    it('blocks deletion for high strategic value', () => {
      const record = makeRecord({ strategicValue: 'HIGH' });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
      expect(result.reasons.some(r => r.includes('strategic'))).toBe(true);
    });

    it('blocks deletion for test-only residue', () => {
      const record = makeRecord({ inertClass: 'TEST_ONLY_RESIDUE' });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
    });

    it('blocks deletion when confidence is too low', () => {
      const record = makeRecord({ confidence: 0.3 });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
    });

    it('blocks deletion for dormant with medium value', () => {
      const record = makeRecord({
        inertClass: 'DORMANT',
        strategicValue: 'MEDIUM',
      });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
    });

    it('blocks deletion for broken chain with non-low value', () => {
      const record = makeRecord({
        inertClass: 'BROKEN_CHAIN',
        strategicValue: 'MEDIUM',
      });
      const result = canDelete(record);
      expect(result.allowed).toBe(false);
    });
  });

  describe('canArchive', () => {
    it('always allows archiving', () => {
      const record = makeRecord();
      const result = canArchive(record);
      expect(result.allowed).toBe(true);
    });

    it('warns when archiving potentially active symbols', () => {
      const record = makeRecord({
        evidence: {
          importsIn: [],
          callsIn: ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js', 'src/e.js', 'src/f.js'],
          referencedByConfig: [],
          referencedByTests: [],
          registeredInRuntime: [],
          exported: true,
        },
      });
      const result = canArchive(record);
      expect(result.allowed).toBe(true);
      expect(result.advisory).not.toBeNull();
    });
  });

  describe('gateDecision', () => {
    it('returns DELETE for clean low-value orphans', () => {
      const record = makeRecord();
      const result = gateDecision(record);
      expect(result.action).toBe('DELETE');
    });

    it('returns REVIEW when deletion gate is blocked', () => {
      const record = makeRecord({
        evidence: {
          importsIn: ['src/consumer.js'],
          callsIn: [],
          referencedByConfig: [],
          referencedByTests: [],
          registeredInRuntime: [],
          exported: true,
        },
        strategicValue: 'HIGH',
      });
      const result = gateDecision(record);
      expect(result.action).toBe('REVIEW');
    });

    it('returns ARCHIVE for medium-value orphans', () => {
      const record = makeRecord({
        inertClass: 'DORMANT',
        strategicValue: 'MEDIUM',
        aiSummary: { ...makeRecord().aiSummary, recommendation: 'ARCHIVE' },
      });
      const result = gateDecision(record);
      expect(result.action).toBe('ARCHIVE');
    });

    it('returns KEEP for active symbols', () => {
      const record = makeRecord({
        aiSummary: { ...makeRecord().aiSummary, recommendation: 'KEEP' },
      });
      const result = gateDecision(record);
      expect(result.action).toBe('KEEP');
    });
  });
});
