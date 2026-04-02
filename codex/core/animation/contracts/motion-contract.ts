import { CanonicalDimensionSpec, FitMode, AnchorMode, SnapMode } from '../../pixelbrain/dimension-formula-compiler';

export type AnimationTrigger =
  | 'mount'
  | 'unmount'
  | 'hover'
  | 'focus'
  | 'click'
  | 'scroll'
  | 'route-change'
  | 'audio'
  | 'state-change'
  | 'idle';

export type AnimationTargetType = 'dom' | 'phaser' | 'canvas' | 'overlay';

/**
 * ANIMATION INTENT — Input contract for Animation AMP
 */
export interface AnimationIntent {
  version: string;
  targetId: string;
  targetType?: AnimationTargetType;
  preset?: string;
  trigger: AnimationTrigger;
  state?: Record<string, unknown>;
  constraints?: {
    reducedMotion?: boolean;
    deviceClass?: 'mobile' | 'desktop' | 'tablet';
    maxDurationMs?: number;
    disableLoop?: boolean;
    // Integration with Dimension Formula:
    layoutConstraint?: CanonicalDimensionSpec;
  };
  requestedProcessors?: string[];
  metadata?: {
    source?: string;
    feature?: string;
    scene?: string;
  };
}

/**
 * MOTION VALUES — Standardized motion parameters
 */
export interface MotionValues {
  durationMs: number;
  delayMs: number;
  easing: string;
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
  opacity: number;
  glow?: number;
  loop: boolean;
  phaseOffset?: number;
  staggerIndex?: number;
  // Computed dimensions from layout context
  width?: number;
  height?: number;
}

/**
 * WORKING STATE — Mutable state during microprocessor pipeline
 */
export interface MotionWorkingState {
  intent: AnimationIntent;
  values: Partial<MotionValues>;
  flags: {
    interruptible?: boolean;
    reduced?: boolean;
    constrained?: boolean;
  };
  diagnostics: string[];
  trace: Array<{
    processorId: string;
    changed: string[];
  }>;
}

/**
 * RESOLVED MOTION OUTPUT — Final output contract for renderers
 */
export interface ResolvedMotionOutput {
  version: string;
  targetId: string;
  ok: boolean;
  renderer: 'framer' | 'css' | 'phaser' | 'custom';
  values: MotionValues;
  bytecode?: string[];
  diagnostics: string[];
  trace: Array<{
    processorId: string;
    changed: string[];
  }>;
}

/**
 * MOTION PROCESSOR CONTRACT
 */
export interface MotionProcessor {
  id: string;
  stage:
    | 'normalize'
    | 'timing'
    | 'transform'
    | 'visual'
    | 'sequence'
    | 'reactive'
    | 'constraint'
    | 'finalize';
  supports(intent: AnimationIntent): boolean;
  run(state: MotionWorkingState): MotionWorkingState;
}
