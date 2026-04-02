import { MotionProcessor, MotionWorkingState, AnimationIntent } from '../contracts/motion-contract';
import { DimensionCompiler, DimensionRuntime } from '../../pixelbrain/dimension-formula-compiler';
import { ViewportChannel } from '../../../../src/lib/truesight/compiler/viewportBytecode';

/**
 * DIMENSION MICROPROCESSOR (mp.layout.dimensions)
 *
 * Bridges the Layout Formula Compiler with Animation.
 * Allows animation targets to know their width/height before transforming.
 * Useful for "Slide 100% of width" or "Center based on canvas" logic.
 *
 * Integration: Uses ViewportChannel.getState() as the canonical source of truth.
 */
export class DimensionProcessor implements MotionProcessor {
  id = 'mp.layout.dimensions';
  stage: const = 'normalize';
  
  private compiler = new DimensionCompiler();
  private runtime = new DimensionRuntime();

  supports(intent: AnimationIntent): boolean {
    return !!intent.constraints?.layoutConstraint;
  }

  run(state: MotionWorkingState): MotionWorkingState {
    const layout = state.intent.constraints?.layoutConstraint;
    if (!layout) return state;

    // Pull real-time viewport truth from the Bytecode Channel
    const viewport = ViewportChannel.getState();

    // Context resolution: state.intent.state overrides viewport truth if provided (manual override)
    const context = {
      viewportWidth: (state.intent.state?.viewportWidth as number) || viewport.width,
      viewportHeight: (state.intent.state?.viewportHeight as number) || viewport.height,
      parentWidth: (state.intent.state?.parentWidth as number) || viewport.width, // Defaults to viewport if no parent specified
      parentHeight: (state.intent.state?.parentHeight as number) || viewport.height,
      deviceClass: viewport.deviceClass,
      orientation: viewport.orientation,
      pixelRatio: viewport.pixelRatio,
    };

    try {
      const bytecode = this.compiler.compile(layout);
      const result = this.runtime.execute(bytecode, context);

      state.values.width = result.width;
      state.values.height = result.height;
      state.diagnostics.push(`LAYOUT_RESOLVED: ${result.width}x${result.height} [${viewport.deviceClass}/${viewport.orientation}]`);
      state.trace.push({ processorId: this.id, changed: ['width', 'height'] });
    } catch (err) {
      state.diagnostics.push(`LAYOUT_ERROR: ${(err as Error).message}`);
    }

    return state;
  }
}
