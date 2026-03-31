/**
 * PixelBrain Bytecode Error Encoder
 * 
 * Encodes errors into a mathematical bytecode format that AIs can parse
 * and understand with precision. Each error is represented as a structured
 * bytecode payload containing error classification, location, and recovery hints.
 * 
 * BYTECODE ERROR SCHEMA:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}-{CHECKSUM}              │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * COMPONENTS:
 *   - PB-ERR: PixelBrain Error marker
 *   - v1: Schema version
 *   - CATEGORY: Error domain (TYPE|VALUE|RANGE|STATE|HOOK|EXT|COORD|COLOR|NOISE|RENDER)
 *   - SEVERITY: Impact level (FATAL|CRIT|WARN|INFO)
 *   - MODULE: Source module identifier
 *   - CODE: Hex-encoded error code with embedded metadata
 *   - CHECKSUM: FNV-1a hash for integrity verification
 * 
 * AI PARSING NOTES:
 *   - All fields are uppercase, dash-separated
 *   - CODE field contains base64-encoded JSON with detailed context
 *   - CHECKSUM validates message integrity (prevents hallucination)
 *   - Deterministic: same error always produces same bytecode
 */

import { hashString } from './shared.js';

// ─── Error Categories ────────────────────────────────────────────────────────

export const ERROR_CATEGORIES = Object.freeze({
  TYPE: 'TYPE',           // Type mismatch, invalid input type
  VALUE: 'VALUE',         // Invalid value, enum violation
  RANGE: 'RANGE',         // Out of bounds, exceeds limits
  STATE: 'STATE',         // Invalid state, lifecycle violation
  HOOK: 'HOOK',           // Hook execution failure
  EXT: 'EXT',             // Extension registration/conflict
  COORD: 'COORD',         // Coordinate mapping error
  COLOR: 'COLOR',         // Color conversion/byte mapping
  NOISE: 'NOISE',         // Procedural noise generation
  RENDER: 'RENDER',       // Rendering pipeline error
  CANVAS: 'CANVAS',       // Canvas context/size issues
  FORMULA: 'FORMULA',     // Formula parsing/evaluation
});

// ─── Error Severity Levels ───────────────────────────────────────────────────

export const ERROR_SEVERITY = Object.freeze({
  FATAL: 'FATAL',   // System halt, cannot recover
  CRIT: 'CRIT',     // Critical, operation failed
  WARN: 'WARN',     // Warning, degraded operation
  INFO: 'INFO',     // Informational, non-blocking
});

// ─── Module Identifiers ──────────────────────────────────────────────────────

export const MODULE_IDS = Object.freeze({
  EXT_REGISTRY: 'EXTREG',
  EXT: 'EXTREG',  // Alias for EXT_REGISTRY
  IMG_SEMANTIC: 'IMGSEM',
  IMG_PIXEL: 'IMGPIX',
  IMG_FORMULA: 'IMGFOR',
  COORD_MAP: 'COORD',
  COORD: 'COORD',  // Alias for COORD_MAP
  COLOR_BYTE: 'COLBYT',
  ANTI_ALIAS: 'ANTIAL',
  NOISE_GEN: 'NOISE',
  TEMPLATE: 'TMPLT',
  GEAR_GLIDE: 'GEARGL',
  SHARED: 'SHARED',
});

// ─── Error Codes (per category) ──────────────────────────────────────────────

export const ERROR_CODES = Object.freeze({
  // TYPE errors
  TYPE_MISMATCH: 0x0001,
  NULL_INPUT: 0x0002,
  UNDEFINED_PROP: 0x0003,
  
  // VALUE errors
  INVALID_ENUM: 0x0101,
  INVALID_FORMAT: 0x0102,
  MISSING_REQUIRED: 0x0103,
  INVALID_VALUE: 0x0104,  // Generic invalid value error
  
  // RANGE errors
  OUT_OF_BOUNDS: 0x0201,
  EXCEEDS_MAX: 0x0202,
  BELOW_MIN: 0x0203,
  
  // STATE errors
  INVALID_STATE: 0x0301,
  LIFECYCLE_VIOLATION: 0x0302,
  RACE_CONDITION: 0x0303,
  
  // HOOK errors
  HOOK_NOT_FN: 0x0401,
  HOOK_TIMEOUT: 0x0402,
  HOOK_CHAIN_BREAK: 0x0403,
  
  // EXT errors
  EXT_ALREADY_REGISTERED: 0x0501,
  EXT_NOT_FOUND: 0x0502,
  EXT_CONFLICT: 0x0503,
  EXT_MISSING_ID: 0x0504,
  
  // COORD errors
  COORD_INVALID: 0x0601,
  COORD_OUT_OF_BOUNDS: 0x0602,
  COORD_TRANSFORM_FAIL: 0x0603,
  
  // COLOR errors
  COLOR_INVALID_HEX: 0x0701,
  COLOR_INVALID_HSL: 0x0702,
  COLOR_BYTE_MISMATCH: 0x0703,
  
  // NOISE errors
  NOISE_INVALID_PARAMS: 0x0801,
  NOISE_OVERFLOW: 0x0802,
  
  // RENDER errors
  RENDER_CONTEXT_LOST: 0x0901,
  RENDER_SIZE_INVALID: 0x0902,
  RENDER_FAILED: 0x0903,
  
  // CANVAS errors
  CANVAS_NOT_FOUND: 0x0A01,
  CANVAS_SIZE_ZERO: 0x0A02,
  
  // FORMULA errors
  FORMULA_PARSE_FAIL: 0x0B01,
  FORMULA_EVAL_FAIL: 0x0B02,
  FORMULA_INVALID_SYNTAX: 0x0B03,
});

// ─── Bytecode Error Class ────────────────────────────────────────────────────

export class BytecodeError extends Error {
  constructor(category, severity, moduleId, errorCode, context = {}) {
    const bytecode = encodeBytecodeError(category, severity, moduleId, errorCode, context);
    super(bytecode);
    this.name = 'BytecodeError';
    this.bytecode = bytecode;
    this.category = category;
    this.severity = severity;
    this.moduleId = moduleId;
    this.errorCode = errorCode;
    this.context = context;
    this.timestamp = Date.now();
    
    // AI-parsable metadata
    this.aiMetadata = {
      parseable: true,
      schemaVersion: 'v1',
      deterministic: true,
      checksumVerified: true,
    };
  }
  
  // Get structured error data for AI consumption
  toJSON() {
    return {
      bytecode: this.bytecode,
      category: this.category,
      severity: this.severity,
      moduleId: this.moduleId,
      errorCode: this.errorCode,
      errorCodeHex: `0x${this.errorCode.toString(16).toUpperCase().padStart(4, '0')}`,
      context: this.context,
      timestamp: this.timestamp,
      aiMetadata: this.aiMetadata,
    };
  }
  
  // Get recovery hints for AI-assisted debugging
  getRecoveryHints() {
    return getRecoveryHintsForError(this.category, this.errorCode, this.context);
  }
}

// ─── Bytecode Encoding ───────────────────────────────────────────────────────

/**
 * Encodes an error into the PixelBrain bytecode format.
 * 
 * @param {string} category - Error category from ERROR_CATEGORIES
 * @param {string} severity - Error severity from ERROR_SEVERITY
 * @param {string} moduleId - Module identifier from MODULE_IDS
 * @param {number} errorCode - Numeric error code from ERROR_CODES
 * @param {object} context - Additional error context
 * @returns {string} Bytecode error string
 */
export function encodeBytecodeError(category, severity, moduleId, errorCode, context = {}) {
  // Validate inputs
  if (!ERROR_CATEGORIES[category]) {
    throw new Error(`Invalid error category: ${category}`);
  }
  if (!ERROR_SEVERITY[severity]) {
    throw new Error(`Invalid error severity: ${severity}`);
  }
  // Validate moduleId by checking if it's a valid module ID value
  const validModuleIds = Object.values(MODULE_IDS);
  if (!validModuleIds.includes(moduleId)) {
    throw new Error(`Invalid module ID: ${moduleId}. Valid values: ${validModuleIds.join(', ')}`);
  }
  if (typeof errorCode !== 'number' || errorCode < 0 || errorCode > 0xFFFF) {
    throw new Error(`Invalid error code: ${errorCode}`);
  }
  
  // Encode context as base64 JSON
  const contextJSON = JSON.stringify(context);
  const contextB64 = btoa(unescape(encodeURIComponent(contextJSON)));
  
  // Build bytecode string (without checksum)
  const codeHex = errorCode.toString(16).toUpperCase().padStart(4, '0');
  const partialBytecode = `PB-ERR-v1-${category}-${severity}-${moduleId}-${codeHex}-${contextB64}`;
  
  // Calculate checksum for integrity
  const checksum = hashString(partialBytecode).toString(16).toUpperCase().padStart(8, '0');
  
  return `${partialBytecode}-${checksum}`;
}

/**
 * Decodes a bytecode error string into structured data.
 * 
 * @param {string} bytecode - Bytecode error string
 * @returns {object|null} Decoded error data or null if invalid
 */
export function decodeBytecodeError(bytecode) {
  try {
    const parts = String(bytecode || '').trim().split('-');
    
    // Validate structure: PB-ERR-v1-CAT-SEV-MOD-CODE-B64-CHECKSUM
    if (parts.length < 8) {
      return null;
    }
    if (parts[0] !== 'PB' || parts[1] !== 'ERR') {
      return null;
    }
    
    const version = parts[2];
    const category = parts[3];
    const severity = parts[4];
    const moduleId = parts[5];
    const codeHex = parts[6];
    
    // Reconstruct base64 (may contain dashes if context was large)
    const checksum = parts[parts.length - 1];
    const contextB64 = parts.slice(7, parts.length - 1).join('-');
    
    // Verify checksum
    const partialBytecode = `PB-ERR-v1-${category}-${severity}-${moduleId}-${codeHex}-${contextB64}`;
    const expectedChecksum = hashString(partialBytecode).toString(16).toUpperCase().padStart(8, '0');
    
    if (checksum.toUpperCase() !== expectedChecksum) {
      return {
        valid: false,
        error: 'CHECKSUM_MISMATCH',
        message: 'Bytecode integrity verification failed',
      };
    }
    
    // Decode context
    let context = {};
    try {
      const contextJSON = decodeURIComponent(escape(atob(contextB64)));
      context = JSON.parse(contextJSON);
    } catch (e) {
      context = { parseError: 'CONTEXT_DECODE_FAILED' };
    }
    
    return {
      valid: true,
      version,
      category,
      severity,
      moduleId,
      errorCode: parseInt(codeHex, 16),
      errorCodeHex: `0x${codeHex}`,
      context,
      checksum,
      aiMetadata: {
        parseable: true,
        schemaVersion: version,
        deterministic: true,
        checksumVerified: true,
      },
    };
  } catch (e) {
    return {
      valid: false,
      error: 'DECODE_EXCEPTION',
      message: e.message,
    };
  }
}

// ─── Recovery Hints ──────────────────────────────────────────────────────────

/**
 * Provides AI-understandable recovery hints for error resolution.
 * 
 * @param {string} category - Error category
 * @param {number} errorCode - Error code
 * @param {object} context - Error context
 * @returns {object} Recovery hints with mathematical precision
 */
export function getRecoveryHintsForError(category, errorCode, context = {}) {
  const hints = {
    category,
    errorCode,
    suggestions: [],
    constraints: [],
    invariants: [],
  };
  
  switch (category) {
    case ERROR_CATEGORIES.TYPE:
      hints.suggestions.push('Validate input types before function calls');
      hints.suggestions.push('Use typeof checks for primitive types');
      hints.constraints.push('All function parameters must match expected types');
      hints.invariants.push('typeof value === expectedType');
      break;
      
    case ERROR_CATEGORIES.VALUE:
      hints.suggestions.push('Check enum membership with Set.has()');
      hints.suggestions.push('Validate required fields before processing');
      hints.constraints.push('Values must be from allowed set');
      hints.invariants.push('allowedValues.has(value) === true');
      break;
      
    case ERROR_CATEGORIES.RANGE:
      hints.suggestions.push('Clamp values to valid range using Math.max/min');
      hints.suggestions.push('Add boundary checks before array access');
      hints.constraints.push('Index must satisfy: 0 <= index < length');
      hints.invariants.push('value >= min && value <= max');
      break;
      
    case ERROR_CATEGORIES.STATE:
      hints.suggestions.push('Implement state machine with explicit transitions');
      hints.suggestions.push('Add lifecycle guards to async operations');
      hints.constraints.push('State transitions must follow valid paths');
      hints.invariants.push('validTransitions[currentState].includes(nextState)');
      break;
      
    case ERROR_CATEGORIES.HOOK:
      hints.suggestions.push('Verify hook is callable with typeof hook === "function"');
      hints.suggestions.push('Wrap hook calls in try-catch with timeout');
      hints.constraints.push('Hooks must be pure functions (no side effects)');
      hints.invariants.push('hook(payload) returns same type as payload');
      break;
      
    case ERROR_CATEGORIES.EXT:
      hints.suggestions.push('Check extension ID uniqueness before registration');
      hints.suggestions.push('Validate extension object structure');
      hints.constraints.push('Extension ID must be non-empty string');
      hints.invariants.push('!extensions.has(extension.id)');
      break;
      
    case ERROR_CATEGORIES.COORD:
      hints.suggestions.push('Validate coordinates against canvas bounds');
      hints.suggestions.push('Use clamp01() for normalized coordinates');
      hints.constraints.push('Coordinates must satisfy: 0 <= x < width, 0 <= y < height');
      hints.invariants.push('x >= 0 && x < canvas.width && y >= 0 && y < canvas.height');
      break;
      
    case ERROR_CATEGORIES.COLOR:
      hints.suggestions.push('Validate hex format: /^#[0-9A-F]{6}$/i');
      hints.suggestions.push('Use hslToHex() for HSL conversion');
      hints.constraints.push('HSL: 0 <= h < 360, 0 <= s <= 100, 0 <= l <= 100');
      hints.invariants.push('/^#[0-9A-Fa-f]{6}$/.test(hexColor)');
      break;
      
    case ERROR_CATEGORIES.NOISE:
      hints.suggestions.push('Ensure noise parameters are in [0, 1] range');
      hints.suggestions.push('Use seeded random for deterministic output');
      hints.constraints.push('Noise input must be normalized');
      hints.invariants.push('input >= 0 && input <= 1');
      break;
      
    case ERROR_CATEGORIES.RENDER:
      hints.suggestions.push('Check canvas context availability');
      hints.suggestions.push('Validate canvas dimensions before rendering');
      hints.constraints.push('Canvas dimensions must be > 0');
      hints.invariants.push('canvas.width > 0 && canvas.height > 0');
      break;
      
    default:
      hints.suggestions.push('Review error context for specific issue');
      hints.suggestions.push('Check module documentation');
  }
  
  // Add context-specific hints
  if (context.expectedType) {
    hints.suggestions.push(`Expected type: ${context.expectedType}`);
  }
  if (context.actualType) {
    hints.suggestions.push(`Actual type: ${context.actualType}`);
  }
  if (context.minValue !== undefined) {
    hints.constraints.push(`Minimum value: ${context.minValue}`);
  }
  if (context.maxValue !== undefined) {
    hints.constraints.push(`Maximum value: ${context.maxValue}`);
  }
  if (context.allowedValues) {
    hints.constraints.push(`Allowed values: ${JSON.stringify(context.allowedValues)}`);
  }
  
  return Object.freeze(hints);
}

// ─── Convenience Error Factories ─────────────────────────────────────────────

/**
 * Creates a type mismatch error.
 */
export function createTypeMismatchError(moduleId, expectedType, actualType, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.TYPE,
    ERROR_SEVERITY.CRIT,
    moduleId,
    ERROR_CODES.TYPE_MISMATCH,
    { expectedType, actualType, ...context }
  );
}

/**
 * Creates an out of bounds error.
 */
export function createOutOfBoundsError(moduleId, value, min, max, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.RANGE,
    ERROR_SEVERITY.CRIT,
    moduleId,
    ERROR_CODES.OUT_OF_BOUNDS,
    { value, min, max, ...context }
  );
}

/**
 * Creates an extension registration error.
 */
export function createExtensionError(moduleId, code, extensionId, context = {}) {
  const errorCode = code === 'ALREADY_REGISTERED' ? ERROR_CODES.EXT_ALREADY_REGISTERED
    : code === 'NOT_FOUND' ? ERROR_CODES.EXT_NOT_FOUND
    : code === 'CONFLICT' ? ERROR_CODES.EXT_CONFLICT
    : ERROR_CODES.EXT_MISSING_ID;
    
  return new BytecodeError(
    ERROR_CATEGORIES.EXT,
    ERROR_SEVERITY.CRIT,
    moduleId,
    errorCode,
    { extensionId, ...context }
  );
}

/**
 * Creates a hook execution error.
 */
export function createHookError(moduleId, hookType, reason, context = {}) {
  const errorCode = reason === 'NOT_FUNCTION' ? ERROR_CODES.HOOK_NOT_FN
    : reason === 'TIMEOUT' ? ERROR_CODES.HOOK_TIMEOUT
    : ERROR_CODES.HOOK_CHAIN_BREAK;
    
  return new BytecodeError(
    ERROR_CATEGORIES.HOOK,
    ERROR_SEVERITY.CRIT,
    moduleId,
    errorCode,
    { hookType, reason, ...context }
  );
}

/**
 * Creates a coordinate mapping error.
 */
export function createCoordinateError(moduleId, code, coords, bounds, context = {}) {
  const errorCode = code === 'INVALID' ? ERROR_CODES.COORD_INVALID
    : code === 'OUT_OF_BOUNDS' ? ERROR_CODES.COORD_OUT_OF_BOUNDS
    : ERROR_CODES.COORD_TRANSFORM_FAIL;
    
  return new BytecodeError(
    ERROR_CATEGORIES.COORD,
    ERROR_SEVERITY.CRIT,
    moduleId,
    errorCode,
    { coords, bounds, ...context }
  );
}

/**
 * Creates a color conversion error.
 */
export function createColorError(moduleId, code, colorValue, context = {}) {
  const errorCode = code === 'INVALID_HEX' ? ERROR_CODES.COLOR_INVALID_HEX
    : code === 'INVALID_HSL' ? ERROR_CODES.COLOR_INVALID_HSL
    : ERROR_CODES.COLOR_BYTE_MISMATCH;
    
  return new BytecodeError(
    ERROR_CATEGORIES.COLOR,
    ERROR_SEVERITY.WARN,
    moduleId,
    errorCode,
    { colorValue, ...context }
  );
}

// ─── AI Parser Utility ───────────────────────────────────────────────────────

/**
 * Parses any error message and returns structured AI-understandable data.
 * If the error is a BytecodeError, decodes it. Otherwise, attempts to classify.
 * 
 * @param {Error|string} error - Error to parse
 * @returns {object} Structured error data
 */
export function parseErrorForAI(error) {
  if (!error) {
    return {
      valid: false,
      error: 'NULL_INPUT',
      message: 'No error provided',
    };
  }
  
  // Handle BytecodeError
  if (error instanceof BytecodeError) {
    return {
      ...error.toJSON(),
      recoveryHints: error.getRecoveryHints(),
    };
  }
  
  // Handle bytecode string
  if (typeof error === 'string' && error.startsWith('PB-ERR-')) {
    const decoded = decodeBytecodeError(error);
    if (decoded.valid) {
      return {
        ...decoded,
        recoveryHints: getRecoveryHintsForError(decoded.category, decoded.errorCode, decoded.context),
      };
    }
    return decoded;
  }
  
  // Handle standard Error
  if (error instanceof Error) {
    return {
      valid: false,
      error: 'STANDARD_ERROR',
      type: error.name,
      message: error.message,
      stack: error.stack,
      aiMetadata: {
        parseable: false,
        schemaVersion: null,
        deterministic: false,
        checksumVerified: false,
      },
    };
  }
  
  // Unknown error type
  return {
    valid: false,
    error: 'UNKNOWN_TYPE',
    message: String(error),
    aiMetadata: {
      parseable: false,
      schemaVersion: null,
      deterministic: false,
      checksumVerified: false,
    },
  };
}
