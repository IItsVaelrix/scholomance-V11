import {
  createConnection,
  createWordAnalysis,
} from "../tools/panelAnalysis.fixture.js";

function analyzedWord(vowelFamily) {
  return { vowelFamily, syllables: [{}] };
}

const THE = createWordAnalysis({
  word: "the",
  normalizedWord: "THE",
  lineIndex: 0,
  wordIndex: 0,
  charStart: 0,
  charEnd: 3,
  vowelFamily: "EY",
});

const TONE = createWordAnalysis({
  word: "tone",
  normalizedWord: "TONE",
  lineIndex: 0,
  wordIndex: 1,
  charStart: 4,
  charEnd: 8,
  vowelFamily: "OW",
});

const META = createWordAnalysis({
  word: "meta",
  normalizedWord: "META",
  lineIndex: 0,
  wordIndex: 2,
  charStart: 9,
  charEnd: 13,
  vowelFamily: "EY",
});

const ALPHA = createWordAnalysis({
  word: "alpha",
  normalizedWord: "ALPHA",
  lineIndex: 0,
  wordIndex: 1,
  charStart: 4,
  charEnd: 9,
  vowelFamily: "AE",
});

const BETA = createWordAnalysis({
  word: "beta",
  normalizedWord: "BETA",
  lineIndex: 0,
  wordIndex: 2,
  charStart: 10,
  charEnd: 14,
  vowelFamily: "IH",
});

export const TRUESIGHT_SCENARIOS = {
  stopWordExclusion: {
    content: "the alpha beta",
    analyzedWords: new Map([
      ["THE", analyzedWord("EY")],
      ["ALPHA", analyzedWord("AE")],
      ["BETA", analyzedWord("IH")],
    ]),
    activeConnections: [
      createConnection(
        { charStart: 0, lineIndex: 0 },
        { charStart: 4, lineIndex: 0 }
      ),
    ],
    expectedColoredWords: ["alpha", "beta"],
  },
  stopWordPromotion: {
    content: "the tone meta",
    analyzedWords: new Map([
      ["THE", analyzedWord("EY")],
      ["TONE", analyzedWord("OW")],
      ["META", analyzedWord("EY")],
    ]),
    activeConnections: [
      createConnection(
        { charStart: 0, lineIndex: 0 },
        { charStart: 4, lineIndex: 0 }
      ),
    ],
    expectedColoredWords: ["tone", "meta"],
  },
  charStartFallback: {
    content: "the tone meta",
    analyzedWordsByCharStart: new Map([
      [0, analyzedWord("EY")],
      [4, analyzedWord("OW")],
      [9, analyzedWord("EY")],
    ]),
    activeConnections: [
      createConnection(
        { charStart: 0, lineIndex: 0 },
        { charStart: 4, lineIndex: 0 }
      ),
    ],
    expectedColoredWords: ["tone", "meta"],
  },
  aliasNormalization: {
    content: "soul coal",
    analyzedWords: new Map([
      ["SOUL", analyzedWord("OH")], // alias -> OW
      ["COAL", analyzedWord("OW")],
    ]),
    activeConnections: [
      createConnection(
        { charStart: 0, lineIndex: 0 },
        { charStart: 5, lineIndex: 0 }
      ),
    ],
    vowelColors: {
      OW: "rebeccapurple",
    },
    charStart: 0,
    expectedColor: "rebeccapurple",
  },
};

export const COLOR_CODEX_SCENARIOS = {
  crossFamilyRhymeCluster: {
    description: "Words with different vowel families connected by slant rhyme share cluster color",
    content: "cat bet",
    wordAnalyses: [
      createWordAnalysis({ word: "cat", normalizedWord: "CAT", charStart: 0, charEnd: 3, vowelFamily: "AE", wordIndex: 0 }),
      createWordAnalysis({ word: "bet", normalizedWord: "BET", charStart: 4, charEnd: 7, vowelFamily: "EH", wordIndex: 1 }),
    ],
    connections: [
      createConnection(
        { charStart: 0, lineIndex: 0, wordIndex: 0, charEnd: 3, word: "cat" },
        { charStart: 4, lineIndex: 0, wordIndex: 1, charEnd: 7, word: "bet" },
        { type: "slant", score: 0.70, syllablesMatched: 1 }
      ),
    ],
  },
  intensityGradient: {
    description: "Words with higher connection scores get higher opacity",
    content: "time rhyme lime day",
    wordAnalyses: [
      createWordAnalysis({ word: "time", normalizedWord: "TIME", charStart: 0, charEnd: 4, vowelFamily: "AY", wordIndex: 0 }),
      createWordAnalysis({ word: "rhyme", normalizedWord: "RHYME", charStart: 5, charEnd: 10, vowelFamily: "AY", wordIndex: 1 }),
      createWordAnalysis({ word: "lime", normalizedWord: "LIME", charStart: 11, charEnd: 15, vowelFamily: "AY", wordIndex: 2 }),
      createWordAnalysis({ word: "day", normalizedWord: "DAY", charStart: 16, charEnd: 19, vowelFamily: "EY", wordIndex: 3 }),
    ],
    connections: [
      createConnection(
        { charStart: 0, lineIndex: 0, wordIndex: 0, charEnd: 4, word: "time" },
        { charStart: 5, lineIndex: 0, wordIndex: 1, charEnd: 10, word: "rhyme" },
        { type: "perfect", score: 0.95, syllablesMatched: 1 }
      ),
      createConnection(
        { charStart: 0, lineIndex: 0, wordIndex: 0, charEnd: 4, word: "time" },
        { charStart: 11, lineIndex: 0, wordIndex: 2, charEnd: 15, word: "lime" },
        { type: "perfect", score: 0.95, syllablesMatched: 1 }
      ),
    ],
    // "day" at charStart 16 has no connections → base opacity
    isolatedCharStart: 16,
    connectedCharStart: 0,
  },
  multiSyllableHighlight: {
    description: "Words with multi-syllable matches get isMultiSyllable flag",
    content: "glitter bitter",
    wordAnalyses: [
      createWordAnalysis({ word: "glitter", normalizedWord: "GLITTER", charStart: 0, charEnd: 7, vowelFamily: "IH", wordIndex: 0, syllableCount: 2 }),
      createWordAnalysis({ word: "bitter", normalizedWord: "BITTER", charStart: 8, charEnd: 14, vowelFamily: "IH", wordIndex: 1, syllableCount: 2 }),
    ],
    connections: [
      createConnection(
        { charStart: 0, lineIndex: 0, wordIndex: 0, charEnd: 7, word: "glitter" },
        { charStart: 8, lineIndex: 0, wordIndex: 1, charEnd: 14, word: "bitter" },
        { type: "perfect", score: 0.94, syllablesMatched: 2 }
      ),
    ],
  },
};

export const PANEL_ANALYSIS_SCENARIOS = {
  stopWordPromotion: {
    text: "the tone meta",
    wordAnalyses: [THE, TONE, META],
    connections: [createConnection(THE, TONE)],
    rhymeGroups: [],
    schemePattern: "",
  },
  stopWordExclusion: {
    text: "the alpha beta",
    wordAnalyses: [THE, ALPHA, BETA],
    connections: [createConnection(THE, ALPHA)],
    rhymeGroups: [],
    schemePattern: "",
  },
};
