/**
 * Deep Rhyme Analysis Engine
 * Provides document-level rhyme analysis including multi-syllable matching,
 * internal rhymes, and rhyme connections.
 */

import { PhonemeEngine } from "./phonology/phoneme.engine.js";
import { RHYME_TYPES } from "../data/rhymeScheme.patterns.js";
import { normalizeVowelFamily } from "./phonology/vowelFamily.js";
import { WORD_REGEX_GLOBAL } from "./wordTokenization.js";

/**
 * @typedef {object} WordPosition
 */

/**
 * @typedef {object} RhymeConnection
 */

/**
 * @typedef {object} LineAnalysis
 */

/**
 * @typedef {object} DocumentAnalysis
 */

const WORD_REGEX = WORD_REGEX_GLOBAL;
const RHYME_THRESHOLD = 0.60;
const ASSONANCE_THRESHOLD = 0.5;
const STRESSED_ASSONANCE_SCORE = 0.62;
const MAX_FULL_PAIR_SCAN_OCCURRENCES = 2;
const TRUESIGHT_RHYME_TYPES = new Set(['perfect', 'near', 'slant', 'assonance', 'identity']);
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
   * @returns {Promise<DocumentAnalysis>} Complete document analysis.
   */
  async analyzeDocument(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return this.emptyDocumentAnalysis();
    }

    const syntaxLayer = options?.syntaxLayer?.enabled ? options.syntaxLayer : null;
    const cacheKey = `${text.slice(0, 100)}${text.length}${syntaxLayer ? '|syntax:1' : '|syntax:0'}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    // --- BATCH TOKENIZATION & AUTHORITY LOADING ---
    // Extract all unique words to pre-fetch their authority data in one go.
    const allUniqueWords = [...new Set(text.match(WORD_REGEX) || [])];
    if (typeof this.engine.ensureAuthorityBatch === 'function') {
      await this.engine.ensureAuthorityBatch(allUniqueWords);
    }

    this.syntaxLayerContext = syntaxLayer;
    this.syntaxGateCounters = { enabled: Boolean(syntaxLayer), totalCandidates: 0, suppressedPairs: 0, weakenedPairs: 0, keptPairs: 0 };

    const rawLines = text.split('\n');
    const lines = [];
    let charOffset = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const lineText = rawLines[i];
      const lineAnalysis = this.analyzeLine(lineText, i, charOffset);
      lines.push(lineAnalysis);
      charOffset += lineText.length + 1;
    }

    const endRhymeConnections = this.findEndRhymeConnections(lines);
    const internalRhymeConnections = lines.flatMap(l => l.internalRhymes);
    const { rhymeGroups, schemePattern } = this.buildRhymeGroups(lines, endRhymeConnections);
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

  analyzeLine(lineText, lineIndex, charOffset = 0) {
    const words = [];
    const wordMatches = [...lineText.matchAll(WORD_REGEX)];
    let totalSyllables = 0;
    let stressPatterns = [];

    for (let i = 0; i < wordMatches.length; i++) {
      const match = wordMatches[i];
      const word = match[0];
      const charStart = charOffset + match.index;
      const deepAnalysis = this.engine.analyzeDeep(word);
      if (deepAnalysis) {
        totalSyllables += deepAnalysis.syllableCount;
        stressPatterns.push(deepAnalysis.stressPattern);
      }
      words.push({ word, lineIndex, wordIndex: i, charStart, charEnd: charStart + word.length, analysis: deepAnalysis, syntaxToken: this.getSyntaxToken(lineIndex, i, charStart) });
    }

    const internalRhymes = this.findInternalRhymes(words);
    const endWord = words.length > 0 ? words[words.length - 1] : null;
    return { lineIndex, text: lineText, words, syllableTotal: totalSyllables, stressPattern: stressPatterns.join(' '), internalRhymes, endRhymeKey: endWord?.analysis?.rhymeKey || null, endWord: endWord?.analysis || null };
  }

  getSyntaxToken(lineIndex, wordIndex, charStart) {
    const syntaxLayer = this.syntaxLayerContext;
    if (!syntaxLayer) return null;
    const identityKey = `${lineIndex}:${wordIndex}:${charStart}`;
    return syntaxLayer.tokenByIdentity?.get?.(identityKey) || syntaxLayer.tokenByCharStart?.get?.(charStart) || null;
  }

  findInternalRhymes(words) {
    const connections = [];
    if (words.length < 2) return connections;
    const buckets = this.buildPhoneticBuckets(words);
    const seenPairs = new Set();
    for (const [, groupWords] of buckets) {
      if (groupWords.length < 2) continue;
      this.collectGroupConnections(groupWords, connections, seenPairs);
    }
    return connections;
  }

  findEndRhymeConnections(lines) {
    const connections = [];
    const endWords = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const lastWord = lines[idx].words[lines[idx].words.length - 1];
      if (lastWord?.analysis) endWords.push({ ...lastWord, lineIndex: idx });
    }
    const buckets = this.buildPhoneticBuckets(endWords);
    const seenPairs = new Set();
    for (const [, groupWords] of buckets) {
      if (groupWords.length < 2) continue;
      this.collectGroupConnections(groupWords, connections, seenPairs);
    }
    return connections;
  }

  collectGroupConnections(groupWords, out, seenPairs = new Set()) {
    if (!Array.isArray(groupWords) || groupWords.length < 2) return;
    if (groupWords.length <= MAX_FULL_PAIR_SCAN_OCCURRENCES) {
      for (let i = 0; i < groupWords.length; i++) {
        for (let j = i + 1; j < groupWords.length; j++) this.pushConnectionIfValid(groupWords[i], groupWords[j], out, seenPairs);
      }
      return;
    }
    for (let i = 1; i < groupWords.length; i++) this.pushConnectionIfValid(groupWords[i - 1], groupWords[i], out, seenPairs);
  }

  pushConnectionIfValid(wordA, wordB, out, seenPairs = new Set()) {
    if (!wordA?.analysis || !wordB?.analysis) return;
    if (this.shouldSkipLexicalRepetition(wordA, wordB)) return;
    const pairKey = this.getPairKey(wordA, wordB);
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    const syntaxGate = this.syntaxLayerContext ? this.evaluateSyntaxGate(wordA, wordB) : null;
    if (syntaxGate) {
      this.recordSyntaxGateDecision(syntaxGate);
      if (syntaxGate.gate === SYNTAX_GATES.SUPPRESS) return;
    }
    const connection = this.scoreConnection(wordA, wordB, syntaxGate);
    if (this.isTruesightRhymeConnection(connection)) out.push(connection);
  }

  evaluateSyntaxGate(wordA, wordB) {
    const tokenA = wordA?.syntaxToken || null;
    const tokenB = wordB?.syntaxToken || null;
    if (!this.syntaxLayerContext) return { gate: SYNTAX_GATES.ALLOW, multiplier: 1, reasons: ['no_syntax_layer'] };
    if (!tokenA && !tokenB) return { gate: SYNTAX_GATES.ALLOW, multiplier: 1, reasons: ['missing_syntax_token'] };
    const aFunction = tokenA?.role === 'function', bFunction = tokenB?.role === 'function';
    const aLineEnd = tokenA?.lineRole === 'line_end', bLineEnd = tokenB?.lineRole === 'line_end';
    const hasFunctionNonEnd = (aFunction && !aLineEnd) || (bFunction && !bLineEnd);
    const isInternalPair = wordA?.lineIndex === wordB?.lineIndex;
    const hasLineAnchor = aLineEnd || bLineEnd || !isInternalPair;
    const phoneticAffinity = this.evaluatePhoneticAffinity(wordA?.analysis, wordB?.analysis);
    if (aFunction && bFunction && !aLineEnd && !bLineEnd) return { gate: SYNTAX_GATES.SUPPRESS, multiplier: 0, reasons: ['both_function_non_terminal'] };
    if (aFunction && bFunction && aLineEnd && bLineEnd) return { gate: SYNTAX_GATES.ALLOW_WEAK, multiplier: 0.9, reasons: ['both_function_line_end_exception'] };
    
    // Stem overlap check (same root words like baking/baked)
    if (tokenA?.stem && tokenB?.stem && tokenA.stem === tokenB.stem) {
      return { gate: SYNTAX_GATES.ALLOW_WEAK, multiplier: 0.5, reasons: ['stem_overlap'] };
    }

    if (hasFunctionNonEnd) {
      if (phoneticAffinity.sharedStressedFamily && hasLineAnchor) return { gate: SYNTAX_GATES.ALLOW_WEAK, multiplier: 0.97, reasons: ['contains_function_non_terminal', 'phonetic_affinity_override'] };
      return { gate: SYNTAX_GATES.ALLOW_WEAK, multiplier: 0.88, reasons: ['contains_function_non_terminal'] };
    }
    return { gate: SYNTAX_GATES.ALLOW, multiplier: 1, reasons: ['default_allow'] };
  }

  evaluatePhoneticAffinity(analysisA, analysisB) {
    if (!analysisA || !analysisB) return { sharedRhymeKey: false, sharedTerminalFamily: false, sharedStressedFamily: false };
    const stressedA = this.getPrimaryStressedVowelFamily(analysisA), stressedB = this.getPrimaryStressedVowelFamily(analysisB);
    return { sharedRhymeKey: analysisA.rhymeKey === analysisB.rhymeKey, sharedTerminalFamily: this.getTerminalVowelFamily(analysisA) === this.getTerminalVowelFamily(analysisB), sharedStressedFamily: stressedA === stressedB };
  }

  recordSyntaxGateDecision(syntaxGate) {
    if (!this.syntaxGateCounters?.enabled) return;
    this.syntaxGateCounters.totalCandidates += 1;
    if (syntaxGate?.gate === SYNTAX_GATES.SUPPRESS) this.syntaxGateCounters.suppressedPairs += 1;
    else if (syntaxGate?.gate === SYNTAX_GATES.ALLOW_WEAK) this.syntaxGateCounters.weakenedPairs += 1;
    else this.syntaxGateCounters.keptPairs += 1;
  }

  isTruesightRhymeConnection(connection) {
    if (!connection) return false;
    if (!TRUESIGHT_RHYME_TYPES.has(connection.type)) return false;
    if (connection.type === 'assonance') return Number(connection.score) > ASSONANCE_THRESHOLD;
    return Number(connection.score) >= RHYME_THRESHOLD;
  }

  shouldSkipLexicalRepetition(wordA, wordB) {
    if (!IGNORE_IDENTICAL_WORD_RHYMES) return false;
    const normalizedA = this.normalizeWord(wordA?.word), normalizedB = this.normalizeWord(wordB?.word);
    return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
  }

  normalizeWord(value) { return String(value || '').trim().toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, ''); }

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
      if (analysis.rhymeKey) addToBucket(`rhyme:${analysis.rhymeKey}`, word);
      const terminalVowel = this.getTerminalVowelFamilyRaw(analysis);
      if (terminalVowel) addToBucket(`vowel:${terminalVowel}`, word);
      const stressedVowel = this.getPrimaryStressedVowelFamilyRaw(analysis);
      if (stressedVowel) addToBucket(`stress:${stressedVowel}`, word);
    }
    return buckets;
  }

  getTerminalVowelFamilyRaw(analysis) {
    if (Array.isArray(analysis?.syllables) && analysis.syllables.length > 0) return analysis.syllables[analysis.syllables.length - 1]?.vowelFamily || null;
    return (typeof analysis?.rhymeKey === 'string' && analysis.rhymeKey.includes('-')) ? analysis.rhymeKey.split('-')[0] || null : null;
  }

  getPrimaryStressedVowelFamilyRaw(analysis) {
    if (!Array.isArray(analysis?.syllables) || analysis.syllables.length === 0) return this.getTerminalVowelFamilyRaw(analysis);
    const stressed = analysis.syllables.find((syl) => Number(syl?.stress) > 0) || analysis.syllables[0];
    return stressed?.vowelFamily || null;
  }

  getTerminalVowelFamily(analysis) {
    return normalizeVowelFamily(this.getTerminalVowelFamilyRaw(analysis));
  }

  getPrimaryStressedVowelFamily(analysis) {
    return normalizeVowelFamily(this.getPrimaryStressedVowelFamilyRaw(analysis));
  }

  calculatePhoneticWeight(analysis) {
    if (!analysis) return 0;
    const syllables = Array.isArray(analysis.syllables) ? analysis.syllables : [];
    const syllableWeight = Math.sqrt(syllables.length || 1);
    const stressWeight = syllables.reduce((acc, syl) => acc + (syl.stress > 0 ? 1.2 : 0.5), 0) / (syllables.length || 1);
    return syllableWeight * stressWeight;
  }

  getPairKey(wordA, wordB) {
    const idA = `${wordA.lineIndex}:${wordA.wordIndex}:${wordA.charStart}`, idB = `${wordB.lineIndex}:${wordB.wordIndex}:${wordB.charStart}`;
    return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  }

  scoreStressedAssonance(analysisA, analysisB) {
    const stressedA = this.getPrimaryStressedVowelFamily(analysisA), stressedB = this.getPrimaryStressedVowelFamily(analysisB);
    return (stressedA && stressedB && stressedA === stressedB) ? STRESSED_ASSONANCE_SCORE : 0;
  }

  scoreConnection(wordA, wordB, syntaxGate = null) {
    const analysisA = wordA.analysis, analysisB = wordB.analysis;
    if (!analysisA || !analysisB) return null;
    const normalizedA = this.normalizeWord(wordA.word), normalizedB = this.normalizeWord(wordB.word);
    const isIdentity = normalizedA === normalizedB;
    const multiMatch = this.engine.scoreMultiSyllableMatch(analysisA, analysisB);
    const stressedAssonanceScore = multiMatch.syllablesMatched === 0 ? this.scoreStressedAssonance(analysisA, analysisB) : 0;
    if (!isIdentity && multiMatch.syllablesMatched === 0 && stressedAssonanceScore <= 0) return null;
    let baseScore = Math.max(Number(multiMatch.score) || 0, stressedAssonanceScore);
    if (isIdentity) baseScore = 1.0;
    const multiplier = Number(syntaxGate?.multiplier);
    const connectionScore = baseScore * (Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1);
    const syllablesMatched = multiMatch.syllablesMatched > 0 ? multiMatch.syllablesMatched : (stressedAssonanceScore > 0 ? 1 : 0);
    const weightA = this.calculatePhoneticWeight(analysisA), weightB = this.calculatePhoneticWeight(analysisB);
    let type = 'consonance';
    if (isIdentity) type = 'identity';
    else if (connectionScore >= RHYME_TYPES.PERFECT.minScore) type = 'perfect';
    else if (connectionScore >= RHYME_TYPES.NEAR.minScore) type = 'near';
    else if (connectionScore >= RHYME_TYPES.SLANT.minScore) type = 'slant';
    else if (connectionScore >= RHYME_TYPES.ASSONANCE.minScore) type = 'assonance';
    return { type, subtype: multiMatch.type, score: connectionScore, syllablesMatched, phoneticWeight: (weightA + weightB) / 2, wordA: { lineIndex: wordA.lineIndex, wordIndex: wordA.wordIndex, charStart: wordA.charStart, charEnd: wordA.charEnd, word: wordA.word }, wordB: { lineIndex: wordB.lineIndex, wordIndex: wordB.wordIndex, charStart: wordB.charStart, charEnd: wordB.charEnd, word: wordB.word }, groupLabel: null, syntax: syntaxGate ? { gate: syntaxGate.gate || SYNTAX_GATES.ALLOW, multiplier: multiplier, reasons: Array.isArray(syntaxGate.reasons) ? syntaxGate.reasons : [] } : undefined };
  }

  buildRhymeGroups(lines, connections) {
    const rhymeGroups = new Map(), lineToGroup = new Map();
    let nextGroupIndex = 0;
    for (const conn of connections) {
      const lineA = conn.wordA.lineIndex, lineB = conn.wordB.lineIndex;
      const groupA = lineToGroup.get(lineA), groupB = lineToGroup.get(lineB);
      if (groupA === undefined && groupB === undefined) {
        const label = String.fromCharCode(65 + nextGroupIndex);
        lineToGroup.set(lineA, label); lineToGroup.set(lineB, label); rhymeGroups.set(label, [lineA, lineB]);
        nextGroupIndex++;
      } else if (groupA !== undefined && groupB === undefined) {
        lineToGroup.set(lineB, groupA); rhymeGroups.get(groupA).push(lineB);
      } else if (groupA === undefined && groupB !== undefined) {
        lineToGroup.set(lineA, groupB); rhymeGroups.get(groupB).push(lineA);
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (!lineToGroup.has(i) && lines[i].endWord) {
        const label = String.fromCharCode(65 + nextGroupIndex);
        lineToGroup.set(i, label); rhymeGroups.set(label, [i]);
        nextGroupIndex++;
      }
    }
    rhymeGroups.forEach((lineIndices) => lineIndices.sort((a, b) => a - b));
    const pattern = lines.map((_, i) => lineToGroup.get(i) || 'X').join('');
    return { rhymeGroups, schemePattern: pattern };
  }

  assignGroupLabels(connections, rhymeGroups) {
    for (const conn of connections) {
      for (const [label, lineIndices] of rhymeGroups) {
        if (lineIndices.includes(conn.wordA.lineIndex)) { conn.groupLabel = label; break; }
      }
    }
  }

  computeStatistics(lines, connections, syntaxGateCounters = null) {
    const stats = { totalLines: lines.length, totalWords: lines.reduce((sum, l) => sum + l.words.length, 0), totalSyllables: lines.reduce((sum, l) => sum + l.syllableTotal, 0), perfectCount: 0, nearCount: 0, slantCount: 0, internalCount: 0, multiSyllableCount: 0, endRhymeCount: 0, syntaxGating: { enabled: Boolean(syntaxGateCounters?.enabled), totalCandidates: Number(syntaxGateCounters?.totalCandidates) || 0, suppressedPairs: Number(syntaxGateCounters?.suppressedPairs) || 0, weakenedPairs: Number(syntaxGateCounters?.weakenedPairs) || 0, keptPairs: Number(syntaxGateCounters?.keptPairs) || 0 } };
    for (const conn of connections) {
      if (conn.type === 'perfect') stats.perfectCount++; else if (conn.type === 'near') stats.nearCount++; else if (conn.type === 'slant') stats.slantCount++;
      if (conn.syllablesMatched >= 2) stats.multiSyllableCount++;
      if (conn.wordA.lineIndex === conn.wordB.lineIndex) stats.internalCount++; else stats.endRhymeCount++;
    }
    return stats;
  }

  emptyDocumentAnalysis() { return { lines: [], endRhymeConnections: [], internalRhymeConnections: [], allConnections: [], rhymeGroups: new Map(), schemePattern: '', syntaxSummary: null, statistics: { totalLines: 0, totalWords: 0, totalSyllables: 0, perfectCount: 0, nearCount: 0, slantCount: 0, internalCount: 0, multiSyllableCount: 0, endRhymeCount: 0, syntaxGating: { enabled: false, totalCandidates: 0, suppressedPairs: 0, weakenedPairs: 0, keptPairs: 0 } } }; }
  clearCache() { this.analysisCache.clear(); }
}

export const deepRhymeEngine = new DeepRhymeEngine();
