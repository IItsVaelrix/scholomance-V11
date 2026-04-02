/**
 * Bytecode Blueprint Bridge — Test Suite
 * 
 * Comprehensive tests for parser, validator, compiler, and QA layers.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  parseBlueprintBlock,
  extractBlueprintBlocks,
} from "../../../src/codex/animation/bytecode-bridge/parser/blueprintParser";

import {
  validateBlueprint,
  expandPresets,
} from "../../../src/codex/animation/bytecode-bridge/validator/blueprintValidator";

import {
  compileBlueprint,
} from "../../../src/codex/animation/bytecode-bridge/compiler/blueprintCompiler";

import {
  generateQAReport,
  expectBlueprintInvariant,
  assertBackendParity,
} from "../../../src/codex/animation/bytecode-bridge/qa/blueprintQA";

import {
  AnimationBlueprintV1,
  AnimationPresetV1,
} from "../../../src/codex/animation/bytecode-bridge/contracts/blueprint.types";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const VALID_BLUEPRINT = `
ANIM_START
ID orb-transmission-pulse
NAME Orb Transmission Pulse
TARGET id player-orb
PRESET transmission-pulse
DURATION 800
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP 1
PHASE 0.125
SCALE BASE 1.0 PEAK 1.05
GLOW BASE 0.0 PEAK 0.5
SYMMETRY TYPE radial ORDER 4 ORIGIN 0.5 0.5 SPACE local
GRID MODE cell-space SNAP true
COMPOSITE PASS hybrid
CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16
QA INVARIANT radial-symmetry-preserved
QA INVARIANT scale-remains-within-bounds
ANIM_END
`.trim();

const MINIMAL_BLUEPRINT = `
ANIM_START
ID minimal-test
TARGET id test-element
DURATION 400
EASE TOKEN LINEAR
LOOP 1
ANIM_END
`.trim();

// ─── Parser Tests ────────────────────────────────────────────────────────────

describe("Bytecode Blueprint Bridge — Parser", () => {
  describe("parseBlueprintBlock", () => {
    it("should parse a valid blueprint successfully", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      
      expect(result.success).toBe(true);
      expect(result.blueprint).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it("should extract all required fields", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      expect(blueprint.id).toBe("orb-transmission-pulse");
      expect(blueprint.name).toBe("Orb Transmission Pulse");
      expect(blueprint.target.selectorType).toBe("id");
      expect(blueprint.target.value).toBe("player-orb");
      expect(blueprint.durationMs).toBe(800);
      expect(blueprint.loop).toBe(1);
    });

    it("should parse transforms correctly", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      expect(blueprint.transforms?.scale).toBeDefined();
      expect(blueprint.transforms?.scale?.base).toBe(1.0);
      expect(blueprint.transforms?.scale?.peak).toBe(1.05);
      expect(blueprint.transforms?.glow?.base).toBe(0.0);
      expect(blueprint.transforms?.glow?.peak).toBe(0.5);
    });

    it("should parse symmetry correctly", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      expect(blueprint.symmetry?.type).toBe("radial");
      expect(blueprint.symmetry?.order).toBe(4);
      expect(blueprint.symmetry?.origin?.x).toBe(0.5);
      expect(blueprint.symmetry?.origin?.y).toBe(0.5);
    });

    it("should fail without ANIM_START", () => {
      const invalid = `
TARGET id test
DURATION 400
EASE TOKEN LINEAR
LOOP 1
ANIM_END
`.trim();
      
      const result = parseBlueprintBlock(invalid);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === "ANIM_1002")).toBe(true);
    });

    it("should fail without ANIM_END", () => {
      const invalid = `
ANIM_START
ID test
TARGET id test
DURATION 400
EASE TOKEN LINEAR
LOOP 1
`.trim();
      
      const result = parseBlueprintBlock(invalid);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === "ANIM_1003")).toBe(true);
    });

    it("should fail with missing required fields", () => {
      const invalid = `
ANIM_START
ANIM_END
`.trim();
      
      const result = parseBlueprintBlock(invalid);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === "ANIM_1006")).toBe(true);
    });

    it("should reject unknown directives", () => {
      const invalid = `
ANIM_START
ID test
TARGET id test
DURATION 400
EASE TOKEN LINEAR
LOOP 1
UNKNOWN_DIRECTIVE value
ANIM_END
`.trim();
      
      const result = parseBlueprintBlock(invalid);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === "ANIM_1001")).toBe(true);
    });
  });

  describe("extractBlueprintBlocks", () => {
    it("should extract blueprint blocks from markdown", () => {
      const markdown = `
# Some PDR Document

Here is the animation spec:

ANIM_START
ID test-animation
TARGET id test
DURATION 500
EASE TOKEN LINEAR
LOOP 1
ANIM_END

Some more text here.
`.trim();
      
      const blocks = extractBlueprintBlocks(markdown);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain("ANIM_START");
      expect(blocks[0].content).toContain("ID test-animation");
    });

    it("should extract multiple blocks", () => {
      const markdown = `
ANIM_START
ID first
TARGET id a
DURATION 100
EASE TOKEN LINEAR
LOOP 1
ANIM_END

ANIM_START
ID second
TARGET id b
DURATION 200
EASE TOKEN LINEAR
LOOP 1
ANIM_END
`.trim();
      
      const blocks = extractBlueprintBlocks(markdown);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].content).toContain("ID first");
      expect(blocks[1].content).toContain("ID second");
    });
  });
});

// ─── Validator Tests ─────────────────────────────────────────────────────────

describe("Bytecode Blueprint Bridge — Validator", () => {
  describe("validateBlueprint", () => {
    it("should validate a correct blueprint", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      const validation = validateBlueprint(blueprint);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate minimal blueprint", () => {
      const result = parseBlueprintBlock(MINIMAL_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      const validation = validateBlueprint(blueprint);
      
      expect(validation.valid).toBe(true);
    });

    it("should catch invalid symmetry order", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        symmetry: { type: "radial", order: 1 }, // Invalid: order < 2
      };
      
      const validation = validateBlueprint(blueprint);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes("ORDER"))).toBe(true);
    });

    it("should catch transform bound conflicts", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        transforms: {
          scale: { base: 1.5, min: 1.0, max: 1.2 }, // base > max
        },
      };
      
      const validation = validateBlueprint(blueprint);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes("above max"))).toBe(true);
    });

    it("should warn on high property count", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        transforms: {
          scale: { base: 1.0 },
          rotate: { base: 0 },
          translateX: { base: 0 },
          translateY: { base: 0 },
          opacity: { base: 1 },
          glow: { base: 0 },
          blur: { base: 0 },
        },
        envelopes: {
          env1: { kind: "sine", params: { amplitude: 0.1, period: 100 } },
          env2: { kind: "sine", params: { amplitude: 0.1, period: 100 } },
          env3: { kind: "sine", params: { amplitude: 0.1, period: 100 } },
          env4: { kind: "sine", params: { amplitude: 0.1, period: 100 } },
        },
      };
      
      const validation = validateBlueprint(blueprint);
      
      expect(validation.warnings.some(w => w.message.includes("property count"))).toBe(true);
    });
  });

  describe("expandPresets", () => {
    it("should expand presets correctly", () => {
      const preset: AnimationPresetV1 = {
        name: "test-preset",
        version: "1.0",
        description: "Test preset",
        defaults: {
          durationMs: 600,
          easing: { type: "token", value: "EASE_OUT" },
          transforms: {
            scale: { base: 1.0, peak: 1.1 },
          },
        },
      };
      
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        preset: "test-preset",
        durationMs: 800, // Override preset
        loop: 1,
        easing: { type: "token", value: "LINEAR" }, // Override preset
      };
      
      const presets = new Map([[preset.name, preset]]);
      const expanded = expandPresets(blueprint, presets);
      
      // Blueprint overrides should win
      expect(expanded.durationMs).toBe(800);
      expect(expanded.easing.value).toBe("LINEAR");
      // Preset values should be preserved
      expect(expanded.transforms?.scale?.peak).toBe(1.1);
    });

    it("should handle missing preset gracefully", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        preset: "nonexistent",
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
      };
      
      const presets = new Map();
      const expanded = expandPresets(blueprint, presets);
      
      expect(expanded.metadata?.tags).toContain("warning:preset-not-found:nonexistent");
    });
  });
});

// ─── Compiler Tests ──────────────────────────────────────────────────────────

describe("Bytecode Blueprint Bridge — Compiler", () => {
  describe("compileBlueprint", () => {
    let blueprint: AnimationBlueprintV1;
    
    beforeEach(() => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      blueprint = result.blueprint!;
    });

    it("should compile to all targets successfully", () => {
      const compileResult = compileBlueprint(blueprint, {
        targets: ["css", "phaser", "pixelbrain", "bytecode"],
      });
      
      expect(compileResult.success).toBe(true);
      expect(compileResult.output).toBeDefined();
      expect(compileResult.output?.targets.css).toBeDefined();
      expect(compileResult.output?.targets.phaser).toBeDefined();
      expect(compileResult.output?.targets.pixelbrain).toBeDefined();
      expect(compileResult.output?.targets.bytecode).toBeDefined();
    });

    it("should generate valid CSS payload", () => {
      const compileResult = compileBlueprint(blueprint, { targets: ["css"] });
      const css = compileResult.output?.targets.css;
      
      expect(css).toBeDefined();
      expect(css?.animationConfig.durationMs).toBe(800);
      expect(css?.variables).toBeDefined();
      expect(css?.variables["--anim-scale-base"]).toBe(1.0);
      expect(css?.variables["--anim-scale-peak"]).toBe(1.05);
    });

    it("should generate valid Phaser payload", () => {
      const compileResult = compileBlueprint(blueprint, { targets: ["phaser"] });
      const phaser = compileResult.output?.targets.phaser;
      
      expect(phaser).toBeDefined();
      expect(phaser?.config.duration).toBe(800);
      expect(phaser?.config.repeat).toBe(0); // loop 1 = 0 repeats
    });

    it("should generate valid PixelBrain payload", () => {
      const compileResult = compileBlueprint(blueprint, { targets: ["pixelbrain"] });
      const pb = compileResult.output?.targets.pixelbrain;
      
      expect(pb).toBeDefined();
      expect(pb?.formula).toBeDefined();
      expect(pb?.symmetry).toBeDefined();
      expect(pb?.symmetry?.type).toBe("radial");
    });

    it("should generate valid bytecode with checksum", () => {
      const compileResult = compileBlueprint(blueprint, { targets: ["bytecode"] });
      const bytecode = compileResult.output?.targets.bytecode;
      
      expect(bytecode).toBeDefined();
      expect(bytecode?.version).toBe("1.0");
      expect(bytecode?.instructions.length).toBeGreaterThan(0);
      expect(bytecode?.checksum).toHaveLength(8); // 8 hex chars
    });

    it("should produce deterministic output", () => {
      vi.useFakeTimers();
      
      vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
      const result1 = compileBlueprint(blueprint);
      
      vi.setSystemTime(new Date("2026-04-01T12:00:01Z"));
      const result2 = compileBlueprint(blueprint);
      
      expect(result1.output?.sourceHash).toBe(result2.output?.sourceHash);
      expect(result1.output?.compiledAt).not.toBe(result2.output?.compiledAt); // Timestamp differs
      
      vi.useRealTimers();
    });
  });
});

// ─── QA Tests ────────────────────────────────────────────────────────────────

describe("Bytecode Blueprint Bridge — QA", () => {
  describe("generateQAReport", () => {
    it("should generate a passing report for valid blueprint", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      const report = generateQAReport(blueprint);
      
      expect(report.blueprintId).toBe("orb-transmission-pulse");
      expect(report.failed).toBe(0);
      expect(report.summary).toContain("passed");
    });

    it("should detect invariant violations", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        symmetry: { type: "radial", order: 1 }, // Invalid
        qa: {
          invariants: ["radial-symmetry-preserved"],
        },
      };
      
      const report = generateQAReport(blueprint);
      
      expect(report.failed).toBeGreaterThan(0);
    });
  });

  describe("expectBlueprintInvariant", () => {
    it("should pass radial-symmetry-preserved for valid symmetry", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        symmetry: { type: "radial", order: 4, origin: { x: 0.5, y: 0.5 } },
      };
      
      const result = expectBlueprintInvariant(blueprint, "radial-symmetry-preserved");
      
      expect(result.passed).toBe(true);
    });

    it("should fail radial-symmetry-preserved for invalid order", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        symmetry: { type: "radial", order: 1 },
      };
      
      const result = expectBlueprintInvariant(blueprint, "radial-symmetry-preserved");
      
      expect(result.passed).toBe(false);
    });

    it("should pass scale-remains-within-bounds for valid scale", () => {
      const blueprint: AnimationBlueprintV1 = {
        version: "1.0",
        id: "test",
        target: { selectorType: "id", value: "test" },
        durationMs: 400,
        loop: 1,
        easing: { type: "token", value: "LINEAR" },
        transforms: {
          scale: { base: 1.0, peak: 1.05, min: 0.9, max: 1.1 },
        },
      };
      
      const result = expectBlueprintInvariant(blueprint, "scale-remains-within-bounds");
      
      expect(result.passed).toBe(true);
    });
  });

  describe("assertBackendParity", () => {
    it("should confirm parity between compiled outputs", () => {
      const result = parseBlueprintBlock(VALID_BLUEPRINT);
      const blueprint = result.blueprint!;
      
      const compileResult = compileBlueprint(blueprint, {
        targets: ["css", "phaser"],
      });
      
      const cssOutput = compileResult.output!;
      const phaserOutput = compileResult.output!;
      
      // Create modified output for phaser with same timing
      const parityResult = assertBackendParity(cssOutput, phaserOutput);
      
      expect(parityResult.passed).toBe(true);
    });
  });
});

// ─── Integration Tests ───────────────────────────────────────────────────────

describe("Bytecode Blueprint Bridge — Integration", () => {
  it("should process a complete blueprint end-to-end", () => {
    // Parse
    const parseResult = parseBlueprintBlock(VALID_BLUEPRINT);
    expect(parseResult.success).toBe(true);
    
    // Validate
    const validation = validateBlueprint(parseResult.blueprint!);
    expect(validation.valid).toBe(true);
    
    // Compile
    const compileResult = compileBlueprint(parseResult.blueprint!, {
      targets: ["css", "bytecode"],
    });
    expect(compileResult.success).toBe(true);
    
    // QA
    const qaReport = generateQAReport(parseResult.blueprint!);
    expect(qaReport.failed).toBe(0);
  });

  it("should handle the complete pipeline with errors", () => {
    const invalidBlueprint = `
ANIM_START
ID invalid
TARGET id test
DURATION 400
EASE TOKEN LINEAR
LOOP 1
SYMMETRY TYPE radial ORDER 1
ANIM_END
`.trim();
    
    // Parse should succeed
    const parseResult = parseBlueprintBlock(invalidBlueprint);
    expect(parseResult.success).toBe(true);
    
    // Validate should fail (radial order < 2)
    const validation = validateBlueprint(parseResult.blueprint!);
    expect(validation.valid).toBe(false);
  });
});
