import { PhonemeEngine } from "../../../src/lib/phonology/phoneme.engine.js";

const TOKEN_REGEX = /[a-z]+(?:'[a-z]+)*/gi;

function basePhoneme(phoneme) {
  return String(phoneme || "").replace(/[0-9]/g, "");
}

function toTokenList(line) {
  return String(line || "").match(TOKEN_REGEX)?.map((token) => token.toLowerCase()) || [];
}

function sumRepeatedCounts(counter) {
  let repeated = 0;
  for (const count of counter.values()) {
    if (count > 1) repeated += count - 1;
  }
  return repeated;
}

function buildPhonemeNgrams(analyses, n = 2) {
  const sequence = [];
  for (const analysis of analyses) {
    for (const phoneme of analysis.phonemes || []) {
      const clean = basePhoneme(phoneme);
      if (clean) sequence.push(clean);
    }
  }

  if (sequence.length < n) return new Map();

  const counter = new Map();
  for (let index = 0; index <= sequence.length - n; index += 1) {
    const key = sequence.slice(index, index + n).join("-");
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  return counter;
}

function computeRhymeClusterLength(analyses) {
  if (!analyses.length) return 0;
  const targetFamily = analyses[analyses.length - 1].vowelFamily;
  if (!targetFamily) return 1;

  let count = 0;
  for (let index = analyses.length - 1; index >= 0; index -= 1) {
    if (analyses[index].vowelFamily !== targetFamily) break;
    count += 1;
  }
  return count;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Tokenize a line into lowercase lexical tokens.
 * @param {string} line
 * @returns {string[]}
 */
export function tokenizeLine(line) {
  return toTokenList(line);
}

/**
 * Returns the end-rhyme key for a line using the final lexical token.
 * @param {string} line
 * @returns {string|null}
 */
export function getRhymeKey(line) {
  const tokens = toTokenList(line);
  if (!tokens.length) return null;
  const lastToken = tokens[tokens.length - 1];
  return PhonemeEngine.analyzeWord(lastToken)?.rhymeKey || null;
}

/**
 * Extracts style steering signals for a line.
 * @param {string} line
 * @returns {{
 *   tokenCount: number,
 *   averageSyllables: number,
 *   repeatedVowelFamilies: number,
 *   repeatedPhonemeNgrams: number,
 *   internalRhymeDensity: number,
 *   rhymeClusterLength: number
 * }}
 */
export function getStyleVector(line) {
  const tokens = toTokenList(line);
  if (!tokens.length) {
    return {
      tokenCount: 0,
      averageSyllables: 0,
      repeatedVowelFamilies: 0,
      repeatedPhonemeNgrams: 0,
      internalRhymeDensity: 0,
      rhymeClusterLength: 0,
    };
  }

  const analyses = tokens
    .map((token) => ({ token, analysis: PhonemeEngine.analyzeWord(token) }))
    .filter((entry) => entry.analysis)
    .map((entry) => ({
      token: entry.token,
      vowelFamily: entry.analysis.vowelFamily || null,
      syllableCount: safeNumber(entry.analysis.syllableCount, 1),
      phonemes: Array.isArray(entry.analysis.phonemes) ? entry.analysis.phonemes : [],
      rhymeKey: entry.analysis.rhymeKey || null,
    }));

  if (!analyses.length) {
    return {
      tokenCount: tokens.length,
      averageSyllables: 0,
      repeatedVowelFamilies: 0,
      repeatedPhonemeNgrams: 0,
      internalRhymeDensity: 0,
      rhymeClusterLength: 0,
    };
  }

  const familyCounter = new Map();
  let syllableTotal = 0;
  for (const analysis of analyses) {
    syllableTotal += analysis.syllableCount;
    if (!analysis.vowelFamily) continue;
    familyCounter.set(analysis.vowelFamily, (familyCounter.get(analysis.vowelFamily) || 0) + 1);
  }

  const repeatedVowelFamilies = sumRepeatedCounts(familyCounter);
  const repeatedPhonemeNgrams = sumRepeatedCounts(buildPhonemeNgrams(analyses, 2));
  const tokenCount = analyses.length;
  const internalRhymeDensity = (repeatedVowelFamilies + repeatedPhonemeNgrams) / Math.max(1, tokenCount);

  return {
    tokenCount,
    averageSyllables: syllableTotal / tokenCount,
    repeatedVowelFamilies,
    repeatedPhonemeNgrams,
    internalRhymeDensity,
    rhymeClusterLength: computeRhymeClusterLength(analyses),
  };
}

/**
 * Full per-line extraction used by training and validation.
 * @param {string} line
 */
export function analyzeLinePhonology(line) {
  const tokens = toTokenList(line);
  const endWord = tokens[tokens.length - 1] || null;
  const endAnalysis = endWord ? PhonemeEngine.analyzeWord(endWord) : null;

  return {
    text: String(line || ""),
    tokens,
    endWord,
    rhymeKey: endAnalysis?.rhymeKey || null,
    vowelFamily: endAnalysis?.vowelFamily || null,
    styleVector: getStyleVector(line),
  };
}

