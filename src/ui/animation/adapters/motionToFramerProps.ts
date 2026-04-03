/**
 * Animation AMP — Framer Motion Adapter
 * 
 * Converts resolved motion output into props for Framer Motion components.
 */

import { ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';

export interface FramerMotionProps {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  style?: React.CSSProperties;
}

/**
 * Convert resolved motion output to Framer Motion props
 * 
 * @param motion - Resolved motion output from AMP
 * @param options - Additional adapter options
 * @returns Props compatible with <motion.div />
 */
export function motionToFramerProps(
  motion: ResolvedMotionOutput,
  options: {
    useScaleX?: boolean;
    useScaleY?: boolean;
    includeOpacity?: boolean;
    includeTransform?: boolean;
    includeGlow?: boolean;
  } = {
    includeOpacity: true,
    includeTransform: true,
    includeGlow: true,
  }
): FramerMotionProps {
  if (!motion.ok) {
    return {};
  }

  const { values, framerTransition } = motion;
  
  const animate: any = {};
  
  // Transform
  if (options.includeTransform) {
    if (values.translateX !== 0) animate.x = values.translateX;
    if (values.translateY !== 0) animate.y = values.translateY;
    if (values.rotateDeg !== 0) animate.rotate = values.rotateDeg;
    
    if (options.useScaleX || options.useScaleY) {
      if (options.useScaleX) animate.scaleX = values.scaleX;
      if (options.useScaleY) animate.scaleY = values.scaleY;
    } else if (values.scale !== 1) {
      animate.scale = values.scale;
    }
  }
  
  // Opacity
  if (options.includeOpacity) {
    animate.opacity = values.opacity;
  }
  
  // Custom properties (Glow, Blur)
  const style: React.CSSProperties = {};
  if (options.includeGlow && values.glow !== undefined) {
    (style as any)['--glow-intensity'] = values.glow;
    animate['--glow-intensity'] = values.glow;
  }
  
  if (values.blur !== undefined && values.blur > 0) {
    animate.filter = `blur(${values.blur}px)`;
  }

  return {
    animate,
    transition: framerTransition,
    style,
  };
}
