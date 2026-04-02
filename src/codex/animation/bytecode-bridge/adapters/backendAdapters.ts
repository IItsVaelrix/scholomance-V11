/**
 * Bytecode Blueprint Bridge — Backend Adapters
 * 
 * Adapters apply compiled motion payloads to actual execution environments.
 * They implement semantics, they don't redefine them.
 */

import {
  CSSMotionPayload,
  PhaserMotionPayload,
  PixelBrainFormulaPayload,
  MotionBytecodeArtifact,
  DiagnosticEntry,
} from "../contracts/blueprint.types.ts";

// ─── Adapter Contract ────────────────────────────────────────────────────────

export interface BackendAdapterCapabilities {
  supportedTransforms: string[];
  supportedEasings: string[];
  supportedEnvelopes: string[];
  supportsSymmetry: boolean;
  supportsGrid: boolean;
  performanceCaveats?: string[];
  degradationBehavior?: string;
}

export interface AdapterApplyOptions {
  targetElement: HTMLElement | Phaser.GameObjects.GameObject | unknown;
  payload: CSSMotionPayload | PhaserMotionPayload | PixelBrainFormulaPayload | MotionBytecodeArtifact;
  onStart?: () => void;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface AdapterApplyResult {
  success: boolean;
  instanceId?: string;
  errors: DiagnosticEntry[];
  warnings: DiagnosticEntry[];
}

// ─── CSS Adapter ─────────────────────────────────────────────────────────────

export const CSSAdapter = {
  name: "css",
  
  capabilities: {
    supportedTransforms: ["scale", "rotate", "translateX", "translateY", "opacity", "blur"],
    supportedEasings: ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "cubic-bezier", "steps"],
    supportedEnvelopes: ["constant", "sine", "triangle", "pulse", "bezier", "keyed"],
    supportsSymmetry: false,
    supportsGrid: false,
    performanceCaveats: ["Blur filters may impact performance on low-end devices"],
    degradationBehavior: "Degrades to simpler transforms when filters unsupported",
  } satisfies BackendAdapterCapabilities,

  /**
   * Apply CSS motion payload to a DOM element
   */
  apply(options: AdapterApplyOptions): AdapterApplyResult {
    const errors: DiagnosticEntry[] = [];
    const warnings: DiagnosticEntry[] = [];
    
    const { targetElement, payload } = options;
    
    if (!(targetElement instanceof HTMLElement)) {
      errors.push({
        code: "ADAPTER_CSS_INVALID_TARGET",
        severity: "error",
        category: "execution",
        message: "CSS adapter requires HTMLElement target",
      });
      return { success: false, errors, warnings };
    }

    const cssPayload = payload as CSSMotionPayload;

    // Apply CSS variables
    for (const [key, value] of Object.entries(cssPayload.variables)) {
      targetElement.style.setProperty(key, String(value));
    }

    // Apply animation config via Web Animations API
    if (cssPayload.keyframes && cssPayload.keyframes.length > 0) {
      try {
        const animation = targetElement.animate(
          cssPayload.keyframes.map((kf) => kf.values),
          {
            duration: cssPayload.animationConfig.durationMs,
            delay: cssPayload.animationConfig.delayMs,
            easing: cssPayload.animationConfig.easing,
            iterations: cssPayload.animationConfig.iterations === "infinite" ? Infinity : cssPayload.animationConfig.iterations,
          }
        );

        animation.onfinish = () => options.onComplete?.();
        
        if (options.onUpdate) {
          const tick = () => {
            const duration = animation.effect?.getComputedTiming().duration;
            const currentTime = animation.currentTime;
            
            if (typeof currentTime === "number" && typeof duration === "number" && duration > 0) {
              options.onUpdate?.(currentTime / duration);
            } else {
              options.onUpdate?.(0);
            }
            
            if (animation.playState !== "finished") {
              requestAnimationFrame(tick);
            }
          };
          requestAnimationFrame(tick);
        }

        options.onStart?.();

        return {
          success: true,
          instanceId: animation.id || `css-anim-${Date.now()}`,
          errors,
          warnings,
        };
      } catch (e) {
        errors.push({
          code: "ADAPTER_CSS_ANIMATION_FAILED",
          severity: "error",
          category: "execution",
          message: `Web Animations API failed: ${(e as Error).message}`,
        });
        return { success: false, errors, warnings };
      }
    }

    // Fallback: apply static styles
    if (cssPayload.keyframes && cssPayload.keyframes[0]) {
      for (const [key, value] of Object.entries(cssPayload.keyframes[0].values)) {
        targetElement.style.setProperty(key, String(value));
      }
    }

    options.onStart?.();

    return {
      success: true,
      instanceId: `css-static-${Date.now()}`,
      errors,
      warnings,
    };
  },

  /**
   * Check if a feature is supported
   */
  supports(feature: string): boolean {
    return this.capabilities.supportedTransforms.includes(feature) ||
           this.capabilities.supportedEasings.includes(feature) ||
           this.capabilities.supportedEnvelopes.includes(feature);
  },
};

// ─── Phaser Adapter ──────────────────────────────────────────────────────────

export const PhaserAdapter = {
  name: "phaser",
  
  capabilities: {
    supportedTransforms: ["scale", "rotate", "translateX", "translateY", "opacity", "tint"],
    supportedEasings: ["Linear", "Quad", "Cubic", "Quart", "Quint", "Sine", "Elastic", "Back", "Bounce"],
    supportedEnvelopes: ["constant", "sine", "triangle", "pulse"],
    supportsSymmetry: false,
    supportsGrid: true,
    performanceCaveats: ["Large numbers of tweens may impact frame rate"],
    degradationBehavior: "Falls back to simpler tweens when complex easing unavailable",
  } satisfies BackendAdapterCapabilities,

  /**
   * Apply Phaser motion payload to a game object
   */
  apply(options: AdapterApplyOptions): AdapterApplyResult {
    const errors: DiagnosticEntry[] = [];
    const warnings: DiagnosticEntry[] = [];
    
    const { targetElement, payload } = options;
    const phaserPayload = payload as PhaserMotionPayload;

    // Check if target is a Phaser GameObject
    const gameObject = targetElement as Phaser.GameObjects.GameObject & {
      scene?: { tweens: { add: (config: unknown) => Phaser.Tweens.Tween } };
    };

    if (!gameObject || typeof gameObject !== "object") {
      errors.push({
        code: "ADAPTER_PHASER_INVALID_TARGET",
        severity: "error",
        category: "execution",
        message: "Phaser adapter requires Phaser GameObject target",
      });
      return { success: false, errors, warnings };
    }

    try {
      const tweenConfig: Record<string, unknown> = {
        targets: gameObject,
        ...phaserPayload.config,
      };

      // Add callbacks
      if (options.onStart) {
        tweenConfig.onStart = options.onStart;
      }
      if (options.onComplete) {
        tweenConfig.onComplete = options.onComplete;
      }
      if (options.onUpdate) {
        tweenConfig.onUpdate = (_tween: unknown, target: unknown, value: unknown) => {
          options.onUpdate?.(typeof value === "number" ? value : 0);
        };
      }

      // Create tween
      if (gameObject.scene?.tweens) {
        gameObject.scene.tweens.add(tweenConfig);
        
        return {
          success: true,
          instanceId: `phaser-tween-${Date.now()}`,
          errors,
          warnings,
        };
      } else {
        warnings.push({
          code: "ADAPTER_PHASER_NO_TWEEN_MANAGER",
          severity: "warning",
          category: "execution",
          message: "Target has no scene.tweens - applying static values",
        });
        
        // Apply static values
        for (const [key, value] of Object.entries(phaserPayload.config)) {
          if (key !== "duration" && key !== "delay" && key !== "ease" && key !== "repeat") {
            (gameObject as Record<string, unknown>)[key] = value;
          }
        }
        
        return {
          success: true,
          instanceId: `phaser-static-${Date.now()}`,
          errors,
          warnings,
        };
      }
    } catch (e) {
      errors.push({
        code: "ADAPTER_PHASER_TWEEN_FAILED",
        severity: "error",
        category: "execution",
        message: `Phaser tween creation failed: ${(e as Error).message}`,
      });
      return { success: false, errors, warnings };
    }
  },

  supports(feature: string): boolean {
    return this.capabilities.supportedTransforms.includes(feature) ||
           this.capabilities.supportedEasings.includes(feature) ||
           this.capabilities.supportedEnvelopes.includes(feature);
  },
};

// ─── PixelBrain Adapter ──────────────────────────────────────────────────────

export const PixelBrainAdapter = {
  name: "pixelbrain",
  
  capabilities: {
    supportedTransforms: ["scale", "rotate", "translateX", "translateY", "glow", "color"],
    supportedEasings: ["custom", "mathematical"],
    supportedEnvelopes: ["constant", "sine", "triangle", "expDecay", "pulse", "keyed"],
    supportsSymmetry: true,
    supportsGrid: true,
    performanceCaveats: ["Complex symmetry with high order may impact performance"],
    degradationBehavior: "Reduces symmetry order when performance constrained",
  } satisfies BackendAdapterCapabilities,

  /**
   * Apply PixelBrain formula payload
   */
  apply(options: AdapterApplyOptions): AdapterApplyResult {
    const errors: DiagnosticEntry[] = [];
    const warnings: DiagnosticEntry[] = [];
    
    const { payload } = options;
    const pbPayload = payload as PixelBrainFormulaPayload;

    // PixelBrain execution would integrate with the existing PixelBrain runtime
    // This is a placeholder for the actual integration
    
    try {
      // Parse and execute formula
      executePixelBrainFormula(pbPayload.formula);
      
      // Apply symmetry transforms if specified
      if (pbPayload.symmetry) {
        applySymmetry(pbPayload.symmetry, pbPayload.coordinates);
      }

      // Apply grid snapping if specified
      if (pbPayload.grid?.snap) {
        applyGridSnap(pbPayload.grid, pbPayload.coordinates);
      }

      options.onStart?.();

      return {
        success: true,
        instanceId: `pixelbrain-formula-${Date.now()}`,
        errors,
        warnings,
      };
    } catch (e) {
      errors.push({
        code: "ADAPTER_PIXELBRAIN_EXECUTION_FAILED",
        severity: "error",
        category: "execution",
        message: `PixelBrain formula execution failed: ${(e as Error).message}`,
      });
      return { success: false, errors, warnings };
    }
  },

  supports(_feature: string): boolean {
    return this.capabilities.supportedTransforms.includes(feature) ||
           this.capabilities.supportedEasings.includes(feature) ||
           this.capabilities.supportedEnvelopes.includes(feature);
  },
};

// ─── Bytecode Adapter ────────────────────────────────────────────────────────

export const BytecodeAdapter = {
  name: "bytecode",
  
  capabilities: {
    supportedTransforms: ["all"],
    supportedEasings: ["all"],
    supportedEnvelopes: ["all"],
    supportsSymmetry: true,
    supportsGrid: true,
    performanceCaveats: ["Bytecode interpretation adds minimal overhead"],
    degradationBehavior: "Stops execution on fatal errors, continues with warnings",
  } satisfies BackendAdapterCapabilities,

  /**
   * Execute motion bytecode artifact
   */
  apply(options: AdapterApplyOptions): AdapterApplyResult {
    const errors: DiagnosticEntry[] = [];
    const warnings: DiagnosticEntry[] = [];
    
    const { targetElement, payload } = options;
    const bytecodePayload = payload as MotionBytecodeArtifact;

    try {
      // Verify checksum
      const checksumValid = verifyBytecodeChecksum(bytecodePayload);
      if (!checksumValid) {
        errors.push({
          code: "ADAPTER_BYTECODE_CHECKSUM_INVALID",
          severity: "error",
          category: "execution",
          message: "Bytecode checksum verification failed - artifact may be corrupted",
        });
        return { success: false, errors, warnings };
      }

      // Execute instructions
      const executionContext: Record<string, unknown> = {
        target: targetElement,
        time: 0,
        progress: 0,
      };

      for (const instruction of bytecodePayload.instructions) {
        executeBytecodeInstruction(instruction, executionContext, options);
      }

      return {
        success: true,
        instanceId: `bytecode-exec-${Date.now()}`,
        errors,
        warnings,
      };
    } catch (e) {
      errors.push({
        code: "ADAPTER_BYTECODE_EXECUTION_FAILED",
        severity: "error",
        category: "execution",
        message: `Bytecode execution failed: ${(e as Error).message}`,
      });
      return { success: false, errors, warnings };
    }
  },

  supports(_feature: string): boolean {
    return true; // Bytecode is the universal format
  },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function executePixelBrainFormula(formula: string): Record<string, unknown> {
  // Placeholder - would integrate with actual PixelBrain formula engine
  return { formula, executed: true };
}

function applySymmetry(
  symmetry: PixelBrainFormulaPayload["symmetry"],
  coordinates: PixelBrainFormulaPayload["coordinates"]
): void {
  // Placeholder - would apply symmetry transforms via existing Symmetry AMP
  console.log("Applying symmetry:", symmetry?.type, "to", coordinates.length, "coordinates");
}

function applyGridSnap(
  grid: PixelBrainFormulaPayload["grid"],
  coordinates: PixelBrainFormulaPayload["coordinates"]
): void {
  // Placeholder - would snap coordinates to grid
  console.log("Applying grid snap:", grid?.mode, "to", coordinates.length, "coordinates");
}

function executeBytecodeInstruction(
  instruction: { op: string; params: Record<string, string | number | boolean> },
  context: Record<string, unknown>,
  options: AdapterApplyOptions
): void {
  // Placeholder - would interpret bytecode instructions
  console.log("Executing bytecode instruction:", instruction.op, instruction.params);
  
  switch (instruction.op) {
    case "ANIM_START":
      options.onStart?.();
      break;
    case "ANIM_END":
      options.onComplete?.();
      break;
    // Additional instruction handlers would go here
  }
}

function verifyBytecodeChecksum(bytecode: MotionBytecodeArtifact): boolean {
  // Placeholder - would verify checksum using same algorithm as compiler
  return bytecode.checksum.length === 8; // Basic validation
}

// ─── Adapter Registry ────────────────────────────────────────────────────────

export const AdapterRegistry = {
  adapters: {
    css: CSSAdapter,
    phaser: PhaserAdapter,
    pixelbrain: PixelBrainAdapter,
    bytecode: BytecodeAdapter,
  },

  get(name: string): BackendAdapter | undefined {
    return this.adapters[name as keyof typeof this.adapters];
  },

  getAll(): BackendAdapter[] {
    return Object.values(this.adapters);
  },

  supports(adapterName: string, feature: string): boolean {
    const adapter = this.get(adapterName);
    return adapter?.supports(feature) ?? false;
  },
};

export type BackendAdapter = typeof CSSAdapter | typeof PhaserAdapter | typeof PixelBrainAdapter | typeof BytecodeAdapter;
