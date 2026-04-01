/**
 * Animation AMP — useAnimationIntent Hook
 * 
 * Submits an animation intent to the AMP and returns the resolved motion.
 */

import { useState, useEffect, useRef } from 'react';
import { AnimationIntent, ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';
import { runAnimationAmp } from '../../../codex/animation/amp/runAnimationAmp.ts';

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
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track current intent to avoid redundant runs
  const lastIntentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!intent || !enabled) {
      if (motion) setMotion(null);
      return;
    }

    // Simple hash to detect changes
    const intentHash = JSON.stringify({
      targetId: intent.targetId,
      preset: intent.preset,
      trigger: intent.trigger,
      state: intent.state,
      bytecode: intent.bytecode
    });

    if (intentHash === lastIntentRef.current && motion) {
      return;
    }

    lastIntentRef.current = intentHash;
    
    let isMounted = true;
    
    const processIntent = async () => {
      setIsProcessing(true);
      try {
        const result = await runAnimationAmp(intent);
        if (isMounted) {
          setMotion(result);
        }
      } catch (error) {
        console.error('[useAnimationIntent] AMP Error:', error);
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    };

    void processIntent();

    return () => {
      isMounted = false;
    };
  }, [intent, enabled]);

  return motion;
}
