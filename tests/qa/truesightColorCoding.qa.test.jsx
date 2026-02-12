import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScrollEditor from "../../src/pages/Read/ScrollEditor.jsx";

function renderTruesight({
  content,
  analyzedWords = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  vowelColors = null,
}) {
  return render(
    <ScrollEditor
      initialTitle="Truesight QA"
      initialContent={content}
      isEditable={false}
      isTruesight={true}
      analyzedWords={analyzedWords}
      analyzedWordsByCharStart={analyzedWordsByCharStart}
      activeConnections={activeConnections}
      highlightedLines={[]}
      vowelColors={vowelColors}
    />
  );
}

describe("Truesight color-coding QA", () => {
  it("colors only non-stop direct connection endpoints", () => {
    const { container } = renderTruesight({
      content: "the alpha beta",
      analyzedWords: new Map([
        ["THE", { vowelFamily: "EY", syllables: [{}, {}] }],
        ["ALPHA", { vowelFamily: "AE", syllables: [{}, {}] }],
        ["BETA", { vowelFamily: "IH", syllables: [{}, {}] }],
      ]),
      activeConnections: [
        {
          syllablesMatched: 1,
          wordA: { charStart: 0, lineIndex: 0 }, // the (stop word)
          wordB: { charStart: 4, lineIndex: 0 }, // alpha
        },
      ],
    });

    const coloredWords = Array.from(container.querySelectorAll(".grimoire-word")).map((node) => node.textContent);
    expect(coloredWords).toEqual(["alpha"]);
  });

  it("promotes same-family peers only when the family comes from an excluded stop-word endpoint", () => {
    const { container } = renderTruesight({
      content: "the tone meta",
      analyzedWords: new Map([
        ["THE", { vowelFamily: "EY", syllables: [{}, {}] }],
        ["TONE", { vowelFamily: "OW", syllables: [{}, {}] }],
        ["META", { vowelFamily: "EY", syllables: [{}, {}] }],
      ]),
      activeConnections: [
        {
          syllablesMatched: 1,
          wordA: { charStart: 0, lineIndex: 0 }, // the (excluded stop word)
          wordB: { charStart: 4, lineIndex: 0 }, // tone
        },
      ],
    });

    const coloredWords = Array.from(container.querySelectorAll(".grimoire-word")).map((node) => node.textContent);
    expect(coloredWords).toEqual(["tone", "meta"]);
  });

  it("resolves connection family metadata via charStart fallback when connection refs omit word/family", () => {
    const { container } = renderTruesight({
      content: "the tone meta",
      analyzedWordsByCharStart: new Map([
        [0, { vowelFamily: "EY", syllables: [{}, {}] }], // the
        [4, { vowelFamily: "OW", syllables: [{}, {}] }], // tone
        [9, { vowelFamily: "EY", syllables: [{}, {}] }], // meta
      ]),
      activeConnections: [
        {
          syllablesMatched: 1,
          wordA: { charStart: 0, lineIndex: 0 },
          wordB: { charStart: 4, lineIndex: 0 },
        },
      ],
    });

    const coloredWords = Array.from(container.querySelectorAll(".grimoire-word")).map((node) => node.textContent);
    expect(coloredWords).toEqual(["tone", "meta"]);
  });

  it("normalizes vowel-family aliases before palette lookup", () => {
    const { container } = renderTruesight({
      content: "soul coal",
      analyzedWords: new Map([
        ["SOUL", { vowelFamily: "OH", syllables: [{}, {}] }], // alias -> OW
        ["COAL", { vowelFamily: "OW", syllables: [{}, {}] }],
      ]),
      activeConnections: [
        {
          syllablesMatched: 1,
          wordA: { charStart: 0, lineIndex: 0 },
          wordB: { charStart: 5, lineIndex: 0 },
        },
      ],
      vowelColors: {
        OW: "rebeccapurple",
      },
    });

    const soulNode = container.querySelector('[data-char-start="0"]');
    expect(soulNode).toBeTruthy();
    expect(soulNode.style.color).toBe("rebeccapurple");
  });
});
