# Bytecode Error System Documentation

## 📚 Documentation Index

Welcome to the **PixelBrain Bytecode Error System** documentation. This system provides mathematically precise, AI-parsable error encoding for deterministic error communication.

---

## 📖 Available Documents

### 1. [Bytecode Error System Overview](01_Bytecode_Error_System_Overview.md)

**Purpose:** Introduction and conceptual overview

**Contents:**
- Bytecode error format breakdown
- Error categories and severity levels
- Module identifiers
- API reference
- Integration guide
- Best practices

**Start here if:** You're new to the bytecode error system.

---

### 2. [Error Code Reference](02_Error_Code_Reference.md)

**Purpose:** Complete reference for all error codes

**Contents:**
- Quick reference table (all 35+ error codes)
- Detailed specifications per error
- Context schemas
- Example bytecodes
- Fix patterns and code samples
- Mathematical invariants

**Use this when:** You need to understand a specific error code.

---

### 3. [AI Parsing Guide](03_AI_Parsing_Guide.md)

**Purpose:** Implementation guide for AI error parsing

**Contents:**
- Complete parsing pipeline
- Checksum verification
- Context extraction
- Recovery hint generation
- Fix pattern matching
- Complete parser implementation
- Usage examples

**Use this when:** Implementing AI error handling.

---

## 🔍 Quick Lookup

### Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| TYPE | 0x0000–0x00FF | Type mismatches |
| VALUE | 0x0100–0x01FF | Invalid values |
| RANGE | 0x0200–0x02FF | Out of bounds |
| STATE | 0x0300–0x03FF | State violations |
| HOOK | 0x0400–0x04FF | Hook failures |
| EXT | 0x0500–0x05FF | Extension errors |
| COORD | 0x0600–0x06FF | Coordinate errors |
| COLOR | 0x0700–0x07FF | Color errors |
| NOISE | 0x0800–0x08FF | Noise generation |
| RENDER | 0x0900–0x09FF | Rendering errors |
| CANVAS | 0x0A00–0x0AFF | Canvas errors |
| FORMULA | 0x0B00–0x0BFF | Formula errors |

### Severity Levels

| Severity | Priority | Description |
|----------|----------|-------------|
| FATAL | 100 | System halt |
| CRIT | 75 | Operation failed |
| WARN | 50 | Degraded operation |
| INFO | 25 | Informational |

### Module IDs

- `EXTREG` — Extension Registry
- `IMGSEM` — Image-to-Semantic
- `IMGPIX` — Image-to-Pixel
- `IMGFOR` — Image-to-Formula
- `COORD` — Coordinate Mapping
- `COLBYT` — Color-Byte Mapping
- `ANTIAL` — Anti-Alias Control
- `NOISE` — Procedural Noise
- `TMPLT` — Template Grid
- `GEARGL` — Gear Glide AMP
- `SHARED` — Shared Utilities

---

## 🚀 Quick Start

### 1. Import Error System

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

### 2. Throw Bytecode Errors

```javascript
// Using factory function (recommended)
throw createTypeMismatchError(
  MODULE_IDS.IMGPIX,
  'string',
  typeof pixelData,
  { parameterName: 'pixelData' }
);

// Output: PB-ERR-v1-TYPE-CRIT-IMGPIX-0001-eyJ...-CHECKSUM
```

### 3. Parse Errors (AI-side)

```javascript
try {
  // Operation
} catch (error) {
  const errorData = parseErrorForAI(error);
  
  if (errorData.aiMetadata.parseable) {
    console.log('Category:', errorData.category);
    console.log('Recovery hints:', errorData.recoveryHints);
    console.log('Fix:', errorData.fix);
  }
}
```

---

## 📋 Bytecode Format

```
PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}-{CONTEXT_B64}-{CHECKSUM}
```

**Example:**
```
PB-ERR-v1-RANGE-CRIT-COORD-0201-eyJ2YWx1ZSI6MTUwLCJtaW4iOjAsIm1heCI6MTAwfQ==-A1B2C3D4
```

**Decoded:**
```json
{
  "category": "RANGE",
  "severity": "CRIT",
  "moduleId": "COORD",
  "errorCode": 513,
  "errorCodeHex": "0x0201",
  "context": {
    "value": 150,
    "min": 0,
    "max": 100
  },
  "recoveryHints": {
    "invariants": ["value >= min && value <= max"],
    "suggestions": ["Clamp values to valid range"]
  }
}
```

---

## 🔧 Common Tasks

### Look Up an Error Code

1. Open [Error Code Reference](02_Error_Code_Reference.md)
2. Find category in table of contents
3. Locate specific error code
4. Review context schema and fix pattern

### Implement Error Handling

1. Read [AI Parsing Guide](03_AI_Parsing_Guide.md)
2. Copy parser implementation
3. Customize for your use case
4. Test with sample errors

### Add New Error Codes

1. Open `codex/core/pixelbrain/bytecode-error.js`
2. Add code to `ERROR_CODES` object
3. Document in [Error Code Reference](02_Error_Code_Reference.md)
4. Add recovery hints to `getRecoveryHintsForError()`

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Generation                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Factory    │  │  Constructor│  │  Modules    │         │
│  │  Functions  │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         ↓                ↓                ↓                 │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Bytecode Encoder                         │       │
│  │  (Category + Severity + Module + Code + Context)│       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         FNV-1a Checksum                          │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│         PB-ERR-v1-CAT-SEV-MOD-CODE-B64-CHECKSUM            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    AI Parsing Pipeline                       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Structure Parser                         │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Checksum Verifier                       │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Context Decoder (Base64 → JSON)         │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Recovery Hint Extractor                 │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Fix Pattern Matcher                     │       │
│  └─────────────────────────────────────────────────┘       │
│                            ↓                                │
│         Structured AI-Understandable Data                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Principles

### 1. Deterministic

Same error always produces identical bytecode:
```javascript
const err1 = createTypeMismatchError(MODULE_IDS.IMGPIX, 'string', 'number', { p: 'x' });
const err2 = createTypeMismatchError(MODULE_IDS.IMGPIX, 'string', 'number', { p: 'x' });
console.log(err1.bytecode === err2.bytecode); // true
```

### 2. Self-Describing

All context embedded in bytecode:
```javascript
decodeBytecodeError(bytecode);
// Returns complete error data with no external dependencies
```

### 3. Verifiable

Checksum prevents corruption/hallucination:
```javascript
const decoded = decodeBytecodeError(bytecode);
if (!decoded.valid) {
  console.error('Bytecode corrupted!');
}
```

### 4. Actionable

Recovery hints guide fixes:
```javascript
error.getRecoveryHints();
// Returns suggestions, constraints, and mathematical invariants
```

---

## 🔗 Related Documentation

- [PixelBrain Architecture](../architecture/PIXELBRAIN_ARCHITECTURE.md)
- [Extension System](../architecture/EXTENSION_SYSTEM.md)
- [Error Handling Best Practices](../best-practices/ERROR_HANDLING.md)

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-03-31 | Initial release |

---

## 📞 Support

For questions or issues:
1. Check [Error Code Reference](02_Error_Code_Reference.md) for specific errors
2. Review [AI Parsing Guide](03_AI_Parsing_Guide.md) for implementation help
3. Consult [Overview](01_Bytecode_Error_System_Overview.md) for concepts

---

## ✅ Checklist for AI Systems

When implementing bytecode error handling:

- [ ] Import error system modules
- [ ] Implement checksum verification
- [ ] Add context decoder
- [ ] Extract recovery hints
- [ ] Implement fix pattern matching
- [ ] Add error priority calculation
- [ ] Test with sample errors
- [ ] Add error logging
- [ ] Implement batch parsing (optional)
- [ ] Add automated fix generation (optional)
