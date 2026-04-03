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
| **LINGUISTIC** | **0x0C01** | **`0C01`** | **CRIT** | **LINGUA** | **Phonemic saturation** |
| **LINGUISTIC** | **0x0C02** | **`0C02`** | **CRIT** | **LINGUA** | **Resonance mismatch** |
| **LINGUISTIC** | **0x0C03** | **`0C03`** | **CRIT** | **LINGUA** | **Meter degradation** |
| **LINGUISTIC** | **0x0C04** | **`0C04`** | **WARN** | **LINGUA** | **Syllable overflow** |
| **LINGUISTIC** | **0x0C05** | **`0C05`** | **WARN** | **LINGUA** | **Vowel family mismatch** |
| **COMBAT** | **0x0D01** | **`0D01`** | **CRIT** | **COMBAT** | **Force dissipation** |
| **COMBAT** | **0x0D02** | **`0D02`** | **CRIT** | **COMBAT** | **Entropic repetition** |
| **COMBAT** | **0x0D03** | **`0D03`** | **CRIT** | **COMBAT** | **Mana void exception** |
| **COMBAT** | **0x0D04** | **`0D04`** | **WARN** | **COMBAT** | **Spell cascade failure** |
| **UI_STASIS** | **0x0E01** | **`0E01`** | **CRIT** | **UISTAS** | **Click handler stall** |
| **UI_STASIS** | **0x0E02** | **`0E02`** | **CRIT** | **UISTAS** | **Animation lifecycle hang** |
| **UI_STASIS** | **0x0E03** | **`0E03`** | **CRIT** | **UISTAS** | **Event listener leak** |
| **UI_STASIS** | **0x0E04** | **`0E04`** | **WARN** | **UISTAS** | **Focus trap escape** |
| **UI_STASIS** | **0x0E05** | **`0E05`** | **CRIT** | **UISTAS** | **Pointer capture failure** |
| **UI_STASIS** | **0x0E06** | **`0E06`** | **CRIT** | **UISTAS** | **RAF loop orphan** |
| **UI_STASIS** | **0x0E07** | **`0E07`** | **CRIT** | **UISTAS** | **Interval timer leak** |
| **UI_STASIS** | **0x0E08** | **`0E08`** | **WARN** | **UISTAS** | **Transition interrupt** |

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

### LINGUISTIC Errors (0x0C00–0x0CFF) — World-Law Violations

> **Domain:** Violations of the core phonemic and syntactic constants. These errors describe the collapse of linguistic laws in a world where Syntax is Physics.

#### PHONEMIC_SATURATION — 0x0C01

**Bytecode Pattern:**
```
PB-ERR-v1-LINGUISTIC-CRIT-LINGUA-0C01-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "componentId": "string",
  "phonemeDensity": "number",
  "maxDensity": "number",
  "vowelFamily": "string",
  "syllableCount": "number"
}
```

**When Thrown:**
- Phoneme density exceeds component's vessel capacity
- Truesight overlay cannot render additional phonemic glyphs
- Scroll analysis produces unsustainable phonemic load

**Recovery Invariants:**
```javascript
phonemeDensity <= maxDensity
syllableCount <= MAX_SYLLABLES_PER_VESSEL
```

**Fix Pattern:**
```javascript
function analyzePhonemicDensity(text, maxDensity = 0.85) {
  const density = calculatePhonemeDensity(text);
  
  if (density > maxDensity) {
    throw new BytecodeError(
      ERROR_CATEGORIES.LINGUISTIC,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.LINGUA,
      ERROR_CODES.PHONEMIC_SATURATION,
      {
        componentId: 'truesight-overlay',
        phonemeDensity: density,
        maxDensity,
        vowelFamily: detectVowelFamily(text),
        syllableCount: countSyllables(text),
      }
    );
  }
  
  return density;
}
```

**Thematic Translation:**
> "The vessel overflows with phonemic weight. The ink cannot hold more sound."

**UI Expression:** (WARN severity) — Phonemic Static — A subtle "ink bleed" effect around the affected component. Border-glow pulses out of sync.

---

#### RESONANCE_MISMATCH — 0x0C02

**Bytecode Pattern:**
```
PB-ERR-v1-LINGUISTIC-CRIT-LINGUA-0C02-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "expectedRhymeKey": "string",
  "actualRhymeKey": "string",
  "wordPair": ["string", "string"],
  "rhymeScheme": "string"
}
```

**When Thrown:**
- Rhyme key expected to match but failed (Rhyme Law violation)
- Alliteration pattern broken mid-verse
- Assonance mapping produces conflicting vowel sounds

**Recovery Invariants:**
```javascript
rhymeKey(wordA) === rhymeKey(wordB)
vowelSound(wordA) matches vowelSound(wordB)
```

**Fix Pattern:**
```javascript
function validateRhymePair(wordA, wordB, expectedScheme) {
  const keyA = extractRhymeKey(wordA);
  const keyB = extractRhymeKey(wordB);
  
  if (keyA !== keyB) {
    throw new BytecodeError(
      ERROR_CATEGORIES.LINGUISTIC,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.LINGUA,
      ERROR_CODES.RESONANCE_MISMATCH,
      {
        expectedRhymeKey: keyA,
        actualRhymeKey: keyB,
        wordPair: [wordA, wordB],
        rhymeScheme: expectedScheme,
      }
    );
  }
  
  return true;
}
```

**Thematic Translation:**
> "The echoes do not answer. The rhyme-law is broken."

**UI Expression:** (CRIT severity) — Syntactic Glitch — The active school's color "vibrates" with high-frequency scanline noise. Text becomes jagged.

---

#### METER_DEGRADATION — 0x0C03

**Bytecode Pattern:**
```
PB-ERR-v1-LINGUISTIC-CRIT-LINGUA-0C03-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "expectedMeter": "string (iambic|trochaic|etc)",
  "actualPattern": "string",
  "deviationCount": "number",
  "lineNumber": "number",
  "structuralIntegrity": "number (0-1)"
}
```

**When Thrown:**
- Structural integrity of a scroll has collapsed below stability threshold
- Metrical pattern deviates beyond acceptable tolerance
- Rhythmic analysis detects critical instability

**Recovery Invariants:**
```javascript
structuralIntegrity >= MIN_STABILITY_THRESHOLD
deviationCount <= MAX_DEVIATIONS_PER_LINE
```

**Fix Pattern:**
```javascript
function analyzeMeter(lines, expectedMeter, minStability = 0.7) {
  const result = scanMeter(lines, expectedMeter);
  
  if (result.structuralIntegrity < minStability) {
    throw new BytecodeError(
      ERROR_CATEGORIES.LINGUISTIC,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.LINGUA,
      ERROR_CODES.METER_DEGRADATION,
      {
        expectedMeter,
        actualPattern: result.pattern,
        deviationCount: result.deviations,
        lineNumber: result.problemLine,
        structuralIntegrity: result.integrity,
      }
    );
  }
  
  return result;
}
```

**Thematic Translation:**
> "The rhythm falters. The verse's bones are brittle."

**UI Expression:** (CRIT severity) — Syntactic Glitch — The active school's color "vibrates" with high-frequency scanline noise. Text becomes jagged.

---

#### SYLLABLE_OVERFLOW — 0x0C04

**Bytecode Pattern:**
```
PB-ERR-v1-LINGUISTIC-WARN-LINGUA-0C04-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "word": "string",
  "syllableCount": "number",
  "maxSyllables": "number",
  "context": "string"
}
```

**When Thrown:**
- Word exceeds maximum syllable capacity for current operation
- Multi-syllabic analysis produces overflow state

**Recovery Invariants:**
```javascript
syllableCount <= maxSyllables
```

---

#### VOWEL_FAMILY_MISMATCH — 0x0C05

**Bytecode Pattern:**
```
PB-ERR-v1-LINGUISTIC-WARN-LINGUA-0C05-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "expectedFamily": "string",
  "actualFamily": "string",
  "phoneme": "string",
  "schoolMapping": "string"
}
```

**When Thrown:**
- Vowel family does not match expected school mapping
- Phoneme-to-school assignment conflicts

---

### COMBAT_LOGIC Errors (0x0D00–0x0DFF) — Arena Failures

> **Domain:** For failures in the arena of words. These errors describe combat-specific heuristic and kinetic failures.

#### FORCE_DISSIPATION — 0x0D01

**Bytecode Pattern:**
```
PB-ERR-v1-COMBAT-CRIT-COMBAT-0D01-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "spellId": "string",
  "calculatedForce": "number",
  "expectedForce": "number",
  "alliterationCount": "number",
  "dissipationFactor": "number"
}
```

**When Thrown:**
- Alliteration kinetic force calculation resulted in a non-finite value
- Force propagation fails to reach target
- Energy calculation produces NaN or Infinity

**Recovery Invariants:**
```javascript
Number.isFinite(calculatedForce)
calculatedForce > 0
```

**Fix Pattern:**
```javascript
function calculateSpellForce(spell, alliterationCount) {
  const force = baseForce * Math.pow(alliterationMultiplier, alliterationCount);
  
  if (!Number.isFinite(force) || force <= 0) {
    throw new BytecodeError(
      ERROR_CATEGORIES.COMBAT,
      ERROR_SEVERITY.CRIT,
      MODULE_IDS.COMBAT,
      ERROR_CODES.FORCE_DISSIPATION,
      {
        spellId: spell.id,
        calculatedForce: force,
        expectedForce: baseForce,
        alliterationCount,
        dissipationFactor: calculateDissipation(spell),
      }
    );
  }
  
  return force;
}
```

**Thematic Translation:**
> "The word's force scatters into silence. The alliteration's kinetic chain is broken."

**UI Expression:** (CRIT severity) — Syntactic Glitch — The active school's color "vibrates" with high-frequency scanline noise.

---

#### ENTROPIC_REPETITION — 0x0D02

**Bytecode Pattern:**
```
PB-ERR-v1-COMBAT-CRIT-COMBAT-0D02-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "spellId": "string",
  "repetitionCount": "number",
  "noveltyScore": "number",
  "rarityDecay": "number",
  "exploitThreshold": "number"
}
```

**When Thrown:**
- Novelty/Rarity heuristic reached an exploit-triggering decay state
- Spell repetition triggers anti-exploit decay
- Entropy calculation detects pattern abuse

**Recovery Invariants:**
```javascript
noveltyScore >= MIN_NOVELTY_THRESHOLD
repetitionCount < MAX_REPETITIONS_BEFORE_DECAY
```

---

#### MANA_VOID_EXCEPTION — 0x0D03

**Bytecode Pattern:**
```
PB-ERR-v1-COMBAT-CRIT-COMBAT-0D03-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "requiredMana": "number",
  "availableMana": "number",
  "spellId": "string",
  "deficit": "number"
}
```

**When Thrown:**
- Insufficient mana for spell casting
- Mana calculation produces negative void state

---

#### SPELL_CASCADE_FAILURE — 0x0D04

**Bytecode Pattern:**
```
PB-ERR-v1-COMBAT-WARN-COMBAT-0D04-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "primarySpell": "string",
  "cascadeChain": ["string"],
  "failurePoint": "number",
  "reason": "string"
}
```

**When Thrown:**
- Multi-spell cascade fails mid-chain
- Combo execution interrupted

---

### UI_STASIS Errors (0x0E00–0x0EFF) — Interface Freeze Detection

> **Domain:** UI stasis, freeze, and hang detection. These errors describe conditions where interactive elements become unresponsive or animations stall.

#### CLICK_HANDLER_STALL — 0x0E01

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E01-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "elementId": "string",
  "elementType": "string (button|link|input|etc)",
  "expectedState": "string",
  "actualState": "string",
  "operation": "string",
  "timeoutMs": "number",
  "actualDuration": "number"
}
```

**When Thrown:**
- Click handler exceeds timeout threshold
- Button remains in loading state beyond acceptable duration
- Async click operation never resolves

**Recovery Invariants:**
```javascript
handlerDuration < MAX_HANDLER_DURATION_MS
element.disabled === false after handler completes
```

**Fix Pattern:**
```javascript
async function clickWithTimeout(element, timeoutMs = 5000) {
  const startTime = Date.now();
  
  const handlerPromise = handleClick(element);
  
  const result = await Promise.race([
    handlerPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(
        new BytecodeError(
          ERROR_CATEGORIES.UI_STASIS,
          ERROR_SEVERITY.CRIT,
          MODULE_IDS.UI_STASIS,
          ERROR_CODES.CLICK_HANDLER_STALL,
          {
            elementId: element.id,
            elementType: element.tagName,
            expectedState: 'clickable',
            actualState: element.disabled ? 'disabled' : 'pending',
            operation: 'click-handler',
            timeoutMs,
          }
        )
      ), timeoutMs)
    ),
  ]);
  
  return { result, duration: Date.now() - startTime };
}
```

**Thematic Translation:**
> "The glyph refuses to answer touch. The word hangs suspended in the air."

**UI Expression:** (CRIT severity) — Syntactic Glitch — The active school's color "vibrates" with high-frequency scanline noise.

---

#### ANIMATION_LIFECYCLE_HANG — 0x0E02

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E02-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "animationType": "string (framer-motion|css-raf|css-interval)",
  "phase": "string (mount|update|unmount|interrupt)",
  "reason": "string",
  "componentId": "string",
  "frameCount": "number"
}
```

**When Thrown:**
- Animation never completes after component unmount
- Framer Motion exit animation stalls
- RAF loop continues after cleanup

**Recovery Invariants:**
```javascript
animationCleanupCalled === true
rafLoopRunning === false after unmount
```

---

#### EVENT_LISTENER_LEAK — 0x0E03

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E03-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "eventType": "string",
  "targetElement": "string",
  "listenerCount": "number",
  "expectedCount": "number",
  "componentId": "string"
}
```

**When Thrown:**
- Event listeners not cleaned up on unmount
- Document-level listeners accumulate
- Memory leak detected via listener count

---

#### FOCUS_TRAP_ESCAPE — 0x0E04

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-WARN-UISTAS-0E04-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "trapId": "string",
  "escapeMethod": "string (escape-key|blur|external-focus)",
  "focusLost": "boolean"
}
```

**When Thrown:**
- Focus trap allows unintended escape
- Escape key fails to dismiss modal
- Focus lost to external element

---

#### POINTER_CAPTURE_FAILURE — 0x0E05

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E05-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "elementId": "string",
  "pointerId": "number",
  "captureState": "string (captured|released|orphaned)",
  "operation": "string (drag|resize|draw)"
}
```

**When Thrown:**
- Pointer capture lost mid-drag
- Element unmounts while capturing pointer
- setPointerCapture fails silently

---

#### RAF_LOOP_ORPHAN — 0x0E06

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E06-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "loopId": "string",
  "componentId": "string",
  "frameCount": "number",
  "orphanedAfterUnmount": "boolean"
}
```

**When Thrown:**
- requestAnimationFrame loop continues after component unmount
- Animation frame cleanup not called
- Multiple RAF loops spawn without tracking

---

#### INTERVAL_TIMER_LEAK — 0x0E07

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E07-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "intervalId": "number",
  "intervalMs": "number",
  "componentId": "string",
  "clearedOnUnmount": "boolean"
}
```

**When Thrown:**
- setInterval not cleared on unmount
- Timer continues after component lifecycle ends
- Multiple intervals accumulate

---

#### TRANSITION_INTERRUPT — 0x0E08

**Bytecode Pattern:**
```
PB-ERR-v1-UI_STASIS-WARN-UISTAS-0E08-{CONTEXT_B64}-{CHECKSUM}
```

**Context Schema:**
```json
{
  "transitionType": "string (page|state|animation)",
  "interruptedAt": "number (progress 0-1)",
  "reason": "string (unmount|navigation|error)",
  "fromState": "string",
  "toState": "string"
}
```

**When Thrown:**
- Page transition interrupted by navigation
- State transition interrupted by unmount
- Animation transition cut short

---

## Error Code Ranges by Category

```
TYPE:       0x0000 – 0x00FF  (0–255)
VALUE:      0x0100 – 0x01FF  (256–511)
RANGE:      0x0200 – 0x02FF  (512–767)
STATE:      0x0300 – 0x03FF  (768–1023)
HOOK:       0x0400 – 0x04FF  (1024–1279)
EXT:        0x0500 – 0x05FF  (1280–1535)
COORD:      0x0600 – 0x06FF  (1536–1791)
COLOR:      0x0700 – 0x07FF  (1792–2047)
NOISE:      0x0800 – 0x08FF  (2048–2303)
RENDER:     0x0900 – 0x09FF  (2304–2559)
CANVAS:     0x0A00 – 0x0AFF  (2560–2815)
FORMULA:    0x0B00 – 0x0BFF  (2816–3071)
LINGUISTIC: 0x0C00 – 0x0CFF  (3072–3327)
COMBAT:     0x0D00 – 0x0DFF  (3328–3583)
UI_STASIS:  0x0E00 – 0x0EFF  (3584–3839)
```

Each category has 256 possible error codes. Current implementation uses codes 0x0001–0x0E08 (56 codes).

---

## Severity Encoding

| Severity | Numeric | Description | UI Expression (Scholomance) |
|----------|---------|-------------|-----------------------------|
| FATAL | 4 | System halt, cannot recover | The Void Unfurls — Entire UI collapses into a single high-contrast VOID (zinc) glyph. Background aurora stops. |
| CRIT | 3 | Critical, operation failed | Syntactic Glitch — The active school's color "vibrates" with high-frequency scanline noise. Text becomes jagged. |
| WARN | 2 | Warning, degraded operation | Phonemic Static — A subtle "ink bleed" effect around the affected component. Border-glow pulses out of sync. |
| INFO | 1 | Informational, non-blocking | Echo Trace — A faint, trailing shadow of the bytecode string appears in the status bar. |

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
LINGUA   (Linguistic Analysis)
COMBAT   (Combat Engine)
UISTAS   (UI Stasis Detection)
```

**Encoding Rule:** First 4-6 significant characters, uppercase, no spaces.
