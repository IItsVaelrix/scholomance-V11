import { describe, it, expect } from "vitest";
import { applyPhonologicalProcesses, PHONOLOGICAL_PROCESS_RULES } from "../../src/lib/phonology/phonologicalProcesses.js";

describe("phonologicalProcesses", () => {
  it("exposes a deterministic ordered rule set", () => {
    const ruleIds = PHONOLOGICAL_PROCESS_RULES.map((rule) => rule.id);
    expect(ruleIds).toEqual([
      "nasal_place_assimilation_bilabial",
      "terminal_mb_cluster_reduction",
    ]);
  });

  it("applies bilabial nasal place assimilation", () => {
    const result = applyPhonologicalProcesses(["IH1", "N", "P", "AA0", "K"]);
    expect(result).toEqual(["IH1", "M", "P", "AA0", "K"]);
  });

  it("does not assimilate before non-bilabial consonants", () => {
    const result = applyPhonologicalProcesses(["IH1", "N", "T", "AA0"]);
    expect(result).toEqual(["IH1", "N", "T", "AA0"]);
  });

  it("reduces terminal MB clusters after assimilation", () => {
    const result = applyPhonologicalProcesses(["AH1", "N", "B"]);
    expect(result).toEqual(["AH1", "M"]);
  });

  it("preserves internal MB clusters that are not terminal", () => {
    const result = applyPhonologicalProcesses(["AH1", "M", "B", "ER0"]);
    expect(result).toEqual(["AH1", "M", "B", "ER0"]);
  });

  it("can return a trace of applied rule rewrites", () => {
    const result = applyPhonologicalProcesses(["AH1", "N", "B"], { trace: true });
    expect(result).toEqual({
      phonemes: ["AH1", "M"],
      trace: [
        {
          ruleId: "nasal_place_assimilation_bilabial",
          index: 1,
          before: ["N", "B"],
          after: ["M", "B"],
        },
        {
          ruleId: "terminal_mb_cluster_reduction",
          index: 1,
          before: ["M", "B"],
          after: ["M"],
        },
      ],
    });
  });
});
