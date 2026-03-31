# Bytecode Error Code Reference

## Quick Reference Table

| Category | Code | Hex | Severity | Module | Description |
|----------|------|-----|----------|--------|-------------|
| TYPE | 0x0001 | `0001` | CRIT | Any | Type mismatch |
| TYPE | 0x0002 | `0002` | CRIT | Any | Null input |
| TYPE | 0x0003 | `0003` | WARN | Any | Undefined property |
| VALUE | 0x0101 | `0101` | CRIT | Any | Invalid enum value |
| VALUE | 0x0102 | `0102` | WARN | Any | Invalid format |
| VALUE | 0x0103 | `0103` | CRIT | Any | Missing required field |
| RANGE | 0x0201 | `0201` | CRIT | Any | Out of bounds |
| RANGE | 0x0202 | `0202` | CRIT | Any | Exceeds maximum |
| RANGE | 0x0203 | `0203` | CRIT | Any | Below minimum |
| STATE | 0x0301 | `0301` | CRIT | Any | Invalid state |
| STATE | 0x0302 | `0302` | CRIT | Any | Lifecycle violation |
| STATE | 0x0303 | `0303` | WARN | Any | Race condition |
| HOOK | 0x0401 | `0401` | CRIT | EXTREG | Hook not a function |
| HOOK | 0x0402 | `0402` | CRIT | EXTREG | Hook timeout |
| HOOK | 0x0403 | `0403` | CRIT | EXTREG | Hook chain break |
| EXT | 0x0501 | `0501` | CRIT | EXTREG | Extension already registered |
| EXT | 0x0502 | `0502` | WARN | EXTREG | Extension not found |
| EXT | 0x0503 | `0503` | CRIT | EXTREG | Extension conflict |
| EXT | 0x0504 | `0504` | CRIT | EXTREG | Extension missing ID |
| COORD | 0x0601 | `0601` | CRIT | COORD | Invalid coordinate |
| COORD | 0x0602 | `0602` | CRIT | COORD | Coordinate out of bounds |
| COORD | 0x0603 | `0603` | CRIT | COORD | Coordinate transform fail |
| COLOR | 0x0701 | `0701` | WARN | COLBYT | Invalid hex color |
| COLOR | 0x0702 | `0702` | WARN | COLBYT | Invalid HSL values |
| COLOR | 0x0703 | `0703` | WARN | COLBYT | Color-byte mismatch |
| NOISE | 0x0801 | `0801` | CRIT | NOISE | Invalid noise params |
| NOISE | 0x0802 | `0802` | CRIT | NOISE | Noise overflow |
| RENDER | 0x0901 | `0901` | FATAL | IMGPIX | Render context lost |
| RENDER | 0x0902 | `0902` | CRIT | IMGPIX | Render size invalid |
| RENDER | 0x0903 | `0903` | CRIT | IMGPIX | Render failed |
| CANVAS | 0x0A01 | `0A01` | CRIT | IMGPIX | Canvas not found |
| CANVAS | 0x0A02 | `0A02` | CRIT | IMGPIX | Canvas size zero |
| FORMULA | 0x0B01 | `0B01` | CRIT | IMGFOR | Formula parse fail |
| FORMULA | 0x0B02 | `0B02` | CRIT | IMGFOR | Formula eval fail |
| FORMULA | 0x0B03 | `0B03` | CRIT | IMGFOR | Formula invalid syntax |

---

## Detailed Error Specifications

### TYPE Errors (0x0000–0x00FF)

#### TYPE_MISMATCH — 0x0001

**Bytecode Pattern:**
```
PB-ERR-v1-TYPE-{SEVERITY}-{MODULE}-0001-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "expectedType": "string",
  "actualType": "string",
  "value": "any (optional)"
}
```

**Example:**
```
PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJwYXJhbWV0ZXJOYW1lIjoicGl4ZWxEYXRhIiwiZXhwZWN0ZWRUeXBlIjoic3RyaW5nIiwiYWN0dWFsVHlwZSI6Im51bWJlciJ9-7F8A9B2C
```

**Decoded:**
```json
{
  "bytecode": "PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-...",
  "category": "TYPE",
  "severity": "CRIT",
  "moduleId": "IMGPIX",
  "errorCode": 1,
  "errorCodeHex": "0x0001",
  "context": {
    "parameterName": "pixelData",
    "expectedType": "string",
    "actualType": "number"
  },
  "recoveryHints": {
    "suggestions": [
      "Validate input types before function calls",
      "Use typeof checks for primitive types",
      "Expected type: string",
      "Actual type: number"
    ],
    "constraints": [
      "All function parameters must match expected types"
    ],
    "invariants": [
      "typeof value === expectedType"
    ]
  }
}
```

**Fix Pattern:**
```javascript
// Before
function processPixelData(pixelData) {
  // Assumes pixelData is string
}

// After
function processPixelData(pixelData) {
  if (typeof pixelData !== 'string') {
    throw createTypeMismatchError(
      MODULE_IDS.IMGPIX,
      'string',
      typeof pixelData,
      { parameterName: 'pixelData', value: pixelData }
    );
  }
  // ... process
}
```

---

#### NULL_INPUT — 0x0002

**Bytecode Pattern:**
```
PB-ERR-v1-TYPE-CRIT-{MODULE}-0002-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "functionName": "string",
  "position": "number (argument index)"
}
```

**When Thrown:**
- Function receives `null` where object required
- Callback returns `null` unexpectedly
- Required configuration is `null`

**Fix Pattern:**
```javascript
function setImageConfig(config) {
  if (config === null) {
    throw new BytecodeError(
      ERROR_CATEGORIES.TYPE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.IMGPIX,
      ERROR_CODES.NULL_INPUT,
      { parameterName: 'config', functionName: 'setImageConfig' }
    );
  }
}
```

---

#### UNDEFINED_PROP — 0x0003

**Bytecode Pattern:**
```
PB-ERR-v1-TYPE-WARN-{MODULE}-0003-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "objectName": "string",
  "propertyName": "string",
  "accessType": "read|write|delete"
}
```

**When Thrown:**
- Accessing non-existent object property
- Destructuring missing property
- Optional chaining not used

---

### VALUE Errors (0x0100–0x01FF)

#### INVALID_ENUM — 0x0101

**Bytecode Pattern:**
```
PB-ERR-v1-VALUE-CRIT-{MODULE}-0101-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "providedValue": "any",
  "allowedValues": ["array", "of", "allowed", "values"]
}
```

**Example:**
```
PB-ERR-v1-VALUE-CRIT-EXTREG-0101-eyJwYXJhbWV0ZXJOYW1lIjoidHlwZSIsInByb3ZpZGVkVHlwZSI6IlBIWVNJQ1MiLCJhbGxvd2VkVHlwZXMiOlsiU1RZTEUiLCJDVVNUT01fUFJPUCJdfQ==-3C4D5E6F
```

**Fix Pattern:**
```javascript
function registerExtension(type) {
  const allowedTypes = ['PHYSICS', 'STYLE', 'CUSTOM_PROP'];
  
  if (!allowedTypes.includes(type)) {
    throw new BytecodeError(
      ERROR_CATEGORIES.VALUE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.EXT_REGISTRY,
      ERROR_CODES.INVALID_ENUM,
      {
        parameterName: 'type',
        providedValue: type,
        allowedValues: allowedTypes,
      }
    );
  }
}
```

---

#### INVALID_FORMAT — 0x0102

**Bytecode Pattern:**
```
PB-ERR-v1-VALUE-WARN-{MODULE}-0102-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "providedValue": "string",
  "expectedPattern": "string (regex pattern)",
  "reason": "string"
}
```

**Common Patterns:**
- Hex color: `/^#[0-9A-F]{6}$/i`
- Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- UUID: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

---

#### MISSING_REQUIRED — 0x0103

**Bytecode Pattern:**
```
PB-ERR-v1-VALUE-CRIT-{MODULE}-0103-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "functionName": "string",
  "allRequiredParams": ["array", "of", "required", "params"],
  "providedParams": ["array", "of", "provided", "params"]
}
```

---

### RANGE Errors (0x0200–0x02FF)

#### OUT_OF_BOUNDS — 0x0201

**Bytecode Pattern:**
```
PB-ERR-v1-RANGE-CRIT-{MODULE}-0201-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "parameterName": "string",
  "value": "number",
  "min": "number",
  "max": "number",
  "indexType": "array_index|coordinate|dimension"
}
```

**Example:**
```
PB-ERR-v1-RANGE-CRIT-COORD-0201-eyJ2YWx1ZSI6MTUwLCJtaW4iOjAsIm1heCI6MTAwfQ==-A1B2C3D4
```

**Mathematical Invariant:**
```
∀x ∈ ℝ : min ≤ x ≤ max
```

**Fix Pattern:**
```javascript
function setPixelCoordinate(x, y, canvasWidth, canvasHeight) {
  if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) {
    throw new BytecodeError(
      ERROR_CATEGORIES.RANGE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.COORD_MAP,
      ERROR_CODES.OUT_OF_BOUNDS,
      {
        parameterName: 'coordinates',
        value: { x, y },
        min: { x: 0, y: 0 },
        max: { x: canvasWidth - 1, y: canvasHeight - 1 },
      }
    );
  }
}
```

---

#### EXCEEDS_MAX — 0x0202

**Context Schema:**
```json
{
  "parameterName": "string",
  "value": "number",
  "max": "number",
  "constraint": "string (description of constraint)"
}
```

---

#### BELOW_MIN — 0x0203

**Context Schema:**
```json
{
  "parameterName": "string",
  "value": "number",
  "min": "number",
  "constraint": "string (description of constraint)"
}
```

---

### STATE Errors (0x0300–0x03FF)

#### INVALID_STATE — 0x0301

**Bytecode Pattern:**
```
PB-ERR-v1-STATE-CRIT-{MODULE}-0301-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "currentState": "string",
  "expectedState": "string",
  "operation": "string",
  "validTransitions": ["array", "of", "valid", "states"]
}
```

**State Machine Example:**
```javascript
const stateMachine = {
  IDLE: ['INITIALIZING', 'SHUTDOWN'],
  INITIALIZING: ['READY', 'ERROR'],
  READY: ['RUNNING', 'SHUTDOWN'],
  RUNNING: ['PAUSED', 'SHUTDOWN'],
  PAUSED: ['RUNNING', 'SHUTDOWN'],
  SHUTDOWN: [], // Terminal state
};

function transition(newState) {
  if (!stateMachine[currentState].includes(newState)) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.GEAR_GLIDE,
      ERROR_CODES.INVALID_STATE,
      {
        currentState,
        expectedState: newState,
        operation: 'transition',
        validTransitions: stateMachine[currentState],
      }
    );
  }
  currentState = newState;
}
```

---

### HOOK Errors (0x0400–0x04FF)

#### HOOK_NOT_FN — 0x0401

**Bytecode Pattern:**
```
PB-ERR-v1-HOOK-CRIT-EXTREG-0401-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "hookType": "string (coordinate-map|color-byte|noise-gen|render)",
  "extensionId": "string",
  "actualType": "string (typeof result)"
}
```

**Fix Pattern:**
```javascript
function registerHook(extension, type, hook) {
  if (typeof hook !== 'function') {
    throw createHookError(
      MODULE_IDS.EXT_REGISTRY,
      type,
      'NOT_FUNCTION',
      {
        hookType: type,
        extensionId: extension.id,
        actualType: typeof hook,
      }
    );
  }
  // ... register hook
}
```

---

### EXT Errors (0x0500–0x05FF)

#### EXT_ALREADY_REGISTERED — 0x0501

**Bytecode Pattern:**
```
PB-ERR-v1-EXT-CRIT-EXTREG-0501-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "extensionId": "string",
  "existingExtension": {
    "id": "string",
    "type": "string",
    "registeredAt": "number (timestamp)"
  }
}
```

**Fix Pattern:**
```javascript
function register(extension) {
  if (extensions.has(extension.id)) {
    throw createExtensionError(
      MODULE_IDS.EXT_REGISTRY,
      'ALREADY_REGISTERED',
      extension.id,
      {
        extensionId: extension.id,
        existingExtension: {
          id: extension.id,
          type: extension.type,
          registeredAt: extensions.get(extension.id).timestamp,
        },
      }
    );
  }
  // ... register
}
```

---

### COORD Errors (0x0600–0x06FF)

#### COORD_OUT_OF_BOUNDS — 0x0602

**Bytecode Pattern:**
```
PB-ERR-v1-COORD-CRIT-COORD-0602-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "coords": {
    "x": "number",
    "y": "number"
  },
  "bounds": {
    "width": "number",
    "height": "number"
  },
  "coordinateSpace": "string (screen|world|normalized)"
}
```

**Mathematical Invariant:**
```
∀(x, y) ∈ ℝ² : 0 ≤ x < width ∧ 0 ≤ y < height
```

---

### COLOR Errors (0x0700–0x07FF)

#### COLOR_INVALID_HEX — 0x0701

**Bytecode Pattern:**
```
PB-ERR-v1-COLOR-WARN-COLBYT-0701-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "colorValue": "string",
  "expectedFormat": "string (regex pattern)",
  "reason": "string"
}
```

**Validation Function:**
```javascript
function validateHexColor(hex) {
  const pattern = /^#[0-9A-Fa-f]{6}$/;
  
  if (!pattern.test(hex)) {
    throw createColorError(
      MODULE_IDS.COLOR_BYTE,
      'INVALID_HEX',
      hex,
      {
        expectedFormat: pattern.source,
        reason: 'Hex color must be 6 digits after #',
      }
    );
  }
  return hex;
}
```

---

### NOISE Errors (0x0800–0x08FF)

#### NOISE_INVALID_PARAMS — 0x0801

**Context Schema:**
```json
{
  "params": {
    "scale": "number",
    "octaves": "number",
    "persistence": "number"
  },
  "reason": "string"
}
```

**Valid Ranges:**
- `scale`: [0, 1]
- `octaves`: [1, 8]
- `persistence`: [0, 1]

---

### RENDER Errors (0x0900–0x09FF)

#### RENDER_CONTEXT_LOST — 0x0901

**Severity:** FATAL

**Context Schema:**
```json
{
  "canvasId": "string",
  "contextType": "string (2d|webgl|webgl2)",
  "lastOperation": "string",
  "errorDetail": "string"
}
```

**Recovery:**
```javascript
function getCanvasContext(canvas, type = '2d') {
  const ctx = canvas.getContext(type);
  
  if (!ctx) {
    throw new BytecodeError(
      ERROR_CATEGORIES.RENDER,
      ERROR_SEVERITY.FATAL,
      MODULE_IDS.IMGPIX,
      ERROR_CODES.RENDER_CONTEXT_LOST,
      {
        canvasId: canvas.id,
        contextType: type,
        errorDetail: 'getContext returned null',
      }
    );
  }
  
  return ctx;
}
```

---

## Error Code Ranges by Category

```
TYPE:     0x0000 – 0x00FF  (0–255)
VALUE:    0x0100 – 0x01FF  (256–511)
RANGE:    0x0200 – 0x02FF  (512–767)
STATE:    0x0300 – 0x03FF  (768–1023)
HOOK:     0x0400 – 0x04FF  (1024–1279)
EXT:      0x0500 – 0x05FF  (1280–1535)
COORD:    0x0600 – 0x06FF  (1536–1791)
COLOR:    0x0700 – 0x07FF  (1792–2047)
NOISE:    0x0800 – 0x08FF  (2048–2303)
RENDER:   0x0900 – 0x09FF  (2304–2559)
CANVAS:   0x0A00 – 0x0AFF  (2560–2815)
FORMULA:  0x0B00 – 0x0BFF  (2816–3071)
```

Each category has 256 possible error codes. Current implementation uses codes 0x0001–0x0B03 (35 codes).

---

## Severity Encoding

| Severity | Numeric | Description |
|----------|---------|-------------|
| FATAL | 4 | System halt, cannot recover |
| CRIT | 3 | Critical, operation failed |
| WARN | 2 | Warning, degraded operation |
| INFO | 1 | Informational, non-blocking |

**AI Processing Priority:**
```javascript
const severityPriority = {
  FATAL: 0,  // Process first
  CRIT:  1,
  WARN:  2,
  INFO:  3,  // Process last
};
```

---

## Module ID Encoding

Module IDs are 4-6 character uppercase strings:

```
EXTREG   (Extension Registry)
IMGSEM   (Image-to-Semantic)
IMGPIX   (Image-to-Pixel)
IMGFOR   (Image-to-Formula)
COORD    (Coordinate Mapping)
COLBYT   (Color-Byte Mapping)
ANTIAL   (Anti-Alias Control)
NOISE    (Procedural Noise)
TMPLT    (Template Grid)
GEARGL   (Gear Glide AMP)
SHARED   (Shared Utilities)
```

**Encoding Rule:** First 4-6 significant characters, uppercase, no spaces.
