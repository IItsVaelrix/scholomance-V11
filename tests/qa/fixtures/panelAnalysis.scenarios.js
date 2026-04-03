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

// --- Rhyme analysis scenario words ---

const CAT = createWordAnalysis({
  word: "cat", normalizedWord: "CAT", lineIndex: 0, wordIndex: 0,
  charStart: 0, charEnd: 3, vowelFamily: "AE", rhymeKey: "AE-T",
});

const HAT = createWordAnalysis({
  word: "hat", normalizedWord: "HAT", lineIndex: 1, wordIndex: 0,
  charStart: 4, charEnd: 7, vowelFamily: "AE", rhymeKey: "AE-T",
});

const MAP = createWordAnalysis({
  word: "map", normalizedWord: "MAP", lineIndex: 1, wordIndex: 0,
  charStart: 4, charEnd: 7, vowelFamily: "AE", rhymeKey: "AE-P",
});

const DOG = createWordAnalysis({
  word: "dog", normalizedWord: "DOG", lineIndex: 1, wordIndex: 0,
  charStart: 4, charEnd: 7, vowelFamily: "AO", rhymeKey: "AO-G",
});

const LOG = createWordAnalysis({
  word: "log", normalizedWord: "LOG", lineIndex: 3, wordIndex: 0,
  charStart: 12, charEnd: 15, vowelFamily: "AO", rhymeKey: "AO-G",
});

const BEAUTIFUL = createWordAnalysis({
  word: "beautiful", normalizedWord: "BEAUTIFUL", lineIndex: 0, wordIndex: 0,
  charStart: 0, charEnd: 9, vowelFamily: "UH", syllableCount: 3, rhymeKey: "UH-L",
});

const DUTIFUL = createWordAnalysis({
  word: "dutiful", normalizedWord: "DUTIFUL", lineIndex: 1, wordIndex: 0,
  charStart: 10, charEnd: 17, vowelFamily: "UH", syllableCount: 3, rhymeKey: "UH-L",
});

const BIRD = createWordAnalysis({
  word: "bird", normalizedWord: "BIRD", lineIndex: 2, wordIndex: 0,
  charStart: 8, charEnd: 12, vowelFamily: "ER", rhymeKey: "ER-D",
});

// --- Vowel color mapping scenario words ---

const SOUL = createWordAnalysis({
  word: "soul", normalizedWord: "SOUL", lineIndex: 0, wordIndex: 0,
  charStart: 0, charEnd: 4, vowelFamily: "OW", rhymeKey: "OW-L",
});

const HOLE = createWordAnalysis({
  word: "hole", normalizedWord: "HOLE", lineIndex: 0, wordIndex: 1,
  charStart: 5, charEnd: 9, vowelFamily: "OW", rhymeKey: "OW-L",
});

const FLAME = createWordAnalysis({
  word: "flame", normalizedWord: "FLAME", lineIndex: 0, wordIndex: 0,
  charStart: 0, charEnd: 5, vowelFamily: "EY", rhymeKey: "EY-M",
});

const NAME = createWordAnalysis({
  word: "name", normalizedWord: "NAME", lineIndex: 0, wordIndex: 1,
  charStart: 6, charEnd: 10, vowelFamily: "EY", rhymeKey: "EY-M",
});

const WYRM = createWordAnalysis({
  word: "wyrm", normalizedWord: "WYRM", lineIndex: 0, wordIndex: 0,
  charStart: 0, charEnd: 4, vowelFamily: "ZZ", rhymeKey: "ZZ-M",
});

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

export const RHYME_ANALYSIS_SCENARIOS = {
  perfectRhyme: {
    text: "cat\nhat",
    wordAnalyses: [CAT, HAT],
    connections: [createConnection(CAT, HAT, { type: "perfect", score: 1.0, syllablesMatched: 1 })],
    rhymeGroups: [["A", [0, 1]]],
    schemePattern: "AA",
    scheme: {
      id: "COUPLET", name: "Couplet", pattern: "AA",
      confidence: 1.0, groups: [["A", [0, 1]]],
    },
  },
  feminineRhyme: {
    text: "beautiful\ndutiful",
    wordAnalyses: [BEAUTIFUL, DUTIFUL],
    connections: [createConnection(BEAUTIFUL, DUTIFUL, { type: "feminine", score: 0.95, syllablesMatched: 2 })],
    rhymeGroups: [["A", [0, 1]]],
    schemePattern: "AA",
    scheme: {
      id: "COUPLET", name: "Couplet", pattern: "AA",
      confidence: 0.95, groups: [["A", [0, 1]]],
    },
  },
  assonance: {
    text: "cat\nmap",
    wordAnalyses: [CAT, MAP],
    connections: [createConnection(CAT, MAP, { type: "assonance", score: 0.6, syllablesMatched: 1 })],
    rhymeGroups: [["A", [0, 1]]],
    schemePattern: "AA",
  },
  schemeABAB: {
    text: "cat\ndog\nhat\nlog",
    wordAnalyses: [
      { ...CAT, lineIndex: 0 },
      { ...DOG, lineIndex: 1 },
      { ...HAT, lineIndex: 2, charStart: 8, charEnd: 11 },
      { ...LOG, lineIndex: 3 },
    ],
    connections: [
      createConnection({ ...CAT, lineIndex: 0 }, { ...HAT, lineIndex: 2 }, { type: "perfect", score: 1.0, syllablesMatched: 1 }),
      createConnection({ ...DOG, lineIndex: 1 }, { ...LOG, lineIndex: 3 }, { type: "perfect", score: 1.0, syllablesMatched: 1 }),
    ],
    rhymeGroups: [["A", [0, 2]], ["B", [1, 3]]],
    schemePattern: "ABAB",
    scheme: {
      id: "ALTERNATE", name: "Alternate Rhyme", pattern: "ABAB",
      confidence: 1.0, groups: [["A", [0, 2]], ["B", [1, 3]]],
    },
  },
  noRhymes: {
    text: "cat\ndog\nbird",
    wordAnalyses: [CAT, DOG, BIRD],
    connections: [],
    rhymeGroups: [],
    schemePattern: "",
    scheme: null,
  },
};

export const VOWEL_COLOR_SCENARIOS = {
  owFamily: {
    text: "soul hole",
    wordAnalyses: [SOUL, HOLE],
    connections: [createConnection(SOUL, HOLE, { type: "perfect", score: 1.0, syllablesMatched: 1 })],
  },
  eyFamily: {
    text: "flame name",
    wordAnalyses: [FLAME, NAME],
    connections: [createConnection(FLAME, NAME, { type: "perfect", score: 1.0, syllablesMatched: 1 })],
  },
  unknownFamily: {
    text: "wyrm",
    wordAnalyses: [WYRM],
    connections: [],
  },
};

export const HYGIENE_SCENARIOS = {
  singletonNoise: {
    text: "time rhyme day",
    wordAnalyses: [
      createWordAnalysis({ word: "time", normalizedWord: "TIME", charStart: 0, charEnd: 4, vowelFamily: "AY", wordIndex: 0 }),
      createWordAnalysis({ word: "rhyme", normalizedWord: "RHYME", charStart: 5, charEnd: 10, vowelFamily: "AY", wordIndex: 1 }),
      createWordAnalysis({ word: "day", normalizedWord: "DAY", charStart: 11, charEnd: 14, vowelFamily: "EY", wordIndex: 2 }),
    ],
    connections: [
      createConnection({ charStart: 0, wordIndex: 0 }, { charStart: 5, wordIndex: 1 }, { score: 1.0 })
    ]
  },
  forensicMode: {
    text: "area strict",
    wordAnalyses: [
      createWordAnalysis({ word: "area", normalizedWord: "AREA", charStart: 0, charEnd: 4, vowelFamily: "EA", wordIndex: 0 }),
      createWordAnalysis({ word: "strict", normalizedWord: "STRICT", charStart: 5, charEnd: 11, vowelFamily: "IH", wordIndex: 1 }),
    ],
    connections: []
  },
  heatmapMode: {
    text: "match cold",
    wordAnalyses: [
      createWordAnalysis({ word: "match", normalizedWord: "MATCH", charStart: 0, charEnd: 5, vowelFamily: "AE", wordIndex: 0 }),
      createWordAnalysis({ word: "cold", normalizedWord: "COLD", charStart: 6, charEnd: 10, vowelFamily: "OW", wordIndex: 1 }),
    ],
    connections: []
  }
};
