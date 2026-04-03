/**
 * Animation AMP — CSS Variables Adapter
 * 
 * Extracts resolved motion output into CSS custom properties.
 */

import { ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';

/**
 * Convert resolved motion output to CSS style object
 * 
 * @param motion - Resolved motion output from AMP
 * @returns React.CSSProperties with animation variables
 */
export function motionToCssVars(motion: ResolvedMotionOutput): React.CSSProperties {
  if (!motion.ok || !motion.cssVariables) {
    return {};
  }

  return motion.cssVariables as React.CSSProperties;
}
