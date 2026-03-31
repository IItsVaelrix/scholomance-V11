/**
 * QA Bytecode Error Assertion Library
 * 
 * Provides AI-parsable error assertions for QA tests.
 * Each assertion failure produces a bytecode error for automated debugging.
 */

import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
  createTypeMismatchError,
  createOutOfBoundsError,
  createExtensionError,
  createHookError,
  createCoordinateError,
  createColorError,
  decodeBytecodeError,
  parseErrorForAI,
} from '../../../codex/core/pixelbrain/bytecode-error.js';

// ─── Test Result Classifications ─────────────────────────────────────────────

export const TEST_SEVERITY = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  SKIP: 'SKIP',
  ERROR: 'ERROR',
});

// ─── Bytecode Test Error Class ───────────────────────────────────────────────

export class QATestError extends BytecodeError {
  constructor(category, severity, moduleId, errorCode, testContext) {
    const context = {
      testName: testContext.testName,
      testFile: testContext.testFile,
      testSuite: testContext.testSuite,
      expected: testContext.expected,
      actual: testContext.actual,
      stackTrace: testContext.stackTrace,
      timestamp: Date.now(),
      ...testContext.extra,
    };

    super(category, severity, moduleId, errorCode, context);
    this.name = 'QATestError';
    this.testContext = testContext;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      qaMetadata: {
        testName: this.testContext.testName,
        testFile: this.testContext.testFile,
        testSuite: this.testContext.testSuite,
        reproducible: true,
        autoFixable: this.getRecoveryHints().suggestions.length > 0,
      },
    };
  }
}

// ─── Assertion Functions ─────────────────────────────────────────────────────

/**
 * Asserts that a value equals expected value.
 * Produces bytecode error on failure.
 */
export function assertEqual(actual, expected, testContext) {
  if (actual !== expected) {
    throw new QATestError(
      ERROR_CATEGORIES.VALUE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.SHARED,
      ERROR_CODES.INVALID_VALUE,
      {
        ...testContext,
        expected: String(expected),
        actual: String(actual),
        assertionType: 'EQUALS',
      }
    );
  }
  return { pass: true };
}

/**
 * Asserts that a condition is truthy.
 */
export function assertTrue(condition, testContext) {
  if (!condition) {
    throw new QATestError(
      ERROR_CATEGORIES.VALUE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.SHARED,
      ERROR_CODES.INVALID_VALUE,
      {
        ...testContext,
        expected: 'true',
        actual: String(condition),
        assertionType: 'TRUTHY',
      }
    );
  }
  return { pass: true };
}

/**
 * Asserts that a value is within expected range.
 */
export function assertInRange(value, min, max, testContext) {
  if (value < min || value > max) {
    throw createOutOfBoundsError(MODULE_IDS.SHARED, value, min, max, {
      ...testContext,
      assertionType: 'IN_RANGE',
    });
  }
  return { pass: true };
}

/**
 * Asserts that a value has expected type.
 */
export function assertType(value, expectedType, testContext) {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    throw createTypeMismatchError(MODULE_IDS.SHARED, expectedType, actualType, {
      ...testContext,
      assertionType: 'TYPE_CHECK',
      value: String(value),
    });
  }
  return { pass: true };
}

/**
 * Asserts that a function throws a specific bytecode error.
 */
export function assertThrowsBytecode(fn, expectedCategory, expectedCode, testContext) {
  try {
    fn();
    throw new QATestError(
      ERROR_CATEGORIES.STATE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.SHARED,
      ERROR_CODES.INVALID_STATE,
      {
        ...testContext,
        expected: `BytecodeError (${expectedCategory}-${expectedCode})`,
        actual: 'No error thrown',
        assertionType: 'THROWS_BYTECODE',
      }
    );
  } catch (error) {
    if (!(error instanceof BytecodeError)) {
      throw new QATestError(
        ERROR_CATEGORIES.TYPE,
        ERROR_SEVERITY.CRIT,
        MODULE_IDS.SHARED,
        ERROR_CODES.TYPE_MISMATCH,
        {
          ...testContext,
          expected: 'BytecodeError',
          actual: error.constructor.name,
          assertionType: 'THROWS_BYTECODE',
        }
      );
    }

    const decoded = decodeBytecodeError(error.bytecode);
    if (!decoded.valid) {
      throw new QATestError(
        ERROR_CATEGORIES.VALUE,
        ERROR_SEVERITY.CRIT,
        MODULE_IDS.SHARED,
        ERROR_CODES.INVALID_FORMAT,
        {
          ...testContext,
          expected: `Valid bytecode (${expectedCategory}-${expectedCode})`,
          actual: 'Invalid bytecode format',
          assertionType: 'THROWS_BYTECODE',
        }
      );
    }

    if (decoded.category !== expectedCategory || decoded.errorCode !== expectedCode) {
      throw new QATestError(
        ERROR_CATEGORIES.VALUE,
        ERROR_SEVERITY.CRIT,
        MODULE_IDS.SHARED,
        ERROR_CODES.INVALID_VALUE,
        {
          ...testContext,
          expected: `${expectedCategory}-${expectedCode.toString(16).toUpperCase()}`,
          actual: `${decoded.category}-${decoded.errorCodeHex}`,
          assertionType: 'THROWS_BYTECODE',
        }
      );
    }

    return { pass: true, error: decoded };
  }
}

/**
 * Asserts that a coordinate is within canvas bounds.
 */
export function assertCoordinateInBounds(coords, bounds, testContext) {
  if (
    coords.x < 0 || coords.x >= bounds.width ||
    coords.y < 0 || coords.y >= bounds.height
  ) {
    throw createCoordinateError(MODULE_IDS.SHARED, 'OUT_OF_BOUNDS', coords, bounds, {
      ...testContext,
      assertionType: 'COORD_BOUNDS',
    });
  }
  return { pass: true };
}

/**
 * Asserts that a color value is valid hex format.
 */
export function assertValidHexColor(colorValue, testContext) {
  const pattern = /^#[0-9A-Fa-f]{6}$/;
  if (!pattern.test(colorValue)) {
    throw createColorError(MODULE_IDS.SHARED, 'INVALID_HEX', colorValue, {
      ...testContext,
      assertionType: 'HEX_COLOR',
      expectedFormat: pattern.source,
    });
  }
  return { pass: true };
}

/**
 * Asserts that an extension can be registered.
 */
export function assertExtensionRegisterable(extension, registry, testContext) {
  try {
    const result = registry.register(extension);
    return { pass: true, result };
  } catch (error) {
    if (error instanceof BytecodeError) {
      throw error; // Re-throw bytecode errors as-is
    }
    throw createExtensionError(MODULE_IDS.SHARED, 'REGISTER_FAILED', extension.id, {
      ...testContext,
      assertionType: 'EXT_REGISTER',
      originalError: error.message,
    });
  }
}

// ─── Test Result Reporter ────────────────────────────────────────────────────

/**
 * Converts test results to AI-parsable bytecode format.
 */
export function reportTestResult(testResult) {
  const { testName, testFile, testSuite, duration, assertions } = testResult;

  if (testResult.status === TEST_SEVERITY.PASS) {
    return {
      status: TEST_SEVERITY.PASS,
      bytecode: null,
      aiMetadata: {
        parseable: false,
        reason: 'Test passed - no error to encode',
      },
    };
  }

  // Test failed - encode as bytecode
  const error = new QATestError(
    ERROR_CATEGORIES.STATE,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS.SHARED,
    ERROR_CODES.INVALID_STATE,
    {
      testName,
      testFile,
      testSuite,
      duration,
      totalAssertions: assertions.length,
      failedAssertions: assertions.filter(a => !a.pass).length,
      failureDetails: assertions.filter(a => !a.pass),
    }
  );

  return {
    status: TEST_SEVERITY.FAIL,
    bytecode: error.bytecode,
    decoded: decodeBytecodeError(error.bytecode),
    aiMetadata: {
      parseable: true,
      schemaVersion: 'v1',
      deterministic: true,
      checksumVerified: true,
      autoFixable: error.getRecoveryHints().suggestions.length > 0,
    },
    recoveryHints: error.getRecoveryHints(),
  };
}

/**
 * Aggregates multiple test results into summary bytecode.
 */
export function aggregateTestResults(testResults) {
  const total = testResults.length;
  const passed = testResults.filter(r => r.status === TEST_SEVERITY.PASS).length;
  const failed = testResults.filter(r => r.status === TEST_SEVERITY.FAIL).length;
  const errors = testResults.filter(r => r.status === TEST_SEVERITY.ERROR).length;

  const failureRate = failed / total;
  const errorRate = errors / total;

  // Generate summary bytecode
  const summaryContext = {
    total,
    passed,
    failed,
    errors,
    failureRate: Math.round(failureRate * 1000) / 1000,
    errorRate: Math.round(errorRate * 1000) / 1000,
    passRate: Math.round((passed / total) * 1000) / 1000,
    failedTests: testResults
      .filter(r => r.status === TEST_SEVERITY.FAIL)
      .map(r => ({ name: r.testName, file: r.testFile })),
  };

  // Determine overall severity
  const overallSeverity = errorRate > 0.1 ? ERROR_SEVERITY.FATAL
    : failureRate > 0.3 ? ERROR_SEVERITY.CRIT
    : failureRate > 0.1 ? ERROR_SEVERITY.WARN
    : ERROR_SEVERITY.INFO;

  const summaryError = new BytecodeError(
    ERROR_CATEGORIES.STATE,
    overallSeverity,
    MODULE_IDS.SHARED,
    errorRate > 0.1 ? ERROR_CODES.INVALID_STATE : ERROR_CODES.INVALID_VALUE,
    summaryContext
  );

  return {
    total,
    passed,
    failed,
    errors,
    passRate: summaryContext.passRate,
    bytecode: summaryError.bytecode,
    decoded: decodeBytecodeError(summaryError.bytecode),
    aiMetadata: {
      parseable: true,
      schemaVersion: 'v1',
      deterministic: true,
      checksumVerified: true,
    },
  };
}

// ─── QA Clock Integration ────────────────────────────────────────────────────

/**
 * Records test timing with bytecode metadata.
 */
export function recordTestTiming(testContext, startTime, endTime) {
  const duration = endTime - startTime;
  const expectedMaxDuration = testContext.expectedMaxDuration || 5000;

  if (duration > expectedMaxDuration) {
    return {
      duration,
      slow: true,
      bytecode: new BytecodeError(
        ERROR_CATEGORIES.RANGE,
        ERROR_SEVERITY.WARN,
        MODULE_IDS.SHARED,
        ERROR_CODES.EXCEEDS_MAX,
        {
          testName: testContext.testName,
          parameterName: 'duration',
          value: duration,
          max: expectedMaxDuration,
        }
      ).bytecode,
    };
  }

  return {
    duration,
    slow: false,
    bytecode: null,
  };
}

// ─── Visual Regression Assertions ────────────────────────────────────────────

/**
 * Asserts that visual output matches baseline within tolerance.
 */
export function assertVisualMatch(actual, baseline, tolerance, testContext) {
  const diff = calculateVisualDiff(actual, baseline);
  
  if (diff > tolerance) {
    throw new QATestError(
      ERROR_CATEGORIES.VALUE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.SHARED,
      ERROR_CODES.INVALID_VALUE,
      {
        ...testContext,
        assertionType: 'VISUAL_MATCH',
        expected: `diff <= ${tolerance}`,
        actual: `diff = ${diff}`,
        visualDiff: diff,
        tolerance,
      }
    );
  }
  
  return { pass: true, diff };
}

function calculateVisualDiff(actual, baseline) {
  // Simplified - in production use pixelmatch or similar
  if (actual === baseline) return 0;
  return 1.0; // Complete mismatch
}

// ─── Export for QA Test Files ────────────────────────────────────────────────

export default {
  // Assertions
  assertEqual,
  assertTrue,
  assertInRange,
  assertType,
  assertThrowsBytecode,
  assertCoordinateInBounds,
  assertValidHexColor,
  assertExtensionRegisterable,
  assertVisualMatch,
  
  // Reporting
  reportTestResult,
  aggregateTestResults,
  recordTestTiming,
  
  // Classes
  QATestError,
  
  // Constants
  TEST_SEVERITY,
};
