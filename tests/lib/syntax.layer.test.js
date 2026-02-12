import { describe, it, expect } from "vitest";
import { buildSyntaxLayer, classifySyntaxToken } from "../../src/lib/syntax.layer.js";

describe("syntax.layer", () => {
  it("classifies function/content roles with line-role and stress-role tags", () => {
    const functionToken = classifySyntaxToken(
      {
        text: "and",
        normalized: "and",
        start: 0,
        end: 3,
        isStopWord: true,
        isContentWord: false,
        stressPattern: "0",
        deepPhonetics: { syllables: [{ stress: 0 }] },
      },
      { lineNumber: 0, wordIndex: 0, lineWordCount: 2 }
    );

    const contentToken = classifySyntaxToken(
      {
        text: "burning",
        normalized: "burning",
        start: 4,
        end: 11,
        isStopWord: false,
        isContentWord: true,
        stressPattern: "10",
        deepPhonetics: { syllables: [{ stress: 1 }, { stress: 0 }] },
      },
      { lineNumber: 0, wordIndex: 1, lineWordCount: 2 }
    );

    expect(functionToken.role).toBe("function");
    expect(functionToken.lineRole).toBe("line_start");
    expect(functionToken.stressRole).toBe("unstressed");
    expect(functionToken.rhymePolicy).toBe("suppress");
    expect(functionToken.reasons).toContain("function_non_terminal");

    expect(contentToken.role).toBe("content");
    expect(contentToken.lineRole).toBe("line_end");
    expect(contentToken.stressRole).toBe("primary");
    expect(contentToken.stem).toBe("burn");
    expect(contentToken.rhymePolicy).toBe("allow");
  });

  it("builds identity-keyed syntax layer and summary counts", () => {
    const layer = buildSyntaxLayer({
      lines: [
        {
          number: 0,
          words: [
            {
              text: "to",
              normalized: "to",
              start: 0,
              end: 2,
              isStopWord: true,
              isContentWord: false,
              stressPattern: "0",
              deepPhonetics: { syllables: [{ stress: 0 }] },
            },
            {
              text: "fire",
              normalized: "fire",
              start: 3,
              end: 7,
              isStopWord: false,
              isContentWord: true,
              stressPattern: "1",
              deepPhonetics: { syllables: [{ stress: 1 }] },
            },
          ],
        },
      ],
    });

    expect(layer.enabled).toBe(true);
    expect(layer.tokens).toHaveLength(2);
    expect(layer.syntaxSummary.tokenCount).toBe(2);
    expect(layer.syntaxSummary.roleCounts.function).toBe(1);
    expect(layer.syntaxSummary.roleCounts.content).toBe(1);
    expect(layer.tokenByIdentity.get("0:0:0")?.word).toBe("to");
    expect(layer.tokenByCharStart.get(3)?.word).toBe("fire");
  });
});
