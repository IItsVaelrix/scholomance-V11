/**
 * PixelBrain QA — PB-SANI-v1 Fingerprinting Tests
 *
 * Tests for:
 * - Deterministic fingerprint generation
 * - Checksum verification
 * - Encoding/decoding round-trips
 * - Schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  hashFingerprint,
  encodeFingerprint,
  parseFingerprint,
  SANI_PREFIX,
  SANI_SCHEMA_VERSION,
  INERT_CLASSES,
  SEVERITIES,
  ROLES,
  REACHABILITY,
  STRATEGIC_VALUES,
} from '../../scripts/pb-sani/fingerprint.js';

describe('PB-SANI-v1 Fingerprint Schema', () => {
  describe('hashFingerprint', () => {
    it('produces deterministic hashes for identical inputs', () => {
      const input = {
        inertClass: 'ORPHANED',
        moduleId: 'TEST',
        role: 'UTIL_HELPER',
        reachability: 'NONE',
        strategicValue: 'LOW',
      };
      const hash1 = hashFingerprint(input);
      const hash2 = hashFingerprint(input);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const a = hashFingerprint({
        inertClass: 'ORPHANED',
        moduleId: 'A',
        role: 'UTIL_HELPER',
        reachability: 'NONE',
        strategicValue: 'LOW',
      });
      const b = hashFingerprint({
        inertClass: 'ORPHANED',
        moduleId: 'B',
        role: 'UTIL_HELPER',
        reachability: 'NONE',
        strategicValue: 'LOW',
      });
      expect(a).not.toBe(b);
    });

    it('produces 8-character uppercase hex strings', () => {
      const hash = hashFingerprint({
        inertClass: 'ORPHANED',
        moduleId: 'M',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'LOW',
      });
      expect(hash).toMatch(/^[A-F0-9]{8}$/);
    });
  });

  describe('encodeFingerprint', () => {
    it('produces valid bytecode string', () => {
      const fp = encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'UTIL_HELPER',
        reachability: 'NONE',
        strategicValue: 'LOW',
        path: 'src/test.js',
        symbolName: 'testFn',
      });

      expect(fp).toMatch(/^PB-SANI-v1-/);
      const parts = fp.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(10);
    });

    it('includes all required segments', () => {
      const fp = encodeFingerprint({
        inertClass: 'DORMANT',
        severity: 'INFO',
        moduleId: 'COORDSYM',
        role: 'SYMMETRY_TRANSFORM',
        reachability: 'NONE',
        strategicValue: 'MEDIUM',
        path: 'src/sym.js',
        symbolName: 'symFn',
      });

      const parts = fp.split('-');
      expect(parts[0]).toBe('PB');
      expect(parts[1]).toBe('SANI');
      expect(parts[2]).toBe('v1');
      expect(parts[3]).toBe('DORMANT');
      expect(parts[4]).toBe('INFO');
      expect(parts[5]).toBe('COORDSYM');
      expect(parts[6]).toBe('SYMMETRY_TRANSFORM');
      expect(parts[7]).toBe('NONE');
      expect(parts[8]).toBe('MEDIUM');
    });

    it('throws on invalid inert class', () => {
      expect(() => encodeFingerprint({
        inertClass: 'INVALID',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'LOW',
        path: 'x',
        symbolName: 'y',
      })).toThrow('invalid inert class');
    });

    it('throws on invalid severity', () => {
      expect(() => encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'FATAL',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'LOW',
        path: 'x',
        symbolName: 'y',
      })).toThrow('invalid severity');
    });

    it('throws on invalid role', () => {
      expect(() => encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'INVALID_ROLE',
        reachability: 'NONE',
        strategicValue: 'LOW',
        path: 'x',
        symbolName: 'y',
      })).toThrow('invalid role');
    });

    it('throws on invalid reachability', () => {
      expect(() => encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'EVERYWHERE',
        strategicValue: 'LOW',
        path: 'x',
        symbolName: 'y',
      })).toThrow('invalid reachability');
    });

    it('throws on invalid strategic value', () => {
      expect(() => encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'MAXIMUM',
        path: 'x',
        symbolName: 'y',
      })).toThrow('invalid strategic value');
    });
  });

  describe('parseFingerprint', () => {
    it('round-trips encode/decode', () => {
      const encoded = encodeFingerprint({
        inertClass: 'BROKEN_CHAIN',
        severity: 'CRIT',
        moduleId: 'IMGFOR',
        role: 'FORMULA_BRIDGE',
        reachability: 'PARTIAL',
        strategicValue: 'HIGH',
        path: 'src/bridge.js',
        symbolName: 'bridgeFn',
      });

      const parsed = parseFingerprint(encoded);
      expect(parsed.valid).toBe(true);
      expect(parsed.inertClass).toBe('BROKEN_CHAIN');
      expect(parsed.severity).toBe('CRIT');
      expect(parsed.moduleId).toBe('IMGFOR');
      expect(parsed.role).toBe('FORMULA_BRIDGE');
      expect(parsed.reachability).toBe('PARTIAL');
      expect(parsed.strategicValue).toBe('HIGH');
    });

    it('verifies checksum on valid fingerprints', () => {
      const fp = encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'LOW',
        path: 'x',
        symbolName: 'y',
      });
      const parsed = parseFingerprint(fp);
      expect(parsed.checksumVerified).toBe(true);
    });

    it('detects malformed fingerprints', () => {
      const parsed = parseFingerprint('not-a-fingerprint');
      expect(parsed.valid).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('rejects non-PB-SANI strings', () => {
      const parsed = parseFingerprint('PB-ERR-v1-TYPE-WARN-TEST-0000-ABC');
      expect(parsed.valid).toBe(false);
    });

    it('detects tampered checksums', () => {
      const fp = encodeFingerprint({
        inertClass: 'ORPHANED',
        severity: 'WARN',
        moduleId: 'TEST',
        role: 'OTHER',
        reachability: 'NONE',
        strategicValue: 'LOW',
      });
      // Tamper the hash (last segment)
      const tampered = fp.replace(/[A-F0-9]$/, '0');
      const parsed = parseFingerprint(tampered);
      expect(parsed.valid).toBe(true);
      expect(parsed.checksumVerified).toBe(false);
    });
  });

  describe('constants', () => {
    it('has all 8 inert classes', () => {
      expect(INERT_CLASSES).toHaveLength(8);
      expect(INERT_CLASSES).toContain('ORPHANED');
      expect(INERT_CLASSES).toContain('SHADOWED');
      expect(INERT_CLASSES).toContain('DORMANT');
      expect(INERT_CLASSES).toContain('BROKEN_CHAIN');
      expect(INERT_CLASSES).toContain('DECORATIVE_RESIDUE');
      expect(INERT_CLASSES).toContain('TEST_ONLY_RESIDUE');
      expect(INERT_CLASSES).toContain('MIGRATION_RELIC');
      expect(INERT_CLASSES).toContain('CONFIG_GHOST');
    });

    it('has 3 severity levels', () => {
      expect(SEVERITIES).toEqual(['INFO', 'WARN', 'CRIT']);
    });

    it('has 4 reachability levels', () => {
      expect(REACHABILITY).toHaveLength(4);
      expect(REACHABILITY).toContain('NONE');
      expect(REACHABILITY).toContain('PARTIAL');
      expect(REACHABILITY).toContain('TEST_ONLY');
      expect(REACHABILITY).toContain('OPTIONAL');
    });

    it('has 3 strategic value levels', () => {
      expect(STRATEGIC_VALUES).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    });

    it('has comprehensive role vocabulary', () => {
      expect(ROLES.length).toBeGreaterThanOrEqual(30);
      expect(ROLES).toContain('FORMULA_BRIDGE');
      expect(ROLES).toContain('SYMMETRY_TRANSFORM');
      expect(ROLES).toContain('COMBAT_RESOLVER');
      expect(ROLES).toContain('QA_ASSERTION');
      expect(ROLES).toContain('ERROR_FACTORY');
    });
  });
});
