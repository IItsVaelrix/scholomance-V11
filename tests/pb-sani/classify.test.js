/**
 * PixelBrain QA — Classification Engine Tests
 *
 * Tests for:
 * - Inert class assignment
 * - Reachability assessment
 * - Strategic value estimation
 * - Module ID resolution
 * - Role inference
 */

import { describe, it, expect } from 'vitest';
import { classifySymbol } from '../../scripts/pb-sani/classify.js';

function makeSymbol(overrides = {}) {
  return {
    name: 'testFn',
    type: 'function',
    exported: true,
    calls: [],
    calledBy: [],
    importedBy: [],
    registeredIn: [],
    testedIn: [],
    configRefs: [],
    ...overrides,
  };
}

describe('PB-SANI Classification Engine', () => {
  describe('ORPHANED classification', () => {
    it('classifies exported symbols with no references as ORPHANED', () => {
      const symbol = makeSymbol({ name: 'orphanFn' });
      const result = classifySymbol(symbol, 'src/orphan.js');
      expect(result).not.toBeNull();
      expect(result.inertClass).toBe('ORPHANED');
    });

    it('classifies exported symbols with no imports or calls as ORPHANED', () => {
      const symbol = makeSymbol({
        name: 'unusedExport',
        importedBy: [],
        calledBy: [],
        registeredIn: [],
      });
      const result = classifySymbol(symbol, 'src/unused.js');
      expect(result.inertClass).toBe('ORPHANED');
    });
  });

  describe('BROKEN_CHAIN classification', () => {
    it('classifies imported-but-never-called functions as BROKEN_CHAIN', () => {
      const symbol = makeSymbol({
        name: 'importedNotCalled',
        type: 'function',
        importedBy: ['src/consumer.js'],
        calledBy: [],
        registeredIn: [],
      });
      const result = classifySymbol(symbol, 'src/broken.js');
      expect(result.inertClass).toBe('BROKEN_CHAIN');
    });

    it('does NOT classify constants as BROKEN_CHAIN (consumed by value)', () => {
      const symbol = makeSymbol({
        name: 'MY_CONST',
        type: 'const',
        importedBy: ['src/consumer.js'],
        calledBy: [],
        registeredIn: [],
      });
      const result = classifySymbol(symbol, 'src/constants.js');
      // Constants consumed by value should not be BROKEN_CHAIN
      if (result) {
        expect(result.inertClass).not.toBe('BROKEN_CHAIN');
      }
    });

    it('does NOT classify types as BROKEN_CHAIN', () => {
      const symbol = makeSymbol({
        name: 'MyType',
        type: 'type',
        importedBy: ['src/user.ts'],
        calledBy: [],
        registeredIn: [],
      });
      const result = classifySymbol(symbol, 'src/types.ts');
      if (result) {
        expect(result.inertClass).not.toBe('BROKEN_CHAIN');
      }
    });
  });

  describe('TEST_ONLY_RESIDUE classification', () => {
    it('classifies symbols only referenced by tests as TEST_ONLY_RESIDUE', () => {
      const symbol = makeSymbol({
        name: 'testOnlyFn',
        importedBy: [],
        calledBy: [],
        registeredIn: [],
        testedIn: ['tests/testOnlyFn.test.js'],
      });
      const result = classifySymbol(symbol, 'src/testOnly.js');
      expect(result.inertClass).toBe('TEST_ONLY_RESIDUE');
    });
  });

  describe('ORPHANED vs DECORATIVE_RESIDUE', () => {
    it('classifies exported-but-no-consumers as ORPHANED (checked first)', () => {
      const symbol = makeSymbol({
        name: 'decorativeExport',
        exported: true,
        importedBy: [],
        calledBy: [],
        registeredIn: [],
      });
      const result = classifySymbol(symbol, 'src/decorative.js');
      // ORPHANED is checked before DECORATIVE_RESIDUE — both apply but
      // ORPHANED wins the priority check since there are zero references.
      expect(result.inertClass).toBe('ORPHANED');
    });
  });

  describe('Active symbols are skipped', () => {
    it('returns null for symbols with callers', () => {
      const symbol = makeSymbol({
        name: 'activeFn',
        calledBy: ['src/caller.js'],
      });
      const result = classifySymbol(symbol, 'src/active.js');
      expect(result).toBeNull();
    });

    it('classifies imported-but-never-called functions as BROKEN_CHAIN', () => {
      const symbol = makeSymbol({
        name: 'importedNotCalled',
        importedBy: ['src/importer.js'],
      });
      const result = classifySymbol(symbol, 'src/imported.js');
      expect(result.inertClass).toBe('BROKEN_CHAIN');
    });

    it('returns null for symbols with registrations', () => {
      const symbol = makeSymbol({
        name: 'registeredFn',
        registeredIn: ['src/registry.js'],
      });
      const result = classifySymbol(symbol, 'src/registered.js');
      expect(result).toBeNull();
    });
  });

  describe('Strategic value assessment', () => {
    it('marks bytecode/error infrastructure as HIGH', () => {
      const symbol = makeSymbol({ name: 'encodeError' });
      const result = classifySymbol(symbol, 'codex/core/pixelbrain/bytecode-error.js');
      expect(result.strategicValue).toBe('HIGH');
    });

    it('marks combat/scoring as HIGH', () => {
      const symbol = makeSymbol({ name: 'computeScore' });
      const result = classifySymbol(symbol, 'codex/core/combat.scoring.js');
      expect(result.strategicValue).toBe('HIGH');
    });

    it('marks utility helpers as LOW', () => {
      const symbol = makeSymbol({ name: 'helperFn' });
      const result = classifySymbol(symbol, 'src/utils/helpers.js');
      expect(result.strategicValue).toBe('LOW');
    });
  });

  describe('Module ID resolution', () => {
    it('resolves PixelBrain module IDs', () => {
      const symbol = makeSymbol();
      const result = classifySymbol(symbol, 'codex/core/pixelbrain/shared.js');
      expect(result.moduleId).toBe('PIXELBRAIN');
    });

    it('resolves combat module IDs', () => {
      const symbol = makeSymbol();
      const result = classifySymbol(symbol, 'codex/core/combat.session.js');
      expect(result.moduleId).toBe('COMBAT');
    });

    it('resolves lexicon module IDs', () => {
      const symbol = makeSymbol();
      const result = classifySymbol(symbol, 'codex/services/adapters/lexicon.adapter.js');
      expect(result.moduleId).toBe('LEXICON');
    });

    it('resolves QA module IDs', () => {
      const symbol = makeSymbol();
      const result = classifySymbol(symbol, 'tests/qa/stasis.test.js');
      expect(result.moduleId).toBe('QA');
    });

    it('defaults to OTHER for unrecognized modules', () => {
      const symbol = makeSymbol();
      const result = classifySymbol(symbol, 'src/random/unknown.js');
      expect(result.moduleId).toBe('OTHER');
    });
  });

  describe('Role inference', () => {
    it('infers FORMULA_BRIDGE from name', () => {
      const symbol = makeSymbol({ name: 'bridgeFormulaToCoords' });
      const result = classifySymbol(symbol, 'src/formula.js');
      expect(result.role).toBe('FORMULA_BRIDGE');
    });

    it('infers SYMMETRY_TRANSFORM from name', () => {
      const symbol = makeSymbol({ name: 'canonicalizeSymmetry' });
      const result = classifySymbol(symbol, 'src/symmetry.js');
      expect(result.role).toBe('SYMMETRY_TRANSFORM');
    });

    it('infers ERROR_FACTORY from path', () => {
      const symbol = makeSymbol({ name: 'createError' });
      const result = classifySymbol(symbol, 'codex/core/pixelbrain/bytecode-error.js');
      expect(result.role).toBe('ERROR_FACTORY');
    });

    it('infers COMBAT_RESOLVER from path', () => {
      const symbol = makeSymbol({ name: 'resolveCombat' });
      const result = classifySymbol(symbol, 'codex/core/combat.session.js');
      expect(result.role).toBe('COMBAT_RESOLVER');
    });

    it('defaults to OTHER for unrecognized roles', () => {
      const symbol = makeSymbol({ name: 'weirdThing' });
      const result = classifySymbol(symbol, 'src/mystery.js');
      expect(result.role).toBe('OTHER');
    });
  });
});
