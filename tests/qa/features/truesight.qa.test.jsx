import { describe, expect, it } from "vitest";
import { TRUESIGHT_SCENARIOS, COLOR_CODEX_SCENARIOS } from "../fixtures/panelAnalysis.scenarios.js";
import { expectColoredWords, expectWordsShareClusterColor, expectWordOpacityAbove } from "../tools/truesight.assertions.js";
import { renderTruesightEditor } from "../tools/truesight.renderHarness.jsx";
import { buildColorMap } from "../../../src/lib/colorCodex.js";
import { DEFAULT_VOWEL_COLORS } from "../../../src/data/schoolPalettes.js";

describe("Truesight color-coding QA", () => {
  it("colors all non-stop words with a valid vowelFamily", () => {
    const scenario = TRUESIGHT_SCENARIOS.stopWordExclusion;
    const { container } = renderTruesightEditor({
      ...scenario,
      analysisMode: 'vowel',
      analyzedWordsByCharStart: scenario.analyzedWordsByCharStart || new Map()
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("promotes same-family peers only when the family comes from an excluded stop-word endpoint", () => {
    const scenario = TRUESIGHT_SCENARIOS.stopWordPromotion;
    const { container } = renderTruesightEditor({
      ...scenario,
      analysisMode: 'rhyme',
      analyzedWordsByCharStart: scenario.analyzedWordsByCharStart || new Map()
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("resolves connection family metadata via charStart fallback when connection refs omit word/family", () => {
    const scenario = TRUESIGHT_SCENARIOS.charStartFallback;
    const { container } = renderTruesightEditor({
      ...scenario,
      analysisMode: 'rhyme',
      analyzedWordsByCharStart: scenario.analyzedWordsByCharStart || new Map()
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("normalizes vowel-family aliases before palette lookup", () => {
    const scenario = TRUESIGHT_SCENARIOS.aliasNormalization;
    const { container } = renderTruesightEditor(scenario);

    const soulNode = container.querySelector(`[data-char-start="${scenario.charStart}"]`);
    expect(soulNode).toBeTruthy();
    expect(soulNode.style.color).toBe(scenario.expectedColor);
  });
});

describe("ColorCodex integration QA", () => {
  it("words in same rhyme cluster share color despite different vowel families", () => {
    const scenario = COLOR_CODEX_SCENARIOS.crossFamilyRhymeCluster;
    const colorMap = buildColorMap(scenario.wordAnalyses, scenario.connections, DEFAULT_VOWEL_COLORS);

    const { container } = renderTruesightEditor({
      content: scenario.content,
      analyzedWords: new Map(
        scenario.wordAnalyses.map((w) => [w.normalizedWord, { vowelFamily: w.vowelFamily, syllables: [{}] }])
      ),
      activeConnections: scenario.connections,
      colorMap,
    });

    expectWordsShareClusterColor(container, [0, 4]);
  });

  it("perfect rhyme words have higher opacity than isolated words", () => {
    const scenario = COLOR_CODEX_SCENARIOS.intensityGradient;
    const colorMap = buildColorMap(scenario.wordAnalyses, scenario.connections, DEFAULT_VOWEL_COLORS);

    const connectedEntry = colorMap.get(scenario.connectedCharStart);
    const isolatedEntry = colorMap.get(scenario.isolatedCharStart);

    expect(connectedEntry).toBeTruthy();
    expect(isolatedEntry).toBeTruthy();
    expect(connectedEntry.opacity).toBeGreaterThan(isolatedEntry.opacity);
  });

  it("unclustered words fall back to base vowel family color", () => {
    const scenario = COLOR_CODEX_SCENARIOS.intensityGradient;
    const colorMap = buildColorMap(scenario.wordAnalyses, scenario.connections, DEFAULT_VOWEL_COLORS);

    // "day" (charStart 16, vowelFamily EY) has no connections — should get EY base color
    const dayEntry = colorMap.get(16);
    expect(dayEntry).toBeTruthy();
    expect(dayEntry.color).toBe(DEFAULT_VOWEL_COLORS.EY);
    expect(dayEntry.groupId).toBeNull();
  });

  it("multi-syllable rhyme words receive isMultiSyllable flag", () => {
    const scenario = COLOR_CODEX_SCENARIOS.multiSyllableHighlight;
    const colorMap = buildColorMap(scenario.wordAnalyses, scenario.connections, DEFAULT_VOWEL_COLORS);

    expect(colorMap.get(0).isMultiSyllable).toBe(true);
    expect(colorMap.get(8).isMultiSyllable).toBe(true);
  });
});
