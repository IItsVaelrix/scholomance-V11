/**
 * Animation AMP — Core Runner
 * 
 * Main entry point for the Animation AMP system.
 * Routes animation intents through processor pipeline and emits resolved motion.
 * 
 * Flow: Intent -> Normalize -> Select Processors -> Run Pipeline -> Fuse -> Output
 */

import {
  AnimationIntent,
  MotionWorkingState,
  ResolvedMotionOutput,
  MotionProcessor,
  AnimationAmpConfig,
  DEFAULT_AMP_CONFIG,
  AnimationAmpError,
  AMP_ERROR_CODES,
} from '../contracts/animation.types.ts';
import {
  validateAnimationIntent,
  validateMotionOutput,
  ANIMATION_ERROR_MESSAGES,
} from '../contracts/animation.schemas.ts';
import { buildMotionTrace } from '../diagnostics/buildMotionTrace.ts';
import { encodeMotionBytecode } from '../bytecode/encodeMotionBytecode.ts';

// ─── Processor Registry ─────────────────────────────────────────────────────

class ProcessorRegistry {
  private processors: Map<string, MotionProcessor> = new Map();
  
  register(processor: MotionProcessor): void {
    if (this.processors.has(processor.id)) {
      console.warn(`[AnimationAMP] Processor ${processor.id} already registered, overwriting`);
    }
    this.processors.set(processor.id, processor);
  }
  
  get(id: string): MotionProcessor | undefined {
    return this.processors.get(id);
  }
  
  getAll(): MotionProcessor[] {
    return Array.from(this.processors.values());
  }
  
  getByStage(stage: string): MotionProcessor[] {
    return this.getAll().filter(p => p.stage === stage);
  }
  
  selectForIntent(intent: AnimationIntent): MotionProcessor[] {
    const allProcessors = this.getAll();
    const selected = allProcessors.filter(p => p.supports(intent));
    
    // Sort by stage order and priority
    const stageOrder: Record<string, number> = {
      normalize: 0,
      timing: 1,
      transform: 2,
      visual: 3,
      sequence: 4,
      reactive: 5,
      constraint: 6,
      symmetry: 7,
      finalize: 8,
    };
    
    return selected.sort((a, b) => {
      const stageDiff = (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99);
      if (stageDiff !== 0) return stageDiff;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }
  
  clear(): void {
    this.processors.clear();
  }
}

// Global registry instance
export const processorRegistry = new ProcessorRegistry();

// ─── AMP State ──────────────────────────────────────────────────────────────

interface AmpState {
  config: AnimationAmpConfig;
  isRunning: boolean;
  activeAnimations: Map<string, ResolvedMotionOutput>;
}

const ampState: AmpState = {
  config: { ...DEFAULT_AMP_CONFIG },
  isRunning: false,
  activeAnimations: new Map(),
};

// ─── Core AMP Functions ─────────────────────────────────────────────────────

/**
 * Initialize Animation AMP with custom configuration
 */
export function initAnimationAmp(config: Partial<AnimationAmpConfig> = {}): void {
  ampState.config = { ...DEFAULT_AMP_CONFIG, ...config };
  ampState.isRunning = true;
  console.log('[AnimationAMP] Initialized with config:', ampState.config);
}

/**
 * Normalize animation intent into working state
 */
function normalizeIntent(intent: AnimationIntent): MotionWorkingState {
  const startTime = performance.now();
  
  // Apply preset defaults if preset specified
  let workingState: MotionWorkingState = {
    intent,
    values: {
      durationMs: 300,
      delayMs: 0,
      easing: 'ease-out',
      translateX: 0,
      translateY: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      rotateDeg: 0,
      opacity: 1,
      glow: 0,
      blur: 0,
      loop: false,
      phaseOffset: 0,
      originX: 0.5,
      originY: 0.5,
    },
    flags: {
      interruptible: true,
      reduced: false,
      constrained: false,
      gpuAccelerated: intent.constraints?.gpuAccelerate ?? true,
      symmetryApplied: false,
    },
    diagnostics: [],
    trace: [],
  };
  
  // Load preset defaults if specified
  if (intent.preset) {
    const { getAnimationPreset } = await import('../presets/presetRegistry.ts');
    const preset = getAnimationPreset(intent.preset);
    if (preset) {
      workingState.values = { ...workingState.values, ...preset.defaults };
      workingState.flags = { ...workingState.flags, ...preset.flags };
      workingState.diagnostics.push(`Preset applied: ${intent.preset}`);
    } else {
      workingState.diagnostics.push(`Preset not found: ${intent.preset}`);
    }
  }
  
  // Add normalize trace
  workingState.trace.push({
    processorId: 'amp.normalize',
    stage: 'normalize',
    changed: ['values', 'flags'],
    timestamp: performance.now() - startTime,
  });
  
  return workingState;
}

/**
 * Run processor pipeline on working state
 */
async function runProcessorPipeline(
  workingState: MotionWorkingState,
  processors: MotionProcessor[]
): Promise<MotionWorkingState> {
  const config = ampState.config;
  let state = { ...workingState };
  
  // Limit processor count for performance
  const limitedProcessors = processors.slice(0, config.maxProcessors);
  
  for (const processor of limitedProcessors) {
    const processorStart = performance.now();
    
    // Check frame budget
    if (config.performanceMonitoring) {
      const elapsed = processorStart - (state.trace.at(-1)?.timestamp ?? 0);
      if (elapsed > config.frameBudgetMs) {
        state.diagnostics.push(`Frame budget exceeded before ${processor.id}`);
      }
    }
    
    // Run processor with timeout
    try {
      const result = await Promise.race([
        processor.run(state),
        new Promise<MotionWorkingState>((_, reject) =>
          setTimeout(() => reject(new Error('Processor timeout')), config.processorTimeoutMs)
        ),
      ]);
      state = result;
    } catch (error) {
      state.diagnostics.push(`Processor ${processor.id} failed: ${(error as Error).message}`);
      if (config.debug) {
        console.error(`[AnimationAMP] Processor ${processor.id} error:`, error);
      }
    }
  }
  
  return state;
}

/**
 * Fuse working state into resolved motion output
 */
function fuseMotionOutput(workingState: MotionWorkingState): ResolvedMotionOutput {
  const { intent, values, flags, diagnostics, trace } = workingState;
  
  // Fill in defaults for any missing values
  const outputValues = {
    durationMs: values.durationMs ?? 300,
    delayMs: values.delayMs ?? 0,
    easing: values.easing ?? 'ease-out',
    translateX: values.translateX ?? 0,
    translateY: values.translateY ?? 0,
    scale: values.scale ?? 1,
    scaleX: values.scaleX ?? values.scale ?? 1,
    scaleY: values.scaleY ?? values.scale ?? 1,
    rotateDeg: values.rotateDeg ?? 0,
    opacity: values.opacity ?? 1,
    glow: values.glow ?? 0,
    blur: values.blur ?? 0,
    loop: values.loop ?? false,
    phaseOffset: values.phaseOffset ?? 0,
    originX: values.originX ?? 0.5,
    originY: values.originY ?? 0.5,
  };
  
  // Determine renderer
  const renderer = intent.targetType ?? 'framer';
  
  // Build output
  const output: ResolvedMotionOutput = {
    version: intent.version,
    targetId: intent.targetId,
    ok: true,
    renderer,
    values: outputValues,
    diagnostics: [...diagnostics],
    trace: [...trace],
    performance: {
      processingTimeMs: trace.at(-1)?.timestamp ?? 0,
      processorCount: trace.length,
      reducedMotion: flags.reduced ?? false,
      gpuAccelerated: flags.gpuAccelerated ?? false,
    },
  };
  
  // Generate CSS variables for CSS adapter
  output.cssVariables = {
    '--anim-duration': `${outputValues.durationMs}ms`,
    '--anim-delay': `${outputValues.delayMs}ms`,
    '--anim-easing': outputValues.easing,
    '--anim-translate-x': `${outputValues.translateX}px`,
    '--anim-translate-y': `${outputValues.translateY}px`,
    '--anim-scale': `${outputValues.scale}`,
    '--anim-rotate': `${outputValues.rotateDeg}deg`,
    '--anim-opacity': `${outputValues.opacity}`,
    '--anim-glow': `${outputValues.glow ?? 0}`,
    '--anim-origin-x': `${outputValues.originX * 100}%`,
    '--anim-origin-y': `${outputValues.originY * 100}%`,
  };
  
  // Generate Framer Motion transition config
  output.framerTransition = {
    duration: outputValues.durationMs / 1000,
    delay: outputValues.delayMs / 1000,
    ease: parseEasing(outputValues.easing),
    repeat: outputValues.loop ? Infinity : 0,
    repeatType: 'loop' as const,
  };
  
  // Generate bytecode if enabled
  if (ampState.config.bytecodeEnabled) {
    output.bytecode = encodeMotionBytecode(output);
  }
  
  // Validate output schema
  const validation = validateMotionOutput(output);
  if (!validation.success) {
    output.ok = false;
    output.diagnostics.push(`Output validation failed: ${validation.error.message}`);
  }
  
  return output;
}

/**
 * Parse easing string into Framer Motion format
 */
function parseEasing(easing: string): string | number[] {
  // Named easings
  const namedEasings: Record<string, string | number[]> = {
    'linear': 'linear',
    'ease': 'easeInOut',
    'ease-in': 'easeIn',
    'ease-out': 'easeOut',
    'ease-in-out': 'easeInOut',
    'spring': [0.25, 0.1, 0.25, 1.0],
    'bounce': [0.68, -0.55, 0.265, 1.55],
  };
  
  if (namedEasings[easing]) {
    return namedEasings[easing];
  }
  
  // Cubic bezier: cubic-bezier(0.4, 0, 0.2, 1)
  const cubicMatch = easing.match(/cubic-bezier\(([^)]+)\)/);
  if (cubicMatch) {
    const points = cubicMatch[1].split(',').map(s => parseFloat(s.trim()));
    if (points.length === 4 && points.every(p => !isNaN(p))) {
      return points;
    }
  }
  
  return 'easeOut';
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run Animation AMP with given intent
 * 
 * @param intent - Animation intent to process
 * @returns Resolved motion output for renderer
 */
export async function runAnimationAmp(intent: AnimationIntent): Promise<ResolvedMotionOutput> {
  const startTime = performance.now();
  
  // Validate intent
  const validation = validateAnimationIntent(intent);
  if (!validation.success) {
    throw new AnimationAmpError(
      ANIMATION_ERROR_MESSAGES.INVALID_VERSION,
      AMP_ERROR_CODES.INTENT_VALIDATION_FAILED,
      intent,
      validation.error
    );
  }
  
  // Check if AMP is initialized
  if (!ampState.isRunning) {
    console.warn('[AnimationAMP] AMP not initialized, using defaults');
    initAnimationAmp();
  }
  
  // Normalize intent
  let workingState = normalizeIntent(intent);
  
  // Select processors
  const processors = processorRegistry.selectForIntent(intent);
  
  if (ampState.config.debug) {
    console.log('[AnimationAMP] Selected processors:', processors.map(p => p.id));
  }
  
  // Run processor pipeline
  workingState = await runProcessorPipeline(workingState, processors);
  
  // Fuse output
  const output = fuseMotionOutput(workingState);
  
  // Add to active animations
  ampState.activeAnimations.set(intent.targetId, output);
  
  // Build trace for diagnostics
  if (ampState.config.debug) {
    const trace = buildMotionTrace(output);
    console.log('[AnimationAMP] Motion trace:', trace);
  }
  
  return output;
}

/**
 * Get active animation output for target
 */
export function getActiveAnimation(targetId: string): ResolvedMotionOutput | undefined {
  return ampState.activeAnimations.get(targetId);
}

/**
 * Clear active animation for target
 */
export function clearActiveAnimation(targetId: string): void {
  ampState.activeAnimations.delete(targetId);
}

/**
 * Get all active animations
 */
export function getAllActiveAnimations(): Map<string, ResolvedMotionOutput> {
  return new Map(ampState.activeAnimations);
}

/**
 * Shutdown Animation AMP
 */
export function shutdownAnimationAmp(): void {
  ampState.isRunning = false;
  ampState.activeAnimations.clear();
  console.log('[AnimationAMP] Shutdown complete');
}

/**
 * Get AMP status
 */
export function getAmpStatus(): {
  isRunning: boolean;
  activeCount: number;
  config: AnimationAmpConfig;
} {
  return {
    isRunning: ampState.isRunning,
    activeCount: ampState.activeAnimations.size,
    config: { ...ampState.config },
  };
}

// ─── Auto-initialization ────────────────────────────────────────────────────

// Auto-init in dev mode for convenience
if (import.meta.env?.DEV) {
  initAnimationAmp({ debug: true });
}
