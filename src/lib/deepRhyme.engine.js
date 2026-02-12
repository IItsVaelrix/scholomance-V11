/**
 * Deep Rhyme Analysis Engine
 * Provides document-level rhyme analysis including multi-syllable matching,
 * internal rhymes, and rhyme connections.
 */

import { PhonemeEngine } from "./phoneme.engine.js";
import { RHYME_TYPES } from "../data/rhymeScheme.patterns.js";
import { normalizeVowelFamily } from "./vowelFamily.js";
import { WORD_REGEX_GLOBAL } from "./wordTokenization.js";

/**
 * @typedef {object} WordPosition
 * @property {number} lineIndex - Line number (0-indexed).
 * @property {number} wordIndex - Word position in line.
 * @property {number} charStart - Character offset in full text.
 * @property {number} charEnd - End character offset.
 * @property {string} word - The original word.
 */

/**
 * @typedef {object} RhymeConnection
 * @property {string} type - "perfect" | "near" | "slant" | "assonance" | "consonance"
 * @property {string} subtype - "masculine" | "feminine" | "dactylic" | "mosaic"
 * @property {number} score - Match score (0-1).
 * @property {number} syllablesMatched - How many syllables match.
 * @property {WordPosition} wordA - First word position.
 * @property {WordPosition} wordB - Second word position.
 * @property {string} groupLabel - Rhyme group letter (A, B, C...).
 * @property {{ gate: string, multiplier: number, reasons: string[] }=} syntax
 */

/**
 * @typedef {object} LineAnalysis
 * @property {number} lineIndex - Line number (0-indexed).
 * @property {string} text - Original line text.
 * @property {Array} words - Analyzed words with positions.
 * @property {number} syllableTotal - Total syllables in line.
 * @property {string} stressPattern - Combined stress pattern.
 * @property {RhymeConnection[]} internalRhymes - Rhymes within the line.
 * @property {string} endRhymeKey - Rhyme key of line-ending word.
 * @property {object|null} endWord - Analysis of final word.
 */

/**
 * @typedef {object} DocumentAnalysis
 * @property {LineAnalysis[]} lines - All analyzed lines.
 * @property {RhymeConnection[]} endRhymeConnections - End-word rhyme pairs.
 * @property {RhymeConnection[]} internalRhymeConnections - All internal rhymes.
 * @property {RhymeConnection[]} allConnections - Combined connections.
 * @property {Map<string, number[]>} rhymeGroups - Map of rhyme key to line indices.
 * @property {string} schemePattern - Detected scheme pattern (e.g., "ABAB").
 * @property {object|null} syntaxSummary - Optional syntax layer diagnostics.
 * @property {object} statistics - Counts and metrics.
 */

/** Shared tokenizer used across pipeline/UI to keep token offsets aligned. */
const WORD_REGEX = WORD_REGEX_GLOBAL;

/** Minimum score to consider words as rhyming */
const RHYME_THRESHOLD = 0.65;
/** Assonance is weaker than rhyme/slant, so allow a lower score floor. */
const ASSONANCE_THRESHOLD = 0.60;
/** Stable score used when stressed-vowel assonance is detected without terminal rhyme. */
const STRESSED_ASSONANCE_SCORE = 0.62;
/** When the same rhyme key appears more than this count, avoid quadratic scans */
const MAX_FULL_PAIR_SCAN_OCCURRENCES = 2;
/** Connection types that can activate Truesight rhyme interpretation. */
const TRUESIGHT_RHYME_TYPES = new Set(['perfect', 'near', 'slant', 'assonance']);

/** Identical lexical repetitions are usually refrain, not rhyme. */
const IGNORE_IDENTICAL_WORD_RHYMES = true;
const SYNTAX_GATES = Object.freeze({
  ALLOW: 'allow',
  ALLOW_WEAK: 'allow_weak',
  SUPPRESS: 'suppress',
});

/**
 * Deep Rhyme Analysis Engine
 */
export class DeepRhymeEngine {
  constructor(phonemeEngine = PhonemeEngine) {
    this.engine = phonemeEngine;
    this.analysisCache = new Map();
    this.syntaxLayerContext = null;
    this.syntaxGateCounters = null;
  }

  /**
   * Analyzes an entire document for rhyme patterns.
   * @param {string} text - Full document text.
   * @param {object} [options]
   * @param {object|null} [options.syntaxLayer]
   * @returns {DocumentAnalysis} Complete document analysis.
   */
  analyzeDocument(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return this.emptyDocumentAnalysis();
    }

    const syntaxLayer = options?.syntaxLayer?.enabled ? options.syntaxLayer : null;
    const syntaxCacheTag = syntaxLayer
      ? `|syntax:1:${syntaxLayer.syntaxSummary?.tokenCount || syntaxLayer.tokens?.length || 0}`
      : '|syntax:0';
    const cacheKey = `${text.slice(0, 100)}${text.length}${syntaxCacheTag}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    this.syntaxLayerContext = syntaxLayer;
    this.syntaxGateCounters = {
      enabled: Boolean(syntaxLayer),
      totalCandidates: 0,
      suppressedPairs: 0,
      weakenedPairs: 0,
      keptPairs: 0,
    };

    const rawLines = text.split('\n');
    const lines = [];
    let charOffset = 0;

    // Analyze each line
    for (let i = 0; i < rawLines.length; i++) {
      const lineText = rawLines[i];
      const lineAnalysis = this.analyzeLine(lineText, i, charOffset);
      lines.push(lineAnalysis);
      charOffset += lineText.length + 1; // +1 for newline
    }

    // Find end-rhyme connections
    const endRhymeConnections = this.findEndRhymeConnections(lines);

    // Collect all internal rhymes
    const internalRhymeConnections = lines.flatMap(l => l.internalRhymes);

    // Build rhyme groups
    const { rhymeGroups, schemePattern } = this.buildRhymeGroups(lines, endRhymeConnections);

    // Assign group labels to connections
    this.assignGroupLabels(endRhymeConnections, rhymeGroups);

    const allConnections = [...endRhymeConnections, ...internalRhymeConnections];

    const result = {
      lines,
      endRhymeConnections,
      internalRhymeConnections,
      allConnections,
      rhymeGroups,
      schemePattern,
      syntaxSummary: syntaxLayer?.syntaxSummary || null,
      statistics: this.computeStatistics(lines, allConnections, this.syntaxGateCounters),
    };

    this.syntaxLayerContext = null;
    this.syntaxGateCounters = null;
    this.analysisCache.set(cacheKey, result);
    return result;
  }

  /**
   * Analyzes a single line.
   * @param {string} lineText - The line text.
   * @param {number} lineIndex - Line number.
   * @param {number} charOffset - Character offset from document start.
   * @returns {LineAnalysis}
   */
  analyzeLine(lineText, lineIndex, charOffset = 0) {
    const words = [];
    const wordMatches = [...lineText.matchAll(WORD_REGEX)];

    let totalSyllables = 0;
    let stressPatterns = [];

    for (let i = 0; i < wordMatches.length; i++) {
      const match = wordMatches[i];
      const word = match[0];
      const charStart = charOffset + match.index;
      const charEnd = charStart + word.length;

      const deepAnalysis = this.engine.analyzeDeep(word);

      if (deepAnalysis) {
        totalSyllables += deepAnalysis.syllableCount;
        stressPatterns.push(deepAnalysis.stressPattern);
      }

      words.push({
        word,
        lineIndex,
        wordIndex: i,
        charStart,
        charEnd,
        analysis: deepAnalysis,
        syntaxToken: this.getSyntaxToken(lineIndex, i, charStart),
      });
    }

    // Find internal rhymes (words within the line that rhyme with each other)
    const internalRhymes = this.findInternalRhymes(words);

    // Get the end word for scheme detection
    const endWord = words.length > 0 ? words[words.length - 1] : null;
    const endRhymeKey = endWord?.analysis?.rhymeKey || null;

    return {
      lineIndex,
      text: lineText,
      words,
      syllableTotal: totalSyllables,
      stressPattern: stressPatterns.join(' '),
      internalRhymes,
      endRhymeKey,
      endWord: endWord?.analysis || null,
    };
  }

  /**
   * Looks up a syntax token for a word position using identity-first matching.
   * @param {number} lineIndex
   * @param {number} wordIndex
   * @param {number} charStart
   * @returns {object|null}
   */
  getSyntaxToken(lineIndex, wordIndex, charStart) {
    const syntaxLayer = this.syntaxLayerContext;
    if (!syntaxLayer) return null;

    const identityKey = `${lineIndex}:${wordIndex}:${charStart}`;
    if (syntaxLayer.tokenByIdentity instanceof Map && syntaxLayer.tokenByIdentity.has(identityKey)) {
      return syntaxLayer.tokenByIdentity.get(identityKey) || null;
    }

    if (syntaxLayer.tokenByCharStart instanceof Map && syntaxLayer.tokenByCharStart.has(charStart)) {
      return syntaxLayer.tokenByCharStart.get(charStart) || null;
    }

    if (Array.isArray(syntaxLayer.tokens)) {
      return syntaxLayer.tokens.find((token) => (
        token?.lineNumber === lineIndex &&
        token?.wordIndex === wordIndex &&
        token?.charStart === charStart
      )) || null;
    }

    return null;
  }

  /**
   * Finds rhymes between words within a single line.
   * Optimized with rhyme key grouping: O(g²) instead of O(w²) (Fix 5)
   * @param {Array} words - Analyzed words from a line.
   * @returns {RhymeConnection[]}
   */
  findInternalRhymes(words) {
    const connections = [];

    // Include all words so line-final words can still form internal assonance/rhyme.
    const internalWords = words;
    if (internalWords.length < 2) return connections;

    // Build phonetic buckets (exact rhyme key + terminal vowel family).
    // This allows assonance/slant candidates while avoiding global O(n^2) scans.
    const buckets = this.buildPhoneticBuckets(internalWords);
    const seenPairs = new Set();

    // Only compare words within same phonetic bucket
    for (const [, groupWords] of buckets) {
      if (groupWords.length < 2) continue;
      this.collectGroupConnections(groupWords, connections, seenPairs);
    }

    return connections;
  }

  /**
   * Finds rhyme connections between line-ending words.
   * Optimized with phonetic bucketing: O(g^2) within bucket bounds.
   * @param {LineAnalysis[]} lines - All analyzed lines.
   * @returns {RhymeConnection[]}
   */
  findEndRhymeConnections(lines) {
    const connections = [];
    const endWords = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const lastWord = lines[idx].words[lines[idx].words.length - 1];
      if (!lastWord?.analysis) continue;
      endWords.push({ ...lastWord, lineIndex: idx });
    }

    const buckets = this.buildPhoneticBuckets(endWords);
    const seenPairs = new Set();

    // Only compare words within same phonetic bucket
    for (const [, groupWords] of buckets) {
      if (groupWords.length < 2) continue;
      this.collectGroupConnections(groupWords, connections, seenPairs);
    }

    return connections;
  }

  /**
   * Collects rhyme connections for a same-key group.
   * For groups larger than 2, uses linear adjacent scans to avoid redundant duplication.
   * @param {Array} groupWords
   * @param {RhymeConnection[]} out
   * @param {Set<string>} seenPairs
   */
  collectGroupConnections(groupWords, out, seenPairs = new Set()) {
    if (!Array.isArray(groupWords) || groupWords.length < 2) return;

    if (groupWords.length <= MAX_FULL_PAIR_SCAN_OCCURRENCES) {
      for (let i = 0; i < groupWords.length; i++) {
        for (let j = i + 1; j < groupWords.length; j++) {
          this.pushConnectionIfValid(groupWords[i], groupWords[j], out, seenPairs);
        }
      }
      return;
    }

    for (let i = 1; i < groupWords.length; i++) {
      this.pushConnectionIfValid(groupWords[i - 1], groupWords[i], out, seenPairs);
    }
  }

  /**
   * Scores and appends a connection when it passes the minimum threshold.
   * @param {object} wordA
   * @param {object} wordB
   * @param {RhymeConnection[]} out
   * @param {Set<string>} seenPairs
   */
  pushConnectionIfValid(wordA, wordB, out, seenPairs = new Set()) {
    if (!wordA?.analysis || !wordB?.analysis) return;
    if (this.shouldSkipLexicalRepetition(wordA, wordB)) return;

    const pairKey = this.getPairKey(wordA, wordB);
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const syntaxGate = this.syntaxLayerContext
      ? this.evaluateSyntaxGate(wordA, wordB)
      : null;
    if (syntaxGate) {
      this.recordSyntaxGateDecision(syntaxGate);
      if (syntaxGate.gate === SYNTAX_GATES.SUPPRESS) {
        return;
      }
    }

    const connection = this.scoreConnection(wordA, wordB, syntaxGate);
    if (this.isTruesightRhymeConnection(connection)) {
      out.push(connection);
    }
  }

  /**
   * Applies syntax-aware gate policy to a candidate pair.
   * @param {object} wordA
   * @param {object} wordB
   * @returns {{gate: string, multiplier: number, reasons: string[]}}
   */
  evaluateSyntaxGate(wordA, wordB) {
    const tokenA = wordA?.syntaxToken || null;
    const tokenB = wordB?.syntaxToken || null;

    if (!this.syntaxLayerContext) {
      return {
        gate: SYNTAX_GATES.ALLOW,
        multiplier: 1,
        reasons: ['no_syntax_layer'],
      };
    }

    if (!tokenA && !tokenB) {
      return {
        gate: SYNTAX_GATES.ALLOW,
        multiplier: 1,
        reasons: ['missing_syntax_token'],
      };
    }

    const aFunction = tokenA?.role === 'function';
    const bFunction = tokenB?.role === 'function';
    const aLineEnd = tokenA?.lineRole === 'line_end';
    const bLineEnd = tokenB?.lineRole === 'line_end';
    const hasFunctionNonEnd = (aFunction && !aLineEnd) || (bFunction && !bLineEnd);
    const isInternalPair = wordA?.lineIndex === wordB?.lineIndex;
    const hasLineAnchor = aLineEnd || bLineEnd || !isInternalPair;
    const phoneticAffinity = this.evaluatePhoneticAffinity(wordA?.analysis, wordB?.analysis);

    if (aFunction && bFunction && !aLineEnd && !bLineEnd) {
      return {
        gate: SYNTAX_GATES.SUPPRESS,
        multiplier: 0,
        reasons: ['both_function_non_terminal'],
      };
    }

    if (aFunction && bFunction && aLineEnd && bLineEnd) {
      return {
        gate: SYNTAX_GATES.ALLOW_WEAK,
        multiplier: 0.9,
        reasons: ['both_function_line_end_exception'],
      };
    }

    if (hasFunctionNonEnd) {
      // Preserve strong assonance/rhyme cues when syntax differs, especially when
      // one endpoint is line-anchored or cross-line.
      if (phoneticAffinity.sharedStressedFamily && hasLineAnchor) {
        return {
          gate: SYNTAX_GATES.ALLOW_WEAK,
          multiplier: 0.97,
          reasons: ['contains_function_non_terminal', 'phonetic_affinity_override'],
        };
      }

      return {
        gate: SYNTAX_GATES.ALLOW_WEAK,
        multiplier: 0.88,
        reasons: ['contains_function_non_terminal'],
      };
    }

    const stemA = String(tokenA?.stem || '').trim();
    const stemB = String(tokenB?.stem || '').trim();
    const normalizedA = String(tokenA?.normalized || this.normalizeWord(wordA?.word)).trim();
    const normalizedB = String(tokenB?.normalized || this.normalizeWord(wordB?.word)).trim();
    const isStemEcho = Boolean(
      isInternalPair &&
      stemA &&
      stemB &&
      stemA === stemB &&
      normalizedA &&
      normalizedB &&
      normalizedA !== normalizedB
    );

    if (isStemEcho) {
      return {
        gate: SYNTAX_GATES.ALLOW_WEAK,
        multiplier: 0.85,
        reasons: ['same_stem_internal_echo'],
      };
    }

    return {
      gate: SYNTAX_GATES.ALLOW,
      multiplier: 1,
      reasons: ['default_allow'],
    };
  }

  /**
   * Evaluates lightweight phonetic affinity used by syntax gating.
   * @param {object|null} analysisA
   * @param {object|null} analysisB
   * @returns {{sharedRhymeKey: boolean, sharedTerminalFamily: boolean, sharedStressedFamily: boolean}}
   */
  evaluatePhoneticAffinity(analysisA, analysisB) {
    if (!analysisA || !analysisB) {
      return {
        sharedRhymeKey: false,
        sharedTerminalFamily: false,
        sharedStressedFamily: false,
      };
    }

    const rhymeA = String(analysisA?.rhymeKey || '').trim();
    const rhymeB = String(analysisB?.rhymeKey || '').trim();
    const sharedRhymeKey = Boolean(rhymeA && rhymeB && rhymeA === rhymeB);

    const terminalA = this.getTerminalVowelFamily(analysisA);
    const terminalB = this.getTerminalVowelFamily(analysisB);
    const sharedTerminalFamily = Boolean(terminalA && terminalB && terminalA === terminalB);

    const stressedA = this.getPrimaryStressedVowelFamily(analysisA);
    const stressedB = this.getPrimaryStressedVowelFamily(analysisB);
    const sharedStressedFamily = Boolean(stressedA && stressedB && stressedA === stressedB);

    return {
      sharedRhymeKey,
      sharedTerminalFamily,
      sharedStressedFamily,
    };
  }

  /**
   * Tracks syntax gate counters for analysis diagnostics.
   * @param {{gate: string}} syntaxGate
   */
  recordSyntaxGateDecision(syntaxGate) {
    if (!this.syntaxGateCounters?.enabled) return;
    this.syntaxGateCounters.totalCandidates += 1;
    if (syntaxGate?.gate === SYNTAX_GATES.SUPPRESS) {
      this.syntaxGateCounters.suppressedPairs += 1;
      return;
    }
    if (syntaxGate?.gate === SYNTAX_GATES.ALLOW_WEAK) {
      this.syntaxGateCounters.weakenedPairs += 1;
      return;
    }
    this.syntaxGateCounters.keptPairs += 1;
  }

  /**
   * Returns true when a scored pair is a valid rhyme connection for Truesight.
   * Assonance is only considered for cross-line interpretation to avoid noisy
   * single-line color activation in free-form prose.
   * @param {RhymeConnection | null} connection
   * @returns {boolean}
   */
  isTruesightRhymeConnection(connection) {
    if (!connection) return false;
    if (!TRUESIGHT_RHYME_TYPES.has(connection.type)) return false;
    if (connection.type === 'assonance') {
      return Number(connection.score) >= ASSONANCE_THRESHOLD;
    }
    return Number(connection.score) >= RHYME_THRESHOLD;
  }

  /**
   * Returns true when two tokens are lexical repeats that should not be
   * counted as rhyme connections.
   * @param {object} wordA
   * @param {object} wordB
   * @returns {boolean}
   */
  shouldSkipLexicalRepetition(wordA, wordB) {
    if (!IGNORE_IDENTICAL_WORD_RHYMES) return false;
    const normalizedA = this.normalizeWord(wordA?.word);
    const normalizedB = this.normalizeWord(wordB?.word);
    return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
  }

  /**
   * Normalizes display tokens for lexical comparisons.
   * @param {string} value
   * @returns {string}
   */
  normalizeWord(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^[^a-z']+|[^a-z']+$/g, '');
  }

  /**
   * Builds candidate buckets keyed by exact rhyme and terminal vowel family.
   * @param {Array} words
   * @returns {Map<string, Array>}
   */
  buildPhoneticBuckets(words) {
    const buckets = new Map();

    const addToBucket = (bucketKey, word) => {
      if (!bucketKey) return;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push(word);
    };

    for (const word of words) {
      const analysis = word?.analysis;
      if (!analysis) continue;

      if (analysis.rhymeKey) {
        addToBucket(`rhyme:${analysis.rhymeKey}`, word);
      }

      const terminalVowel = this.getTerminalVowelFamily(analysis);
      if (terminalVowel) {
        addToBucket(`vowel:${terminalVowel}`, word);
      }

      const stressedVowel = this.getPrimaryStressedVowelFamily(analysis);
      if (stressedVowel) {
        addToBucket(`stress:${stressedVowel}`, word);
      }
    }

    return buckets;
  }

  /**
   * Returns terminal syllable vowel family for bucketing.
   * @param {object} analysis
   * @returns {string|null}
   */
  getTerminalVowelFamily(analysis) {
    const syllables = analysis?.syllables;
    if (Array.isArray(syllables) && syllables.length > 0) {
      const family = normalizeVowelFamily(syllables[syllables.length - 1]?.vowelFamily);
      return family || null;
    }

    const rhymeKey = analysis?.rhymeKey;
    if (typeof rhymeKey === 'string' && rhymeKey.includes('-')) {
      const family = normalizeVowelFamily(rhymeKey.split('-')[0]);
      return family || null;
    }

    return null;
  }

  /**
   * Returns the primary stressed syllable vowel family (fallback: first syllable).
   * @param {object} analysis
   * @returns {string|null}
   */
  getPrimaryStressedVowelFamily(analysis) {
    const syllables = analysis?.syllables;
    if (!Array.isArray(syllables) || syllables.length === 0) {
      return this.getTerminalVowelFamily(analysis);
    }
    const stressed = syllables.find((syl) => Number(syl?.stress) > 0) || syllables[0];
    const family = normalizeVowelFamily(stressed?.vowelFamily);
    return family || null;
  }

  /**
   * Computes a stressed-vowel assonance fallback when terminal rhyme scoring misses.
   * @param {object} analysisA
   * @param {object} analysisB
   * @returns {number}
   */
  scoreStressedAssonance(analysisA, analysisB) {
    const stressedA = this.getPrimaryStressedVowelFamily(analysisA);
    const stressedB = this.getPrimaryStressedVowelFamily(analysisB);
    if (!stressedA || !stressedB || stressedA !== stressedB) {
      return 0;
    }
    return STRESSED_ASSONANCE_SCORE;
  }

  /**
   * Creates a stable identity key for an unordered word pair.
   * @param {object} wordA
   * @param {object} wordB
   * @returns {string}
   */
  getPairKey(wordA, wordB) {
    const idA = `${wordA.lineIndex}:${wordA.wordIndex}:${wordA.charStart}`;
    const idB = `${wordB.lineIndex}:${wordB.wordIndex}:${wordB.charStart}`;
    return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  }
  /**
   * Scores the rhyme connection between two words.
   * @param {object} wordA - First word with analysis.
   * @param {object} wordB - Second word with analysis.
   * @param {{gate: string, multiplier: number, reasons: string[]}} [syntaxGate]
   * @returns {RhymeConnection|null}
   */
  scoreConnection(wordA, wordB, syntaxGate = null) {
    const analysisA = wordA.analysis;
    const analysisB = wordB.analysis;

    if (!analysisA || !analysisB) return null;

    // Use multi-syllable scoring
    const multiMatch = this.engine.scoreMultiSyllableMatch(analysisA, analysisB);
    const stressedAssonanceScore = multiMatch.syllablesMatched === 0
      ? this.scoreStressedAssonance(analysisA, analysisB)
      : 0;

    if (multiMatch.syllablesMatched === 0 && stressedAssonanceScore <= 0) return null;

    const baseScore = Math.max(Number(multiMatch.score) || 0, stressedAssonanceScore);
    const multiplier = Number(syntaxGate?.multiplier);
    const appliedMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    const connectionScore = baseScore * appliedMultiplier;
    const syllablesMatched = multiMatch.syllablesMatched > 0
      ? multiMatch.syllablesMatched
      : (stressedAssonanceScore > 0 ? 1 : 0);

    // Determine rhyme type based on score
    let type = 'consonance';
    if (connectionScore >= RHYME_TYPES.PERFECT.minScore) {
      type = 'perfect';
    } else if (connectionScore >= RHYME_TYPES.NEAR.minScore) {
      type = 'near';
    } else if (connectionScore >= RHYME_TYPES.SLANT.minScore) {
      type = 'slant';
    } else if (connectionScore >= RHYME_TYPES.ASSONANCE.minScore) {
      type = 'assonance';
    }

    return {
      type,
      subtype: multiMatch.type,
      score: connectionScore,
      syllablesMatched,
      wordA: {
        lineIndex: wordA.lineIndex,
        wordIndex: wordA.wordIndex,
        charStart: wordA.charStart,
        charEnd: wordA.charEnd,
        word: wordA.word,
      },
      wordB: {
        lineIndex: wordB.lineIndex,
        wordIndex: wordB.wordIndex,
        charStart: wordB.charStart,
        charEnd: wordB.charEnd,
        word: wordB.word,
      },
      groupLabel: null,
      syntax: syntaxGate
        ? {
          gate: syntaxGate.gate || SYNTAX_GATES.ALLOW,
          multiplier: appliedMultiplier,
          reasons: Array.isArray(syntaxGate.reasons) ? syntaxGate.reasons : [],
        }
        : undefined,
    };
  }

  /**
   * Builds rhyme groups and detects scheme pattern.
   * @param {LineAnalysis[]} lines - Analyzed lines.
   * @param {RhymeConnection[]} connections - End-rhyme connections.
   * @returns {{ rhymeGroups: Map, schemePattern: string }}
   */
  buildRhymeGroups(lines, connections) {
    const rhymeGroups = new Map();
    const lineToGroup = new Map();
    let nextGroupIndex = 0;

    // Build union-find structure from connections
    for (const conn of connections) {
      const lineA = conn.wordA.lineIndex;
      const lineB = conn.wordB.lineIndex;

      const groupA = lineToGroup.get(lineA);
      const groupB = lineToGroup.get(lineB);

      if (groupA === undefined && groupB === undefined) {
        // Both lines are new - create a new group
        const label = String.fromCharCode(65 + nextGroupIndex);
        lineToGroup.set(lineA, label);
        lineToGroup.set(lineB, label);
        rhymeGroups.set(label, [lineA, lineB]);
        nextGroupIndex++;
      } else if (groupA !== undefined && groupB === undefined) {
        // Add lineB to groupA
        lineToGroup.set(lineB, groupA);
        rhymeGroups.get(groupA).push(lineB);
      } else if (groupA === undefined && groupB !== undefined) {
        // Add lineA to groupB
        lineToGroup.set(lineA, groupB);
        rhymeGroups.get(groupB).push(lineA);
      }
      // If both already have groups, they should be the same (or we'd merge)
    }

    // Assign unique labels to unrhymed lines
    for (let i = 0; i < lines.length; i++) {
      if (!lineToGroup.has(i) && lines[i].endWord) {
        const label = String.fromCharCode(65 + nextGroupIndex);
        lineToGroup.set(i, label);
        rhymeGroups.set(label, [i]);
        nextGroupIndex++;
      }
    }

    // Sort line indices within each group
    rhymeGroups.forEach((lineIndices) => lineIndices.sort((a, b) => a - b));

    // Build scheme pattern string
    const pattern = lines
      .map((_, i) => lineToGroup.get(i) || 'X')
      .join('');

    return { rhymeGroups, schemePattern: pattern };
  }

  /**
   * Assigns group labels to connections.
   * @param {RhymeConnection[]} connections
   * @param {Map<string, number[]>} rhymeGroups
   */
  assignGroupLabels(connections, rhymeGroups) {
    for (const conn of connections) {
      for (const [label, lineIndices] of rhymeGroups) {
        if (lineIndices.includes(conn.wordA.lineIndex)) {
          conn.groupLabel = label;
          break;
        }
      }
    }
  }

  /**
   * Computes statistics for the analysis.
   * @param {LineAnalysis[]} lines
   * @param {RhymeConnection[]} connections
   * @param {{enabled: boolean, totalCandidates: number, suppressedPairs: number, weakenedPairs: number, keptPairs: number}|null} syntaxGateCounters
   * @returns {object}
   */
  computeStatistics(lines, connections, syntaxGateCounters = null) {
    const stats = {
      totalLines: lines.length,
      totalWords: lines.reduce((sum, l) => sum + l.words.length, 0),
      totalSyllables: lines.reduce((sum, l) => sum + l.syllableTotal, 0),
      perfectCount: 0,
      nearCount: 0,
      slantCount: 0,
      internalCount: 0,
      multiSyllableCount: 0,
      endRhymeCount: 0,
      syntaxGating: {
        enabled: Boolean(syntaxGateCounters?.enabled),
        totalCandidates: Number(syntaxGateCounters?.totalCandidates) || 0,
        suppressedPairs: Number(syntaxGateCounters?.suppressedPairs) || 0,
        weakenedPairs: Number(syntaxGateCounters?.weakenedPairs) || 0,
        keptPairs: Number(syntaxGateCounters?.keptPairs) || 0,
      },
    };

    for (const conn of connections) {
      if (conn.type === 'perfect') stats.perfectCount++;
      else if (conn.type === 'near') stats.nearCount++;
      else if (conn.type === 'slant') stats.slantCount++;

      if (conn.syllablesMatched >= 2) stats.multiSyllableCount++;

      // Check if internal (same line) or end rhyme
      if (conn.wordA.lineIndex === conn.wordB.lineIndex) {
        stats.internalCount++;
      } else {
        stats.endRhymeCount++;
      }
    }

    return stats;
  }

  /**
   * Returns empty document analysis structure.
   * @returns {DocumentAnalysis}
   */
  emptyDocumentAnalysis() {
    return {
      lines: [],
      endRhymeConnections: [],
      internalRhymeConnections: [],
      allConnections: [],
      rhymeGroups: new Map(),
      schemePattern: '',
      syntaxSummary: null,
      statistics: {
        totalLines: 0,
        totalWords: 0,
        totalSyllables: 0,
        perfectCount: 0,
        nearCount: 0,
        slantCount: 0,
        internalCount: 0,
        multiSyllableCount: 0,
        endRhymeCount: 0,
        syntaxGating: {
          enabled: false,
          totalCandidates: 0,
          suppressedPairs: 0,
          weakenedPairs: 0,
          keptPairs: 0,
        },
      },
    };
  }

  /**
   * Clears the analysis cache.
   */
  clearCache() {
    this.analysisCache.clear();
  }
}

// Export singleton instance
export const deepRhymeEngine = new DeepRhymeEngine();

