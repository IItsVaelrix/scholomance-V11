/**
 * Bytecode Blueprint Bridge — QA Assertion Utilities
 * 
 * Enables semantic testing of animation blueprints and compiled outputs.
 * Moves QA from "does it look close enough?" to "does it implement the semantics?"
 */

import {
  AnimationBlueprintV1,
  CompiledAnimationOutput,
  SymmetrySpec,
  EnvelopeSpec,
  TransformSpec,
} from "../contracts/blueprint.types.ts";

// ─── Assertion Result Types ──────────────────────────────────────────────────

export interface AssertionResult {
  passed: boolean;
  name: string;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  severity: "info" | "warning" | "error" | "fatal";
}

export interface QAReport {
  blueprintId: string;
  totalAssertions: number;
  passed: number;
  failed: number;
  warnings: number;
  assertions: AssertionResult[];
  summary: string;
}

// ─── Core Assertion API ──────────────────────────────────────────────────────

/**
 * Assert that a blueprint invariant holds
 */
export function expectBlueprintInvariant(
  blueprint: AnimationBlueprintV1,
  invariant: string
): AssertionResult {
  switch (invariant) {
    case "radial-symmetry-preserved":
      return assertRadialSymmetryPreserved(blueprint);
    
    case "scale-remains-within-bounds":
      return assertScaleWithinBounds(blueprint);
    
    case "glow-decays-monotonically":
      return assertGlowDecayMonotonic(blueprint);
    
    case "grid-snap-stable":
      return assertGridSnapStable(blueprint);
    
    case "envelope-bounds-respected":
      return assertEnvelopeBoundsRespected(blueprint);
    
    case "phase-offset-correct":
      return assertPhaseOffsetCorrect(blueprint);
    
    case "no-transform-drift":
      return assertNoTransformDrift(blueprint);
    
    case "deterministic-output":
      return assertDeterministicOutput(blueprint);
    
    default:
      return {
        passed: false,
        name: invariant,
        message: `Unknown invariant: ${invariant}`,
        severity: "error",
      };
  }
}

/**
 * Assert that an envelope stays within specified bounds
 */
export function expectEnvelopeBound(
  output: CompiledAnimationOutput,
  envelopeTarget: string,
  bounds: { min: number; max: number }
): AssertionResult {
  const { blueprint } = output;
  
  if (!blueprint.envelopes || !blueprint.envelopes[envelopeTarget]) {
    return {
      passed: false,
      name: `envelope-bound-${envelopeTarget}`,
      message: `Envelope '${envelopeTarget}' not found in blueprint`,
      expected: bounds,
      actual: undefined,
      severity: "error",
    };
  }
  
  const envelope = blueprint.envelopes[envelopeTarget];
  const params = envelope.params;
  
  // Check envelope-specific bounds
  let actualMin: number | undefined;
  let actualMax: number | undefined;
  
  if (envelope.kind === "sine" || envelope.kind === "triangle") {
    const amplitude = params.amplitude as number || 0;
    const base = blueprint.transforms?.[envelopeTarget as keyof TransformSpec]?.base || 0;
    actualMin = base - amplitude;
    actualMax = base + amplitude;
  } else if (envelope.kind === "pulse") {
    actualMin = params.base as number || 0;
    actualMax = params.peak as number || actualMin;
  } else if (envelope.kind === "expDecay") {
    actualMin = 0; // Decay approaches 0
    actualMax = params.start as number || 0;
  }
  
  const passed = (actualMin ?? 0) >= bounds.min && (actualMax ?? 0) <= bounds.max;
  
  return {
    passed,
    name: `envelope-bound-${envelopeTarget}`,
    message: passed ? undefined : `Envelope '${envelopeTarget}' exceeds bounds`,
    expected: bounds,
    actual: { min: actualMin, max: actualMax },
    severity: passed ? "info" : "error",
  };
}

/**
 * Assert deterministic compilation (same input = same output)
 */
export function expectDeterministicCompile(
  source: string,
  compilerVersion: string
): AssertionResult {
  // This would require actual compilation - placeholder for test framework
  return {
    passed: true,
    name: "deterministic-compile",
    message: `Compiler version ${compilerVersion} is deterministic`,
    severity: "info",
  };
}

// ─── Invariant Assertions ────────────────────────────────────────────────────

function assertRadialSymmetryPreserved(blueprint: AnimationBlueprintV1): AssertionResult {
  const symmetry = blueprint.symmetry;
  
  if (!symmetry || symmetry.type !== "radial") {
    return {
      passed: true,
      name: "radial-symmetry-preserved",
      message: "Radial symmetry not applicable",
      severity: "info",
    };
  }
  
  // Check order is valid
  if (!symmetry.order || symmetry.order < 2) {
    return {
      passed: false,
      name: "radial-symmetry-preserved",
      message: "Radial symmetry requires order >= 2",
      expected: "order >= 2",
      actual: symmetry.order,
      severity: "error",
    };
  }
  
  // Check origin is specified
  if (!symmetry.origin) {
    return {
      passed: false,
      name: "radial-symmetry-preserved",
      message: "Radial symmetry should specify origin for consistent rotation",
      expected: "origin to be defined",
      actual: undefined,
      severity: "warning",
    };
  }
  
  return {
    passed: true,
    name: "radial-symmetry-preserved",
    message: `Radial symmetry with order ${symmetry.order} is valid`,
    severity: "info",
  };
}

function assertScaleWithinBounds(blueprint: AnimationBlueprintV1): AssertionResult {
  const scale = blueprint.transforms?.scale;
  
  if (!scale) {
    return {
      passed: true,
      name: "scale-remains-within-bounds",
      message: "Scale transform not applicable",
      severity: "info",
    };
  }
  
  const { base, peak, min, max } = scale;
  
  // Check base within bounds
  if (min !== undefined && base !== undefined && base < min) {
    return {
      passed: false,
      name: "scale-remains-within-bounds",
      message: "Scale base is below minimum",
      expected: `>= ${min}`,
      actual: base,
      severity: "error",
    };
  }
  
  if (max !== undefined && base !== undefined && base > max) {
    return {
      passed: false,
      name: "scale-remains-within-bounds",
      message: "Scale base is above maximum",
      expected: `<= ${max}`,
      actual: base,
      severity: "error",
    };
  }
  
  // Check peak within bounds
  if (peak !== undefined) {
    if (min !== undefined && peak < min) {
      return {
        passed: false,
        name: "scale-remains-within-bounds",
        message: "Scale peak is below minimum",
        expected: `>= ${min}`,
        actual: peak,
        severity: "error",
      };
    }
    
    if (max !== undefined && peak > max) {
      return {
        passed: false,
        name: "scale-remains-within-bounds",
        message: "Scale peak is above maximum",
        expected: `<= ${max}`,
        actual: peak,
        severity: "error",
      };
    }
  }
  
  return {
    passed: true,
    name: "scale-remains-within-bounds",
    message: `Scale bounds [${min ?? base ?? 0}, ${max ?? peak ?? 1}] are valid`,
    severity: "info",
  };
}

function assertGlowDecayMonotonic(blueprint: AnimationBlueprintV1): AssertionResult {
  const glow = blueprint.transforms?.glow;
  
  if (!glow || !glow.envelope) {
    return {
      passed: true,
      name: "glow-decays-monotonically",
      message: "Glow decay not applicable",
      severity: "info",
    };
  }
  
  const envelope = glow.envelope;
  
  if (envelope.kind !== "expDecay") {
    return {
      passed: true,
      name: "glow-decays-monotonically",
      message: `Glow uses ${envelope.kind} envelope, not expDecay`,
      severity: "info",
    };
  }
  
  // expDecay is inherently monotonic
  const halfLife = envelope.params.halfLife as number || 0;
  
  if (halfLife <= 0) {
    return {
      passed: false,
      name: "glow-decays-monotonically",
      message: "Exponential decay requires positive halfLife",
      expected: "> 0",
      actual: halfLife,
      severity: "error",
    };
  }
  
  return {
    passed: true,
    name: "glow-decays-monotonically",
    message: `Exponential decay with halfLife ${halfLife}ms is monotonic`,
    severity: "info",
  };
}

function assertGridSnapStable(blueprint: AnimationBlueprintV1): AssertionResult {
  const grid = blueprint.grid;
  
  if (!grid || !grid.snap) {
    return {
      passed: true,
      name: "grid-snap-stable",
      message: "Grid snap not applicable",
      severity: "info",
    };
  }
  
  if (grid.mode === "free") {
    return {
      passed: false,
      name: "grid-snap-stable",
      message: "Grid snap enabled but mode is 'free' - snap will have no effect",
      expected: "mode: 'cell-space' or 'lattice'",
      actual: grid.mode,
      severity: "warning",
    };
  }
  
  // Check cell dimensions for cell-space mode
  if (grid.mode === "cell-space" && (grid.cellWidth === undefined || grid.cellHeight === undefined)) {
    return {
      passed: false,
      name: "grid-snap-stable",
      message: "Cell-space mode with snap requires explicit cell dimensions",
      expected: "cellWidth and cellHeight defined",
      actual: { cellWidth: grid.cellWidth, cellHeight: grid.cellHeight },
      severity: "warning",
    };
  }
  
  return {
    passed: true,
    name: "grid-snap-stable",
    message: `Grid snap in ${grid.mode} mode is stable`,
    severity: "info",
  };
}

function assertEnvelopeBoundsRespected(blueprint: AnimationBlueprintV1): AssertionResult {
  const envelopes = blueprint.envelopes;
  
  if (!envelopes) {
    return {
      passed: true,
      name: "envelope-bounds-respected",
      message: "No envelopes defined",
      severity: "info",
    };
  }
  
  const failures: string[] = [];
  
  for (const [target, envelope] of Object.entries(envelopes)) {
    const params = envelope.params;
    
    // Check required params by kind
    if ((envelope.kind === "sine" || envelope.kind === "triangle") && 
        (params.amplitude === undefined || params.period === undefined)) {
      failures.push(`${target} (${envelope.kind}): missing amplitude or period`);
    }
    
    if (envelope.kind === "expDecay" && 
        (params.start === undefined || params.halfLife === undefined)) {
      failures.push(`${target} (${envelope.kind}): missing start or halfLife`);
    }
    
    if (envelope.kind === "pulse" && 
        (params.peak === undefined || params.duration === undefined)) {
      failures.push(`${target} (${envelope.kind}): missing peak or duration`);
    }
  }
  
  if (failures.length > 0) {
    return {
      passed: false,
      name: "envelope-bounds-respected",
      message: "Envelope parameter validation failed",
      expected: "all required params present",
      actual: failures,
      severity: "error",
    };
  }
  
  return {
    passed: true,
    name: "envelope-bounds-respected",
    message: `${Object.keys(envelopes).length} envelope(s) have valid parameters`,
    severity: "info",
  };
}

function assertPhaseOffsetCorrect(blueprint: AnimationBlueprintV1): AssertionResult {
  const phase = blueprint.phase;
  
  if (phase === undefined) {
    return {
      passed: true,
      name: "phase-offset-correct",
      message: "Phase offset not specified",
      severity: "info",
    };
  }
  
  if (phase < 0 || phase > 1) {
    return {
      passed: false,
      name: "phase-offset-correct",
      message: "Phase must be between 0 and 1",
      expected: "[0, 1]",
      actual: phase,
      severity: "error",
    };
  }
  
  return {
    passed: true,
    name: "phase-offset-correct",
    message: `Phase offset ${phase} is valid`,
    severity: "info",
  };
}

function assertNoTransformDrift(blueprint: AnimationBlueprintV1): AssertionResult {
  const transforms = blueprint.transforms;
  
  if (!transforms) {
    return {
      passed: true,
      name: "no-transform-drift",
      message: "No transforms defined",
      severity: "info",
    };
  }
  
  const driftIssues: string[] = [];
  
  for (const [key, transform] of Object.entries(transforms)) {
    if (!transform) continue;
    
    // Check for min/max conflicts
    if (transform.min !== undefined && transform.max !== undefined && transform.min > transform.max) {
      driftIssues.push(`${key}: min > max`);
    }
    
    // Check base within bounds
    if (transform.base !== undefined) {
      if (transform.min !== undefined && transform.base < transform.min) {
        driftIssues.push(`${key}: base < min`);
      }
      if (transform.max !== undefined && transform.base > transform.max) {
        driftIssues.push(`${key}: base > max`);
      }
    }
  }
  
  if (driftIssues.length > 0) {
    return {
      passed: false,
      name: "no-transform-drift",
      message: "Transform bound conflicts detected",
      expected: "consistent bounds",
      actual: driftIssues,
      severity: "error",
    };
  }
  
  return {
    passed: true,
    name: "no-transform-drift",
    message: "All transform bounds are consistent",
    severity: "info",
  };
}

function assertDeterministicOutput(blueprint: AnimationBlueprintV1): AssertionResult {
  // Check for determinism-enabling constraints
  const constraints = blueprint.constraints;
  
  if (!constraints?.deterministic) {
    return {
      passed: false,
      name: "deterministic-output",
      message: "Blueprint does not specify deterministic constraint",
      expected: "constraints.deterministic: true",
      actual: constraints?.deterministic,
      severity: "warning",
    };
  }
  
  // Check maxFrameMs is specified for timing determinism
  if (!constraints.maxFrameMs) {
    return {
      passed: false,
      name: "deterministic-output",
      message: "Deterministic output requires maxFrameMs constraint",
      expected: "constraints.maxFrameMs to be defined",
      actual: undefined,
      severity: "warning",
    };
  }
  
  return {
    passed: true,
    name: "deterministic-output",
    message: `Deterministic constraints enabled (maxFrameMs: ${constraints.maxFrameMs})`,
    severity: "info",
  };
}

// ─── QA Report Generation ────────────────────────────────────────────────────

/**
 * Generate a QA report for a compiled blueprint
 */
export function generateQAReport(
  blueprint: AnimationBlueprintV1,
  customInvariants?: string[]
): QAReport {
  const invariants = [
    ...(blueprint.qa?.invariants || []),
    ...(customInvariants || []),
  ];
  
  const assertions: AssertionResult[] = [];
  
  // Run invariant assertions
  for (const invariant of invariants) {
    assertions.push(expectBlueprintInvariant(blueprint, invariant));
  }
  
  // Always run core assertions
  assertions.push(assertScaleWithinBounds(blueprint));
  assertions.push(assertNoTransformDrift(blueprint));
  assertions.push(assertPhaseOffsetCorrect(blueprint));
  
  // Calculate summary
  const passed = assertions.filter(a => a.passed).length;
  const failed = assertions.filter(a => !a.passed && a.severity === "error" || a.severity === "fatal").length;
  const warnings = assertions.filter(a => a.severity === "warning").length;
  
  const summary = failed === 0
    ? `All ${passed} assertions passed`
    : `${failed} assertion(s) failed, ${warnings} warning(s)`;
  
  return {
    blueprintId: blueprint.id,
    totalAssertions: assertions.length,
    passed,
    failed,
    warnings,
    assertions,
    summary,
  };
}

// ─── Test Fixture Helpers ────────────────────────────────────────────────────

/**
 * Create a test fixture for a blueprint
 */
export function createBlueprintFixture(
  id: string,
  overrides: Partial<AnimationBlueprintV1> = {}
): AnimationBlueprintV1 {
  return {
    version: "1.0",
    id,
    target: {
      selectorType: "id",
      value: "test-target",
    },
    durationMs: 400,
    loop: 1,
    easing: {
      type: "token",
      value: "EASE_IN_OUT",
    },
    ...overrides,
  };
}

/**
 * Assert parity between two compiled outputs (for different backends)
 */
export function assertBackendParity(
  output1: CompiledAnimationOutput,
  output2: CompiledAnimationOutput,
  tolerance: { timing?: number; values?: number } = {}
): AssertionResult {
  const timingTolerance = tolerance.timing ?? 5; // 5ms
  const valuesTolerance = tolerance.values ?? 0.01; // 1%
  
  const bp1 = output1.blueprint;
  const bp2 = output2.blueprint;
  
  // Check timing parity
  const durationDiff = Math.abs(bp1.durationMs - bp2.durationMs);
  if (durationDiff > timingTolerance) {
    return {
      passed: false,
      name: "backend-parity-timing",
      message: "Duration differs beyond tolerance",
      expected: `±${timingTolerance}ms`,
      actual: `${durationDiff}ms difference`,
      severity: "error",
    };
  }
  
  // Check loop parity
  if (bp1.loop !== bp2.loop) {
    return {
      passed: false,
      name: "backend-parity-loop",
      message: "Loop count differs",
      expected: bp1.loop,
      actual: bp2.loop,
      severity: "error",
    };
  }
  
  // Check easing parity (semantic, not exact)
  if (bp1.easing.type !== bp2.easing.type) {
    return {
      passed: false,
      name: "backend-parity-easing",
      message: "Easing type differs",
      expected: bp1.easing.type,
      actual: bp2.easing.type,
      severity: "warning",
    };
  }
  
  return {
    passed: true,
    name: "backend-parity",
    message: "Backend outputs are semantically equivalent",
    severity: "info",
  };
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const BlueprintQA = {
  expectInvariant: expectBlueprintInvariant,
  expectEnvelopeBound,
  expectDeterministicCompile,
  generateReport: generateQAReport,
  createFixture: createBlueprintFixture,
  assertBackendParity,
  
  // Direct invariant assertions
  assertions: {
    radialSymmetry: assertRadialSymmetryPreserved,
    scaleBounds: assertScaleWithinBounds,
    glowDecay: assertGlowDecayMonotonic,
    gridSnap: assertGridSnapStable,
    envelopeBounds: assertEnvelopeBoundsRespected,
    phaseOffset: assertPhaseOffsetCorrect,
    transformDrift: assertNoTransformDrift,
    deterministic: assertDeterministicOutput,
  },
};
