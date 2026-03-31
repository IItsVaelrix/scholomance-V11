import { useMemo, useCallback } from 'react';
import { normalizeVowelFamily } from '../lib/phonology/vowelFamily';
import { VOWEL_FAMILY_TO_SCHOOL } from '../data/schools.js';

const STOP_WORDS = new Set([
  "A", "AN", "THE",
  "I", "ME", "MY", "WE", "US", "OUR",
  "YOU", "YOUR",
  "HE", "HIM", "HIS", "SHE", "HER",
  "IT", "ITS",
  "THEY", "THEM", "THEIR",
  "AM", "IS", "ARE", "WAS", "WERE", "BE", "BEEN", "BEING",
  "HAS", "HAVE", "HAD",
  "DO", "DOES", "DID",
  "WILL", "WOULD", "SHALL", "SHOULD",
  "CAN", "COULD", "MAY", "MIGHT", "MUST",
  "IN", "ON", "AT", "TO", "FOR", "OF", "BY", "FROM", "UP",
  "WITH", "AS", "INTO", "BUT", "OR", "AND", "SO", "IF",
  "NOT", "NO", "NOR",
  "THAT", "THIS", "THAN",
  "WHAT", "WHEN", "WHERE", "WHO", "HOW", "WHICH",
  "ABOUT", "JUST", "VERY", "TOO", "ALSO",
]);

/**
 * useColorCodex — Bytecode-native hook for phonetic color state.
 * 
 * Consumes VisualBytecode from wordAnalyses (produced by Codex VerseIR amplifier).
 * No longer builds legacy colorMap — bytecode is authoritative.
 */
export function useColorCodex(wordAnalyses, activeConnections, syntaxLayer = null, options = {}) {
  const { analysisMode = 'none' } = options;

  // Build charStart -> bytecode lookup from wordAnalyses
  const bytecodeByCharStart = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(wordAnalyses)) return map;

    for (const analysis of wordAnalyses) {
      const charStart = Number(analysis?.charStart);
      if (!Number.isInteger(charStart) || charStart < 0) continue;

      // Prioritize visualBytecode, fall back to trueVisionBytecode
      const bytecode = analysis?.visualBytecode || analysis?.trueVisionBytecode || null;
      if (bytecode) {
        map.set(charStart, { bytecode, analysis });
      }
    }

    return map;
  }, [wordAnalyses]);

  // Build connection context for rhyme mode coloring
  const colorContext = useMemo(() => {
    const connectedTokenCharStarts = new Set();
    const substitutionFamilies = new Set();
    const directNonStopFamilies = new Set();
    const connections = Array.isArray(activeConnections) ? activeConnections : [];

    if (connections.length === 0) {
      return { connectedTokenCharStarts, substitutionFamilies, directNonStopFamilies };
    }

    for (const conn of connections) {
      const register = (wordRef) => {
        if (!wordRef) return;
        const charStart = Number(wordRef?.charStart);
        if (Number.isInteger(charStart) && charStart >= 0) {
          connectedTokenCharStarts.add(charStart);
        }
        const family = normalizeVowelFamily(wordRef?.vowelFamily);
        if (family) {
          substitutionFamilies.add(family);
          const norm = (wordRef?.normalizedWord || wordRef?.word || "").toUpperCase();
          if (norm && !STOP_WORDS.has(norm)) {
            directNonStopFamilies.add(family);
          }
        }
      };
      register(conn.wordA);
      register(conn.wordB);
    }

    return { connectedTokenCharStarts, substitutionFamilies, directNonStopFamilies };
  }, [activeConnections]);

  /**
   * Determines if a word should be colored based on its bytecode and analysis mode.
   * 
   * @param {number} charStart - Character offset of the word
   * @param {string} normalizedWord - Uppercase normalized word
   * @param {string} vowelFamily - Vowel family identifier
   * @returns {boolean} - True if the word should be colored
   */
  const shouldColorWord = useCallback((charStart, normalizedWord, vowelFamily) => {
    const isStopWord = STOP_WORDS.has(normalizedWord);
    const entry = bytecodeByCharStart.get(charStart);
    const bytecode = entry?.bytecode;

    // No bytecode = no color (unless in vowel mode with content word)
    if (!bytecode) {
      if (analysisMode === 'vowel' && !isStopWord) {
        // In vowel mode, color content words by their family even without bytecode
        return !!vowelFamily;
      }
      return false;
    }

    // INERT bytecode = never color
    if (bytecode.effectClass === 'INERT') {
      return false;
    }

    // VOWEL mode: color all non-stop words with valid bytecode
    if (analysisMode === 'vowel') {
      return !isStopWord;
    }

    // RHYME mode: color based on connection participation
    const isRhymeMode = analysisMode === 'rhyme' || (analysisMode === 'none' && activeConnections.length > 0);

    if (isRhymeMode) {
      // Direct connection participants always get colored
      if (colorContext.connectedTokenCharStarts.has(charStart)) {
        return true;
      }

      // Check syntax suppression
      const syntaxToken = syntaxLayer?.tokenByCharStart?.get(charStart);
      if (syntaxToken?.rhymePolicy === "suppress") {
        return false;
      }

      // Stop words never get colored in rhyme mode
      if (isStopWord) {
        return false;
      }

      // Family peers: only color if family has no non-stop direct participant
      const family = normalizeVowelFamily(vowelFamily);
      const isPeer = family && colorContext.substitutionFamilies.has(family);
      if (isPeer && colorContext.directNonStopFamilies.has(family)) {
        return false;
      }

      // Color if has resonance (glowIntensity > 0) and is a peer
      if (isPeer && bytecode.glowIntensity > 0) {
        return true;
      }

      return false;
    }

    // Default: color if bytecode has any resonance signal
    return bytecode.glowIntensity > 0 || bytecode.effectClass !== 'INERT';
  }, [bytecodeByCharStart, colorContext, analysisMode, activeConnections, syntaxLayer]);

  /**
   * Retrieves bytecode and derived color info for a word.
   * 
   * @param {number} charStart - Character offset of the word
   * @returns {{ bytecode: object|null, analysis: object|null, school: string|null, color: string|null }}
   */
  const getBytecodeForWord = useCallback((charStart) => {
    const entry = bytecodeByCharStart.get(charStart);
    if (!entry) {
      return { bytecode: null, analysis: null, school: null, color: null };
    }

    const { bytecode, analysis } = entry;
    const school = bytecode?.school || (analysis?.vowelFamily ? VOWEL_FAMILY_TO_SCHOOL[normalizeVowelFamily(analysis.vowelFamily)] : null) || null;
    const color = bytecode?.color || null;

    return { bytecode, analysis, school, color };
  }, [bytecodeByCharStart]);

  return { 
    bytecodeByCharStart, 
    shouldColorWord,
    getBytecodeForWord,
  };
}
