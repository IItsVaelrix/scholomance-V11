import { describe, it, expect, beforeEach } from 'vitest';
import { runAnimationAmp, initAnimationAmp, getActiveAnimation } from '../../../src/codex/animation/amp/runAnimationAmp.ts';
import { AnimationIntent } from '../../../src/codex/animation/contracts/animation.types.ts';

describe('Animation AMP Core', () => {
  beforeEach(() => {
    initAnimationAmp({ debug: true });
  });

  it('should process a basic animation intent', async () => {
    const intent: AnimationIntent = {
      version: 'v1.0',
      targetId: 'test-target-1',
      targetType: 'framer',
      trigger: 'mount',
      preset: 'orb-idle'
    };

    const output = await runAnimationAmp(intent);

    expect(output).toBeDefined();
    expect(output.ok).toBe(true);
    expect(output.targetId).toBe('test-target-1');
    expect(output.renderer).toBe('framer');
    expect(output.values).toBeDefined();
    expect(output.trace.length).toBeGreaterThan(0);
  });

  it('should apply constraints correctly', async () => {
    const intent: AnimationIntent = {
      version: 'v1.0',
      targetId: 'test-target-2',
      trigger: 'hover',
      constraints: {
        reducedMotion: true
      },
      state: {
        scale: 1.5,
        durationMs: 1000
      }
    };

    const output = await runAnimationAmp(intent);

    expect(output.performance?.reducedMotion).toBe(true);
    expect(output.values.durationMs).toBeLessThanOrEqual(200);
    expect(output.values.scale).toBeLessThanOrEqual(1.05);
    expect(output.diagnostics).toContain('Reduced motion applied');
  });

  it('should store and retrieve active animations', async () => {
    const intent: AnimationIntent = {
      version: 'v1.0',
      targetId: 'test-target-3',
      trigger: 'click'
    };

    const output = await runAnimationAmp(intent);
    const retrieved = getActiveAnimation('test-target-3');

    expect(retrieved?.targetId).toEqual(output.targetId);
  });

  it('should handle processor errors gracefully', async () => {
    // Mock a failing processor by intentionally providing invalid state
    const intent: AnimationIntent = {
      version: 'v1.0',
      targetId: 'test-target-4',
      trigger: 'audio',
      state: {
        invalidValue: NaN
      }
    };

    const output = await runAnimationAmp(intent);
    
    // It should still complete but might have diagnostics
    expect(output.ok).toBe(true);
    expect(output.values).toBeDefined();
  });
});
