import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../src/hooks/usePhonemeEngine.jsx", () => ({
  usePhonemeEngine: () => ({ engine: null }),
}));

import ScrollEditor from "../../src/pages/Read/ScrollEditor.jsx";
import { ThemeProvider } from "../../src/hooks/useTheme.jsx";

describe("ScrollEditor Truesight overlay", () => {
  const renderWithProviders = (ui) => {
    return render(
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    );
  };

  it("renders one overlay row per document line, including blank lines", () => {
    const content = [
      "The freedom of Defiance",
      "is freedom of a God",
      "",
      "Liberation...",
      "We really need it now",
    ].join("\n");

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="Line mapping"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={new Map()}
        activeConnections={[]}
        highlightedLines={[]}
      />
    );

    const overlayLines = container.querySelectorAll(".truesight-line");
    expect(overlayLines.length).toBe(content.split("\n").length);
  });

  it("does not color words when no rhyme connections are active", () => {
    const content = "Alpha beta";
    const analyzedWords = new Map([
      ["ALPHA", { vowelFamily: "AE", syllables: [{}, {}] }],
      ["BETA", { vowelFamily: "EY", syllables: [{}, {}] }],
    ]);

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="No connections"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={analyzedWords}
        activeConnections={[]}
        highlightedLines={[]}
      />
    );

    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(0);
  });

  it("colors only words participating in rhyme connections", () => {
    const content = "Alpha beta gamma";
    const analyzedWords = new Map([
      ["ALPHA", { vowelFamily: "AE", syllables: [{}, {}] }],
      ["BETA", { vowelFamily: "EY", syllables: [{}, {}] }],
      ["GAMMA", { vowelFamily: "AE", syllables: [{}, {}] }],
    ]);
    const activeConnections = [
      {
        syllablesMatched: 1,
        wordA: { charStart: 0, lineIndex: 0, word: "Alpha", normalizedWord: "ALPHA", vowelFamily: "AE" },
        wordB: { charStart: 11, lineIndex: 0, word: "gamma", normalizedWord: "GAMMA", vowelFamily: "AE" },
      },
    ];

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="With connections"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={analyzedWords}
        activeConnections={activeConnections}
        highlightedLines={[]}
      />
    );

    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(2);
    expect(coloredWords[0]?.textContent).toBe("Alpha");
    expect(coloredWords[1]?.textContent).toBe("gamma");
  });

  it("substitutes excluded awkward words through active vowel families", () => {
    const content = "the tone meta";
    const analyzedWords = new Map([
      ["THE", { vowelFamily: "EY", syllables: [{}, {}] }],
      ["TONE", { vowelFamily: "OW", syllables: [{}, {}] }],
      ["META", { vowelFamily: "EY", syllables: [{}, {}] }],
    ]);
    const activeConnections = [
      {
        syllablesMatched: 1,
        wordA: { charStart: 0, lineIndex: 0, word: "the", normalizedWord: "THE", vowelFamily: "EY" },
        wordB: { charStart: 4, lineIndex: 0, word: "tone", normalizedWord: "TONE", vowelFamily: "OW" },
      },
    ];

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="Vowel substitution"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={analyzedWords}
        activeConnections={activeConnections}
        highlightedLines={[]}
      />
    );

    const coloredWords = Array.from(container.querySelectorAll(".grimoire-word")).map((node) => node.textContent);
    expect(coloredWords).toEqual(["tone", "meta"]);
  });

  it("does not broaden to all family peers when a non-stop connected word already represents that family", () => {
    const content = "the echo mellow";
    const analyzedWords = new Map([
      ["THE", { vowelFamily: "EH", syllables: [{}, {}] }],
      ["ECHO", { vowelFamily: "EH", syllables: [{}, {}] }],
      ["MELLOW", { vowelFamily: "EH", syllables: [{}, {}] }],
    ]);
    const activeConnections = [
      {
        syllablesMatched: 1,
        wordA: { charStart: 0, lineIndex: 0, word: "the", normalizedWord: "THE", vowelFamily: "EH" },
        wordB: { charStart: 4, lineIndex: 0, word: "echo", normalizedWord: "ECHO", vowelFamily: "EH" },
      },
    ];

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="No broad family spill"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={analyzedWords}
        activeConnections={activeConnections}
        highlightedLines={[]}
      />
    );

    const coloredWords = Array.from(container.querySelectorAll(".grimoire-word")).map((node) => node.textContent);
    expect(coloredWords).toEqual(["echo"]);
  });

  it("emits stable token identity when a Truesight word is activated", () => {
    const content = "Alpha beta gamma";
    const analyzedWords = new Map([
      ["ALPHA", { vowelFamily: "AE", syllables: [{}, {}] }],
      ["BETA", { vowelFamily: "EY", syllables: [{}, {}] }],
      ["GAMMA", { vowelFamily: "AE", syllables: [{}, {}] }],
    ]);
    const activeConnections = [
      {
        syllablesMatched: 1,
        wordA: { charStart: 0, lineIndex: 0, word: "Alpha", normalizedWord: "ALPHA", vowelFamily: "AE" },
        wordB: { charStart: 11, lineIndex: 0, word: "gamma", normalizedWord: "GAMMA", vowelFamily: "AE" },
      },
    ];
    const onWordActivate = vi.fn();

    const { container } = renderWithProviders(
      <ScrollEditor
        initialTitle="Activation"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analysisMode="rhyme"
        analyzedWords={analyzedWords}
        activeConnections={activeConnections}
        highlightedLines={[]}
        onWordActivate={onWordActivate}
      />
    );

    const clickableWord = container.querySelector(".grimoire-word--interactive");
    expect(clickableWord).toBeTruthy();

    fireEvent.click(clickableWord);

    expect(onWordActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "pin",
        word: "Alpha",
        normalizedWord: "ALPHA",
        lineIndex: 0,
        wordIndex: 0,
        charStart: 0,
      })
    );
  });
});
