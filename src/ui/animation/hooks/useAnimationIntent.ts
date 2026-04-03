/**
 * Animation AMP — useAnimationIntent Hook
 * 
 * Submits an animation intent to the AMP and returns the resolved motion.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimationIntent, ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';
import { runAnimationAmp } from '../../../codex/animation/amp/runAnimationAmp.ts';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.js';

/**
 * Hook to submit an animation intent to the AMP
 * 
 * @param intent - The animation intent to process
 * @param enabled - Whether to run the AMP (default true)
 * @returns Resolved motion output or null if not yet processed
 */
export function useAnimationIntent(
  intent: AnimationIntent | null,
  enabled: boolean = true
): ResolvedMotionOutput | null {
  const [motion, setMotion] = useState<ResolvedMotionOutput | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Augment intent with accessibility constraints if not specified
  const augmentedIntent = useMemo(() => {
    if (!intent) return null;
    
    return {
      ...intent,
      constraints: {
        reducedMotion: prefersReducedMotion,
        ...intent.constraints,
      }
    };
  }, [intent, prefersReducedMotion]);

  // Track current intent to avoid redundant runs
  const lastIntentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!augmentedIntent || !enabled) {
      if (motion) setMotion(null);
      return;
    }

    // Simple hash to detect changes
    const intentHash = JSON.stringify({
      targetId: augmentedIntent.targetId,
      preset: augmentedIntent.preset,
      trigger: augmentedIntent.trigger,
      state: augmentedIntent.state,
      bytecode: augmentedIntent.bytecode,
      constraints: augmentedIntent.constraints
    });

    if (intentHash === lastIntentRef.current && motion) {
      return;
    }

    lastIntentRef.current = intentHash;
    
    let isMounted = true;
    
    const processIntent = async () => {
      try {
        const result = await runAnimationAmp(augmentedIntent);
        if (isMounted) {
          setMotion(result);
        }
      } catch (error) {
        console.error('[useAnimationIntent] AMP Error:', error);
      }
    };

    void processIntent();

    return () => {
      isMounted = false;
    };
  }, [augmentedIntent, enabled, motion]);

  return motion;
}
