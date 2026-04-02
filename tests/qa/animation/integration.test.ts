import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAnimationIntent } from '../../../src/ui/animation/hooks/useAnimationIntent.ts';
import { useResolvedMotion } from '../../../src/ui/animation/hooks/useResolvedMotion.ts';
import { initAnimationAmp, runAnimationAmp } from '../../../src/codex/animation/amp/runAnimationAmp.ts';
import { AnimationIntent } from '../../../src/codex/animation/contracts/animation.types.ts';

describe('Animation AMP Integration', () => {
  beforeEach(() => {
    initAnimationAmp({ debug: true });
  });

  it('should resolve motion via useAnimationIntent hook', async () => {
    const intent: AnimationIntent = {
      version: 'v1.0',
      targetId: 'hook-test-1',
      trigger: 'mount',
      preset: 'orb-idle'
    };

    const { result } = renderHook(() => useAnimationIntent(intent));

    await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 2000 });
    
    expect(result.current?.targetId).toBe('hook-test-1');
    expect(result.current?.ok).toBe(true);
  });

  it('should poll for updates via useResolvedMotion hook', async () => {
    const targetId = 'polling-test-1';
    
    // 1. Initial run
    await runAnimationAmp({
      version: 'v1.0',
      targetId,
      trigger: 'mount',
      preset: 'orb-idle'
    });

    const { result } = renderHook(() => useResolvedMotion(targetId, 100));

    expect(result.current?.targetId).toBe(targetId);

    // 2. Trigger another run for same target
    await runAnimationAmp({
      version: 'v1.0',
      targetId,
      trigger: 'hover',
      state: { scale: 1.2 }
    });

    // 3. Hook should pick up update after polling
    await waitFor(() => expect(result.current?.values.scale).toBe(1.2), { timeout: 1000 });
  });
});
