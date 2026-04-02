/**
 * Bytecode Blueprint Bridge — Zod Validation Schemas
 * 
 * Runtime validation for AnimationBlueprintV1 and related types.
 * All blueprints must pass schema validation before compilation.
 */

import { z } from "zod";

// ─── Helper Schemas ──────────────────────────────────────────────────────────

const NonEmptyString = z.string().min(1, "Field cannot be empty");

// ─── Target Specification ────────────────────────────────────────────────────

export const TargetSpecSchema = z.object({
  selectorType: z.enum(["id", "class", "role", "symbolic", "engine-target"]),
  value: NonEmptyString,
});

// ─── Easing Specification ────────────────────────────────────────────────────

export const EasingSpecSchema = z.object({
  type: z.enum(["token", "cubic", "spring", "custom"]),
  value: z.union([
    NonEmptyString,
    z.array(z.number()),
    z.record(z.string(), z.number()),
  ]),
});

// ─── Envelope Specification ──────────────────────────────────────────────────

export const EnvelopeSpecSchema = z.object({
  kind: z.enum(["constant", "sine", "triangle", "expDecay", "pulse", "bezier", "keyed"]),
  params: z.record(z.string(),z.union([z.number(), z.string(), z.boolean()])),
});

// ─── Transform Specification ─────────────────────────────────────────────────

export const ScalarTransformSpecSchema = z.object({
  base: z.number().optional(),
  peak: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  envelope: EnvelopeSpecSchema.optional(),
});

export const TransformSpecSchema = z.object({
  scale: ScalarTransformSpecSchema.optional(),
  rotate: ScalarTransformSpecSchema.optional(),
  translateX: ScalarTransformSpecSchema.optional(),
  translateY: ScalarTransformSpecSchema.optional(),
  opacity: ScalarTransformSpecSchema.optional(),
  glow: ScalarTransformSpecSchema.optional(),
  blur: ScalarTransformSpecSchema.optional(),
});

// ─── Symmetry Specification ──────────────────────────────────────────────────

export const SymmetrySpecSchema = z.object({
  type: z.enum(["none", "mirror-x", "mirror-y", "radial", "diagonal"]),
  order: z.number().int().positive().optional(),
  origin: z.object({
    x: z.number(),
    y: z.number(),
    space: z.enum(["local", "grid", "world"]).optional(),
  }).optional(),
});

// ─── Grid Specification ──────────────────────────────────────────────────────

export const GridSpecSchema = z.object({
  mode: z.enum(["free", "cell-space", "lattice"]),
  latticeId: z.string().optional(),
  snap: z.boolean().optional(),
  cellWidth: z.number().positive().optional(),
  cellHeight: z.number().positive().optional(),
});

// ─── Anchor Specification ────────────────────────────────────────────────────

export const AnchorSpecSchema = z.object({
  pivotX: z.number().optional(),
  pivotY: z.number().optional(),
  originSpace: z.enum(["local", "grid", "world"]).optional(),
});

// ─── Compositing Specification ───────────────────────────────────────────────

export const CompositingSpecSchema = z.object({
  blendMode: z.string().optional(),
  zLayer: z.union([z.string(), z.number()]).optional(),
  pass: z.enum(["css", "phaser", "pixelbrain", "hybrid"]),
});

// ─── Backend Hints ───────────────────────────────────────────────────────────

export const BackendHintsSchema = z.object({
  css: z.record(z.string(),z.union([z.string(), z.number(), z.boolean()])).optional(),
  phaser: z.record(z.string(),z.union([z.string(), z.number(), z.boolean()])).optional(),
  pixelbrain: z.record(z.string(),z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// ─── Constraint Specification ────────────────────────────────────────────────

export const ConstraintSpecSchema = z.object({
  deterministic: z.boolean().optional(),
  maxFrameMs: z.number().positive().optional(),
  maxPropertyCount: z.number().int().positive().optional(),
  allowBackendDegradation: z.boolean().optional(),
  requireParityAcrossBackends: z.boolean().optional(),
});

// ─── QA Specification ────────────────────────────────────────────────────────

export const QASpecSchema = z.object({
  invariants: z.array(z.string()).optional(),
  parityMode: z.enum(["strict", "tolerant", "backend-specific"]).optional(),
  screenshotRequired: z.boolean().optional(),
});

// ─── Metadata Specification ──────────────────────────────────────────────────

export const MetadataSpecSchema = z.object({
  author: z.string().optional(),
  createdAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  feature: z.string().optional(),
});

// ─── Main Animation Blueprint Schema ─────────────────────────────────────────

export const AnimationBlueprintV1Schema = z.object({
  version: z.literal("1.0"),
  id: NonEmptyString,
  name: z.string().optional(),
  description: z.string().optional(),
  target: TargetSpecSchema,
  preset: z.string().optional(),
  durationMs: z.number().positive(),
  delayMs: z.number().nonnegative().optional(),
  loop: z.union([z.number().int().nonnegative(), z.literal("infinite")]),
  easing: EasingSpecSchema,
  phase: z.number().optional(),
  transforms: TransformSpecSchema.optional(),
  envelopes: z.record(z.string(),EnvelopeSpecSchema).optional(),
  symmetry: SymmetrySpecSchema.optional(),
  grid: GridSpecSchema.optional(),
  anchors: AnchorSpecSchema.optional(),
  compositing: CompositingSpecSchema.optional(),
  backendHints: BackendHintsSchema.optional(),
  constraints: ConstraintSpecSchema.optional(),
  qa: QASpecSchema.optional(),
  metadata: MetadataSpecSchema.optional(),
});

// ─── Preset Schema ───────────────────────────────────────────────────────────

export const AnimationPresetV1Schema = z.object({
  name: NonEmptyString,
  version: z.literal("1.0"),
  description: z.string().optional(),
  defaults: AnimationBlueprintV1Schema.partial().omit({ version: true, id: true, target: true }),
});

// ─── Compiled Output Schemas ─────────────────────────────────────────────────

export const DiagnosticEntrySchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error", "fatal"]),
  category: z.enum(["parse", "validation", "capability", "compile", "execution", "parity", "performance"]),
  message: z.string(),
  line: z.number().int().positive().optional(),
  directive: z.string().optional(),
  hint: z.string().optional(),
});

export const KeyframeSpecSchema = z.object({
  offset: z.number().min(0).max(1),
  values: z.record(z.string(),z.union([z.string(), z.number()])),
});

export const CSSMotionPayloadSchema = z.object({
  variables: z.record(z.string(),z.union([z.string(), z.number()])),
  animationConfig: z.object({
    durationMs: z.number().positive(),
    delayMs: z.number().nonnegative(),
    easing: z.string(),
    iterations: z.union([z.number().int().nonnegative(), z.literal("infinite")]),
  }),
  keyframes: z.array(KeyframeSpecSchema).optional(),
});

export const PhaserMotionPayloadSchema = z.object({
  targetType: z.enum(["tween", "timeline"]),
  config: z.record(z.string(),z.unknown()),
});

export const CoordinateSpecSchema = z.object({
  x: z.number(),
  y: z.number(),
  space: z.enum(["pixel", "cell", "lattice"]),
});

export const PixelBrainFormulaPayloadSchema = z.object({
  formula: z.string(),
  coordinates: z.array(CoordinateSpecSchema),
  symmetry: SymmetrySpecSchema.optional(),
  grid: GridSpecSchema.optional(),
});

export const BytecodeInstructionSchema = z.object({
  op: z.string(),
  params: z.record(z.string(),z.union([z.string(), z.number(), z.boolean()])),
});

export const MotionBytecodeArtifactSchema = z.object({
  version: z.string(),
  instructions: z.array(BytecodeInstructionSchema),
  checksum: z.string(),
});

export const CompiledAnimationOutputSchema = z.object({
  blueprint: AnimationBlueprintV1Schema,
  compilerVersion: z.string(),
  compiledAt: z.string(),
  sourceHash: z.string(),
  targets: z.object({
    css: CSSMotionPayloadSchema.optional(),
    phaser: PhaserMotionPayloadSchema.optional(),
    pixelbrain: PixelBrainFormulaPayloadSchema.optional(),
    bytecode: MotionBytecodeArtifactSchema.optional(),
  }),
  diagnostics: z.array(DiagnosticEntrySchema),
});

// ─── Result Type Schemas ─────────────────────────────────────────────────────

export const BlueprintParseResultSchema = z.object({
  success: z.boolean(),
  blueprint: AnimationBlueprintV1Schema.optional(),
  errors: z.array(DiagnosticEntrySchema),
  warnings: z.array(DiagnosticEntrySchema),
  sourceMap: z.instanceof(Map).optional(),
});

export const BlueprintValidateResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(DiagnosticEntrySchema),
  warnings: z.array(DiagnosticEntrySchema),
});

export const BlueprintCompileResultSchema = z.object({
  success: z.boolean(),
  output: CompiledAnimationOutputSchema.optional(),
  errors: z.array(DiagnosticEntrySchema),
  warnings: z.array(DiagnosticEntrySchema),
});

// ─── Validation Helpers ──────────────────────────────────────────────────────

export function validateAnimationBlueprint(
  data: unknown
): z.SafeParseReturnType<unknown, z.infer<typeof AnimationBlueprintV1Schema>> {
  return AnimationBlueprintV1Schema.safeParse(data);
}

export function validateAnimationPreset(
  data: unknown
): z.SafeParseReturnType<unknown, z.infer<typeof AnimationPresetV1Schema>> {
  return AnimationPresetV1Schema.safeParse(data);
}

export function isAnimationBlueprint(
  data: unknown
): data is z.infer<typeof AnimationBlueprintV1Schema> {
  return AnimationBlueprintV1Schema.safeParse(data).success;
}

export function isCompiledAnimationOutput(
  data: unknown
): data is z.infer<typeof CompiledAnimationOutputSchema> {
  return CompiledAnimationOutputSchema.safeParse(data).success;
}
