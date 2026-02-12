import { stemWord } from "../../codex/core/analysis.pipeline.js";

const FUNCTION_WORDS = new Set([
  "a", "an", "the",
  "i", "me", "my", "mine", "we", "us", "our", "ours",
  "you", "your", "yours",
  "he", "him", "his", "she", "her", "hers",
  "it", "its",
  "they", "them", "their", "theirs",
  "am", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "will", "would", "shall", "should",
  "can", "could", "may", "might", "must",
  "in", "on", "at", "to", "for", "of", "by", "from", "up",
  "with", "as", "into", "but", "or", "and", "so", "if",
  "not", "no", "nor", "than", "that", "this", "these", "those",
  "what", "when", "where", "who", "how", "which",
  "about", "just", "very", "too", "also",
]);

function createEmptyCounts() {
  return {
    roleCounts: { content: 0, function: 0 },
    lineRoleCounts: { line_start: 0, line_mid: 0, line_end: 0 },
    stressRoleCounts: { primary: 0, secondary: 0, unstressed: 0, unknown: 0 },
    rhymePolicyCounts: { allow: 0, allow_weak: 0, suppress: 0 },
    reasonCounts: {},
  };
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, "");
}

function resolveLineRole(wordIndex, wordCount) {
  if (!Number.isInteger(wordIndex) || !Number.isInteger(wordCount) || wordCount <= 0) {
    return "line_mid";
  }
  if (wordIndex <= 0) return "line_start";
  if (wordIndex >= wordCount - 1) return "line_end";
  return "line_mid";
}

function inferStressRole(analyzedWord) {
  const syllables = Array.isArray(analyzedWord?.deepPhonetics?.syllables)
    ? analyzedWord.deepPhonetics.syllables
    : [];
  if (syllables.length > 0) {
    const stresses = syllables.map((syllable) => Number(syllable?.stress) || 0);
    if (stresses.some((stress) => stress === 1)) return "primary";
    if (stresses.some((stress) => stress === 2)) return "secondary";
    if (stresses.some((stress) => stress === 0)) return "unstressed";
  }

  const pattern = String(analyzedWord?.stressPattern || "");
  if (pattern.includes("1")) return "primary";
  if (pattern.includes("2")) return "secondary";
  if (pattern.includes("0")) return "unstressed";

  return "unknown";
}

function inferRole(analyzedWord, normalized) {
  if (analyzedWord?.isStopWord === true) return "function";
  if (analyzedWord?.isContentWord === true) return "content";
  if (analyzedWord?.isContentWord === false) return "function";
  if (FUNCTION_WORDS.has(normalized)) return "function";
  return normalized.length >= 3 ? "content" : "function";
}

function incrementCount(record, key) {
  if (!record || !key) return;
  record[key] = (record[key] || 0) + 1;
}

function getIdentityKey(lineNumber, wordIndex, charStart) {
  return `${lineNumber}:${wordIndex}:${charStart}`;
}

export function classifySyntaxToken(analyzedWord, lineContext = {}) {
  const normalized = normalizeToken(analyzedWord?.normalized || analyzedWord?.text);
  const wordIndex = Number.isInteger(lineContext.wordIndex) ? lineContext.wordIndex : -1;
  const lineWordCount = Number.isInteger(lineContext.lineWordCount) ? lineContext.lineWordCount : 0;
  const lineRole = resolveLineRole(wordIndex, lineWordCount);
  const role = inferRole(analyzedWord, normalized);
  const stressRole = inferStressRole(analyzedWord);
  const stem = normalized ? stemWord(normalized) : "";
  const reasons = [];

  let rhymePolicy = "allow";
  if (role === "function" && lineRole !== "line_end") {
    rhymePolicy = "suppress";
    reasons.push("function_non_terminal");
  } else if (role === "function" && lineRole === "line_end") {
    rhymePolicy = "allow_weak";
    reasons.push("function_line_end_exception");
  } else {
    reasons.push("content_default");
  }

  return {
    word: analyzedWord?.text || "",
    normalized,
    lineNumber: Number.isInteger(lineContext.lineNumber) ? lineContext.lineNumber : (analyzedWord?.lineNumber ?? -1),
    wordIndex,
    charStart: Number.isInteger(analyzedWord?.start) ? analyzedWord.start : -1,
    charEnd: Number.isInteger(analyzedWord?.end) ? analyzedWord.end : -1,
    role,
    lineRole,
    stressRole,
    stem,
    rhymePolicy,
    reasons,
  };
}

export function buildSyntaxLayer(analyzedDoc) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  const tokens = [];
  const tokenByIdentity = new Map();
  const tokenByCharStart = new Map();
  const counts = createEmptyCounts();

  for (const line of lines) {
    const lineWords = Array.isArray(line?.words) ? line.words : [];
    const lineNumber = Number.isInteger(line?.number) ? line.number : -1;

    for (let wordIndex = 0; wordIndex < lineWords.length; wordIndex += 1) {
      const analyzedWord = lineWords[wordIndex];
      const token = classifySyntaxToken(analyzedWord, {
        lineNumber,
        wordIndex,
        lineWordCount: lineWords.length,
      });

      tokens.push(token);
      const key = getIdentityKey(token.lineNumber, token.wordIndex, token.charStart);
      tokenByIdentity.set(key, token);
      if (Number.isInteger(token.charStart) && token.charStart >= 0) {
        tokenByCharStart.set(token.charStart, token);
      }

      incrementCount(counts.roleCounts, token.role);
      incrementCount(counts.lineRoleCounts, token.lineRole);
      incrementCount(counts.stressRoleCounts, token.stressRole);
      incrementCount(counts.rhymePolicyCounts, token.rhymePolicy);
      token.reasons.forEach((reason) => incrementCount(counts.reasonCounts, reason));
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

export function getSyntaxIdentityKey(lineNumber, wordIndex, charStart) {
  return getIdentityKey(lineNumber, wordIndex, charStart);
}
