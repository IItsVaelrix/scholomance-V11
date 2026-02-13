export const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

function toUpperSafe(value) {
  return String(value || "").toUpperCase();
}

export function createWordAnalysis(overrides = {}) {
  const word = String(overrides.word ?? "word");
  const charStart = Number.isInteger(overrides.charStart) ? overrides.charStart : 0;
  const charEnd = Number.isInteger(overrides.charEnd) ? overrides.charEnd : charStart + word.length;
  const vowelFamily = String(overrides.vowelFamily ?? "AH");

  return {
    word,
    normalizedWord: overrides.normalizedWord ?? toUpperSafe(word),
    lineIndex: Number.isInteger(overrides.lineIndex) ? overrides.lineIndex : 0,
    wordIndex: Number.isInteger(overrides.wordIndex) ? overrides.wordIndex : 0,
    charStart,
    charEnd,
    vowelFamily,
    syllableCount: Number.isInteger(overrides.syllableCount) ? overrides.syllableCount : 1,
    rhymeKey: overrides.rhymeKey ?? `${vowelFamily}-${toUpperSafe(word.slice(-1))}`,
    ...overrides,
  };
}

export function createConnection(wordA, wordB, overrides = {}) {
  return {
    type: "perfect",
    score: 1.0,
    syllablesMatched: 1,
    wordA,
    wordB,
    ...overrides,
  };
}

export function createPanelAnalysisData({
  connections = [],
  wordAnalyses = [],
  rhymeGroups = [],
  schemePattern = "",
  scheme = null,
  vowelSummary = null,
} = {}) {
  const uniqueWords = new Set(
    wordAnalyses.map((item) => String(item?.normalizedWord || item?.word || "").toUpperCase())
  ).size;

  return {
    analysis: {
      allConnections: connections,
      wordAnalyses,
      rhymeGroups,
      schemePattern,
    },
    scheme,
    vowelSummary: vowelSummary ?? {
      ...EMPTY_VOWEL_SUMMARY,
      totalWords: wordAnalyses.length,
      uniqueWords,
    },
  };
}
