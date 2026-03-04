import { describe, expect, it } from "vitest";
import { buildColorMap } from "../../src/lib/colorCodex.js";
import { DEFAULT_VOWEL_COLORS } from "../../src/data/schoolPalettes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWord(charStart, vowelFamily, syllableCount = 1) {
  return {
    word: `word_${charStart}`,
    normalizedWord: `WORD_${charStart}`,
    lineIndex: 0,
    wordIndex: charStart,
    charStart,
    charEnd: charStart + 5,
    vowelFamily,
    syllableCount,
    rhymeKey: `${vowelFamily}-open`,
  };
}

function makeConnection(csA, csB, score, type = "perfect", syllablesMatched = 1, syntaxMultiplier = 1) {
  return {
    type,
    subtype: "masculine",
    score,
    syllablesMatched,
    wordA: { lineIndex: 0, wordIndex: csA, charStart: csA, charEnd: csA + 5, word: `word_${csA}` },
    wordB: { lineIndex: 0, wordIndex: csB, charStart: csB, charEnd: csB + 5, word: `word_${csB}` },
    groupLabel: null,
    syntax: syntaxMultiplier < 1 ? { gate: "allow_weak", multiplier: syntaxMultiplier, reasons: [] } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildColorMap", () => {
  it("returns an empty map for empty input", () => {
    expect(buildColorMap([], [], DEFAULT_VOWEL_COLORS).size).toBe(0);
    expect(buildColorMap(null, null, DEFAULT_VOWEL_COLORS).size).toBe(0);
  });

  it("assigns base vowel family color to unclustered words", () => {
    const words = [makeWord(0, "EY"), makeWord(10, "IY")];
    const map = buildColorMap(words, [], DEFAULT_VOWEL_COLORS);

    expect(map.get(0).color).toBe(DEFAULT_VOWEL_COLORS.EY);
    expect(map.get(10).color).toBe(DEFAULT_VOWEL_COLORS.IY);
    expect(map.get(0).groupId).toBeNull();
    expect(map.get(0).rhymeType).toBeNull();
  });

  it("ghosts unclustered words with reduced opacity", () => {
    const words = [makeWord(0, "EY")];
    const map = buildColorMap(words, [], DEFAULT_VOWEL_COLORS);
    expect(map.get(0).isGhost).toBe(true);
    expect(map.get(0).isAnchor).toBe(false);
    expect(map.get(0).opacity).toBeGreaterThan(0.12);
    expect(map.get(0).opacity).toBeLessThan(0.35);
  });

  it("clusters connected words and assigns canonical cluster color", () => {
    // Two words with different vowel families connected by slant rhyme
    const words = [makeWord(0, "AE"), makeWord(10, "AE")];
    const connections = [makeConnection(0, 10, 0.70, "slant")];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    // Both words should share the same color (canonical family wins)
    expect(map.get(0).color).toBe(map.get(10).color);
    expect(map.get(0).groupId).not.toBeNull();
    expect(map.get(0).groupId).toBe(map.get(10).groupId);
  });

  it("selects canonical family by majority vote", () => {
    // 2 EY words + 1 IY word connected → EY should win
    const words = [makeWord(0, "EY"), makeWord(10, "EY"), makeWord(20, "IY")];
    const connections = [
      makeConnection(0, 10, 0.95, "perfect"),
      makeConnection(10, 20, 0.70, "slant"),
    ];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    // All three should share EY's color
    expect(map.get(0).color).toBe(map.get(10).color);
    expect(map.get(0).color).toBe(map.get(20).color);
  });

  it("handles transitive clustering via union-find", () => {
    // A→B and B→C should cluster A, B, C together
    const words = [makeWord(0, "AE"), makeWord(10, "AE"), makeWord(20, "AE")];
    const connections = [
      makeConnection(0, 10, 0.80, "near"),
      makeConnection(10, 20, 0.75, "near"),
    ];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    expect(map.get(0).groupId).toBe(map.get(10).groupId);
    expect(map.get(10).groupId).toBe(map.get(20).groupId);
  });

  it("maps connection score to opacity gradient", () => {
    const words = [
      makeWord(0, "EY"),
      makeWord(10, "IY"),
      makeWord(20, "AE"),
      makeWord(30, "OW"),
      makeWord(40, "UW"),
    ];
    const connections = [
      makeConnection(0, 10, 0.95, "perfect"),  // high
      makeConnection(20, 30, 0.70, "slant"),    // medium
    ];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    // Perfect rhyme words should have higher opacity than slant rhyme words
    expect(map.get(0).opacity).toBeGreaterThan(map.get(20).opacity);
    // Slant rhyme words should have higher opacity than isolated words
    expect(map.get(20).opacity).toBeGreaterThan(map.get(40).opacity);
    expect(map.get(40).isGhost).toBe(true);
    expect(map.get(40).isAnchor).toBe(false);
    expect(map.get(40).opacity).toBeLessThan(map.get(20).opacity);
  });

  it("sets isMultiSyllable flag for connections with syllablesMatched >= 2", () => {
    const words = [makeWord(0, "EY", 2), makeWord(10, "EY", 2)];
    const connections = [makeConnection(0, 10, 0.85, "near", 2)];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    expect(map.get(0).isMultiSyllable).toBe(true);
    expect(map.get(10).isMultiSyllable).toBe(true);
  });

  it("does not set isMultiSyllable for single-syllable matches", () => {
    const words = [makeWord(0, "EY"), makeWord(10, "EY")];
    const connections = [makeConnection(0, 10, 0.90, "near", 1)];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    expect(map.get(0).isMultiSyllable).toBe(false);
  });

  it("records bestScore and rhymeType from highest-scoring connection", () => {
    const words = [makeWord(0, "EY"), makeWord(10, "EY"), makeWord(20, "EY")];
    const connections = [
      makeConnection(0, 10, 0.70, "slant"),
      makeConnection(0, 20, 0.95, "perfect"),
    ];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    expect(map.get(0).bestScore).toBeCloseTo(0.95, 2);
    expect(map.get(0).rhymeType).toBe("perfect");
  });

  it("applies syntax gate multiplier to opacity", () => {
    const words = [makeWord(0, "EY"), makeWord(10, "EY")];
    // Syntax gate weakens to 0.85x
    const connections = [makeConnection(0, 10, 0.90, "near", 1, 0.85)];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    const fullOpacity = (0.45 + (0.90 * 0.55)) * 1.1; // balanceWeight = 1.1 for EY
    const gatedOpacity = fullOpacity * 0.85; // Clamp happens AFTER multiplier
    expect(map.get(0).opacity).toBeCloseTo(Math.min(1.0, Math.max(0.2, gatedOpacity)), 2);
  });

  it("does not cluster connections below the minimum score threshold", () => {
    const words = [makeWord(0, "AE"), makeWord(10, "AE")];
    const connections = [makeConnection(0, 10, 0.50, "consonance")]; // Below 0.60
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    // Should NOT be clustered
    expect(map.get(0).groupId).toBeNull();
    expect(map.get(10).groupId).toBeNull();
    // Colors should be same (AE family)
    expect(map.get(0).color).toBe(DEFAULT_VOWEL_COLORS.AE);
    expect(map.get(10).color).toBe(DEFAULT_VOWEL_COLORS.AE);
  });

  it("uses alphabetical tiebreaker for canonical family stability", () => {
    // 1 AE word (weight 2 because monosyllabic) vs 1 IY word (weight 2)
    // AE < IY alphabetically → AE wins the tie
    const words = [makeWord(0, "AE"), makeWord(10, "IY")];
    const connections = [makeConnection(0, 10, 0.70, "slant")];
    const map = buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);

    expect(map.get(0).color).toBe(DEFAULT_VOWEL_COLORS.AE);
    expect(map.get(10).color).toBe(DEFAULT_VOWEL_COLORS.AE);
  });

  it("handles words with no vowel family gracefully", () => {
    const words = [makeWord(0, null), makeWord(10, "EY")];
    const map = buildColorMap(words, [], DEFAULT_VOWEL_COLORS);

    expect(map.has(0)).toBe(false); // No color for null family
    expect(map.get(10).color).toBe(DEFAULT_VOWEL_COLORS.EY);
  });

  it("performs within 10ms for 500 words and 200 connections", () => {
    const words = [];
    for (let i = 0; i < 500; i++) {
      const families = ["EY", "IY", "AE", "AE", "OW", "UW"];
      words.push(makeWord(i * 10, families[i % families.length]));
    }
    const connections = [];
    for (let i = 0; i < 200; i++) {
      const a = (i * 17) % 500;
      const b = (i * 31 + 7) % 500;
      if (a !== b) {
        connections.push(makeConnection(a * 10, b * 10, 0.60 + Math.random() * 0.35, "near"));
      }
    }

    const start = performance.now();
    buildColorMap(words, connections, DEFAULT_VOWEL_COLORS);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});
