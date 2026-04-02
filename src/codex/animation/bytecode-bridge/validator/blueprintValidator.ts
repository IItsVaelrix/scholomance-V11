/**
 * Bytecode Blueprint Bridge — Validation Layer
 * 
 * Validates parsed AnimationBlueprintV1 objects for structural and semantic correctness.
 * Separate from parsing: parsing answers "can this be read?", validation answers "is this legal?"
 */

import {
  AnimationBlueprintV1,
  BlueprintValidateResult,
  DiagnosticEntry,
  BLUEPRINT_ERROR_CODES,
  TransformSpec,
  SymmetrySpec,
  GridSpec,
  EnvelopeSpec,
} from "../contracts/blueprint.types.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_ENVELOPE_PARAMS: Record<string, string[]> = {
  constant: ["value"],
  sine: ["amplitude", "period", "phase"],
  triangle: ["amplitude", "period"],
  expDecay: ["start", "halfLife"],
  pulse: ["peak", "duration", "decay"],
  bezier: ["points"],
  keyed: ["keyframes"],
};

const VALID_EASING_TOKENS = new Set([
  "LINEAR",
  "EASE_IN",
  "EASE_OUT",
  "EASE_IN_OUT",
  "IN_OUT_ARC",
  "OUT_ARC",
  "IN_BACK",
  "OUT_BACK",
  "IN_OUT_BACK",
  "SPRING",
  "SPRING_GENTLE",
  "SPRING_SNAPPY",
]);

// ─── Core Validator ──────────────────────────────────────────────────────────

/**
 * Validate an AnimationBlueprintV1 object
 */
export function validateBlueprint(blueprint: AnimationBlueprintV1): BlueprintValidateResult {
  const errors: DiagnosticEntry[] = [];
  const warnings: DiagnosticEntry[] = [];

  // Structural validation
  validateStructure(blueprint, errors, warnings);

  // Semantic validation
  validateSemantics(blueprint, errors, warnings);

  // Backend capability validation
  validateBackendCapabilities(blueprint, errors, warnings);

  // Performance validation
  validatePerformance(blueprint, errors, warnings);

  // QA validation
  validateQA(blueprint, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Structural Validation ───────────────────────────────────────────────────

function validateStructure(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // ID validation
  if (!blueprint.id || blueprint.id.trim() === "") {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_MISSING_TARGET,
      "Blueprint ID is required and cannot be empty"
    ));
  }

  // Target validation
  if (!blueprint.target || !blueprint.target.value) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_MISSING_TARGET,
      "Target selector is required"
    ));
  }

  // Duration validation
  if (blueprint.durationMs <= 0) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
      "Duration must be a positive number"
    ));
  }

  // Delay validation
  if (blueprint.delayMs !== undefined && blueprint.delayMs < 0) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
      "Delay cannot be negative"
    ));
  }

  // Loop validation
  if (typeof blueprint.loop === "number" && blueprint.loop < 0) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
      "Loop count cannot be negative"
    ));
  }

  // Easing validation
  if (blueprint.easing.type === "token") {
    const tokenValue = String(blueprint.easing.value).toUpperCase();
    if (!VALID_EASING_TOKENS.has(tokenValue)) {
      warnings.push(createValidationWarning(
        `Unknown easing token: ${blueprint.easing.value}. Valid tokens: ${Array.from(VALID_EASING_TOKENS).join(", ")}`
      ));
    }
  }

  // Phase validation
  if (blueprint.phase !== undefined && (blueprint.phase < 0 || blueprint.phase > 1)) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
      "Phase must be between 0 and 1"
    ));
  }
}

// ─── Semantic Validation ─────────────────────────────────────────────────────

function validateSemantics(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // Validate transforms
  if (blueprint.transforms) {
    validateTransforms(blueprint.transforms, errors, warnings);
  }

  // Validate envelopes
  if (blueprint.envelopes) {
    validateEnvelopes(blueprint.envelopes, errors, warnings);
  }

  // Validate symmetry
  if (blueprint.symmetry) {
    validateSymmetry(blueprint.symmetry, errors, warnings);
  }

  // Validate grid
  if (blueprint.grid) {
    validateGrid(blueprint.grid, errors, warnings);
  }

  // Validate constraints consistency
  if (blueprint.constraints) {
    validateConstraintsConsistency(blueprint.constraints, errors, warnings);
  }
}

function validateTransforms(
  transforms: TransformSpec,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  const transformKeys = Object.keys(transforms) as Array<keyof TransformSpec>;
  
  for (const key of transformKeys) {
    const transform = transforms[key];
    if (!transform) continue;

    // Validate min/max coherence
    if (transform.min !== undefined && transform.max !== undefined) {
      if (transform.min > transform.max) {
        errors.push(createValidationError(
          BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
          `Transform ${key}: min (${transform.min}) cannot be greater than max (${transform.max})`
        ));
      }
    }

    // Validate base within bounds
    if (transform.base !== undefined) {
      if (transform.min !== undefined && transform.base < transform.min) {
        errors.push(createValidationError(
          BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
          `Transform ${key}: base (${transform.base}) is below min (${transform.min})`
        ));
      }
      if (transform.max !== undefined && transform.base > transform.max) {
        errors.push(createValidationError(
          BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
          `Transform ${key}: base (${transform.base}) is above max (${transform.max})`
        ));
      }
    }

    // Validate peak within bounds
    if (transform.peak !== undefined) {
      if (transform.min !== undefined && transform.peak < transform.min) {
        errors.push(createValidationError(
          BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
          `Transform ${key}: peak (${transform.peak}) is below min (${transform.min})`
        ));
      }
      if (transform.max !== undefined && transform.peak > transform.max) {
        errors.push(createValidationError(
          BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_TRANSFORM,
          `Transform ${key}: peak (${transform.peak}) is above max (${transform.max})`
        ));
      }
    }

    // Validate envelope if present
    if (transform.envelope) {
      validateEnvelope(key.toString(), transform.envelope, errors, warnings);
    }
  }
}

function validateEnvelopes(
  envelopes: Record<string, EnvelopeSpec>,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  for (const [target, envelope] of Object.entries(envelopes)) {
    validateEnvelope(target, envelope, errors, warnings);
  }
}

function validateEnvelope(
  target: string,
  envelope: EnvelopeSpec,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  const validParams = VALID_ENVELOPE_PARAMS[envelope.kind] || [];
  
  // Check for valid params
  for (const param of Object.keys(envelope.params)) {
    if (!validParams.includes(param.toLowerCase())) {
      warnings.push(createValidationWarning(
        `Envelope '${target}' (${envelope.kind}): Unknown parameter '${param}'. Valid params: ${validParams.join(", ")}`
      ));
    }
  }

  // Validate required params by kind
  if (envelope.kind === "sine" || envelope.kind === "triangle") {
    if (envelope.params.amplitude === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'amplitude'`
      ));
    }
    if (envelope.params.period === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'period'`
      ));
    }
  }

  if (envelope.kind === "expDecay") {
    if (envelope.params.start === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'start'`
      ));
    }
    if (envelope.params.halfLife === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'halfLife'`
      ));
    }
  }

  if (envelope.kind === "pulse") {
    if (envelope.params.peak === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'peak'`
      ));
    }
    if (envelope.params.duration === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_ENVELOPE_PARAM,
        `Envelope '${target}' (${envelope.kind}): Missing required parameter 'duration'`
      ));
    }
  }
}

function validateSymmetry(
  symmetry: SymmetrySpec,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // Radial symmetry requires order >= 2
  if (symmetry.type === "radial") {
    if (symmetry.order === undefined) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_MISSING_SYMMETRY_ORDER,
        "Radial symmetry requires ORDER to be specified"
      ));
    } else if (symmetry.order < 2) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.VALIDATE_INVALID_SYMMETRY_ORDER,
        `Radial symmetry ORDER must be >= 2, got ${symmetry.order}`
      ));
    }
  }

  // Validate origin if specified
  if (symmetry.origin) {
    if (symmetry.origin.x < 0 || symmetry.origin.y < 0) {
      warnings.push(createValidationWarning(
        "Symmetry origin coordinates are negative - ensure this is intentional"
      ));
    }
  }
}

function validateGrid(
  grid: GridSpec,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // Lattice mode requires latticeId
  if (grid.mode === "lattice" && !grid.latticeId) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_GRID_CONFLICT,
      "Grid mode 'lattice' requires a latticeId to be specified"
    ));
  }

  // Cell-space mode requires cell dimensions
  if (grid.mode === "cell-space") {
    if (grid.cellWidth === undefined || grid.cellHeight === undefined) {
      warnings.push(createValidationWarning(
        "Grid mode 'cell-space' works best with explicit cellWidth and cellHeight"
      ));
    }
  }

  // Snap requires grid mode
  if (grid.snap === true && grid.mode === "free") {
    warnings.push(createValidationWarning(
      "Grid snap enabled but mode is 'free' - snap may have no effect"
    ));
  }
}

function validateConstraintsConsistency(
  constraints: AnimationBlueprintV1["constraints"],
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // maxFrameMs sanity check
  if (constraints.maxFrameMs !== undefined) {
    if (constraints.maxFrameMs < 8) {
      warnings.push(createValidationWarning(
        `maxFrameMs of ${constraints.maxFrameMs}ms is very aggressive - most displays are 60fps (16.67ms)`
      ));
    }
    if (constraints.maxFrameMs > 100) {
      warnings.push(createValidationWarning(
        `maxFrameMs of ${constraints.maxFrameMs}ms is high - may result in perceptible lag`
      ));
    }
  }

  // maxPropertyCount sanity check
  if (constraints.maxPropertyCount !== undefined && constraints.maxPropertyCount < 1) {
    errors.push(createValidationError(
      BLUEPRINT_ERROR_CODES.VALIDATE_CONSTRAINT_VIOLATION,
      "maxPropertyCount must be at least 1"
    ));
  }
}

// ─── Backend Capability Validation ───────────────────────────────────────────

function validateBackendCapabilities(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // Check for backend-specific features that may not be supported
  if (blueprint.compositing?.pass === "pixelbrain") {
    if (blueprint.transforms?.blur) {
      warnings.push(createValidationWarning(
        "Blur transform may not be fully supported in PixelBrain backend"
      ));
    }
  }

  if (blueprint.compositing?.pass === "css") {
    if (blueprint.symmetry && blueprint.symmetry.type !== "none") {
      warnings.push(createValidationWarning(
        "Symmetry transforms require additional handling in CSS backend"
      ));
    }
  }

  // Check parity requirement with multiple backends
  if (blueprint.constraints?.requireParityAcrossBackends) {
    if (!blueprint.compositing || blueprint.compositing.pass === "css" || blueprint.compositing.pass === "phaser" || blueprint.compositing.pass === "pixelbrain" || blueprint.compositing.pass === "hybrid") {
      // Parity check is valid
    }
  }
}

// ─── Performance Validation ──────────────────────────────────────────────────

function validatePerformance(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  // Count properties
  let propertyCount = 0;
  
  if (blueprint.transforms) {
    propertyCount += Object.keys(blueprint.transforms).length;
  }
  
  if (blueprint.envelopes) {
    propertyCount += Object.keys(blueprint.envelopes).length;
  }

  if (blueprint.constraints?.maxPropertyCount !== undefined) {
    if (propertyCount > blueprint.constraints.maxPropertyCount) {
      errors.push(createValidationError(
        BLUEPRINT_ERROR_CODES.PERF_PROPERTY_COUNT_EXCEEDED,
        `Property count (${propertyCount}) exceeds maxPropertyCount (${blueprint.constraints.maxPropertyCount})`
      ));
    }
  }

  // Warn on high property count
  if (propertyCount > 10) {
    warnings.push(createValidationWarning(
      `High property count (${propertyCount}) - consider simplifying for better performance`
    ));
  }

  // Check for expensive combinations
  const hasExpensiveCombination = 
    blueprint.symmetry?.type === "radial" &&
    blueprint.transforms !== undefined &&
    Object.keys(blueprint.transforms).length > 3;

  if (hasExpensiveCombination) {
    warnings.push(createValidationWarning(
      "Radial symmetry with multiple transforms may impact performance on low-end devices"
    ));
  }
}

// ─── QA Validation ───────────────────────────────────────────────────────────

function validateQA(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): void {
  if (!blueprint.qa) return;

  // Validate invariant names
  if (blueprint.qa.invariants) {
    const validInvariants = new Set([
      "radial-symmetry-preserved",
      "scale-remains-within-bounds",
      "glow-decays-monotonically",
      "grid-snap-stable",
      "envelope-bounds-respected",
      "phase-offset-correct",
      "no-transform-drift",
      "deterministic-output",
    ]);

    for (const invariant of blueprint.qa.invariants) {
      if (!validInvariants.has(invariant)) {
        warnings.push(createValidationWarning(
          `Unknown QA invariant: '${invariant}'. Consider adding test coverage for this invariant.`
        ));
      }
    }
  }

  // Validate parity mode consistency
  if (blueprint.qa.parityMode === "strict" && !blueprint.constraints?.requireParityAcrossBackends) {
    warnings.push(createValidationWarning(
      "QA parityMode is 'strict' but constraints.requireParityAcrossBackends is not set"
    ));
  }
}

// ─── Error/Warning Helpers ───────────────────────────────────────────────────

function createValidationError(code: number, message: string): DiagnosticEntry {
  return {
    code: `ANIM_${code.toString(16).toUpperCase().padStart(4, "0")}`,
    severity: "error",
    category: "validation",
    message,
  };
}

function createValidationWarning(message: string): DiagnosticEntry {
  return {
    code: "ANIM_WARN",
    severity: "warning",
    category: "validation",
    message,
  };
}

// ─── Preset Expansion ────────────────────────────────────────────────────────

import { AnimationPresetV1 } from "../contracts/blueprint.types.ts";

/**
 * Expand presets in a blueprint with override precedence:
 * 1. explicit blueprint field
 * 2. expanded preset field
 * 3. system default
 */
export function expandPresets(
  blueprint: AnimationBlueprintV1,
  presets: Map<string, AnimationPresetV1>
): AnimationBlueprintV1 {
  if (!blueprint.preset) {
    return blueprint;
  }

  const preset = presets.get(blueprint.preset);
  if (!preset) {
    // Preset not found - return blueprint with warning added to metadata
    return {
      ...blueprint,
      metadata: {
        ...blueprint.metadata,
        tags: [...(blueprint.metadata?.tags || []), `warning:preset-not-found:${blueprint.preset}`],
      },
    };
  }

  // Merge preset defaults with blueprint overrides
  const expanded: AnimationBlueprintV1 = {
    ...blueprint,
    ...preset.defaults,
    // Blueprint fields always win
    ...blueprint,
    // Deep merge transforms
    transforms: {
      ...preset.defaults.transforms,
      ...blueprint.transforms,
    },
    // Deep merge envelopes
    envelopes: {
      ...preset.defaults.envelopes,
      ...blueprint.envelopes,
    },
  };

  return expanded;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const BlueprintValidator = {
  validate: validateBlueprint,
  expandPresets,
};
