import { 
  AnimationIntent, 
  MotionWorkingState, 
  ResolvedMotionOutput, 
  MotionProcessor,
  MotionValues
} from '../contracts/motion-contract';
import { DimensionProcessor } from '../processors/dimension-processor';

const DEFAULT_MOTION: MotionValues = {
  durationMs: 300,
  delayMs: 0,
  easing: 'ease-out',
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotateDeg: 0,
  opacity: 1,
  loop: false,
};

/**
 * ANIMATION AMP — Core Orchestrator
 *
 * One animation request. One routed AMP path. Many small processors. One resolved motion truth.
 */
export class AnimationAmp {
  private processors: MotionProcessor[] = [
    new DimensionProcessor(),
    // Future: TimingProcessor, InteractionProcessor, ReducedMotionProcessor, etc.
  ];

  /**
   * Main entry point for animation requests
   */
  run(intent: AnimationIntent): ResolvedMotionOutput {
    let state: MotionWorkingState = {
      intent,
      values: { ...DEFAULT_MOTION },
      flags: {
        interruptible: true,
        reduced: intent.constraints?.reducedMotion || false,
      },
      diagnostics: [],
      trace: [],
    };

    // 1. Filter supported processors and sort by stage
    const activeProcessors = this.processors
      .filter(p => p.supports(intent))
      .sort((a, b) => this.getStageOrder(a.stage) - this.getStageOrder(b.stage));

    // 2. Run pipeline
    for (const processor of activeProcessors) {
      state = processor.run(state);
    }

    // 3. Finalize and Fuse
    return this.fuse(state);
  }

  private fuse(state: MotionWorkingState): ResolvedMotionOutput {
    const finalValues: MotionValues = {
      ...DEFAULT_MOTION,
      ...state.values,
    } as MotionValues;

    return {
      version: state.intent.version,
      targetId: state.intent.targetId,
      ok: true,
      renderer: this.inferRenderer(state.intent),
      values: finalValues,
      diagnostics: state.diagnostics,
      trace: state.trace,
    };
  }

  private inferRenderer(intent: AnimationIntent): 'framer' | 'css' | 'phaser' | 'custom' {
    if (intent.targetType === 'phaser') return 'phaser';
    if (intent.targetType === 'canvas') return 'custom';
    if (intent.targetType === 'dom') return 'framer';
    return 'css';
  }

  private getStageOrder(stage: string): number {
    const order = {
      'normalize': 0,
      'timing': 1,
      'transform': 2,
      'visual': 3,
      'sequence': 4,
      'reactive': 5,
      'constraint': 6,
      'finalize': 7,
    };
    return (order as any)[stage] || 99;
  }
}

/**
 * Global singleton for quick access
 */
export const runAnimationAmp = (intent: AnimationIntent) => new AnimationAmp().run(intent);
