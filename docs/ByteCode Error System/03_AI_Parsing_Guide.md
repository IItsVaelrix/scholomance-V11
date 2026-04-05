# AI Parsing Guide for Bytecode Errors

## Overview

This guide explains how AI systems can parse, understand, and respond to PixelBrain bytecode errors with mathematical precision.

---

## Parsing Pipeline

```
Bytecode String → Decode → Verify → Extract → Analyze → Respond
     ↓              ↓         ↓         ↓          ↓         ↓
  Input        Structure  Checksum  Context   Recovery   Fix
```

---

## Step 1: Decode Bytecode

### Input Validation

```javascript
import { decodeBytecodeError, parseErrorForAI } from 'codex/core/pixelbrain/bytecode-error.js';

function parseBytecodeError(input) {
  // Handle different input types
  if (!input) {
    return {
      valid: false,
      error: 'NULL_INPUT',
      message: 'No error provided',
    };
  }
  
  // Already a BytecodeError instance
  if (input instanceof BytecodeError) {
    return input.toJSON();
  }
  
  // Bytecode string
  if (typeof input === 'string' && input.startsWith('PB-ERR-')) {
    return decodeBytecodeError(input);
  }
  
  // Standard Error
  if (input instanceof Error) {
    return {
      valid: false,
      error: 'STANDARD_ERROR',
      type: input.name,
      message: input.message,
      stack: input.stack,
    };
  }
  
  // Unknown
  return {
    valid: false,
    error: 'UNKNOWN_TYPE',
    message: String(input),
  };
}
```

### Structure Parsing

```javascript
function parseBytecodeStructure(bytecode) {
  const parts = bytecode.split('-');
  
  // Validate minimum parts: PB-ERR-v1-CAT-SEV-MOD-CODE-B64-CHECKSUM
  if (parts.length < 8) {
    return { valid: false, error: 'INVALID_STRUCTURE' };
  }
  
  // Validate marker
  if (parts[0] !== 'PB' || parts[1] !== 'ERR') {
    return { valid: false, error: 'INVALID_MARKER' };
  }
  
  return {
    valid: true,
    version: parts[2],
    category: parts[3],
    severity: parts[4],
    moduleId: parts[5],
    errorCode: parts[6],
    // Reconstruct base64 (may contain dashes)
    contextB64: parts.slice(7, -1).join('-'),
    checksum: parts[parts.length - 1],
  };
}
```

---

## Step 2: Verify Checksum

### FNV-1a Hash Verification

```javascript
function hashString(value) {
  const input = String(value ?? '');
  let hash = 2166136261; // FNV offset basis (32-bit)

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash >>> 0; // Convert to unsigned 32-bit
}

function verifyChecksum(bytecode) {
  const parsed = parseBytecodeStructure(bytecode);
  if (!parsed.valid) return { valid: false, error: parsed.error };
  
  // Reconstruct partial bytecode (without checksum)
  const partial = `PB-ERR-v1-${parsed.category}-${parsed.severity}-${parsed.moduleId}-${parsed.errorCode}-${parsed.contextB64}`;
  
  // Calculate expected checksum
  const expectedChecksum = hashString(partial).toString(16).toUpperCase().padStart(8, '0');
  
  // Compare
  if (parsed.checksum.toUpperCase() !== expectedChecksum) {
    return {
      valid: false,
      error: 'CHECKSUM_MISMATCH',
      message: 'Bytecode integrity verification failed',
      expected: expectedChecksum,
      received: parsed.checksum,
    };
  }
  
  return { valid: true, checksumVerified: true };
}
```

### Checksum Failure Handling

```javascript
function handleChecksumFailure(bytecode) {
  const verification = verifyChecksum(bytecode);
  
  if (!verification.valid) {
    // Log for security audit
    console.warn('[SECURITY] Bytecode checksum mismatch:', {
      bytecode,
      expected: verification.expected,
      received: verification.received,
      timestamp: Date.now(),
    });
    
    // Alert user
    return {
      alert: true,
      message: 'Error message corrupted - cannot verify authenticity',
      action: 'Request fresh error from source',
    };
  }
  
  return { alert: false };
}
```

---

## Step 3: Extract Context

### Base64 Decoding

```javascript
function decodeContext(contextB64) {
  try {
    // Handle URL-safe base64 variants
    const safeB64 = contextB64.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode base64
    const jsonStr = decodeURIComponent(escape(atob(safeB64)));
    
    // Parse JSON
    return {
      valid: true,
      data: JSON.parse(jsonStr),
    };
  } catch (e) {
    return {
      valid: false,
      error: 'CONTEXT_DECODE_FAILED',
      message: e.message,
    };
  }
}
```

### Context Schema Validation

```javascript
function validateContextSchema(category, context) {
  const requiredFields = {
    TYPE: ['expectedType', 'actualType'],
    VALUE: ['providedValue', 'allowedValues'],
    RANGE: ['value', 'min', 'max'],
    STATE: ['currentState', 'expectedState'],
    HOOK: ['hookType', 'reason'],
    EXT: ['extensionId'],
    COORD: ['coords', 'bounds'],
    COLOR: ['colorValue', 'expectedFormat'],
    NOISE: ['params', 'reason'],
    RENDER: ['canvasId', 'contextType'],
  };
  
  const fields = requiredFields[category] || [];
  const missing = fields.filter(f => !(f in context));
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: 'INCOMPLETE_CONTEXT',
      missingFields: missing,
    };
  }
  
  return { valid: true };
}
```

---

## Step 4: Extract Recovery Hints

### Invariant Extraction

```javascript
function extractInvariants(errorData) {
  const { category, errorCode, context } = errorData;
  
  const invariants = {
    TYPE: [
      `typeof value === ${JSON.stringify(context.expectedType)}`,
    ],
    VALUE: [
      `allowedValues.has(${JSON.stringify(context.providedValue)}) === true`,
    ],
    RANGE: [
      `${context.value} >= ${context.min} && ${context.value} <= ${context.max}`,
    ],
    STATE: [
      `validTransitions[${JSON.stringify(context.currentState)}].includes(${JSON.stringify(context.expectedState)})`,
    ],
    HOOK: [
      `typeof hook === 'function'`,
      `hook(payload) returns same type as payload`,
    ],
    EXT: [
      `!extensions.has(${JSON.stringify(context.extensionId)})`,
    ],
    COORD: [
      `x >= 0 && x < ${context.bounds.width} && y >= 0 && y < ${context.bounds.height}`,
    ],
    COLOR: [
      `${JSON.stringify(context.expectedFormat)}.test(${JSON.stringify(context.colorValue)})`,
    ],
    NOISE: [
      `input >= 0 && input <= 1`,
    ],
    RENDER: [
      `canvas.width > 0 && canvas.height > 0`,
      `ctx !== null && typeof ctx === 'object'`,
    ],
  };
  
  return invariants[category] || ['Review error context for specific issue'];
}
```

### Constraint Extraction

```javascript
function extractConstraints(errorData) {
  const { category, context } = errorData;
  const constraints = [];
  
  if (context.minValue !== undefined) {
    constraints.push(`Minimum value: ${context.minValue}`);
  }
  if (context.maxValue !== undefined) {
    constraints.push(`Maximum value: ${context.maxValue}`);
  }
  if (context.allowedValues) {
    constraints.push(`Allowed values: ${JSON.stringify(context.allowedValues)}`);
  }
  if (context.expectedType) {
    constraints.push(`Expected type: ${context.expectedType}`);
  }
  
  return constraints;
}
```

---

## Step 5: Analyze Error Pattern

### Error Classification

```javascript
function classifyErrorPattern(errorData) {
  const { category, severity, errorCode, context } = errorData;
  
  // Determine if error is recoverable
  const recoverable = severity !== 'FATAL';
  
  // Determine if error is user-caused or system-caused
  const userCaused = ['TYPE', 'VALUE', 'RANGE'].includes(category);
  
  // Determine if error needs immediate attention
  const urgent = severity === 'FATAL' || severity === 'CRIT';
  
  // Determine error frequency pattern
  const isRecurring = context.timestamp && (Date.now() - context.timestamp < 5000);
  
  return {
    recoverable,
    userCaused,
    urgent,
    isRecurring,
    suggestedAction: getSuggestedAction(errorData),
  };
}

function getSuggestedAction(errorData) {
  const { category, severity } = errorData;
  
  if (severity === 'FATAL') {
    return 'HALT_AND_REPORT';
  }
  
  if (['TYPE', 'VALUE', 'RANGE'].includes(category)) {
    return 'VALIDATE_INPUT';
  }
  
  if (['STATE', 'HOOK', 'EXT'].includes(category)) {
    return 'CHECK_SYSTEM_STATE';
  }
  
  return 'INVESTIGATE_AND_FIX';
}
```

---

## Step 6: Generate Fix

### Fix Pattern Matching

```javascript
function generateFix(errorData) {
  const { category, errorCode, context } = errorData;
  
  const fixPatterns = {
    TYPE: {
      [0x0001]: {  // TYPE_MISMATCH
        code: `if (typeof ${context.parameterName} !== '${context.expectedType}') {
  throw createTypeMismatchError(
    MODULE_IDS.${context.moduleId},
    '${context.expectedType}',
    typeof ${context.parameterName},
    { parameterName: '${context.parameterName}' }
  );
}`,
        description: 'Add type validation before processing',
      },
      [0x0002]: {  // NULL_INPUT
        code: `if (${context.parameterName} === null) {
  throw new BytecodeError(
    ERROR_CATEGORIES.TYPE,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS.${context.moduleId},
    ERROR_CODES.NULL_INPUT,
    { parameterName: '${context.parameterName}' }
  );
}`,
        description: 'Add null check',
      },
    },
    RANGE: {
      [0x0201]: {  // OUT_OF_BOUNDS
        code: `const ${context.parameterName} = Math.max(${context.min}, Math.min(${context.max}, value));`,
        description: 'Clamp value to valid range',
      },
      [0x0202]: {  // EXCEEDS_MAX
        code: `if (value > ${context.max}) {
  throw createOutOfBoundsError(
    MODULE_IDS.${context.moduleId},
    value,
    ${context.min},
    ${context.max}
  );
}`,
        description: 'Add upper bound check',
      },
    },
    COLOR: {
      [0x0701]: {  // INVALID_HEX
        code: `const pattern = /^#[0-9A-F]{6}$/i;
if (!pattern.test(${context.parameterName})) {
  throw createColorError(
    MODULE_IDS.COLOR_BYTE,
    'INVALID_HEX',
    ${context.parameterName}
  );
}`,
        description: 'Validate hex color format',
      },
    },
  };
  
  const categoryFixes = fixPatterns[category];
  if (!categoryFixes) {
    return {
      code: null,
      description: 'No automated fix available - manual review required',
    };
  }
  
  const fix = categoryFixes[errorCode];
  if (!fix) {
    return {
      code: null,
      description: 'No fix pattern for this specific error code',
    };
  }
  
  return fix;
}
```

---

## Complete AI Parser Implementation

```javascript
import {
  BytecodeError,
  decodeBytecodeError,
  getRecoveryHintsForError,
  parseErrorForAI,
} from 'codex/core/pixelbrain/bytecode-error.js';

export class AIErrorParser {
  /**
   * Parse any error into AI-understandable format
   */
  parse(error) {
    const result = parseErrorForAI(error);
    
    if (!result.aiMetadata?.parseable) {
      return {
        parseable: false,
        type: 'UNKNOWN',
        message: result.message,
        suggestion: 'Convert to BytecodeError for AI parsing',
      };
    }
    
    // Verify checksum
    const checksumValid = this.verifyChecksum(result.bytecode);
    if (!checksumValid) {
      return {
        parseable: true,
        checksumValid: false,
        alert: 'Bytecode integrity compromised',
      };
    }
    
    // Extract recovery information
    const recoveryHints = getRecoveryHintsForError(
      result.category,
      result.errorCode,
      result.context
    );
    
    // Generate fix
    const fix = this.generateFix(result);
    
    return {
      parseable: true,
      checksumValid: true,
      classification: {
        category: result.category,
        severity: result.severity,
        module: result.moduleId,
        code: result.errorCodeHex,
      },
      context: result.context,
      recoveryHints,
      fix,
      priority: this.calculatePriority(result),
    };
  }
  
  /**
   * Verify bytecode checksum
   */
  verifyChecksum(bytecode) {
    const parts = bytecode.split('-');
    if (parts.length < 8) return false;
    
    const checksum = parts[parts.length - 1];
    const partial = parts.slice(0, -1).join('-');
    const expected = hashString(partial).toString(16).toUpperCase();
    
    return checksum.toUpperCase() === expected;
  }
  
  /**
   * Calculate error priority for AI response ordering
   */
  calculatePriority(errorData) {
    const severityWeight = {
      FATAL: 100,
      CRIT: 75,
      WARN: 50,
      INFO: 25,
    };
    
    const categoryWeight = {
      STATE: 20,  // State errors can cascade
      HOOK: 15,   // Hook errors affect extensions
      EXT: 15,    // Extension errors block features
      RENDER: 10, // Render errors affect UX
      RANGE: 5,   // Range errors are usually input validation
      TYPE: 5,    // Type errors are usually input validation
      VALUE: 5,
      COLOR: 3,
      COORD: 3,
      NOISE: 3,
      CANVAS: 3,
      FORMULA: 3,
    };
    
    return (
      (severityWeight[errorData.severity] || 0) +
      (categoryWeight[errorData.category] || 0)
    );
  }
  
  /**
   * Generate fix for error
   */
  generateFix(errorData) {
    // Implementation from generateFix() above
    // ...
  }
}

// FNV-1a hash implementation
function hashString(value) {
  const input = String(value ?? '');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
```

---

## Usage Examples

### Example 1: Parse Type Mismatch

```javascript
const parser = new AIErrorParser();

try {
  processPixelData(12345); // Should be string
} catch (error) {
  const result = parser.parse(error);
  
  console.log(result);
  // {
  //   parseable: true,
  //   checksumValid: true,
  //   classification: {
  //     category: 'TYPE',
  //     severity: 'CRIT',
  //     module: 'IMGPIX',
  //     code: '0x0001',
  //   },
  //   context: {
  //     parameterName: 'pixelData',
  //     expectedType: 'string',
  //     actualType: 'number',
  //   },
  //   recoveryHints: {
  //     suggestions: [...],
  //     constraints: [...],
  //     invariants: ['typeof value === "string"'],
  //   },
  //   fix: {
  //     code: 'if (typeof pixelData !== \'string\') { ... }',
  //     description: 'Add type validation before processing',
  //   },
  //   priority: 80,
  // }
}
```

### Example 2: Batch Error Analysis

```javascript
async function analyzeErrorBatch(errors) {
  const parser = new AIErrorParser();
  
  const results = errors.map(error => parser.parse(error));
  
  // Sort by priority
  results.sort((a, b) => b.priority - a.priority);
  
  // Group by category
  const byCategory = {};
  for (const result of results) {
    const cat = result.classification?.category || 'UNKNOWN';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(result);
  }
  
  // Generate summary
  return {
    total: results.length,
    byCategory: Object.entries(byCategory).map(([cat, errs]) => ({
      category: cat,
      count: errs.length,
      avgPriority: errs.reduce((s, e) => s + e.priority, 0) / errs.length,
    })),
    critical: results.filter(r => r.classification?.severity === 'FATAL'),
    actionable: results.filter(r => r.fix?.code !== null),
  };
}
```

### Example 3: Automated Fix Generation

```javascript
async function autoFixError(error) {
  const parser = new AIErrorParser();
  const result = parser.parse(error);
  
  if (!result.parseable || !result.checksumValid) {
    return { success: false, reason: 'Cannot parse error' };
  }
  
  if (!result.fix?.code) {
    return { success: false, reason: 'No automated fix available' };
  }
  
  // Apply fix (in real system, this would modify source)
  console.log('Suggested fix:');
  console.log(result.fix.description);
  console.log(result.fix.code);
  
  return {
    success: true,
    fix: result.fix,
    invariants: result.recoveryHints.invariants,
  };
}
```

---

## Error Response Templates

### For TYPE Errors

```
Type mismatch detected in {module}.

Expected: {expectedType}
Received: {actualType}
Parameter: {parameterName}

Invariant violated: typeof value === {expectedType}

Recommended fix: Add type validation before function call.
```

### For RANGE Errors

```
Value out of bounds in {module}.

Value: {value}
Valid range: [{min}, {max}]

Invariant violated: {min} ≤ value ≤ {max}

Recommended fix: Clamp value using Math.max/min or add boundary check.
```

### For STATE Errors

```
Invalid state transition in {module}.

Current state: {currentState}
Requested state: {expectedState}
Operation: {operation}

Invariant violated: validTransitions[currentState].includes(nextState)

Recommended fix: Implement state machine with explicit transition table.
```

---

## Performance Considerations

### Parsing Time

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| Checksum verification | < 1ms | FNV-1a is fast |
| Base64 decode | < 1ms | Native browser API |
| JSON parse | < 1ms | Depends on context size |
| Full parse | < 5ms | Complete pipeline |

### Memory Usage

- Bytecode string: ~100-500 bytes
- Parsed object: ~1-2 KB
- Recovery hints: ~500 bytes
- Total per error: ~2-3 KB

### Optimization Tips

1. **Cache decoded results** for repeated errors
2. **Batch parse** multiple errors together
3. **Lazy load** recovery hints (only when needed)
4. **Stream large contexts** instead of full decode

---

## Machine-Parseable Fixes: `solution_bytecode`

Starting in v1.0, the `recoveryHints` object includes a `solution_bytecode` field. This is a `PB-FIX-v1` encoded string that represents a deterministic fix operation.

**Format:** `PB-FIX-v1-{CATEGORY}-{OP}-{CODE}-{CONTEXT_B64}-{CHECKSUM}`

**Example:**
`PB-FIX-v1-RANGE-CLAMP_RANGE-0201-eyJwYXJhbWV0ZXJOYW1lIjoiaHVlIiwibWluIjowLCJtYXgiOjM2MCwib3AiOiJDTEFNUF9SQU5HRSJ9-7D8E9F0A`

AI agents should prioritize `solution_bytecode` over prose suggestions when performing automated repairs.
