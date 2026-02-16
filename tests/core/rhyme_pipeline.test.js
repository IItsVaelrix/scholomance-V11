/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { buildPairs } from "../../codex/core/rhyme/training.js";
import { RhymeKeyPredictor } from "../../codex/core/rhyme/predictor.js";
import { RhymeLineGenerator } from "../../codex/core/rhyme/generator.js";
import { scoreLine } from "../../codex/core/rhyme/validator.js";

const TRAINING_LINES = [
  "Signal rising in the rain",
  "Echo carving in the rain",
  "Circuits sleeping under gold",
  "Towers folding into gold",
  "Signal rising in the rain",
  "Echo carving in the rain",
  "Circuits sleeping under gold",
  "Towers folding into gold",
];

describe("Rhyme training pipeline", () => {
  it("builds supervised pairs with motif tags and style vectors", () => {
    const pairs = buildPairs(TRAINING_LINES, 2);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some((pair) => pair.isRefrain)).toBe(true);
    expect(pairs.some((pair) => pair.refrainId)).toBe(true);

    const sample = pairs[0];
    expect(sample.styleVector).toBeTruthy();
    expect(sample.styleVector).toHaveProperty("internalRhymeDensity");
    expect(sample.styleVector).toHaveProperty("averageSyllables");
    expect(sample).toHaveProperty("targetRhymeKey");
    expect(sample).toHaveProperty("contextRhymeKeys");
  });

  it("predicts the next rhyme key from context with useful accuracy", () => {
    const pairs = buildPairs(TRAINING_LINES, 2);
    const predictor = new RhymeKeyPredictor({ maxOrder: 2 }).fit(pairs);

    const evaluated = pairs.slice(2);
    const hits = evaluated.filter((pair) => {
      const prediction = predictor.predictRhymeKey(pair, { topK: 1 });
      return prediction.rhymeKey === pair.targetRhymeKey;
    }).length;

    const accuracy = hits / evaluated.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.7);
  });

  it("falls back to common cadence keys when context has no direct signal", () => {
    const pairs = buildPairs(TRAINING_LINES, 2);
    const predictor = new RhymeKeyPredictor({ maxOrder: 2 }).fit(pairs);

    const prediction = predictor.predictRhymeKey(["Unknown context with no direct rhyme clue"]);
    expect(prediction.rhymeKey).toBeTruthy();
    expect(predictor.getMostCommonRhymeKeys(2)).toContain(prediction.rhymeKey);
  });

  it("generates lines that satisfy strict rhyme validation for a fixed target", () => {
    const pairs = buildPairs(TRAINING_LINES, 2);
    const generator = new RhymeLineGenerator().fit(pairs);
    const targetPair = pairs.find((pair) => pair.targetRhymeKey === "EY-N") || pairs[0];

    for (let index = 0; index < 20; index += 1) {
      const line = generator.generateLine(
        targetPair.context,
        targetPair.targetRhymeKey,
        targetPair.styleVector,
        { variationIndex: index }
      );
      const validation = scoreLine(line, targetPair.targetRhymeKey, {
        strict: true,
        styleVector: targetPair.styleVector,
      });
      expect(validation.isValid).toBe(true);
    }
  });

  it("produces deterministic validation scores for the same input", () => {
    const styleVector = buildPairs(TRAINING_LINES, 2)[0].styleVector;
    const first = scoreLine("Signal rising in the rain", "EY-N", { strict: true, styleVector });
    const second = scoreLine("Signal rising in the rain", "EY-N", { strict: true, styleVector });
    expect(second).toEqual(first);
  });
});

