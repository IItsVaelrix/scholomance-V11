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

  it("builds hidden harkov model signals in 4-bar stanzas with ordered stages", () => {
    const layer = buildSyntaxLayer({
      lines: [
        { number: 0, words: [{ text: "Flame", start: 0, end: 5, deepPhonetics: { syllables: [{ stress: 1 }] } }] },
        { number: 1, words: [{ text: "and", start: 6, end: 9, deepPhonetics: { syllables: [{ stress: 0 }] } }] },
        { number: 2, words: [{ text: "stone", start: 10, end: 15, deepPhonetics: { syllables: [{ stress: 1 }] } }] },
        { number: 3, words: [{ text: "echoes", start: 16, end: 22, deepPhonetics: { syllables: [{ stress: 1 }] } }] },
        { number: 4, words: [{ text: "rise", start: 23, end: 27, deepPhonetics: { syllables: [{ stress: 1 }] } }] },
      ],
    });

    expect(layer.hhm?.enabled).toBe(true);
    expect(layer.hhm?.stanzaSizeBars).toBe(4);
    expect(layer.hhm?.stanzaCount).toBe(2);
    expect(layer.hhm?.logicOrder).toEqual([
      "SYNTAX",
      "PREDICTOR",
      "SPELLCHECK",
      "JUDICIARY",
      "PHONEME",
      "HEURISTICS",
      "METER",
    ]);
    expect(layer.hhm?.dictionarySources?.some((source) => source.id === "scholomance")).toBe(true);

    const firstToken = layer.tokens[0];
    expect(firstToken.hhm?.stanzaIndex).toBe(0);
    expect(firstToken.hhm?.stanzaBar).toBe(1);
    expect(firstToken.hhm?.stageScores?.SYNTAX).toBeTruthy();

    const fifthToken = layer.tokens[4];
    expect(fifthToken.hhm?.stanzaIndex).toBe(1);
    expect(fifthToken.hhm?.stanzaBar).toBe(1);
  });

  it("stores prev/next token stems in HHM context snapshots for audit parity", () => {
    const layer = buildSyntaxLayer({
      lines: [
        {
          number: 0,
          words: [
            { text: "running", start: 0, end: 7, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: "runner", start: 8, end: 14, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: "runs", start: 15, end: 19, deepPhonetics: { syllables: [{ stress: 0 }] } },
          ],
        },
      ],
    });

    const middle = layer.tokens[1];
    expect(middle.hhm?.context?.prevToken?.stem).toBeTruthy();
    expect(middle.hhm?.context?.nextToken?.stem).toBeTruthy();
  });
});
