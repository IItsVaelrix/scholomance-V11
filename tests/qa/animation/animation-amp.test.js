import { describe, it, expect } from 'vitest';
import { runAnimationAmp } from '../../../codex/core/animation/amp/run-animation-amp';
import { DimensionCompiler } from '../../../codex/core/pixelbrain/dimension-formula-compiler';

describe('Animation AMP — Connection & Integration', () => {
  const compiler = new DimensionCompiler();

  it('successfully resolves layout constraints through the microprocessor pipeline', () => {
    // 1. Create a layout constraint (e.g., a square logo)
    const layout = compiler.canonicalize(compiler.parse('100x100'));

    // 2. Create an animation intent with this constraint
    const intent = {
      version: '1.0.0',
      targetId: 'logo-asset',
      trigger: 'mount',
      constraints: {
        layoutConstraint: layout
      }
    };

    // 3. Run the AMP
    const output = runAnimationAmp(intent);

    // 4. Validate connection
    expect(output.ok).toBe(true);
    expect(output.values.width).toBe(100);
    expect(output.values.height).toBe(100);
    expect(output.trace.some(t => t.processorId === 'mp.layout.dimensions')).toBe(true);
  });

  it('routes to the correct renderer based on target type', () => {
    const phaserIntent = {
      version: '1.0.0',
      targetId: 'sprite-1',
      targetType: 'phaser',
      trigger: 'idle'
    };

    const output = runAnimationAmp(phaserIntent);
    expect(output.renderer).toBe('phaser');
  });

  it('applies default motion values when no processors modify them', () => {
    const intent = {
      version: '1.0.0',
      targetId: 'simple-box',
      trigger: 'hover'
    };

    const output = runAnimationAmp(intent);
    expect(output.values.opacity).toBe(1);
    expect(output.values.scale).toBe(1);
    expect(output.values.durationMs).toBe(300);
  });
});
