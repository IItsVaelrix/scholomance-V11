import { stemWord } from "../../codex/core/analysis.pipeline.js";

/**
 * Strict set of English function words (closed-class tokens).
 */
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "than",
  "i", "me", "my", "mine", "you", "your", "yours", "we", "us", "our", "ours",
  "he", "him", "his", "she", "her", "hers", "they", "them", "their", "theirs",
  "it", "its", "this", "that", "these", "those",
  "am", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "done",
  "to", "of", "in", "on", "at", "for", "from", "with", "by", "as",
  "not", "no", "so", "too", "very", "just", "can", "could", "would", "should",
  "will", "shall", "might", "may", "must"
]);

/**
 * Lexical triggers for specific part-of-speech context.
 */
const VERB_TRIGGERS = new Set(["to", "will", "would", "shall", "should", "can", "could", "must", "may", "might"]);
const NOUN_TRIGGERS = new Set(["the", "a", "an", "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"]);

/**
 * Enhanced Syntax Layer Analyzer
 * Performs context-aware parsing and robust token classification.
 */
export class SyntaxAnalyzer {
  /**
   * Normalizes a token for linguistic comparison.
   * @param {string} value 
   */
  static normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^[^a-z']+|[^a-z']+$/g, "");
  }
}

/**
 * Refined buildSyntaxLayer using multi-pass context awareness.
 */
export function buildSyntaxLayer(analyzedDoc) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  const tokens = [];
  const tokenByIdentity = new Map();
  const tokenByCharStart = new Map();
  
  const counts = {
    roleCounts: { content: 0, function: 0 },
    lineRoleCounts: { line_start: 0, line_mid: 0, line_end: 0 },
    stressRoleCounts: { primary: 0, secondary: 0, unstressed: 0, unknown: 0 },
    rhymePolicyCounts: { allow: 0, allow_weak: 0, suppress: 0 },
    reasonCounts: {},
  };

  const registerToken = (token) => {
    tokens.push(token);
    const key = `${token.lineNumber}:${token.wordIndex}:${token.charStart}`;
    tokenByIdentity.set(key, token);
    if (token.charStart >= 0) tokenByCharStart.set(token.charStart, token);
    
    counts.roleCounts[token.role]++;
    counts.lineRoleCounts[token.lineRole]++;
    counts.stressRoleCounts[token.stressRole]++;
    counts.rhymePolicyCounts[token.rhymePolicy]++;
    token.reasons.forEach(r => {
      counts.reasonCounts[r] = (counts.reasonCounts[r] || 0) + 1;
    });
  };

  // Pass 1: Local Context Classification
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    const lineWords = Array.isArray(line?.words) ? line.words : [];
    const lineNum = Number.isInteger(line?.number) ? line.number : lIdx;

    for (let wIdx = 0; wIdx < lineWords.length; wIdx++) {
      const analyzedWord = lineWords[wIdx];
      const prevWord = wIdx > 0 ? lineWords[wIdx - 1] : null;

      const normalized = SyntaxAnalyzer.normalize(analyzedWord.text);
      const prevNorm = prevWord ? SyntaxAnalyzer.normalize(prevWord.text) : "";
      
      const reasons = [];
      let role = "content";
      let rhymePolicy = "allow";

      // 1. Initial Function Word Check
      const isFunction = FUNCTION_WORDS.has(normalized);
      if (isFunction) {
        role = "function";
        reasons.push("closed_class_token");
      }

      // 2. Contextual Override (Sight-based)
      if (prevNorm && NOUN_TRIGGERS.has(prevNorm)) {
          reasons.push("noun_precursor_context");
          if (role === "function") role = "content"; 
      } else if (prevNorm && VERB_TRIGGERS.has(prevNorm)) {
          reasons.push("verb_precursor_context");
          role = "content"; 
      }

      // 3. Morphological Suffix Check
      if (normalized.endsWith("ing") || normalized.endsWith("ed")) {
          reasons.push("morphological_suffix");
          role = "content";
      }

      // 4. Line Positioning
      let lineRole = "line_mid";
      if (wIdx === 0 && lineWords.length === 1) lineRole = "line_end"; // Edge case
      else if (wIdx === 0) lineRole = "line_start";
      else if (wIdx === lineWords.length - 1) lineRole = "line_end";

      // 5. Stress Role
      let stressRole = "unknown";
      const stresses = analyzedWord.deepPhonetics?.syllables?.map(s => s.stress) || [];
      if (stresses.includes(1)) stressRole = "primary";
      else if (stresses.includes(2)) stressRole = "secondary";
      else if (stresses.includes(0)) stressRole = "unstressed";

      // 6. Policy Finalization
      if (role === "function" && lineRole !== "line_end") {
        rhymePolicy = "suppress";
        reasons.push("function_non_terminal");
      } else if (role === "function" && lineRole === "line_end") {
        rhymePolicy = "allow_weak";
        reasons.push("function_line_end_exception");
      } else {
        reasons.push("content_default");
      }

      registerToken({
        word: analyzedWord.text,
        normalized,
        lineNumber: lineNum,
        wordIndex: wIdx,
        charStart: analyzedWord.start,
        charEnd: analyzedWord.end,
        role,
        lineRole,
        stressRole,
        stem: stemWord(normalized),
        rhymePolicy,
        reasons
      });
    }
  }

  return {
    enabled: tokens.length > 0,
    tokens,
    tokenByIdentity,
    tokenByCharStart,
    syntaxSummary: {
      enabled: tokens.length > 0,
      tokenCount: tokens.length,
      ...counts,
      tokens,
    },
  };
}

/**
 * Legacy compatibility export.
 */
export function classifySyntaxToken(analyzedWord, lineContext = {}) {
    const wordIndex = Number.isInteger(lineContext.wordIndex) ? lineContext.wordIndex : 0;
    const lineWordCount = Number.isInteger(lineContext.lineWordCount) ? lineContext.lineWordCount : 1;
    
    // Create a line with dummy words to satisfy lineWordCount for role logic
    const dummyWords = new Array(lineWordCount).fill(null).map((_, i) => 
        i === wordIndex ? analyzedWord : { text: "dummy" }
    );
    
    const dummyDoc = { lines: [{ words: dummyWords, number: lineContext.lineNumber || 0 }] };
    const layer = buildSyntaxLayer(dummyDoc);
    return layer.tokens[wordIndex];
}

export function getSyntaxIdentityKey(lineNumber, wordIndex, charStart) {
  return `${lineNumber}:${wordIndex}:${charStart}`;
}
