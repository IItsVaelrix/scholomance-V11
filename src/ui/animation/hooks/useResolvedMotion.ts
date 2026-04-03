/**
 * Animation AMP — useResolvedMotion Hook
 * 
 * Consumes the resolved motion output from an active animation by targetId.
 */

import { useState, useEffect } from 'react';
import { ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';
import { getActiveAnimation } from '../../../codex/animation/amp/runAnimationAmp.ts';

/**
 * Hook to consume a resolved motion output for a given targetId
 * 
 * @param targetId - The unique identifier of the animation target
 * @param pollingIntervalMs - Frequency to poll for updates (default 100ms)
 * @returns Resolved motion output or null if no active animation found
 */
export function useResolvedMotion(
  targetId: string | null,
  pollingIntervalMs: number = 100
): ResolvedMotionOutput | null {
  const [motion, setMotion] = useState<ResolvedMotionOutput | null>(null);

  useEffect(() => {
    if (!targetId) {
      if (motion) setMotion(null);
      return;
    }

    // Initial check
    const initial = getActiveAnimation(targetId);
    if (initial) {
      setMotion(initial);
    }

    // Polling for updates (could be replaced by an event emitter in future)
    const interval = setInterval(() => {
      const current = getActiveAnimation(targetId);
      if (current !== motion) {
        setMotion(current || null);
      }
    }, pollingIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [targetId, pollingIntervalMs, motion]);

  return motion;
}
