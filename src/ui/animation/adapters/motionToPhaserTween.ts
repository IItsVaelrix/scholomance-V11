/**
 * Animation AMP — Phaser Tween Adapter
 * 
 * Converts resolved motion output into Phaser tween configurations.
 */

import { ResolvedMotionOutput } from '../../../codex/animation/contracts/animation.types.ts';

/**
 * Convert resolved motion output to Phaser Tween config
 * 
 * @param motion - Resolved motion output from AMP
 * @param targets - Phaser game objects to animate
 * @returns Phaser.Types.Tweens.TweenBuilderConfig or similar
 */
export function motionToPhaserTween(
  motion: ResolvedMotionOutput,
  targets: any
): any {
  if (!motion.ok) {
    return null;
  }

  const { values } = motion;
  
  const props: any = {};
  
  if (values.translateX !== 0) props.x = values.translateX;
  if (values.translateY !== 0) props.y = values.translateY;
  if (values.rotateDeg !== 0) props.angle = values.rotateDeg;
  if (values.scale !== 1) props.scale = values.scale;
  if (values.opacity !== 1) props.alpha = values.opacity;
  
  // Custom properties can be handled via onUpdate or proxy objects
  if (values.glow !== undefined) props.glow = values.glow;

  return {
    targets,
    ...props,
    duration: values.durationMs,
    delay: values.delayMs,
    ease: motion.framerTransition?.ease || 'Power2',
    yoyo: values.loop,
    repeat: values.loop ? -1 : 0,
  };
}
