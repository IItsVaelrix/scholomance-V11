import { describe, it, expect } from 'vitest';
import { DimensionCompiler, DimensionRuntime } from '../../../codex/core/pixelbrain/dimension-formula-compiler';

describe('PixelBrain — Performance & Redundancy Pressure Test', () => {
  const compiler = new DimensionCompiler();
  const runtime = new DimensionRuntime();

  // 1. Referential Stability Test (The "GPU Feeding" Theory)
  it('CONFIRM/DENY: Returns a new object reference every execution even for identical input', () => {
    const spec = compiler.canonicalize(compiler.parse('1920×1080'));
    const bytecode = compiler.compile(spec);
    const context = { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1920, parentHeight: 1080 };

    const result1 = runtime.execute(bytecode, context);
    const result2 = runtime.execute(bytecode, context);

    // Denial check: If result1 === result2, the GPU/UI engine wouldn't be "fed" new data unnecessarily.
    // Confirm check: If result1 !== result2, the UI layer (React/Phaser) likely re-renders every frame.
    const isNewReference = result1 !== result2;
    console.log(`[TEST] Referential Stability: ${isNewReference ? 'CONFIRMED (New Reference Created)' : 'DENIED (Stable Reference)'}`);
    expect(isNewReference).toBe(true); 
  });

  // 2. Execution Throughput & Decay Test
  it('CONFIRM/DENY: Execution time decays over 100,000 iterations (Memory/Leak Pressure)', () => {
    const spec = compiler.canonicalize(compiler.parse('clamp(parent.width, 1200, 1440), aspect 16:9, snap integer'));
    const bytecode = compiler.compile(spec);
    const context = { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 1080 };

    const iterations = 100000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      runtime.execute(bytecode, context);
    }
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    console.log(`[TEST] Throughput: ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
    console.log(`[TEST] Avg execution time: ${avgTime.toFixed(4)}ms`);

    // A modern CPU should handle this math in < 0.001ms per call.
    // If avgTime is high or if we measure first 10k vs last 10k and it's higher, there's decay.
    expect(avgTime).toBeLessThan(0.01); // Threshold for a "fast" runtime
  });

  // 3. Instruction Set Growth Test (Bytecode Leak)
  it('CONFIRM/DENY: Bytecode length grows on repeated compilation of same human string', () => {
    const input = '1920x1080 or 1920x600';
    
    const bytecode1 = compiler.compile(compiler.canonicalize(compiler.parse(input)));
    const bytecode2 = compiler.compile(compiler.canonicalize(compiler.parse(input)));
    
    console.log(`[TEST] Bytecode Stability: Run 1 (${bytecode1.length} inst), Run 2 (${bytecode2.length} inst)`);
    expect(bytecode1.length).toBe(bytecode2.length);
  });
});
