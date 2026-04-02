import { describe, it, expect } from 'vitest';
import { DimensionCompiler, DimensionRuntime, DimensionCompileError, DimensionErrorCode, detectDeviceClass, detectOrientation } from '../../../codex/core/pixelbrain/dimension-formula-compiler';

describe('PixelBrain — Dimension Formula Compiler', () => {
  const compiler = new DimensionCompiler();
  const runtime = new DimensionRuntime();

  // ─── Parser QA (PDR Section 13) ────────────────────────────────────────────

  describe('Parser', () => {
    it('parses 1920×1080 as fixed width and height', () => {
      const parsed = compiler.parse('1920×1080');
      expect(parsed.type).toBe('fixed');
      expect(parsed.width).toBe(1920);
      expect(parsed.height).toBe(1080);
    });

    it('parses 1200px–1440px as a width range', () => {
      const parsed = compiler.parse('1200px–1440px');
      expect(parsed.type).toBe('range');
      expect(parsed.min).toBe(1200);
      expect(parsed.max).toBe(1440);
    });

    it('parses 16×16 to 32×32 as a bounded square family', () => {
      const parsed = compiler.parse('16x16 to 32x32');
      expect(parsed.type).toBe('square-range');
      expect(parsed.min).toBe(16);
      expect(parsed.max).toBe(32);
    });

    it('parses A or B as explicit variants', () => {
      const parsed = compiler.parse('1920×1080 or 1920×600');
      expect(parsed.type).toBe('variants');
      expect(parsed.variants.length).toBe(2);
      expect(parsed.variants[0].width).toBe(1920);
      expect(parsed.variants[1].height).toBe(600);
    });

    it('parses units (em, rem, vh, vw, %)', () => {
      expect(compiler.parse('50vw').type).toBe('single');
      expect(compiler.parse('50vh').type).toBe('single');
      expect(compiler.parse('50%').type).toBe('single');
      expect(compiler.parse('16em').type).toBe('single');
      expect(compiler.parse('1rem').type).toBe('single');
    });

    it('parses selectNearest', () => {
      const parsed = compiler.parse('selectNearest(parent.width, [16, 32])');
      expect(parsed.type).toBe('select-nearest');
      expect(parsed.options).toEqual([16, 32]);
    });

    it('parses orientation-specific specs', () => {
      const parsed = compiler.parse('portrait 1920x1080, landscape 1920x600');
      expect(parsed.type).toBe('orientation');
      expect(parsed.portrait.width).toBe(1920);
      expect(parsed.landscape.height).toBe(600);
    });

    it('rejects vague language', () => {
      expect(() => compiler.parse('kinda wide')).toThrow(DimensionCompileError);
      expect(() => compiler.parse('fairly large')).toThrow(DimensionCompileError);
      expect(() => compiler.parse('normal size')).toThrow(DimensionCompileError);
    });

    it('rejects negative values', () => {
      expect(() => compiler.parse('-100px')).toThrow(DimensionCompileError);
    });

    it('rejects impossible clamps', () => {
      expect(() => compiler.parse('clamp(parent.width, 1440, 1200)')).toThrow(DimensionCompileError);
    });
  });

  // ─── Canonicalization QA ───────────────────────────────────────────────────

  describe('Canonicalization', () => {
    it('every spec resolves to a supported canonical type', () => {
      const specs = [
        '1920×1080',
        '1200px–1440px',
        'viewport.width',
        'parent.width',
        '1920, aspect 16:9',
        '1920×1080 or 1920×600',
      ];

      for (const spec of specs) {
        const parsed = compiler.parse(spec);
        const canonical = compiler.canonicalize(parsed);
        expect(['fixed', 'range', 'viewport', 'container', 'aspect', 'variant']).toContain(canonical.kind);
      }
    });

    it('no vague prose survives canonicalization', () => {
      expect(() => {
        const parsed = compiler.parse('kinda wide');
        compiler.canonicalize(parsed);
      }).toThrow();
    });

    it('width-only specs do not silently invent height', () => {
      const parsed = compiler.parse('1920');
      const canonical = compiler.canonicalize(parsed);
      expect(canonical.heightPolicy).toBeUndefined();
    });

    it('every record contains snap mode', () => {
      const parsed = compiler.parse('1920×1080');
      const canonical = compiler.canonicalize(parsed);
      expect(canonical.snapMode).toBeDefined();
      expect(canonical.snapMode).toBe('integer');
    });

    it('aspect ratios compile to formula', () => {
      const parsed = compiler.parse('1920, aspect 16:9');
      const canonical = compiler.canonicalize(parsed);
      expect(canonical.heightPolicy).toBeDefined();
      expect(canonical.heightPolicy?.type).toBe('mul');
    });
  });

  // ─── Formula QA ────────────────────────────────────────────────────────────

  describe('Formula Evaluation', () => {
    it('clamp formulas evaluate correctly', () => {
      const spec = compiler.canonicalize(compiler.parse('clamp(parent.width, 1200, 1440)'));
      const bytecode = compiler.compile(spec);

      // Parent 1600 → 1440
      expect(runtime.execute(bytecode, { viewportWidth: 1600, viewportHeight: 900, parentWidth: 1600, parentHeight: 900 }).width).toBe(1440);
      // Parent 1300 → 1300
      expect(runtime.execute(bytecode, { viewportWidth: 1600, viewportHeight: 900, parentWidth: 1300, parentHeight: 900 }).width).toBe(1300);
      // Parent 1000 → 1200
      expect(runtime.execute(bytecode, { viewportWidth: 1600, viewportHeight: 900, parentWidth: 1000, parentHeight: 900 }).width).toBe(1200);
    });

    it('aspect formulas derive correct dimensions', () => {
      const spec = compiler.canonicalize(compiler.parse('1920, aspect 16:9'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080); // 1920 * 9/16
    });

    it('square formulas map height to width correctly', () => {
      const spec = compiler.canonicalize(compiler.parse('clamp(parent.width, 150, 300)'));
      spec.heightPolicy = { type: 'sameAsWidth' };
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 500, viewportHeight: 500, parentWidth: 200, parentHeight: 200 });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('nearest-size selection works correctly', () => {
      const spec = compiler.canonicalize(compiler.parse('selectNearest(parent.width, [16, 32])'));
      const bytecode = compiler.compile(spec);

      // Parent 20 → 16 (nearest)
      expect(runtime.execute(bytecode, { viewportWidth: 100, viewportHeight: 100, parentWidth: 20, parentHeight: 100 }).width).toBe(16);
      // Parent 25 → 32 (nearest)
      expect(runtime.execute(bytecode, { viewportWidth: 100, viewportHeight: 100, parentWidth: 25, parentHeight: 100 }).width).toBe(32);
    });
  });

  // ─── Bytecode QA ───────────────────────────────────────────────────────────

  describe('Bytecode Compilation', () => {
    it('formula AST compiles into stable bytecode', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×1080'));
      const bytecode1 = compiler.compile(spec);
      const bytecode2 = compiler.compile(spec);

      expect(JSON.stringify(bytecode1)).toBe(JSON.stringify(bytecode2));
    });

    it('variants compile into distinct programs', () => {
      const parsed = compiler.parse('1920×1080 or 1920×600');
      const canonical = compiler.canonicalize(parsed);
      
      expect(canonical.variants).toBeDefined();
      expect(canonical.variants?.length).toBe(2);

      const bytecode1 = compiler.compile(canonical.variants[0]);
      const bytecode2 = compiler.compile(canonical.variants[1]);

      expect(JSON.stringify(bytecode1)).not.toBe(JSON.stringify(bytecode2));
    });

    it('unsupported input fails loudly', () => {
      expect(() => compiler.parse('kinda big')).toThrow(DimensionCompileError);
      expect(() => compiler.canonicalize({ type: 'unknown' })).toThrow(DimensionCompileError);
    });
  });

  // ─── Runtime QA ────────────────────────────────────────────────────────────

  describe('Runtime Execution', () => {
    it('runtime executes bytecode and returns exact dimensions', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×1080'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('snap mode applies correctly per asset class', () => {
      // Integer snap
      const spec1 = compiler.canonicalize(compiler.parse('1920.5×1080.7, snap integer'));
      const bytecode1 = compiler.compile(spec1);
      const result1 = runtime.execute(bytecode1, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });
      expect(result1.width).toBe(1920); // Rounded
      expect(result1.height).toBe(1081); // Rounded

      // No snap
      const spec2 = compiler.canonicalize(compiler.parse('1920.5×1080.7, snap none'));
      const bytecode2 = compiler.compile(spec2);
      const result2 = runtime.execute(bytecode2, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });
      expect(result2.width).toBe(1920.5);
      expect(result2.height).toBe(1080.7);
    });

    it('fit mode applies consistently', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×1080, fit cover'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });

      expect(result.fitMode).toBe('cover');
    });

    it('anchor mode applies after dimension computation', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×1080, anchor center'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 2000, viewportHeight: 1200, parentWidth: 2000, parentHeight: 1200 });

      expect(result.anchor).toBe('center');
    });
  });

  // ─── All 10 PDR Bytecode Examples ──────────────────────────────────────────

  describe('PDR Section 7 — All Bytecode Examples', () => {
    it('7.1 Desktop fullscreen width', () => {
      const spec = compiler.canonicalize(compiler.parse('viewport.width'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(1920);
    });

    it('7.2 Desktop container width', () => {
      const spec = compiler.canonicalize(compiler.parse('clamp(parent.width, 1200, 1440)'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(1440);
    });

    it('7.3 Tablet width', () => {
      const spec = compiler.canonicalize(compiler.parse('768'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(768);
    });

    it('7.4 Mobile iOS width', () => {
      const spec = compiler.canonicalize(compiler.parse('clamp(viewport.width, 375, 390)'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 380, viewportHeight: 600, parentWidth: 380, parentHeight: 600 });
      expect(result.width).toBe(380);
    });

    it('7.5 Hero banner 1920×1080', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×1080, aspect 16:9, snap integer'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1920, parentHeight: 1080 });
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.aspectRatio).toEqual({ numerator: 16, denominator: 9 });
    });

    it('7.6 Hero banner 1920×600', () => {
      const spec = compiler.canonicalize(compiler.parse('1920×600'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1920, parentHeight: 1080 });
      expect(result.width).toBe(1920);
      expect(result.height).toBe(600);
    });

    it('7.7 Product thumbnail square', () => {
      const spec = compiler.canonicalize(compiler.parse('clamp(parent.width, 150, 300)'));
      spec.heightPolicy = { type: 'sameAsWidth' };
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 500, viewportHeight: 500, parentWidth: 200, parentHeight: 200 });
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('7.8 Logo rectangle', () => {
      const spec = compiler.canonicalize(compiler.parse('250×100, snap pixel'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 500, viewportHeight: 500, parentWidth: 500, parentHeight: 500 });
      expect(result.width).toBe(250);
      expect(result.height).toBe(100);
      expect(result.snapMode).toBe('pixel');
    });

    it('7.9 Logo square', () => {
      const spec = compiler.canonicalize(compiler.parse('100×100, snap pixel'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 500, viewportHeight: 500, parentWidth: 500, parentHeight: 500 });
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('7.10 Favicon selectNearest', () => {
      const spec = compiler.canonicalize(compiler.parse('selectNearest(parent.width, [16, 32])'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 500, viewportHeight: 500, parentWidth: 20, parentHeight: 500 });
      expect(result.width).toBe(16);
      expect(result.height).toBe(16);
    });
  });

  // ─── Device & Orientation Detection ────────────────────────────────────────

  describe('Device Class Detection', () => {
    it('detects desktop for viewport >= 1024', () => {
      expect(detectDeviceClass(1920)).toBe('desktop');
      expect(detectDeviceClass(1024)).toBe('desktop');
    });

    it('detects tablet for viewport 768-1023', () => {
      expect(detectDeviceClass(768)).toBe('tablet');
      expect(detectDeviceClass(900)).toBe('tablet');
    });

    it('detects mobile-ios for viewport 375-767', () => {
      expect(detectDeviceClass(375)).toBe('mobile-ios');
      expect(detectDeviceClass(414)).toBe('mobile-ios');
    });

    it('detects mobile-android for viewport < 375', () => {
      expect(detectDeviceClass(360)).toBe('mobile-android');
      expect(detectDeviceClass(320)).toBe('mobile-android');
    });
  });

  describe('Orientation Detection', () => {
    it('detects portrait', () => {
      expect(detectOrientation(768, 1024)).toBe('portrait');
    });

    it('detects landscape', () => {
      expect(detectOrientation(1920, 1080)).toBe('landscape');
    });

    it('detects square', () => {
      expect(detectOrientation(512, 512)).toBe('square');
    });
  });

  // ─── Unit Conversion Tests ─────────────────────────────────────────────────

  describe('Unit Conversion', () => {
    it('converts em to px', () => {
      const spec = compiler.canonicalize(compiler.parse('16em'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(256); // 16 * 16
    });

    it('converts rem to px', () => {
      const spec = compiler.canonicalize(compiler.parse('2rem'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(32); // 2 * 16
    });

    it('converts vw to px', () => {
      const spec = compiler.canonicalize(compiler.parse('50vw'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(960); // 50% of 1920
    });

    it('converts vh to px', () => {
      const spec = compiler.canonicalize(compiler.parse('25vh'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 1600, parentHeight: 900 });
      expect(result.width).toBe(270); // 25% of 1080
    });

    it('converts % to px (parent-relative)', () => {
      const spec = compiler.canonicalize(compiler.parse('50%'));
      const bytecode = compiler.compile(spec);
      const result = runtime.execute(bytecode, { viewportWidth: 1920, viewportHeight: 1080, parentWidth: 800, parentHeight: 600 });
      expect(result.width).toBe(400); // 50% of 800
    });
  });
});
