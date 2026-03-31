# PixelBrain Bytecode Error System

## Overview

The PixelBrain Bytecode Error System is a **mathematically precise, AI-parsable error encoding framework** designed for deterministic error communication between humans, AIs, and automated systems.

Every error is encoded into a structured bytecode string that contains:
- Error classification (category, severity, module)
- Specific error code (hex-encoded)
- Context data (base64-encoded JSON)
- Integrity checksum (FNV-1a hash)

---

## Bytecode Error Format

```
PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}-{CONTEXT_B64}-{CHECKSUM}
```

### Component Breakdown

| Position | Component | Format | Length | Description |
|----------|-----------|--------|--------|-------------|
| 1 | Marker | `PB-ERR` | 6 chars | PixelBrain Error identifier |
| 2 | Version | `v1`, `v2`, ... | 2-3 chars | Schema version |
| 3 | Category | Enum (see below) | 3-6 chars | Error domain |
| 4 | Severity | `FATAL`, `CRIT`, `WARN`, `INFO` | 4 chars | Impact level |
| 5 | Module | 4-6 char ID | 4-6 chars | Source module |
| 6 | Code | 4-digit hex | 4 chars | Specific error |
| 7 | Context | Base64 JSON | Variable | Error details |
| 8 | Checksum | 8-digit hex | 8 chars | Integrity hash |

---

## Error Categories

### TYPE — Type Mismatch Errors

**Domain:** Input type validation, type coercion failures

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0001 | `0001` | TYPE_MISMATCH | Expected type differs from actual type |
| 0x0002 | `0002` | NULL_INPUT | Null value provided where object required |
| 0x0003 | `0003` | UNDEFINED_PROP | Undefined property accessed |

**Example Bytecode:**
```
PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJwYXJhbWV0ZXJOYW1lIjoicGl4ZWxEYXRhIiwiZXhwZWN0ZWRUeXBlIjoic3RyaW5nIiwiYWN0dWFsVHlwZSI6Im51bWJlciJ9-7F8A9B2C
```

**Decoded Context:**
```json
{
  "parameterName": "pixelData",
  "expectedType": "string",
  "actualType": "number"
}
```

**Recovery Invariants:**
```javascript
typeof value === expectedType
```

**Fix Suggestions:**
1. Add type validation before function calls
2. Use `typeof` checks for primitive types
3. Implement type coercion if appropriate

---

### VALUE — Invalid Value Errors

**Domain:** Enum violations, format errors, missing required fields

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0101 | `0101` | INVALID_ENUM | Value not in allowed set |
| 0x0102 | `0102` | INVALID_FORMAT | Value format doesn't match pattern |
| 0x0103 | `0103` | MISSING_REQUIRED | Required field not provided |

**Example Bytecode:**
```
PB-ERR-v1-VALUE-CRIT-EXTREG-0101-eyJwcm92aWRlZFR5cGUiOiJQSFlTSUNTIiwiYWxsb3dlZFR5cGVzIjpbIlNUWUxFIiwiQ1VTVE9NX1BST1AiXX0=-3C4D5E6F
```

**Decoded Context:**
```json
{
  "providedType": "PHYSICS",
  "allowedTypes": ["STYLE", "CUSTOM_PROP"]
}
```

**Recovery Invariants:**
```javascript
allowedValues.has(value) === true
```

**Fix Suggestions:**
1. Check enum membership with `Set.has()`
2. Validate against allowed values before processing
3. Review module documentation for valid options

---

### RANGE — Out of Bounds Errors

**Domain:** Array bounds, numeric ranges, dimension limits

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0201 | `0201` | OUT_OF_BOUNDS | Index outside valid range |
| 0x0202 | `0202` | EXCEEDS_MAX | Value exceeds maximum limit |
| 0x0203 | `0203` | BELOW_MIN | Value below minimum limit |

**Example Bytecode:**
```
PB-ERR-v1-RANGE-CRIT-COORD-0201-eyJ2YWx1ZSI6MTUwLCJtaW4iOjAsIm1heCI6MTAwfQ==-A1B2C3D4
```

**Decoded Context:**
```json
{
  "value": 150,
  "min": 0,
  "max": 100
}
```

**Recovery Invariants:**
```javascript
value >= min && value <= max
// For array indices:
index >= 0 && index < array.length
```

**Fix Suggestions:**
1. Clamp values: `Math.max(min, Math.min(max, value))`
2. Add boundary checks before array access
3. Validate input ranges at function entry

---

### STATE — Invalid State Errors

**Domain:** State machine violations, lifecycle errors, race conditions

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0301 | `0301` | INVALID_STATE | Operation not valid in current state |
| 0x0302 | `0302` | LIFECYCLE_VIOLATION | Operation called at wrong lifecycle phase |
| 0x0303 | `0303` | RACE_CONDITION | Concurrent access conflict detected |

**Example Bytecode:**
```
PB-ERR-v1-STATE-CRIT-GEARGL-0301-eyJjdXJyZW50U3RhdGUiOiJJREFMRSIsImV4cGVjdGVkU3RhdGUiOiJSVU5OSU5HIiwib3BlcmF0aW9uIjoidXBkYXRlIn0=-5E6F7A8B
```

**Decoded Context:**
```json
{
  "currentState": "IDLE",
  "expectedState": "RUNNING",
  "operation": "update"
}
```

**Recovery Invariants:**
```javascript
validTransitions[currentState].includes(nextState) === true
```

**Fix Suggestions:**
1. Implement explicit state machine with transition table
2. Add lifecycle guards to async operations
3. Use mutex/lock for shared state access

---

### HOOK — Hook Execution Errors

**Domain:** Extension hook failures, callback errors

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0401 | `0401` | HOOK_NOT_FN | Hook is not a function |
| 0x0402 | `0402` | HOOK_TIMEOUT | Hook execution exceeded time limit |
| 0x0403 | `0403` | HOOK_CHAIN_BREAK | Hook chain interrupted |

**Example Bytecode:**
```
PB-ERR-v1-HOOK-CRIT-EXTREG-0401-eyJob29rVHlwZSI6ImNvb3JkaW5hdGUtbWFwIiwiZXh0ZW5zaW9uSWQiOiJwaHlzaWNzLXN0cmV0Y2giLCJhY3R1YWxUeXBlIjoib2JqZWN0In0=-9C0D1E2F
```

**Decoded Context:**
```json
{
  "hookType": "coordinate-map",
  "extensionId": "physics-stretch",
  "actualType": "object"
}
```

**Recovery Invariants:**
```javascript
typeof hook === 'function'
hook(payload) returns same type as payload
```

**Fix Suggestions:**
1. Verify hook is callable: `typeof hook === "function"`
2. Wrap hook calls in try-catch with timeout
3. Ensure hooks are pure functions (no side effects)

---

### EXT — Extension Errors

**Domain:** Extension registration, conflicts, validation

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0501 | `0501` | EXT_ALREADY_REGISTERED | Extension ID already in use |
| 0x0502 | `0502` | EXT_NOT_FOUND | Extension ID not found |
| 0x0503 | `0503` | EXT_CONFLICT | Extension conflicts with existing |
| 0x0504 | `0504` | EXT_MISSING_ID | Extension lacks required ID |

**Example Bytecode:**
```
PB-ERR-v1-EXT-CRIT-EXTREG-0501-eyJleHRlbnNpb25JZCI6InBoeXNpY3Mtc3RyZXRjaCIsImV4aXN0aW5nRXh0ZW5zaW9uIjp7ImlkIjoicGh5c2ljcy1zdHJldGNoIiwidHlwZSI6IlBIWVNJQ1MifX0=-3A4B5C6D
```

**Decoded Context:**
```json
{
  "extensionId": "physics-stretch",
  "existingExtension": {
    "id": "physics-stretch",
    "type": "PHYSICS"
  }
}
```

**Recovery Invariants:**
```javascript
!extensions.has(extension.id)
typeof extension.id === 'string' && extension.id.length > 0
```

**Fix Suggestions:**
1. Check extension ID uniqueness before registration
2. Validate extension object structure
3. Use UUID or namespace for extension IDs

---

### COORD — Coordinate Mapping Errors

**Domain:** Coordinate validation, transformation, bounds checking

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0601 | `0601` | COORD_INVALID | Coordinate format invalid |
| 0x0602 | `0602` | COORD_OUT_OF_BOUNDS | Coordinate outside canvas bounds |
| 0x0603 | `0603` | COORD_TRANSFORM_FAIL | Coordinate transformation failed |

**Example Bytecode:**
```
PB-ERR-v1-COORD-CRIT-COORD-0602-eyJjb29yZHMiOnsieCI6MjAwLCJ5IjoxNTB9LCJib3VuZHMiOnsid2lkdGgiOjE2MCwiaGVpZ2h0IjoxNDR9fQ==-7E8F9A0B
```

**Decoded Context:**
```json
{
  "coords": { "x": 200, "y": 150 },
  "bounds": { "width": 160, "height": 144 }
}
```

**Recovery Invariants:**
```javascript
x >= 0 && x < canvas.width && y >= 0 && y < canvas.height
```

**Fix Suggestions:**
1. Validate coordinates against canvas bounds
2. Use `clamp01()` for normalized coordinates
3. Apply coordinate transformation before bounds check

---

### COLOR — Color Conversion Errors

**Domain:** Hex/HSL conversion, byte mapping, format validation

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0701 | `0701` | COLOR_INVALID_HEX | Hex color format invalid |
| 0x0702 | `0702` | COLOR_INVALID_HSL | HSL values out of range |
| 0x0703 | `0703` | COLOR_BYTE_MISMATCH | Color-byte mapping inconsistent |

**Example Bytecode:**
```
PB-ERR-v1-COLOR-WARN-COLBYT-0701-eyJjb2xvclZhbHVlIjoiIzEyMzQ1NjciLCJleHBlY3RlZEZvcm1hdCI6IiNeWzAtOUEtRl17Nn0kL2kifQ==-1C2D3E4F
```

**Decoded Context:**
```json
{
  "colorValue": "#1234567",
  "expectedFormat": "/^#[0-9A-F]{6}$/i"
}
```

**Recovery Invariants:**
```javascript
/^#[0-9A-Fa-f]{6}$/.test(hexColor)
h >= 0 && h < 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100
```

**Fix Suggestions:**
1. Validate hex format: `/^#[0-9A-F]{6}$/i`
2. Use `hslToHex()` for HSL conversion
3. Normalize color values before processing

---

### NOISE — Procedural Noise Errors

**Domain:** Noise generation, parameter validation, overflow

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0801 | `0801` | NOISE_INVALID_PARAMS | Noise parameters invalid |
| 0x0802 | `0802` | NOISE_OVERFLOW | Noise calculation overflow |

**Example Bytecode:**
```
PB-ERR-v1-NOISE-CRIT-NOISE-0801-eyJwYXJhbXMiOnsic2NhbGUiOjIsIm9jdGF2ZXMiOjh9LCJyZWFzb24iOiJzY2FsZSBtdXN0IGJlIFswLDFdIn0=-5F6A7B8C
```

**Decoded Context:**
```json
{
  "params": { "scale": 2, "octaves": 8 },
  "reason": "scale must be [0,1]"
}
```

**Recovery Invariants:**
```javascript
input >= 0 && input <= 1
Number.isFinite(output) && !Number.isNaN(output)
```

**Fix Suggestions:**
1. Ensure noise parameters are in [0, 1] range
2. Use seeded random for deterministic output
3. Clamp intermediate values to prevent overflow

---

### RENDER — Rendering Pipeline Errors

**Domain:** Canvas rendering, context management, draw operations

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0901 | `0901` | RENDER_CONTEXT_LOST | Canvas context lost/unavailable |
| 0x0902 | `0902` | RENDER_SIZE_INVALID | Canvas dimensions invalid |
| 0x0903 | `0903` | RENDER_FAILED | Draw operation failed |

**Example Bytecode:**
```
PB-ERR-v1-RENDER-CRIT-IMGPIX-0902-eyJjYW52YXNXaWR0aCI6MCwiY2FudmFzSGVpZ2h0IjowLCJtaW5TaXplIjoxfQ=-9A0B1C2D
```

**Decoded Context:**
```json
{
  "canvasWidth": 0,
  "canvasHeight": 0,
  "minSize": 1
}
```

**Recovery Invariants:**
```javascript
canvas.width > 0 && canvas.height > 0
ctx !== null && typeof ctx === 'object'
```

**Fix Suggestions:**
1. Check canvas context availability
2. Validate canvas dimensions before rendering
3. Handle context loss gracefully

---

### CANVAS — Canvas Element Errors

**Domain:** Canvas element access, size validation

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0A01 | `0A01` | CANVAS_NOT_FOUND | Canvas element not found |
| 0x0A02 | `0A02` | CANVAS_SIZE_ZERO | Canvas has zero dimensions |

---

### FORMULA — Formula Parsing Errors

**Domain:** Formula syntax, evaluation, expression parsing

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 0x0B01 | `0B01` | FORMULA_PARSE_FAIL | Formula syntax parsing failed |
| 0x0B02 | `0B02` | FORMULA_EVAL_FAIL | Formula evaluation failed |
| 0x0B03 | `0B03` | FORMULA_INVALID_SYNTAX | Formula syntax invalid |

---

## Module Identifiers

| ID | Module | File Path |
|----|--------|-----------|
| `EXTREG` | Extension Registry | `extension-registry.js` |
| `IMGSEM` | Image-to-Semantic Bridge | `image-to-semantic-bridge.js` |
| `IMGPIX` | Image-to-Pixel Art | `image-to-pixel-art.js` |
| `IMGFOR` | Image-to-Bytecode Formula | `image-to-bytecode-formula.js` |
| `COORD` | Coordinate Mapping | `coordinate-mapping.js` |
| `COLBYT` | Color-Byte Mapping | `color-byte-mapping.js` |
| `ANTIAL` | Anti-Alias Control | `anti-alias-control.js` |
| `NOISE` | Procedural Noise | `procedural-noise.js` |
| `TMPLT` | Template Grid Engine | `template-grid-engine.js` |
| `GEARGL` | Gear Glide AMP | `gear-glide-amp.js` |
| `SHARED` | Shared Utilities | `shared.js` |

---

## API Reference

### Classes

#### `BytecodeError`

Main error class that extends native `Error`.

```javascript
import { BytecodeError, ERROR_CATEGORIES, ERROR_SEVERITY, MODULE_IDS, ERROR_CODES } from './bytecode-error.js';

const error = new BytecodeError(
  ERROR_CATEGORIES.TYPE,
  ERROR_SEVERITY.CRIT,
  MODULE_IDS.IMGPIX,
  ERROR_CODES.TYPE_MISMATCH,
  { expectedType: 'string', actualType: 'number' }
);

console.log(error.bytecode);
// → PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJ...-CHECKSUM

console.log(error.toJSON());
// → Structured data for AI consumption

console.log(error.getRecoveryHints());
// → Recovery suggestions and invariants
```

### Functions

#### `encodeBytecodeError(category, severity, moduleId, errorCode, context)`

Encodes error components into bytecode string.

**Parameters:**
- `category` (string): Error category from `ERROR_CATEGORIES`
- `severity` (string): Severity from `ERROR_SEVERITY`
- `moduleId` (string): Module ID from `MODULE_IDS`
- `errorCode` (number): Error code from `ERROR_CODES`
- `context` (object): Additional context data

**Returns:** `string` — Bytecode error string

#### `decodeBytecodeError(bytecode)`

Decodes bytecode string into structured data.

**Parameters:**
- `bytecode` (string): Bytecode error string

**Returns:** `object|null` — Decoded error data or null if invalid

#### `parseErrorForAI(error)`

Parses any error into AI-understandable format.

**Parameters:**
- `error` (Error|string): Error to parse

**Returns:** `object` — Structured error data with metadata

### Factory Functions

#### `createTypeMismatchError(moduleId, expectedType, actualType, context)`

Creates type mismatch error.

#### `createOutOfBoundsError(moduleId, value, min, max, context)`

Creates out of bounds error.

#### `createExtensionError(moduleId, code, extensionId, context)`

Creates extension registration error.

#### `createHookError(moduleId, hookType, reason, context)`

Creates hook execution error.

#### `createCoordinateError(moduleId, code, coords, bounds, context)`

Creates coordinate mapping error.

#### `createColorError(moduleId, code, colorValue, context)`

Creates color conversion error.

---

## Integration Guide

### Step 1: Import Error System

```javascript
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
  createTypeMismatchError,
  parseErrorForAI,
} from 'codex/core/pixelbrain/bytecode-error.js';
```

### Step 2: Replace Standard Errors

**Before:**
```javascript
if (typeof pixelData !== 'string') {
  throw new Error('pixelData must be a string');
}
```

**After:**
```javascript
if (typeof pixelData !== 'string') {
  throw createTypeMismatchError(
    MODULE_IDS.IMGPIX,
    'string',
    typeof pixelData,
    { parameterName: 'pixelData' }
  );
}
```

### Step 3: Parse Errors in AI Handler

```javascript
try {
  // PixelBrain operation
} catch (error) {
  const errorData = parseErrorForAI(error);
  
  if (errorData.aiMetadata.parseable) {
    // AI can understand and provide precise fix
    console.log('Bytecode:', errorData.bytecode);
    console.log('Recovery hints:', errorData.recoveryHints);
  } else {
    // Fallback to standard error handling
    console.error('Standard error:', error.message);
  }
}
```

---

## Checksum Algorithm

The checksum uses **FNV-1a hash** (32-bit) for integrity verification:

```javascript
function hashString(value) {
  const input = String(value ?? '');
  let hash = 2166136261; // FNV offset basis

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash >>> 0; // Convert to unsigned 32-bit
}
```

**Verification:**
```javascript
const partialBytecode = 'PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJ...';
const checksum = hashString(partialBytecode).toString(16).toUpperCase();
// → 8-character hex string
```

---

## Best Practices

### For Humans

1. **Always include context**: Provide parameter names, expected vs actual values
2. **Use factory functions**: They ensure consistent context structure
3. **Read recovery hints**: Each error includes mathematical invariants
4. **Check checksum**: Verify bytecode integrity before acting

### For AIs

1. **Parse bytecode first**: Use `parseErrorForAI()` for structured data
2. **Verify checksum**: Ensure bytecode hasn't been corrupted
3. **Extract invariants**: Use `recoveryHints.invariants` for fix validation
4. **Generate fixes**: Match error code to known fix patterns

### For Systems

1. **Log full bytecode**: Include complete string for debugging
2. **Track error codes**: Aggregate by code for pattern detection
3. **Monitor checksums**: Alert on checksum failures (data corruption)
4. **Version gate**: Check schema version before parsing

---

## Examples

### Complete Error Flow

```javascript
// 1. Throw error with factory
import { createOutOfBoundsError, MODULE_IDS } from './bytecode-error.js';

function setPixel(x, y, color) {
  if (x < 0 || x >= 160 || y < 0 || y >= 144) {
    throw createOutOfBoundsError(
      MODULE_IDS.IMGPIX,
      { x, y },
      { x: 0, y: 0 },
      { x: 159, y: 143 }
    );
  }
  // ... set pixel
}

// 2. Catch and parse
import { parseErrorForAI } from './bytecode-error.js';

try {
  setPixel(200, 150, '#FF0000');
} catch (error) {
  const errorData = parseErrorForAI(error);
  
  console.log(errorData);
  // {
  //   bytecode: "PB-ERR-v1-RANGE-CRIT-IMGPIX-0201-...",
  //   category: "RANGE",
  //   severity: "CRIT",
  //   moduleId: "IMGPIX",
  //   errorCode: 513,
  //   errorCodeHex: "0x0201",
  //   context: { ... },
  //   recoveryHints: {
  //     suggestions: ["Clamp values to valid range..."],
  //     constraints: ["0 <= x < width, 0 <= y < height"],
  //     invariants: ["x >= 0 && x < canvas.width && y >= 0 && y < canvas.height"]
  //   }
  // }
}
```

### AI-Assisted Debugging

```javascript
async function debugError(error) {
  const errorData = parseErrorForAI(error);
  
  if (!errorData.aiMetadata.parseable) {
    return 'Cannot parse error - please provide bytecode format';
  }
  
  // Verify checksum
  const decoded = decodeBytecodeError(errorData.bytecode);
  if (!decoded.valid) {
    return 'Error: Checksum verification failed - bytecode corrupted';
  }
  
  // Generate fix based on error code
  const fix = await generateFix(errorData);
  
  return {
    diagnosis: errorData.category,
    severity: errorData.severity,
    location: errorData.moduleId,
    fix,
    invariants: errorData.recoveryHints.invariants,
  };
}
```

---

## Troubleshooting

### Checksum Mismatch

**Symptom:** `decodeBytecodeError()` returns `{ valid: false, error: 'CHECKSUM_MISMATCH' }`

**Causes:**
1. Bytecode string was modified/corrupted
2. Encoding/decoding used different character sets
3. Base64 context was truncated

**Fix:**
- Use original bytecode string without modification
- Ensure UTF-8 encoding throughout pipeline

### Context Decode Failed

**Symptom:** `context` contains `{ parseError: 'CONTEXT_DECODE_FAILED' }`

**Causes:**
1. Base64 string corrupted
2. JSON in context was malformed
3. Unicode characters not properly encoded

**Fix:**
- Re-throw error with fresh context
- Use `JSON.stringify()` for context serialization

### Invalid Category/Severity

**Symptom:** `encodeBytecodeError()` throws "Invalid error category"

**Causes:**
1. Typo in category/severity string
2. Using undefined constant

**Fix:**
- Import from `ERROR_CATEGORIES` and `ERROR_SEVERITY` constants
- Use factory functions instead of constructor

---

## Version History

### v1 (Current)

- Initial release
- 12 error categories
- 36 specific error codes
- FNV-1a checksum
- Base64 context encoding
- Recovery hints system

### Planned (v2)

- Error correlation IDs for tracing
- Compressed context for large payloads
- Multi-language recovery hints
- Machine learning fix suggestions
