import { analyzeLinePhonology } from "./phonology.js";

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeLineRecords(lines) {
  if (!Array.isArray(lines)) return [];

  return lines
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          id: `doc_001:${index}`,
          documentId: "doc_001",
          documentTitle: "Untitled",
          lineIndex: index,
          sectionLabel: null,
          text: entry,
        };
      }

      if (!entry || typeof entry !== "object") return null;

      return {
        id: String(entry.id || `${entry.documentId || "doc_001"}:${entry.lineIndex ?? index}`),
        documentId: String(entry.documentId || "doc_001"),
        documentTitle: String(entry.documentTitle || "Untitled"),
        lineIndex: Number.isInteger(entry.lineIndex) ? entry.lineIndex : index,
        sectionLabel: entry.sectionLabel || null,
        text: String(entry.text || ""),
      };
    })
    .filter((entry) => entry && entry.text.trim().length > 0);
}

function detectRefrainTags(lineRecords, options = {}) {
  const minOccurrences = Math.max(2, Number(options.minOccurrences) || 2);
  const maxSequenceLength = Math.max(1, Number(options.maxSequenceLength) || 3);
  const minTokens = Math.max(2, Number(options.minTokens) || 3);

  const tags = lineRecords.map(() => ({
    isRefrain: false,
    refrainId: null,
    motifText: null,
    sequenceLength: 0,
  }));

  const normalized = lineRecords.map((line) => normalizeKey(line.text));

  for (let sequenceLength = maxSequenceLength; sequenceLength >= 1; sequenceLength -= 1) {
    const sequences = new Map();
    for (let start = 0; start <= normalized.length - sequenceLength; start += 1) {
      const window = normalized.slice(start, start + sequenceLength);
      if (!window.every(Boolean)) continue;
      const tokenCount = window.join(" ").split(" ").filter(Boolean).length;
      if (tokenCount < minTokens) continue;

      const key = window.join(" || ");
      if (!sequences.has(key)) sequences.set(key, []);
      sequences.get(key).push(start);
    }

    for (const [key, starts] of sequences.entries()) {
      if (starts.length < minOccurrences) continue;
      const refrainId = `refrain_${stableHash(`${sequenceLength}:${key}`).slice(0, 10)}`;

      for (const start of starts) {
        for (let offset = 0; offset < sequenceLength; offset += 1) {
          const index = start + offset;
          const existing = tags[index];
          if (existing.sequenceLength > sequenceLength) continue;
          tags[index] = {
            isRefrain: true,
            refrainId,
            motifText: key,
            sequenceLength,
          };
        }
      }
    }
  }

  return tags;
}

/**
 * Build supervised context -> next-rhyme pairs.
 *
 * @param {Array<string|object>} lines
 * @param {number} [windowSize=4]
 * @param {{ allowEmptyContext?: boolean, refrain?: { minOccurrences?: number, maxSequenceLength?: number, minTokens?: number } }} [options]
 */
export function buildPairs(lines, windowSize = 4, options = {}) {
  const maxWindow = Math.max(1, Number(windowSize) || 4);
  const allowEmptyContext = Boolean(options.allowEmptyContext);

  const normalizedLines = normalizeLineRecords(lines).map((line) => ({
    ...line,
    analysis: analyzeLinePhonology(line.text),
  }));

  const tags = normalizedLines.map(() => ({
    isRefrain: false,
    refrainId: null,
    motifText: null,
    sequenceLength: 0,
  }));

  const indicesByDocument = new Map();
  normalizedLines.forEach((line, index) => {
    if (!indicesByDocument.has(line.documentId)) indicesByDocument.set(line.documentId, []);
    indicesByDocument.get(line.documentId).push(index);
  });

  for (const indices of indicesByDocument.values()) {
    const subset = indices.map((index) => normalizedLines[index]);
    const subsetTags = detectRefrainTags(subset, options.refrain || {});
    subsetTags.forEach((tag, localIndex) => {
      tags[indices[localIndex]] = tag;
    });
  }

  const pairs = [];
  for (let index = 0; index < normalizedLines.length; index += 1) {
    const current = normalizedLines[index];
    if (!current.analysis?.rhymeKey) continue;

    const context = [];
    for (let cursor = index - 1; cursor >= 0 && context.length < maxWindow; cursor -= 1) {
      const prior = normalizedLines[cursor];
      if (prior.documentId !== current.documentId) break;
      context.unshift(prior);
    }

    if (!allowEmptyContext && context.length === 0) continue;

    const tag = tags[index] || {
      isRefrain: false,
      refrainId: null,
      motifText: null,
    };

    pairs.push({
      id: current.id,
      documentId: current.documentId,
      documentTitle: current.documentTitle,
      lineIndex: current.lineIndex,
      sectionLabel: current.sectionLabel,
      context: context.map((entry) => entry.text),
      contextRhymeKeys: context.map((entry) => entry.analysis?.rhymeKey || "UNK"),
      targetLine: current.text,
      targetEndWord: current.analysis.endWord,
      targetRhymeKey: current.analysis.rhymeKey,
      styleVector: current.analysis.styleVector,
      isRefrain: Boolean(tag.isRefrain),
      refrainId: tag.refrainId || null,
      motifText: tag.motifText || null,
    });
  }

  return pairs;
}
