/**
 * QA Test: Bytecode Error System Integration
 * 
 * Demonstrates how to use bytecode errors in QA tests for AI-parsable results.
 */

import { describe, it, expect } from 'vitest';
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  ERROR_CODES,
  MODULE_IDS,
  createTypeMismatchError,
  createOutOfBoundsError,
  decodeBytecodeError,
  parseErrorForAI,
} from '../../codex/core/pixelbrain/bytecode-error.js';

import {
  QATestError,
  assertEqual,
  assertInRange,
  assertType,
  assertThrowsBytecode,
  assertCoordinateInBounds,
  assertValidHexColor,
  reportTestResult,
  aggregateTestResults,
  TEST_SEVERITY,
} from './tools/bytecode-assertions.js';

// Module ID constants (use string literals to avoid import issues)
const MOD = {
  IMGPIX: 'IMGPIX',
  COORD: 'COORD',
  SHARED: 'SHARED',
  EXTREG: 'EXTREG',
};

describe('Bytecode Error System - QA Integration', () => {
  describe('BytecodeError Class', () => {
    it('should create valid bytecode error', () => {
      const error = new BytecodeError(
        ERROR_CATEGORIES.TYPE,
        ERROR_SEVERITY.CRIT,
        MOD.IMGPIX,
        ERROR_CODES.TYPE_MISMATCH,
        { expectedType: 'string', actualType: 'number' }
      );

      // Verify bytecode format
      expect(error.bytecode).toMatch(/^PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-.+-[0-9A-F]{8}$/);
      
      // Verify AI metadata
      expect(error.aiMetadata.parseable).toBe(true);
      expect(error.aiMetadata.deterministic).toBe(true);
      expect(error.aiMetadata.checksumVerified).toBe(true);
    });

    it('should produce deterministic bytecode', () => {
      const error1 = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      const error2 = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      
      expect(error1.bytecode).toBe(error2.bytecode);
    });

    it('should include recovery hints', () => {
      const error = createOutOfBoundsError(MOD.COORD, 150, 0, 100, { param: 'x' });
      const hints = error.getRecoveryHints();
      
      expect(hints.category).toBe('RANGE');
      expect(hints.suggestions.length).toBeGreaterThan(0);
      expect(hints.invariants[0]).toContain('>=');
    });
  });

  describe('Bytecode Decoding', () => {
    it('should decode valid bytecode', () => {
      const error = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      const decoded = decodeBytecodeError(error.bytecode);
      
      expect(decoded.valid).toBe(true);
      expect(decoded.category).toBe('TYPE');
      expect(decoded.severity).toBe('CRIT');
      expect(decoded.moduleId).toBe('IMGPIX');
      expect(decoded.errorCode).toBe(1);
      expect(decoded.context.expectedType).toBe('string');
    });

    it('should detect checksum mismatch', () => {
      const error = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      const corruptedBytecode = error.bytecode.slice(0, -1) + '0'; // Corrupt checksum
      
      const decoded = decodeBytecodeError(corruptedBytecode);
      
      expect(decoded.valid).toBe(false);
      expect(decoded.error).toBe('CHECKSUM_MISMATCH');
    });

    it('should handle invalid bytecode format', () => {
      const decoded = decodeBytecodeError('NOT-A-VALID-BYTECODE');
      
      expect(decoded).toBe(null);
    });
  });

  describe('QA Assertions', () => {
    it('assertEqual should pass for equal values', () => {
      const result = assertEqual(5, 5, {
        testName: 'testEqual',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'QA Assertions',
      });
      
      expect(result.pass).toBe(true);
    });

    it('assertEqual should throw bytecode error for unequal values', () => {
      expect(() => {
        assertEqual(5, 10, {
          testName: 'testEqual',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'QA Assertions',
        });
      }).toThrow(QATestError);
    });

    it('assertType should validate types', () => {
      const result = assertType('hello', 'string', {
        testName: 'testType',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'QA Assertions',
      });
      
      expect(result.pass).toBe(true);
    });

    it('assertType should throw on type mismatch', () => {
      expect(() => {
        assertType(123, 'string', {
          testName: 'testType',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'QA Assertions',
        });
      }).toThrow(BytecodeError);
    });

    it('assertInRange should validate range', () => {
      const result = assertInRange(50, 0, 100, {
        testName: 'testRange',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'QA Assertions',
      });
      
      expect(result.pass).toBe(true);
    });

    it('assertInRange should throw on out of bounds', () => {
      expect(() => {
        assertInRange(150, 0, 100, {
          testName: 'testRange',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'QA Assertions',
        });
      }).toThrow(BytecodeError);
    });

    it('assertCoordinateInBounds should validate coordinates', () => {
      const result = assertCoordinateInBounds(
        { x: 100, y: 50 },
        { width: 160, height: 144 },
        {
          testName: 'testCoord',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'QA Assertions',
        }
      );
      
      expect(result.pass).toBe(true);
    });

    it('assertValidHexColor should validate hex colors', () => {
      const result = assertValidHexColor('#FF5733', {
        testName: 'testColor',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'QA Assertions',
      });
      
      expect(result.pass).toBe(true);
    });

    it('assertValidHexColor should reject invalid hex', () => {
      expect(() => {
        assertValidHexColor('#GGGGGG', {
          testName: 'testColor',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'QA Assertions',
        });
      }).toThrow(BytecodeError);
    });
  });

  describe('assertThrowsBytecode', () => {
    it('should verify function throws expected bytecode error', () => {
      const result = assertThrowsBytecode(
        () => {
          throw createTypeMismatchError(MOD.IMGPIX, 'string', 'number', {});
        },
        ERROR_CATEGORIES.TYPE,
        ERROR_CODES.TYPE_MISMATCH,
        {
          testName: 'testThrows',
          testFile: 'bytecode-qa.test.js',
          testSuite: 'assertThrowsBytecode',
        }
      );

      expect(result.pass).toBe(true);
      expect(result.error.category).toBe('TYPE');
    });

    it('should fail when wrong error category', () => {
      expect(() => {
        assertThrowsBytecode(
          () => {
            throw createTypeMismatchError(MODULE_IDS.IMGPIX, 'string', 'number', {});
          },
          ERROR_CATEGORIES.RANGE, // Wrong category
          ERROR_CODES.TYPE_MISMATCH,
          {
            testName: 'testThrows',
            testFile: 'bytecode-qa.test.js',
            testSuite: 'assertThrowsBytecode',
          }
        );
      }).toThrow(QATestError);
    });
  });

  describe('Test Result Reporting', () => {
    it('should report passing test', () => {
      const result = reportTestResult({
        testName: 'testPass',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'Reporting',
        duration: 100,
        status: TEST_SEVERITY.PASS,
        assertions: [{ pass: true }, { pass: true }],
      });

      expect(result.status).toBe(TEST_SEVERITY.PASS);
      expect(result.bytecode).toBe(null);
      expect(result.aiMetadata.parseable).toBe(false);
    });

    it('should report failing test as bytecode', () => {
      const result = reportTestResult({
        testName: 'testFail',
        testFile: 'bytecode-qa.test.js',
        testSuite: 'Reporting',
        duration: 150,
        status: TEST_SEVERITY.FAIL,
        assertions: [{ pass: true }, { pass: false, reason: 'Expected 5 to equal 10' }],
      });

      expect(result.status).toBe(TEST_SEVERITY.FAIL);
      expect(result.bytecode).toMatch(/^PB-ERR-v1-.+-[0-9A-F]{8}$/);
      expect(result.aiMetadata.parseable).toBe(true);
      expect(result.aiMetadata.checksumVerified).toBe(true);
    });

    it('should aggregate multiple test results', () => {
      const testResults = [
        { testName: 'test1', testFile: 'a.test.js', testSuite: 'Suite', duration: 50, status: TEST_SEVERITY.PASS, assertions: [] },
        { testName: 'test2', testFile: 'a.test.js', testSuite: 'Suite', duration: 75, status: TEST_SEVERITY.PASS, assertions: [] },
        { testName: 'test3', testFile: 'a.test.js', testSuite: 'Suite', duration: 100, status: TEST_SEVERITY.FAIL, assertions: [] },
      ];

      const summary = aggregateTestResults(testResults);

      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.passRate).toBeCloseTo(0.667, 2);
      expect(summary.bytecode).toMatch(/^PB-ERR-v1-.+-[0-9A-F]{8}$/);
    });
  });

  describe('parseErrorForAI', () => {
    it('should parse BytecodeError', () => {
      const error = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      const result = parseErrorForAI(error);

      expect(result.aiMetadata.parseable).toBe(true);
      expect(result.category).toBe('TYPE');
      expect(result.recoveryHints).toBeDefined();
      expect(result.recoveryHints.suggestions.length).toBeGreaterThan(0);
    });

    it('should parse bytecode string', () => {
      const error = createTypeMismatchError(MOD.IMGPIX, 'string', 'number', { p: 'x' });
      const result = parseErrorForAI(error.bytecode);

      expect(result.aiMetadata.parseable).toBe(true);
      expect(result.category).toBe('TYPE');
    });

    it('should handle standard Error', () => {
      const error = new Error('Standard error message');
      const result = parseErrorForAI(error);

      expect(result.aiMetadata.parseable).toBe(false);
      expect(result.error).toBe('STANDARD_ERROR');
      expect(result.type).toBe('Error');
    });

    it('should handle null input', () => {
      const result = parseErrorForAI(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('NULL_INPUT');
    });
  });

  describe('Integration: PixelBrain Extension Registry', () => {
    it('should throw bytecode error for invalid extension type', async () => {
      const { createExtensionRegistry } = await import('../../codex/core/pixelbrain/extension-registry.js');
      const registry = createExtensionRegistry();

      expect(() => {
        registry.register({
          id: 'test-ext',
          type: 'INVALID_TYPE', // Not in allowed types
          hooks: {},
        });
      }).toThrow(BytecodeError);
    });

    it('should throw bytecode error for missing extension ID', async () => {
      const { createExtensionRegistry } = await import('../../codex/core/pixelbrain/extension-registry.js');
      const registry = createExtensionRegistry();

      expect(() => {
        registry.register({
          id: '', // Empty ID
          type: 'PHYSICS',
          hooks: {},
        });
      }).toThrow(BytecodeError);
    });

    it('should throw bytecode error for duplicate registration', async () => {
      const { createExtensionRegistry } = await import('../../codex/core/pixelbrain/extension-registry.js');
      const registry = createExtensionRegistry();

      const ext = {
        id: 'duplicate-ext',
        type: 'PHYSICS',
        hooks: {},
      };

      registry.register(ext);

      expect(() => {
        registry.register(ext);
      }).toThrow(BytecodeError);
    });
  });
});
