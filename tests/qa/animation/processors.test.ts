import { describe, it, expect } from 'vitest';
import { 
  reducedMotionProcessor,
  deviceProfileProcessor,
  performanceCapProcessor,
  boundsConstraintProcessor
} from '../../../src/codex/animation/processors/constraints/constraintProcessors.ts';
import { 
  MotionWorkingState, 
  AnimationIntent 
} from '../../../src/codex/animation/contracts/animation.types.ts';

const createMockState = (intent: Partial<AnimationIntent> = {}, values: Partial<MotionWorkingState['values']> = {}): MotionWorkingState => ({
  intent: {
    version: 'v1.0',
    targetId: 'test-target',
    trigger: 'mount',
    ...intent
  },
  values: {
    durationMs: 400,
    delayMs: 0,
    easing: 'ease-out',
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateDeg: 0,
    opacity: 1,
    loop: false,
    originX: 0.5,
    originY: 0.5,
    ...values
  },
  flags: {
    reduced: false,
    constrained: false,
  },
  diagnostics: [],
  trace: []
});

describe('Constraint Microprocessors', () => {
  describe('reducedMotionProcessor', () => {
    it('should clamp values when reducedMotion is enabled', () => {
      const state = createMockState(
        { constraints: { reducedMotion: true } },
        { durationMs: 1000, scale: 2, loop: true, translateX: 50, glow: 1 }
      );
      
      const result = reducedMotionProcessor.run(state);
      
      expect(result.values.durationMs).toBe(200);
      expect(result.values.scale).toBeLessThanOrEqual(1.05);
      expect(result.values.loop).toBe(false);
      expect(result.values.translateX).toBe(10);
      expect(result.values.glow).toBe(0);
      expect(result.flags.reduced).toBe(true);
    });

    it('should NOT clamp values when reducedMotion is disabled', () => {
      const state = createMockState(
        { constraints: { reducedMotion: false } },
        { durationMs: 1000, scale: 2 }
      );
      
      const result = reducedMotionProcessor.run(state);
      
      expect(result.values.durationMs).toBe(1000);
      expect(result.values.scale).toBe(2);
      expect(result.flags.reduced).toBe(false);
    });
  });

  describe('deviceProfileProcessor', () => {
    it('should apply mobile performance caps', () => {
      const state = createMockState(
        { constraints: { deviceClass: 'mobile' } },
        { durationMs: 1000, blur: 10, glow: 0.8 }
      );
      
      const result = deviceProfileProcessor.run(state);
      
      expect(result.values.durationMs).toBe(400);
      expect(result.values.blur).toBe(0);
      expect(result.values.glow).toBe(0.3);
      expect(result.flags.constrained).toBe(true);
    });
  });

  describe('performanceCapProcessor', () => {
    it('should enforce maxDurationMs', () => {
      const state = createMockState(
        { constraints: { maxDurationMs: 500 } },
        { durationMs: 1000 }
      );
      
      const result = performanceCapProcessor.run(state);
      
      expect(result.values.durationMs).toBe(500);
    });

    it('should enforce FPS cap for loops', () => {
      const state = createMockState(
        { constraints: { maxFps: 30 } },
        { durationMs: 10, loop: true }
      );
      
      const result = performanceCapProcessor.run(state);
      
      // frameTime for 30fps is ~33.3ms
      expect(result.values.durationMs).toBeGreaterThanOrEqual(33);
    });
  });

  describe('boundsConstraintProcessor', () => {
    it('should clamp unreasonable values', () => {
      const state = createMockState(
        {},
        { scale: 10, opacity: 5, rotateDeg: 720, glow: -1 }
      );
      
      const result = boundsConstraintProcessor.run(state);
      
      expect(result.values.scale).toBe(3);
      expect(result.values.opacity).toBe(1);
      expect(result.values.rotateDeg).toBe(0);
      expect(result.values.glow).toBe(0);
    });
  });
});
