import fs from "node:fs";
import path from "node:path";

const SONG_HEADER_REGEX = /^\s*(\d+)\s*[.)]\s+(.+?)\s*$/;
const SECTION_MARKER_REGEX = /^\s*\[(.+?)\]\s*$/;

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toDocId(index) {
  return `doc_${String(index).padStart(3, "0")}`;
}

function inferTitleFromHeader(line) {
  const match = String(line || "").match(SONG_HEADER_REGEX);
  if (!match) return null;
  return {
    number: Number(match[1]) || null,
    title: normalizeLineText(match[2]),
  };
}

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "untitled";
}

async function extractDocxTextFromPath(filePath) {
  let mammoth;
  try {
    mammoth = await import("mammoth");
  } catch (error) {
    throw new Error(
      "DOCX parsing needs optional dependency `mammoth`. Install it or pass plain text/markdown input."
    );
  }

  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeWhitespace(result?.value || "");
}

async function extractDocxTextFromBuffer(buffer) {
  let mammoth;
  try {
    mammoth = await import("mammoth");
  } catch (error) {
    throw new Error(
      "DOCX parsing needs optional dependency `mammoth`. Install it or pass plain text/markdown input."
    );
  }

  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result?.value || "");
}

async function resolveInputText(source) {
  if (Buffer.isBuffer(source)) {
    return extractDocxTextFromBuffer(source);
  }

  if (typeof source !== "string") {
    throw new TypeError("parseDocxToLines expects a filepath, raw text, or Buffer.");
  }

  const looksLikeRawText = source.includes("\n");
  if (looksLikeRawText && !fs.existsSync(source)) {
    return normalizeWhitespace(source);
  }

  const absolutePath = path.resolve(source);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Input not found: ${absolutePath}`);
  }

  if (absolutePath.toLowerCase().endsWith(".docx")) {
    return extractDocxTextFromPath(absolutePath);
  }

  return normalizeWhitespace(fs.readFileSync(absolutePath, "utf8"));
}

/**
 * Converts raw text to line records with document and section boundaries.
 * Supports:
 * - .docx files (via optional `mammoth`)
 * - plain text/markdown files
 * - raw text input
 *
 * @param {string|Buffer} source
 * @param {{ includeSectionMarkers?: boolean, minChars?: number }} [options]
 * @returns {Promise<Array<{
 *   id: string,
 *   documentId: string,
 *   documentTitle: string,
 *   documentNumber: number|null,
 *   lineIndex: number,
 *   sectionLabel: string|null,
 *   text: string,
 *   normalizedText: string
 * }>>}
 */
export async function parseDocxToLines(source, options = {}) {
  const includeSectionMarkers = Boolean(options.includeSectionMarkers);
  const minChars = Math.max(1, Number(options.minChars) || 1);

  const text = await resolveInputText(source);
  const rawLines = String(text || "").split("\n");

  const result = [];
  let documentCounter = 1;
  let activeDocumentId = toDocId(documentCounter);
  let activeDocumentTitle = "Untitled";
  let activeDocumentNumber = null;
  let lineIndex = 0;
  let sectionLabel = null;

  for (const rawLine of rawLines) {
    const line = normalizeLineText(rawLine);
    if (!line) continue;

    const header = inferTitleFromHeader(line);
    if (header) {
      activeDocumentNumber = header.number;
      activeDocumentTitle = header.title || `Track ${header.number || documentCounter}`;
      activeDocumentId = `${toDocId(documentCounter)}_${safeSlug(activeDocumentTitle)}`;
      documentCounter += 1;
      lineIndex = 0;
      sectionLabel = null;
      continue;
    }

    const section = line.match(SECTION_MARKER_REGEX);
    if (section) {
      sectionLabel = normalizeLineText(section[1]) || null;
      if (!includeSectionMarkers) continue;
    }

    if (line.length < minChars) continue;

    result.push({
      id: `${activeDocumentId}:${lineIndex}`,
      documentId: activeDocumentId,
      documentTitle: activeDocumentTitle,
      documentNumber: activeDocumentNumber,
      lineIndex,
      sectionLabel,
      text: line,
      normalizedText: line.toLowerCase(),
    });

    lineIndex += 1;
  }

  return result;
}

