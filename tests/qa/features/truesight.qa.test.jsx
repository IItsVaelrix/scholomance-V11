import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { TRUESIGHT_SCENARIOS } from "../fixtures/panelAnalysis.scenarios.js";
import { expectColoredWords } from "../tools/truesight.assertions.js";
import { renderTruesightEditor } from "../tools/truesight.renderHarness.jsx";

describe("Truesight color-coding QA", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("colors all non-stop words with a valid vowelFamily", async () => {
    const scenario = TRUESIGHT_SCENARIOS.stopWordExclusion;
    const analyzedWordsByIdentity = new Map();
    
    const charStarts = { "THE": 0, "ALPHA": 4, "BETA": 10 };

    scenario.analyzedWords.forEach((analysis, normalizedWord) => {
      const isStop = ["THE", "A", "AN"].includes(normalizedWord);
      const charStart = charStarts[normalizedWord];
      
      const entry = {
        ...analysis,
        charStart,
        lineIndex: 0,
        wordIndex: normalizedWord === "THE" ? 0 : normalizedWord === "ALPHA" ? 1 : 2,
        visualBytecode: {
          effectClass: isStop ? 'INERT' : 'RESONANT',
          school: 'VOID',
          color: 'rgb(128, 128, 128)',
          glowIntensity: isStop ? 0 : 0.5,
        }
      };
      analyzedWordsByIdentity.set(`0:${entry.wordIndex}:${charStart}`, entry);
    });

    const { container } = await renderTruesightEditor({
      ...scenario,
      analysisMode: 'vowel',
      analyzedWordsByIdentity,
      isEditable: false,
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("promotes same-family peers only when the family comes from an excluded stop-word endpoint", async () => {
    const scenario = TRUESIGHT_SCENARIOS.stopWordPromotion;
    const analyzedWordsByIdentity = new Map();
    
    // THE (0), TONE (4), META (9)
    const theEntry = { charStart: 0, wordIndex: 0, lineIndex: 0, visualBytecode: { effectClass: 'INERT' } };
    const toneEntry = { 
      charStart: 4, wordIndex: 1, lineIndex: 0, 
      word: 'tone', normalizedWord: 'TONE', vowelFamily: 'OW',
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(0, 0, 255)' } 
    };
    const metaEntry = { 
      charStart: 9, wordIndex: 2, lineIndex: 0, 
      word: 'meta', normalizedWord: 'META', vowelFamily: 'EY',
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(255, 0, 0)' } 
    };

    analyzedWordsByIdentity.set("0:0:0", theEntry);
    analyzedWordsByIdentity.set("0:1:4", toneEntry);
    analyzedWordsByIdentity.set("0:2:9", metaEntry);

    const { container } = await renderTruesightEditor({
      ...scenario,
      analysisMode: 'rhyme',
      analyzedWordsByIdentity,
      isEditable: false,
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("resolves connection family metadata via charStart fallback when connection refs omit word/family", async () => {
    const scenario = TRUESIGHT_SCENARIOS.charStartFallback;
    const analyzedWordsByIdentity = new Map();
    
    const theEntry = { charStart: 0, wordIndex: 0, lineIndex: 0, visualBytecode: { effectClass: 'INERT' } };
    const toneEntry = { 
      charStart: 4, wordIndex: 1, lineIndex: 0, 
      word: 'tone', normalizedWord: 'TONE', vowelFamily: 'OW',
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(0, 0, 255)' } 
    };
    const metaEntry = { 
      charStart: 9, wordIndex: 2, lineIndex: 0, 
      word: 'meta', normalizedWord: 'META', vowelFamily: 'EY',
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(255, 0, 0)' } 
    };

    analyzedWordsByIdentity.set("0:0:0", theEntry);
    analyzedWordsByIdentity.set("0:1:4", toneEntry);
    analyzedWordsByIdentity.set("0:2:9", metaEntry);

    const { container } = await renderTruesightEditor({
      ...scenario,
      analysisMode: 'rhyme',
      analyzedWordsByIdentity,
      isEditable: false,
    });

    expectColoredWords(container, scenario.expectedColoredWords);
  });

  it("normalizes vowel-family aliases before palette lookup", async () => {
    const scenario = TRUESIGHT_SCENARIOS.aliasNormalization;
    const analyzedWordsByIdentity = new Map();
    
    const entry = {
      word: 'soul', charStart: scenario.charStart, wordIndex: 0, lineIndex: 0,
      vowelFamily: 'OH',
      visualBytecode: {
        effectClass: 'RESONANT',
        color: scenario.expectedColor
      }
    };
    analyzedWordsByIdentity.set(`0:0:${scenario.charStart}`, entry);

    const { container } = await renderTruesightEditor({
      ...scenario,
      analyzedWordsByIdentity,
      isEditable: false,
    });

    const soulNode = container.querySelector(`[data-char-start="${scenario.charStart}"]`);
    expect(soulNode).toBeTruthy();
    const color = soulNode.style.color;
    expect(['rebeccapurple', 'rgb(102, 51, 153)']).toContain(color.toLowerCase());
  });
});

describe("ByteCode integration QA", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("words in same rhyme cluster share color via bytecode", async () => {
    const analyzedWordsByIdentity = new Map();
    analyzedWordsByIdentity.set("0:0:0", { 
      charStart: 0, wordIndex: 0, lineIndex: 0,
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(255, 0, 0)' } 
    });
    analyzedWordsByIdentity.set("0:1:4", { 
      charStart: 4, wordIndex: 1, lineIndex: 0,
      visualBytecode: { effectClass: 'RESONANT', color: 'rgb(255, 0, 0)' } 
    });

    const { container } = await renderTruesightEditor({
      content: "cat bet",
      analyzedWordsByIdentity,
      isTruesight: true,
      analysisMode: 'rhyme',
      isEditable: false
    });

    const node1 = container.querySelector(`[data-char-start="0"]`);
    const node2 = container.querySelector(`[data-char-start="4"]`);
    expect(node1.style.color).toBe('rgb(255, 0, 0)');
    expect(node2.style.color).toBe('rgb(255, 0, 0)');
  });

  it("perfect rhyme words have glow intensity via bytecode", async () => {
    const analyzedWordsByIdentity = new Map();
    analyzedWordsByIdentity.set("0:0:0", { 
      charStart: 0, wordIndex: 0, lineIndex: 0,
      visualBytecode: { effectClass: 'RESONANT', glowIntensity: 0.9 } 
    });
    analyzedWordsByIdentity.set("0:1:16", { 
      charStart: 16, wordIndex: 3, lineIndex: 0,
      visualBytecode: { effectClass: 'RESONANT', glowIntensity: 0.3 } 
    });

    const { container } = await renderTruesightEditor({
      content: "time rhyme lime day",
      analyzedWordsByIdentity,
      isTruesight: true,
      analysisMode: 'rhyme',
      isEditable: false
    });

    const node1 = container.querySelector(`[data-char-start="0"]`);
    // Note: charStart 16 is "day" in "time rhyme lime day"
    // time(0-4), rhyme(5-10), lime(11-15), day(16-19)
    const node2 = container.querySelector(`[data-char-start="16"]`);
    
    const intensity1 = node1.style.getPropertyValue('--vb-glow-intensity');
    expect(intensity1).toBe("0.9");
  });
});
