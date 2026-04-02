/**
 * Bytecode Blueprint Bridge — Compiler Layer
 * 
 * Transforms validated AnimationBlueprintV1 into backend-specific execution payloads.
 * Supports CSS, Phaser, PixelBrain, and Motion Bytecode outputs.
 */

import {
  AnimationBlueprintV1,
  CompiledAnimationOutput,
  BlueprintCompileResult,
  DiagnosticEntry,
  CSSMotionPayload,
  PhaserMotionPayload,
  PixelBrainFormulaPayload,
  MotionBytecodeArtifact,
  BLUEPRINT_ERROR_CODES,
} from "../contracts/blueprint.types.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPILER_VERSION = "1.0.0";

// ─── Core Compiler ───────────────────────────────────────────────────────────

interface CompileOptions {
  targets?: Array<"css" | "phaser" | "pixelbrain" | "bytecode">;
  sourceHash?: string;
}

/**
 * Compile a validated AnimationBlueprintV1 into backend-specific payloads
 */
export function compileBlueprint(
  blueprint: AnimationBlueprintV1,
  options: CompileOptions = {}
): BlueprintCompileResult {
  const errors: DiagnosticEntry[] = [];
  const warnings: DiagnosticEntry[] = [];
  
  const targets: CompiledAnimationOutput["targets"] = {};
  const requestedTargets = options.targets || ["css", "phaser", "pixelbrain", "bytecode"];

  // Compile to each requested target
  for (const target of requestedTargets) {
    try {
      switch (target) {
        case "css":
          targets.css = compileToCSS(blueprint, errors, warnings);
          break;
        case "phaser":
          targets.phaser = compileToPhaser(blueprint, errors, warnings);
          break;
        case "pixelbrain":
          targets.pixelbrain = compileToPixelBrain(blueprint, errors, warnings);
          break;
        case "bytecode":
          targets.bytecode = compileToBytecode(blueprint, errors, warnings);
          break;
      }
    } catch (e) {
      errors.push(createCompileError(
        BLUEPRINT_ERROR_CODES.COMPILE_ENVELOPE_FAILURE,
        `Failed to compile ${target}: ${(e as Error).message}`
      ));
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
    };
  }

  const output: CompiledAnimationOutput = {
    blueprint,
    compilerVersion: COMPILER_VERSION,
    compiledAt: new Date().toISOString(),
    sourceHash: options.sourceHash || hashBlueprint(blueprint),
    targets,
    diagnostics: [...errors, ...warnings].map((e) => ({
      ...e,
      severity: e.severity as "info" | "warning" | "error" | "fatal",
    })),
  };

  return {
    success: true,
    output,
    errors,
    warnings,
  };
}

// ─── CSS Compiler ────────────────────────────────────────────────────────────

function compileToCSS(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): CSSMotionPayload {
  const variables: Record<string, string | number> = {};
  
  // Generate CSS custom properties from transforms
  if (blueprint.transforms) {
    if (blueprint.transforms.scale) {
      const scale = blueprint.transforms.scale;
      variables["--anim-scale-base"] = scale.base ?? 1;
      variables["--anim-scale-peak"] = scale.peak ?? scale.base ?? 1;
      if (scale.min !== undefined) variables["--anim-scale-min"] = scale.min;
      if (scale.max !== undefined) variables["--anim-scale-max"] = scale.max;
    }
    
    if (blueprint.transforms.translateX) {
      variables["--anim-translate-x"] = `${blueprint.transforms.translateX.base ?? 0}px`;
    }
    
    if (blueprint.transforms.translateY) {
      variables["--anim-translate-y"] = `${blueprint.transforms.translateY.base ?? 0}px`;
    }
    
    if (blueprint.transforms.rotate) {
      variables["--anim-rotate"] = `${blueprint.transforms.rotate.base ?? 0}deg`;
    }
    
    if (blueprint.transforms.opacity) {
      variables["--anim-opacity"] = blueprint.transforms.opacity.base ?? 1;
    }
    
    if (blueprint.transforms.glow) {
      variables["--anim-glow-intensity"] = blueprint.transforms.glow.base ?? 0;
    }
  }

  // Generate keyframes from envelopes
  const keyframes = generateCSSKeyframes(blueprint);

  // Build animation config
  const animationConfig = {
    durationMs: blueprint.durationMs,
    delayMs: blueprint.delayMs || 0,
    easing: easingToCSS(blueprint.easing),
    iterations: blueprint.loop,
  };

  return {
    variables,
    animationConfig,
    keyframes,
  };
}

function easingToCSS(easing: AnimationBlueprintV1["easing"]): string {
  if (easing.type === "token") {
    const tokenMap: Record<string, string> = {
      LINEAR: "linear",
      EASE_IN: "ease-in",
      EASE_OUT: "ease-out",
      EASE_IN_OUT: "ease-in-out",
      IN_OUT_ARC: "cubic-bezier(0.43, 0.13, 0.23, 0.96)",
      OUT_ARC: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      IN_BACK: "cubic-bezier(0.6, -0.28, 0.735, 0.045)",
      OUT_BACK: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      IN_OUT_BACK: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      SPRING: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      SPRING_GENTLE: "cubic-bezier(0.25, 0.1, 0.25, 1.2)",
      SPRING_SNAPPY: "cubic-bezier(0.4, 0, 0.2, 1.4)",
    };
    return tokenMap[String(easing.value).toUpperCase()] || "ease-in-out";
  }
  
  if (easing.type === "cubic") {
    const value = easing.value as number[];
    if (Array.isArray(value) && value.length === 4) {
      return `cubic-bezier(${value.join(", ")})`;
    }
  }
  
  return String(easing.value);
}

function generateCSSKeyframes(blueprint: AnimationBlueprintV1): Array<{ offset: number; values: Record<string, string | number> }> {
  const keyframes: Array<{ offset: number; values: Record<string, string | number> }> = [];
  
  // Generate keyframes based on envelopes
  if (blueprint.envelopes || blueprint.transforms) {
    // 0% keyframe
    const startValues: Record<string, string | number> = {};
    
    if (blueprint.transforms?.scale) {
      startValues["transform"] = `scale(${blueprint.transforms.scale.base ?? 1})`;
    }
    
    keyframes.push({
      offset: 0,
      values: startValues,
    });
    
    // 50% keyframe (peak for sine/triangle envelopes)
    if (blueprint.transforms?.scale?.peak !== undefined) {
      keyframes.push({
        offset: 0.5,
        values: {
          transform: `scale(${blueprint.transforms.scale.peak})`,
        },
      });
    }
    
    // 100% keyframe
    keyframes.push({
      offset: 1,
      values: startValues,
    });
  }
  
  return keyframes;
}

// ─── Phaser Compiler ─────────────────────────────────────────────────────────

function compileToPhaser(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): PhaserMotionPayload {
  const config: Record<string, unknown> = {
    duration: blueprint.durationMs,
    delay: blueprint.delayMs || 0,
    repeat: typeof blueprint.loop === "number" ? blueprint.loop - 1 : blueprint.loop === "infinite" ? -1 : 0,
  };

  // Add easing
  config.ease = easingToPhaser(blueprint.easing);

  // Add transforms
  if (blueprint.transforms) {
    const tweenProps: Record<string, unknown> = {};
    
    if (blueprint.transforms.scale) {
      const scale = blueprint.transforms.scale;
      if (scale.peak !== undefined && scale.base !== undefined) {
        tweenProps.scale = {
          from: scale.base,
          to: scale.peak,
          yoyo: true,
        };
      } else if (scale.base !== undefined) {
        tweenProps.scale = scale.base;
      }
    }
    
    if (blueprint.transforms.translateX || blueprint.transforms.translateY) {
      tweenProps.x = blueprint.transforms.translateX?.base ?? 0;
      tweenProps.y = blueprint.transforms.translateY?.base ?? 0;
    }
    
    if (blueprint.transforms.rotate) {
      tweenProps.rotation = (blueprint.transforms.rotate.base ?? 0) * (Math.PI / 180);
    }
    
    if (blueprint.transforms.opacity) {
      tweenProps.alpha = blueprint.transforms.opacity.base ?? 1;
    }
    
    Object.assign(config, tweenProps);
  }

  // Determine tween vs timeline
  const targetType = blueprint.envelopes ? "timeline" : "tween";

  return {
    targetType,
    config,
  };
}

function easingToPhaser(easing: AnimationBlueprintV1["easing"]): string {
  if (easing.type === "token") {
    const tokenMap: Record<string, string> = {
      LINEAR: "Linear",
      EASE_IN: "Quad.easeIn",
      EASE_OUT: "Quad.easeOut",
      EASE_IN_OUT: "Quad.easeInOut",
      IN_OUT_ARC: "Sine.easeInOut",
      OUT_ARC: "Back.easeOut",
      SPRING: "Elastic.easeOut",
    };
    return tokenMap[String(easing.value).toUpperCase()] || "Power2";
  }
  
  return "Power2";
}

// ─── PixelBrain Compiler ─────────────────────────────────────────────────────

function compileToPixelBrain(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): PixelBrainFormulaPayload {
  // Generate mathematical formula from envelopes
  const formula = generatePixelBrainFormula(blueprint);
  
  // Generate coordinates from grid/symmetry
  const coordinates = generatePixelBrainCoordinates(blueprint);

  return {
    formula,
    coordinates,
    symmetry: blueprint.symmetry,
    grid: blueprint.grid,
  };
}

function generatePixelBrainFormula(blueprint: AnimationBlueprintV1): string {
  const parts: string[] = [];
  
  // Build formula from transforms and envelopes
  if (blueprint.transforms?.scale) {
    const scale = blueprint.transforms.scale;
    if (scale.envelope?.kind === "sine") {
      const amplitude = scale.envelope.params.amplitude || 0.05;
      const period = scale.envelope.params.period || blueprint.durationMs;
      parts.push(`scale(t) = ${scale.base ?? 1} + ${amplitude} * sin(2 * PI * t / ${period})`);
    } else if (scale.peak !== undefined) {
      parts.push(`scale(t) = lerp(${scale.base ?? 1}, ${scale.peak}, envelope(t))`);
    }
  }
  
  if (blueprint.transforms?.glow) {
    const glow = blueprint.transforms.glow;
    if (glow.envelope?.kind === "expDecay") {
      const start = glow.envelope.params.start || glow.peak || 0.5;
      const halfLife = glow.envelope.params.halfLife || 400;
      parts.push(`glow(t) = ${start} * exp(-t / ${halfLife})`);
    }
  }

  return parts.join("; ") || `identity(t) = 1`;
}

function generatePixelBrainCoordinates(blueprint: AnimationBlueprintV1): Array<{ x: number; y: number; space: "pixel" | "cell" | "lattice" }> {
  const coordinates: Array<{ x: number; y: number; space: "pixel" | "cell" | "lattice" }> = [];
  
  // Default center coordinate
  const space = blueprint.grid?.mode === "lattice" ? "lattice" : blueprint.grid?.mode === "cell-space" ? "cell" : "pixel";
  
  if (blueprint.symmetry?.origin) {
    coordinates.push({
      x: blueprint.symmetry.origin.x,
      y: blueprint.symmetry.origin.y,
      space,
    });
  } else {
    coordinates.push({
      x: 0.5,
      y: 0.5,
      space,
    });
  }

  return coordinates;
}

// ─── Bytecode Compiler ───────────────────────────────────────────────────────

function compileToBytecode(
  blueprint: AnimationBlueprintV1,
  errors: DiagnosticEntry[],
  warnings: DiagnosticEntry[]
): MotionBytecodeArtifact {
  const instructions: Array<{ op: string; params: Record<string, string | number | boolean> }> = [];

  // ANIM_START
  instructions.push({
    op: "ANIM_START",
    params: {
      id: blueprint.id,
      version: blueprint.version,
    },
  });

  // TARGET
  instructions.push({
    op: "TARGET",
    params: {
      type: blueprint.target.selectorType,
      value: blueprint.target.value,
    },
  });

  // PRESET (if present)
  if (blueprint.preset) {
    instructions.push({
      op: "PRESET",
      params: { name: blueprint.preset },
    });
  }

  // TIMING
  instructions.push({
    op: "TIMING",
    params: {
      duration: blueprint.durationMs,
      delay: blueprint.delayMs || 0,
      loop: blueprint.loop,
      phase: blueprint.phase || 0,
    },
  });

  // EASING
  instructions.push({
    op: "EASING",
    params: {
      type: blueprint.easing.type,
      value: String(blueprint.easing.value),
    },
  });

  // TRANSFORMS
  if (blueprint.transforms) {
    for (const [key, value] of Object.entries(blueprint.transforms)) {
      if (value) {
        instructions.push({
          op: "TRANSFORM",
          params: {
            property: key,
            base: value.base ?? 0,
            peak: value.peak ?? value.base ?? 0,
            min: value.min ?? 0,
            max: value.max ?? 0,
          },
        });
      }
    }
  }

  // ENVELOPES
  if (blueprint.envelopes) {
    for (const [target, envelope] of Object.entries(blueprint.envelopes)) {
      instructions.push({
        op: "ENVELOPE",
        params: {
          target,
          kind: envelope.kind,
          ...envelope.params,
        },
      });
    }
  }

  // SYMMETRY
  if (blueprint.symmetry) {
    instructions.push({
      op: "SYMMETRY",
      params: {
        type: blueprint.symmetry.type,
        order: blueprint.symmetry.order || 0,
        originX: blueprint.symmetry.origin?.x || 0.5,
        originY: blueprint.symmetry.origin?.y || 0.5,
        space: blueprint.symmetry.origin?.space || "local",
      },
    });
  }

  // GRID
  if (blueprint.grid) {
    instructions.push({
      op: "GRID",
      params: {
        mode: blueprint.grid.mode,
        snap: blueprint.grid.snap || false,
        cellWidth: blueprint.grid.cellWidth || 0,
        cellHeight: blueprint.grid.cellHeight || 0,
      },
    });
  }

  // CONSTRAINTS
  if (blueprint.constraints) {
    instructions.push({
      op: "CONSTRAINTS",
      params: {
        deterministic: blueprint.constraints.deterministic || false,
        maxFrameMs: blueprint.constraints.maxFrameMs || 16,
      },
    });
  }

  // ANIM_END
  instructions.push({
    op: "ANIM_END",
    params: {},
  });

  // Generate checksum
  const checksum = generateBytecodeChecksum(instructions);

  return {
    version: "1.0",
    instructions,
    checksum,
  };
}

function generateBytecodeChecksum(instructions: Array<{ op: string; params: Record<string, string | number | boolean> }>): string {
  // Simple FNV-1a style hash for demonstration
  const serialized = JSON.stringify(instructions);
  let hash = 0x811c9dc5;
  
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0; // Convert to unsigned 32-bit
  }
  
  return hash.toString(16).padStart(8, "0");
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function hashBlueprint(blueprint: AnimationBlueprintV1): string {
  const serialized = JSON.stringify(blueprint);
  let hash = 0;
  
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

function createCompileError(code: number, message: string): DiagnosticEntry {
  return {
    code: `ANIM_${code.toString(16).toUpperCase().padStart(4, "0")}`,
    severity: "error",
    category: "compile",
    message,
  };
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const BlueprintCompiler = {
  compile: compileBlueprint,
  version: COMPILER_VERSION,
};
