/**
 * Symmetry AMP Integration Processor
 * 
 * Connects Animation AMP to the existing Symmetry AMP system.
 * Applies symmetry-aware motion transformations for mirrored/radial patterns.
 */

import { MotionProcessor, MotionWorkingState, AnimationIntent } from '../../contracts/animation.types.ts';

/**
 * Symmetry-aware motion processor
 * 
 * Integrates with Symmetry AMP to apply:
 * - Mirrored motion for horizontal/vertical symmetry
 * - Radial motion patterns for radial symmetry
 * - Axis-aligned transforms
 */
export const symmetryMotionProcessor: MotionProcessor = {
  id: 'mp.symmetry.motion',
  stage: 'symmetry',
  priority: 70,
  
  supports(intent: AnimationIntent): boolean {
    return intent.symmetry !== undefined && 
           intent.symmetry.type !== 'none' &&
           intent.symmetry.confidence !== undefined &&
           intent.symmetry.confidence > 0.5;
  },
  
  run(input: MotionWorkingState): MotionWorkingState {
    const state = { ...input };
    const symmetry = state.intent.symmetry;
    
    if (!symmetry) {
      return state;
    }
    
    state.diagnostics.push(`Symmetry motion applied: ${symmetry.type} (confidence: ${symmetry.confidence})`);
    state.flags.symmetryApplied = true;
    
    const changes: string[] = [];
    
    // Apply symmetry-specific motion patterns
    switch (symmetry.type) {
      case 'horizontal':
        // Mirror motion across horizontal axis
        if (symmetry.mirror) {
          // For horizontal symmetry, mirror Y transforms
          if (state.values.translateY) {
            state.values.translateY = -state.values.translateY;
            changes.push('translateY');
          }
          
          // Set origin to horizontal center
          state.values.originY = 0.5;
          changes.push('originY');
        }
        break;
        
      case 'vertical':
        // Mirror motion across vertical axis
        if (symmetry.mirror) {
          // For vertical symmetry, mirror X transforms
          if (state.values.translateX) {
            state.values.translateX = -state.values.translateX;
            changes.push('translateX');
          }
          
          // Set origin to vertical center
          state.values.originX = 0.5;
          changes.push('originX');
        }
        break;
        
      case 'radial':
        // Apply radial motion pattern
        if (symmetry.mirror) {
          // Calculate rotation based on symmetry order
          const order = Math.max(2, Math.round(360 / (symmetry.axis ?? 90)));
          const segmentAngle = 360 / order;
          
          // Apply subtle rotation for radial effect
          state.values.rotateDeg = segmentAngle;
          state.values.loop = true;
          state.values.durationMs = (state.values.durationMs ?? 300) * order;
          changes.push('rotateDeg', 'loop', 'durationMs');
          
          // Center origin for radial rotation
          state.values.originX = 0.5;
          state.values.originY = 0.5;
          changes.push('originX', 'originY');
        }
        break;
    }
    
    // Apply confidence-based intensity scaling
    // Higher confidence = more pronounced symmetry effect
    if (symmetry.confidence !== undefined) {
      const intensity = symmetry.confidence;
      
      // Scale transform values by confidence
      if (state.values.translateX) {
        state.values.translateX *= intensity;
        changes.push('translateX');
      }
      if (state.values.translateY) {
        state.values.translateY *= intensity;
        changes.push('translateY');
      }
      if (state.values.scale && state.values.scale !== 1) {
        const delta = (state.values.scale - 1) * intensity;
        state.values.scale = 1 + delta;
        changes.push('scale');
      }
    }
    
    // Record trace
    if (changes.length > 0) {
      state.trace.push({
        processorId: this.id,
        stage: this.stage,
        changed: changes,
        timestamp: performance.now(),
      });
    }
    
    return state;
  },
};

/**
 * Symmetry-aware stagger processor
 * 
 * Applies staggered animations based on symmetry axis
 */
export const symmetryStaggerProcessor: MotionProcessor = {
  id: 'mp.symmetry.stagger',
  stage: 'sequence',
  priority: 60,
  
  supports(intent: AnimationIntent): boolean {
    return intent.symmetry !== undefined &&
           intent.symmetry.type !== 'none' &&
           intent.state?.staggerIndex !== undefined;
  },
  
  run(input: MotionWorkingState): MotionWorkingState {
    const state = { ...input };
    const symmetry = state.intent.symmetry;
    const staggerIndex = state.intent.state?.staggerIndex as number;
    const staggerTotal = state.intent.state?.staggerTotal as number | undefined;
    
    if (!symmetry || staggerIndex === undefined) {
      return state;
    }
    
    // Calculate phase offset based on symmetry
    let phaseOffset = 0;
    
    switch (symmetry.type) {
      case 'horizontal':
        // Stagger from center outward or vice versa
        phaseOffset = staggerIndex * 50; // 50ms per element
        break;
        
      case 'vertical':
        // Stagger from top to bottom or vice versa
        phaseOffset = staggerIndex * 50;
        break;
        
      case 'radial':
        // Stagger in radial pattern
        const total = staggerTotal ?? 8;
        phaseOffset = (staggerIndex / total) * (state.values.durationMs ?? 300);
        break;
    }
    
    state.values.phaseOffset = phaseOffset;
    state.values.delayMs = (state.values.delayMs ?? 0) + phaseOffset;
    
    state.diagnostics.push(`Symmetry stagger applied: ${phaseOffset}ms offset`);
    state.trace.push({
      processorId: this.id,
      stage: this.stage,
      changed: ['phaseOffset', 'delayMs'],
      timestamp: performance.now(),
    });
    
    return state;
  },
};

// ─── Processor Collection ───────────────────────────────────────────────────

export const symmetryProcessors: MotionProcessor[] = [
  symmetryMotionProcessor,
  symmetryStaggerProcessor,
];
