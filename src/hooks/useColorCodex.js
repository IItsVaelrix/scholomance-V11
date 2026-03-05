import { useMemo, useCallback } from 'react';
import { buildColorMap } from '../lib/colorCodex';
import { normalizeVowelFamily } from '../lib/phonology/vowelFamily';

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
 * useColorCodex
 * Decoupled hook for managing phonetic color state and word eligibility.
 */
export function useColorCodex(analysisSources, activeConnections, palette, syntaxLayer = null, options = {}) {
  const { theme = 'dark', analysisMode = 'none' } = options;

  const wordAnalyses = useMemo(() => {
    if (Array.isArray(analysisSources)) return analysisSources;
    const combined = new Map();
    if (analysisSources && typeof analysisSources === 'object' && !(analysisSources instanceof Map)) {
      const { analyzedWords, analyzedWordsByCharStart, analyzedWordsByIdentity } = analysisSources;
      if (analyzedWords instanceof Map) for (const [k, v] of analyzedWords) combined.set(k, v);
      if (analyzedWordsByCharStart instanceof Map) for (const [k, v] of analyzedWordsByCharStart) combined.set(k, { ...v, charStart: k });
      if (analyzedWordsByIdentity instanceof Map) for (const [k, v] of analyzedWordsByIdentity) combined.set(k, v);
      return Array.from(combined.values());
    }
    if (analysisSources instanceof Map) {
        return Array.from(analysisSources.entries()).map(([k, v]) => ({
            ...v,
            normalizedWord: typeof k === 'string' ? k : v.normalizedWord,
            charStart: typeof k === 'number' ? k : v.charStart
        }));
    }
    return [];
  }, [analysisSources]);

  const colorMap = useMemo(() => {
    if (wordAnalyses.length === 0 || !palette) return new Map();
    return buildColorMap(wordAnalyses, activeConnections, palette, {
      theme,
      analysisMode,
      syntaxLayer,
    });
  }, [wordAnalyses, activeConnections, palette, theme, analysisMode, syntaxLayer]);

  const colorContext = useMemo(() => {
    const connectedTokenCharStarts = new Set();
    const substitutionFamilies = new Set();
    // Families that have at least one non-stop word directly in a connection.
    // These families should NOT broaden to all peers — only direct participants get colored.
    const directNonStopFamilies = new Set();
    const connections = Array.isArray(activeConnections) ? activeConnections : [];

    const resolveWordFamilyInternal = (wordRef) => {
      if (!wordRef) return null;
      const direct = normalizeVowelFamily(wordRef.vowelFamily);
      if (direct) return direct;
      const clean = (wordRef.normalizedWord || wordRef.word || "").toUpperCase();
      if (analysisSources) {
        if (analysisSources instanceof Map) {
           const fromWord = analysisSources.get(clean);
           if (fromWord) return normalizeVowelFamily(fromWord.vowelFamily);
        } else if (typeof analysisSources === 'object') {
          const { analyzedWordsByCharStart, analyzedWords } = analysisSources;
          if (Number.isInteger(wordRef.charStart)) {
            const fromCS = analyzedWordsByCharStart?.get(wordRef.charStart);
            if (fromCS) return normalizeVowelFamily(fromCS.vowelFamily);
          }
          if (clean) {
            const fromWord = analyzedWords?.get(clean);
            if (fromWord) return normalizeVowelFamily(fromWord.vowelFamily);
          }
        }
      }
      return null;
    };

    if (connections.length === 0) {
      return { connectedTokenCharStarts, substitutionFamilies, directNonStopFamilies };
    }

    // Resolve the normalized word for a connection ref, falling back to analysisSources
    const resolveNormalizedWord = (wordRef) => {
      if (!wordRef) return "";
      const direct = (wordRef.normalizedWord || wordRef.word || "").toUpperCase();
      if (direct) return direct;
      // Fall back to analysisSources by charStart
      if (Number.isInteger(wordRef.charStart) && analysisSources) {
        if (analysisSources instanceof Map) {
          for (const [key, val] of analysisSources) {
            if (typeof key === 'string' && val?.charStart === wordRef.charStart) return key;
          }
        } else if (typeof analysisSources === 'object') {
          const fromCS = analysisSources.analyzedWordsByCharStart?.get(wordRef.charStart);
          if (fromCS) return (fromCS.normalizedWord || fromCS.word || "").toUpperCase();
          // Search analyzedWords map for matching charStart
          if (analysisSources.analyzedWords) {
            for (const [key, val] of analysisSources.analyzedWords) {
              if (val?.charStart === wordRef.charStart) return key;
            }
          }
        }
      }
      return "";
    };

    for (const conn of connections) {
      const register = (wordRef) => {
        if (!wordRef) return;
        if (Number.isInteger(wordRef.charStart)) connectedTokenCharStarts.add(wordRef.charStart);
        const family = resolveWordFamilyInternal(wordRef);
        if (family) {
          substitutionFamilies.add(family);
          const norm = resolveNormalizedWord(wordRef);
          if (norm && !STOP_WORDS.has(norm)) {
            directNonStopFamilies.add(family);
          }
        }
      };
      register(conn.wordA);
      register(conn.wordB);
    }

    return { connectedTokenCharStarts, substitutionFamilies, directNonStopFamilies };
  }, [activeConnections, analysisSources]);

  const shouldColorWord = useCallback((charStart, normalizedWord, vowelFamily) => {
    const isStopWord = STOP_WORDS.has(normalizedWord);
    const codexEntry = Number.isInteger(charStart) ? colorMap.get(charStart) : null;
    const passesGhostFloor = !codexEntry || codexEntry.isAnchor || Number(codexEntry.salience) >= 0.15;
    
    // Explicit VOWEL mode: Color all content words
    if (analysisMode === 'vowel') {
      if (isStopWord) return false;
      return passesGhostFloor;
    }

    // Explicit RHYME mode or DEFAULT (if connections exist)
    const isRhymeMode = analysisMode === 'rhyme' || (analysisMode === 'none' && activeConnections.length > 0);
    
    if (isRhymeMode) {
      const family = normalizeVowelFamily(vowelFamily);
      const isPeer = family && colorContext.substitutionFamilies.has(family);

      const syntaxToken = syntaxLayer?.tokenByCharStart?.get(charStart);
      if (syntaxToken?.rhymePolicy === "suppress") return false;

      if (isStopWord) return false;

      // If this word is directly part of a connection, always color it
      if (colorContext.connectedTokenCharStarts.has(charStart)) return true;

      // Only broaden to family peers when the family has no non-stop direct participant.
      // This prevents coloring all EH words when "echo" (non-stop) already represents EH.
      if (isPeer && colorContext.directNonStopFamilies.has(family)) return false;

      if (!isPeer) return false;

      return passesGhostFloor;
    }

    return false;
  }, [colorContext, analysisMode, activeConnections, syntaxLayer, colorMap]);

  return { colorMap, shouldColorWord };
}
