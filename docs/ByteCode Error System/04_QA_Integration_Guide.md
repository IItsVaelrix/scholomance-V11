# Bytecode Error System - QA Integration Guide

## Overview

This guide explains how to integrate the Bytecode Error System into Scholomance's QA infrastructure for AI-parsable test results.

---

## Quick Start

### 1. Import QA Assertion Library

```javascript
import {
  assertEqual,
  assertTrue,
  assertInRange,
  assertType,
  assertThrowsBytecode,
  reportTestResult,
  QATestError,
} from 'tests/qa/tools/bytecode-assertions.js';
```

### 2. Use in Tests

```javascript
import { describe, it } from 'vitest';

describe('My Feature', () => {
  it('should work correctly', () => {
    const result = myFunction();
    
    // Standard assertion
    assertEqual(result, expected, {
      testName: 'should work correctly',
      testFile: 'my-feature.test.js',
      testSuite: 'My Feature',
    });
  });
});
```

### 3. Capture Test Results

```javascript
import { reportTestResult, TEST_SEVERITY } from './bytecode-assertions.js';

const testResult = {
  testName: 'should work correctly',
  testFile: 'my-feature.test.js',
  testSuite: 'My Feature',
  duration: 150,
  status: TEST_SEVERITY.FAIL,
  assertions: [{ pass: false, reason: 'Expected 5 to equal 10' }],
};

const bytecodeResult = reportTestResult(testResult);
console.log(bytecodeResult.bytecode);
// → PB-ERR-v1-STATE-CRIT-SHARED-0301-eyJ...-CHECKSUM
```

---

## Assertion Functions

### assertEqual(actual, expected, testContext)

Asserts that two values are strictly equal.

**Parameters:**
- `actual` — Actual value
- `expected` — Expected value
- `testContext` — Test metadata

**Test Context Schema:**
```javascript
{
  testName: 'string',
  testFile: 'string',
  testSuite: 'string',
  expectedMaxDuration: 'number (optional)',
  extra: 'object (optional)',
}
```

**Example:**
```javascript
assertEqual(pixelData.length, 160 * 144, {
  testName: 'should have correct pixel count',
  testFile: 'pixel-art.test.js',
  testSuite: 'Image Processing',
});
```

**Bytecode Error on Failure:**
```
PB-ERR-v1-VALUE-CRIT-SHARED-0101-eyJ0ZXN0TmFtZSI6InNob3VsZCBoYXZlIGNvcnJlY3QgcGl4ZWwgY291bnQiLCJleHBlY3RlZCI6IjIzMDQwIiwiYWN0dWFsIjoiMjMwMzkifQ==-CHECKSUM
```

---

### assertTrue(condition, testContext)

Asserts that a condition is truthy.

**Example:**
```javascript
assertTrue(canvas.width > 0, {
  testName: 'should have valid canvas dimensions',
  testFile: 'canvas.test.js',
  testSuite: 'Rendering',
});
```

---

### assertInRange(value, min, max, testContext)

Asserts that a value is within expected range.

**Example:**
```javascript
assertInRange(audioLevel, 0, 1, {
  testName: 'should have normalized audio level',
  testFile: 'audio.test.js',
  testSuite: 'Audio Analysis',
});
```

**Bytecode Error on Failure:**
```
PB-ERR-v1-RANGE-CRIT-SHARED-0201-eyJ2YWx1ZSI6MS41LCJtaW4iOjAsIm1heCI6MX0=-CHECKSUM
```

---

### assertType(value, expectedType, testContext)

Asserts that a value has expected type.

**Example:**
```javascript
assertType(pixelData, 'string', {
  testName: 'should receive string pixel data',
  testFile: 'pixel-art.test.js',
  testSuite: 'Image Processing',
});
```

---

### assertThrowsBytecode(fn, expectedCategory, expectedCode, testContext)

Asserts that a function throws a specific bytecode error.

**Parameters:**
- `fn` — Function to execute
- `expectedCategory` — Expected error category (TYPE, VALUE, RANGE, etc.)
- `expectedCode` — Expected error code from ERROR_CODES
- `testContext` — Test metadata

**Example:**
```javascript
import { ERROR_CATEGORIES, ERROR_CODES } from 'codex/core/pixelbrain/bytecode-error.js';

assertThrowsBytecode(
  () => registerExtension({ id: '', type: 'INVALID' }),
  ERROR_CATEGORIES.EXT,
  ERROR_CODES.EXT_MISSING_ID,
  {
    testName: 'should reject extension without ID',
    testFile: 'extension-registry.test.js',
    testSuite: 'Extension System',
  }
);
```

---

### assertCoordinateInBounds(coords, bounds, testContext)

Asserts that coordinates are within canvas bounds.

**Example:**
```javascript
assertCoordinateInBounds(
  { x: 100, y: 50 },
  { width: 160, height: 144 },
  {
    testName: 'should place pixel within canvas',
    testFile: 'coordinate-mapping.test.js',
    testSuite: 'Coordinate System',
  }
);
```

---

### assertValidHexColor(colorValue, testContext)

Asserts that a color value is valid hex format.

**Example:**
```javascript
assertValidHexColor('#FF5733', {
  testName: 'should accept valid hex color',
  testFile: 'color-byte-mapping.test.js',
  testSuite: 'Color System',
});
```

---

## Test Result Reporting

### reportTestResult(testResult)

Converts test result to AI-parsable bytecode format.

**Input Schema:**
```javascript
{
  testName: 'string',
  testFile: 'string',
  testSuite: 'string',
  duration: 'number (ms)',
  status: 'PASS|FAIL|SKIP|ERROR',
  assertions: [{ pass: 'boolean', reason?: 'string' }],
}
```

**Output Schema:**
```javascript
{
  status: 'PASS|FAIL',
  bytecode: 'string|null',
  decoded: {
    valid: 'boolean',
    category: 'string',
    severity: 'string',
    context: 'object',
  },
  aiMetadata: {
    parseable: 'boolean',
    schemaVersion: 'string',
    deterministic: 'boolean',
    checksumVerified: 'boolean',
    autoFixable: 'boolean',
  },
  recoveryHints: {
    suggestions: ['array of strings'],
    constraints: ['array of strings'],
    invariants: ['array of strings'],
  },
}
```

**Example:**
```javascript
const testResult = {
  testName: 'should validate input',
  testFile: 'validation.test.js',
  testSuite: 'Input Handling',
  duration: 120,
  status: TEST_SEVERITY.FAIL,
  assertions: [
    { pass: true },
    { pass: false, reason: 'Expected type string but got number' },
  ],
};

const bytecodeResult = reportTestResult(testResult);

console.log(bytecodeResult.bytecode);
// → PB-ERR-v1-STATE-CRIT-SHARED-0301-eyJ...-CHECKSUM

console.log(bytecodeResult.recoveryHints.invariants);
// → ["typeof value === 'string'"]
```

---

### aggregateTestResults(testResults)

Aggregates multiple test results into summary bytecode.

**Example:**
```javascript
const testResults = [
  { testName: 'test1', testFile: 'a.test.js', testSuite: 'Suite', duration: 50, status: TEST_SEVERITY.PASS, assertions: [] },
  { testName: 'test2', testFile: 'a.test.js', testSuite: 'Suite', duration: 75, status: TEST_SEVERITY.PASS, assertions: [] },
  { testName: 'test3', testFile: 'a.test.js', testSuite: 'Suite', duration: 100, status: TEST_SEVERITY.FAIL, assertions: [] },
];

const summary = aggregateTestResults(testResults);

console.log(summary);
// {
//   total: 3,
//   passed: 2,
//   failed: 1,
//   errors: 0,
//   passRate: 0.667,
//   bytecode: 'PB-ERR-v1-STATE-WARN-SHARED-0301-eyJ...-CHECKSUM',
//   aiMetadata: { parseable: true, ... },
// }
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: QA Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with bytecode reporting
        run: npm run test:qa -- --reporter=json --outputFile=test-results.json
      
      - name: Process bytecode results
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const { aggregateTestResults } = require('./tests/qa/tools/bytecode-assertions.js');
            
            const results = JSON.parse(fs.readFileSync('test-results.json'));
            const summary = aggregateTestResults(results.testResults);
            
            console.log('Test Summary Bytecode:', summary.bytecode);
            console.log('Pass Rate:', summary.passRate);
            
            // Fail if pass rate below threshold
            if (summary.passRate < 0.9) {
              core.setFailed(`Pass rate ${summary.passRate} below threshold 0.9`);
            }
```

### Vitest Configuration

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { bytecodeReporter } from './tests/qa/tools/bytecode-reporter.js';

export default defineConfig({
  test: {
    reporter: ['default', bytecodeReporter()],
    outputFile: 'test-results/bytecode-summary.json',
  },
});
```

---

## Custom Assertions

### Creating Domain-Specific Assertions

```javascript
import { QATestError, ERROR_CATEGORIES, ERROR_SEVERITY, MODULE_IDS } from './bytecode-assertions.js';

/**
 * Asserts that a PixelBrain formula produces valid coordinates.
 */
export function assertValidFormulaCoordinates(coords, formula, testContext) {
  if (!coords || typeof coords !== 'object') {
    throw new QATestError(
      ERROR_CATEGORIES.TYPE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMGFOR,
      ERROR_CODES.TYPE_MISMATCH,
      {
        ...testContext,
        assertionType: 'FORMULA_COORDS',
        expected: 'object',
        actual: typeof coords,
      }
    );
  }
  
  if (coords.x < 0 || coords.x > 160 || coords.y < 0 || coords.y > 144) {
    throw new QATestError(
      ERROR_CATEGORIES.RANGE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMGFOR,
      ERROR_CODES.OUT_OF_BOUNDS,
      {
        ...testContext,
        assertionType: 'FORMULA_COORDS',
        coords,
        bounds: { width: 160, height: 144 },
      }
    );
  }
  
  return { pass: true };
}
```

---

## AI Debugging Workflow

### 1. Run Tests

```bash
npm run test:qa
```

### 2. Capture Bytecode Output

```
Test: should validate pixel data
Status: FAIL
Bytecode: PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJwYXJhbWV0ZXJOYW1lIjoicGl4ZWxEYXRhIiwiZXhwZWN0ZWRUeXBlIjoic3RyaW5nIiwiYWN0dWFsVHlwZSI6Im51bWJlciJ9-7F8A9B2C
```

### 3. Parse with AI

```javascript
import { parseErrorForAI } from 'codex/core/pixelbrain/bytecode-error.js';

const bytecode = 'PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-...';
const errorData = parseErrorForAI(bytecode);

console.log(errorData);
// {
//   category: 'TYPE',
//   severity: 'CRIT',
//   recoveryHints: {
//     suggestions: ['Validate input types before function calls'],
//     invariants: ['typeof value === "string"'],
//   },
//   fix: {
//     code: 'if (typeof pixelData !== \'string\') { ... }',
//     description: 'Add type validation',
//   },
// }
```

### 4. Apply Fix

```javascript
// Before
function processPixelData(pixelData) {
  // Assumes string
}

// After
function processPixelData(pixelData) {
  if (typeof pixelData !== 'string') {
    throw createTypeMismatchError(
      MODULE_IDS.IMGPIX,
      'string',
      typeof pixelData,
      { parameterName: 'pixelData' }
    );
  }
  // ... process
}
```

### 5. Re-run Tests

```bash
npm run test:qa
# Test should now pass
```

---

## Best Practices

### 1. Always Include Test Context

```javascript
// ❌ Bad
assertEqual(result, expected);

// ✅ Good
assertEqual(result, expected, {
  testName: 'should produce expected result',
  testFile: 'my-feature.test.js',
  testSuite: 'My Feature',
});
```

### 2. Use Specific Error Categories

```javascript
// ❌ Bad - generic assertion
assertTrue(typeof data === 'string');

// ✅ Good - type-specific assertion
assertType(data, 'string', { ... });
```

### 3. Capture Full Test Metadata

```javascript
const testContext = {
  testName: 'should validate input',
  testFile: 'validation.test.js',
  testSuite: 'Input Handling',
  expectedMaxDuration: 500,
  extra: {
    inputSize: inputData.length,
    environment: process.env.NODE_ENV,
  },
};
```

### 4. Aggregate Results for Summary

```javascript
// At end of test suite
const summary = aggregateTestResults(allTestResults);
console.log('Overall Pass Rate:', summary.passRate);
console.log('Summary Bytecode:', summary.bytecode);
```

### 5. Verify Checksums in CI

```javascript
const { decodeBytecodeError } = require('codex/core/pixelbrain/bytecode-error.js');

const decoded = decodeBytecodeError(summary.bytecode);
if (!decoded.valid) {
  throw new Error('Test summary bytecode corrupted!');
}
```

---

## Migration Guide

### From Standard Assertions

**Before:**
```javascript
import { expect } from 'vitest';

expect(result).toBe(expected);
expect(typeof data).toBe('string');
expect(value).toBeGreaterThan(0);
```

**After:**
```javascript
import { assertEqual, assertType, assertInRange } from './bytecode-assertions.js';

assertEqual(result, expected, testContext);
assertType(data, 'string', testContext);
assertInRange(value, 1, Infinity, testContext);
```

### Hybrid Approach

```javascript
import { expect } from 'vitest';
import { assertEqual } from './bytecode-assertions.js';

// Use bytecode assertions for critical checks
assertEqual(criticalValue, expected, testContext);

// Use standard assertions for non-critical checks
expect(nonCriticalValue).toBeDefined();
```

---

## Troubleshooting

### Checksum Mismatch in Test Results

**Symptom:** `decodeBytecodeError()` returns `CHECKSUM_MISMATCH`

**Cause:** Test result was modified after encoding

**Fix:** Don't modify bytecode strings after generation

### Missing Test Context

**Symptom:** Error says "testName is required"

**Fix:** Always pass complete test context:
```javascript
{
  testName: 'my test',
  testFile: 'my.test.js',
  testSuite: 'My Suite',
}
```

### Assertion Not Throwing

**Symptom:** Test passes when it should fail

**Cause:** Using standard assertions instead of bytecode assertions

**Fix:** Use bytecode assertion functions:
```javascript
// ❌ Won't throw bytecode error
expect(value).toBe(expected);

// ✅ Will throw bytecode error
assertEqual(value, expected, testContext);
```

---

## Related Documentation

- [Bytecode Error System Overview](../../docs/ByteCode%20Error%20System/01_Bytecode_Error_System_Overview.md)
- [Error Code Reference](../../docs/ByteCode%20Error%20System/02_Error_Code_Reference.md)
- [AI Parsing Guide](../../docs/ByteCode%20Error%20System/03_AI_Parsing_Guide.md)
