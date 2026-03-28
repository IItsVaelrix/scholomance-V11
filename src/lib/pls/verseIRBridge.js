import { normalizeVowelFamily } from '../phonology/vowelFamily.js';

function normalizeToken(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeTokenList(values) {
  const seen = new Set();
  const tokens = [];

  (Array.isArray(values) ? values : []).forEach((value) => {
    const token = normalizeToken(value);
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  });

  return tokens;
}

function sortNumericList(values) {
  return [...values].sort((a, b) => a - b);
}

function buildCompilerSnapshot(compiler) {
  if (!compiler || typeof compiler !== 'object') {
    return null;
  }

  return Object.freeze({
    verseIRVersion: String(compiler.verseIRVersion || ''),
    mode: String(compiler.mode || ''),
    tokenCount: Number.isFinite(Number(compiler.tokenCount)) ? Number(compiler.tokenCount) : 0,
    lineCount: Number.isFinite(Number(compiler.lineCount)) ? Number(compiler.lineCount) : 0,
    syllableWindowCount: Number.isFinite(Number(compiler.syllableWindowCount))
      ? Number(compiler.syllableWindowCount)
      : 0,
    lineBreakStyle: String(compiler.lineBreakStyle || ''),
    maxWindowSyllables: Number.isFinite(Number(compiler.maxWindowSyllables))
      ? Number(compiler.maxWindowSyllables)
      : null,
    maxWindowTokenSpan: Number.isFinite(Number(compiler.maxWindowTokenSpan))
      ? Number(compiler.maxWindowTokenSpan)
      : null,
    offsetSemantics: typeof compiler.offsetSemantics === 'string' ? compiler.offsetSemantics : null,
    graphemeAware: typeof compiler.graphemeAware === 'boolean' ? compiler.graphemeAware : null,
    graphemeCount: Number.isFinite(Number(compiler.graphemeCount)) ? Number(compiler.graphemeCount) : null,
    whitespaceFidelity: Boolean(compiler.whitespaceFidelity),
  });
}

function createLineAccumulator(lineIndex) {
  return {
    lineIndex,
    anchorWords: new Set(),
    vowelFamilyCounts: new Map(),
    repeatedWindowIds: new Set(),
    repeatedWindowSignatures: new Set(),
    windowSyllableLengths: new Set(),
    terminalRhymeTailSignatures: new Set(),
    anchorCount: 0,
  };
}

function incrementMapCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function getOrCreateLineAccumulator(linesByIndex, lineIndex) {
  if (!linesByIndex.has(lineIndex)) {
    linesByIndex.set(lineIndex, createLineAccumulator(lineIndex));
  }
  return linesByIndex.get(lineIndex);
}

function finalizeLineAccumulator(line) {
  const vowelFamilies = [...line.vowelFamilyCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  return Object.freeze({
    lineIndex: line.lineIndex,
    anchorCount: line.anchorCount,
    anchorWords: Object.freeze([...line.anchorWords].sort()),
    dominantVowelFamily: vowelFamilies[0]?.id || null,
    vowelFamilies: Object.freeze(vowelFamilies),
    repeatedWindowCount: line.repeatedWindowIds.size,
    repeatedWindowIds: Object.freeze(sortNumericList(line.repeatedWindowIds)),
    repeatedWindowSignatures: Object.freeze([...line.repeatedWindowSignatures].sort()),
    windowSyllableLengths: Object.freeze(sortNumericList(line.windowSyllableLengths)),
    terminalRhymeTailSignatures: Object.freeze([...line.terminalRhymeTailSignatures].sort()),
  });
}

export function buildPlsVerseIRBridge(compiler, rhymeAstrology) {
  const inspector = rhymeAstrology?.enabled ? rhymeAstrology?.inspector : null;
  if (!inspector || typeof inspector !== 'object') {
    return null;
  }

  const linesByIndex = new Map();

  const anchors = (Array.isArray(inspector.anchors) ? inspector.anchors : [])
    .map((anchor) => {
      const compilerRef = anchor?.compilerRef && typeof anchor.compilerRef === 'object'
        ? anchor.compilerRef
        : null;
      const lineIndex = Number.isInteger(Number(compilerRef?.lineIndex))
        ? Number(compilerRef.lineIndex)
        : (Number.isInteger(Number(anchor?.lineIndex)) ? Number(anchor.lineIndex) : -1);
      const normalizedWord = normalizeToken(anchor?.normalizedWord || anchor?.word);
      const primaryStressedVowelFamily = normalizeVowelFamily(compilerRef?.primaryStressedVowelFamily || null);
      const terminalVowelFamily = normalizeVowelFamily(compilerRef?.terminalVowelFamily || null);
      const activeWindowIds = sortNumericList(
        (Array.isArray(compilerRef?.activeWindowIds) ? compilerRef.activeWindowIds : anchor?.activeWindowIds || [])
          .map((value) => Number(value))
          .filter(Number.isInteger)
      );

      const normalizedAnchor = Object.freeze({
        word: String(anchor?.word || normalizedWord.toLowerCase()),
        normalizedWord,
        lineIndex,
        tokenId: Number.isInteger(Number(compilerRef?.tokenId))
          ? Number(compilerRef.tokenId)
          : (Number.isInteger(Number(anchor?.tokenId)) ? Number(anchor.tokenId) : -1),
        charStart: Number.isInteger(Number(compilerRef?.charStart))
          ? Number(compilerRef.charStart)
          : (Number.isInteger(Number(anchor?.charStart)) ? Number(anchor.charStart) : -1),
        charEnd: Number.isInteger(Number(compilerRef?.charEnd))
          ? Number(compilerRef.charEnd)
          : (Number.isInteger(Number(anchor?.charEnd)) ? Number(anchor.charEnd) : -1),
        activeWindowIds: Object.freeze(activeWindowIds),
        sign: typeof anchor?.sign === 'string' ? anchor.sign : null,
        rhymeTailSignature: typeof compilerRef?.rhymeTailSignature === 'string'
          ? compilerRef.rhymeTailSignature
          : null,
        primaryStressedVowelFamily,
        terminalVowelFamily,
        syllableCount: Number.isFinite(Number(compilerRef?.syllableCount))
          ? Number(compilerRef.syllableCount)
          : 0,
        isLineStart: Boolean(compilerRef?.isLineStart),
        isLineEnd: Boolean(compilerRef?.isLineEnd),
      });

      if (lineIndex >= 0) {
        const line = getOrCreateLineAccumulator(linesByIndex, lineIndex);
        line.anchorCount += 1;
        if (normalizedWord) {
          line.anchorWords.add(normalizedWord);
        }
        incrementMapCount(line.vowelFamilyCounts, primaryStressedVowelFamily || terminalVowelFamily || null);
        if (normalizedAnchor.isLineEnd && normalizedAnchor.rhymeTailSignature) {
          line.terminalRhymeTailSignatures.add(normalizedAnchor.rhymeTailSignature);
        }
      }

      return normalizedAnchor;
    })
    .filter((anchor) => anchor.lineIndex >= 0);

  const windows = (Array.isArray(inspector.windows) ? inspector.windows : [])
    .map((window) => {
      const lineIndex = Number.isInteger(Number(window?.lineIndex)) ? Number(window.lineIndex) : -1;
      const repeated = Boolean(window?.repeated);
      const syllableLength = Number.isFinite(Number(window?.syllableLength)) ? Number(window.syllableLength) : 0;
      const normalizedWindow = Object.freeze({
        id: Number.isInteger(Number(window?.id)) ? Number(window.id) : -1,
        lineIndex,
        repeated,
        syllableLength,
        signature: typeof window?.signature === 'string' ? window.signature : '',
        stressContour: typeof window?.stressContour === 'string' ? window.stressContour : '',
        codaContour: typeof window?.codaContour === 'string' ? window.codaContour : '',
        anchorWords: Object.freeze(normalizeTokenList(window?.anchorWords)),
      });

      if (lineIndex >= 0) {
        const line = getOrCreateLineAccumulator(linesByIndex, lineIndex);
        normalizedWindow.anchorWords.forEach((word) => line.anchorWords.add(word));
        if (repeated && normalizedWindow.id >= 0) {
          line.repeatedWindowIds.add(normalizedWindow.id);
        }
        if (repeated && normalizedWindow.signature) {
          line.repeatedWindowSignatures.add(normalizedWindow.signature);
        }
        if (syllableLength > 0) {
          line.windowSyllableLengths.add(syllableLength);
        }
      }

      return normalizedWindow;
    })
    .filter((window) => window.lineIndex >= 0);

  const lines = [...linesByIndex.values()]
    .map(finalizeLineAccumulator)
    .sort((a, b) => a.lineIndex - b.lineIndex);

  if (anchors.length === 0 && windows.length === 0) {
    return null;
  }

  return Object.freeze({
    version: '1.0.0',
    compiler: buildCompilerSnapshot(compiler),
    anchors: Object.freeze(anchors),
    lineEndAnchors: Object.freeze(
      anchors
        .filter((anchor) => anchor.isLineEnd)
        .sort((a, b) => (b.lineIndex - a.lineIndex) || (b.charStart - a.charStart))
    ),
    windows: Object.freeze(windows),
    lines: Object.freeze(lines),
  });
}

export function attachPlsVerseIRBridge(features, verseIRBridge) {
  if (!features && !verseIRBridge) {
    return null;
  }

  const baseFeatures = features && typeof features === 'object'
    ? { ...features }
    : {};

  if (!verseIRBridge) {
    return baseFeatures;
  }

  return {
    ...baseFeatures,
    verseIRBridge,
  };
}

function resolvePreviousLineEnd(bridge, prevLineEndWord) {
  const normalizedPrevLineEndWord = normalizeToken(prevLineEndWord);
  if (!normalizedPrevLineEndWord) {
    return null;
  }

  const matches = (Array.isArray(bridge?.lineEndAnchors) ? bridge.lineEndAnchors : [])
    .filter((anchor) => anchor.normalizedWord === normalizedPrevLineEndWord);

  if (matches.length === 0) {
    return null;
  }

  return matches[0];
}

function scoreCurrentLineCandidate(line, currentLineWords, previousLineEnd) {
  if (!line || !Array.isArray(line.anchorWords) || currentLineWords.length === 0) {
    return 0;
  }

  const anchorWordSet = new Set(line.anchorWords);
  let overlapCount = 0;
  currentLineWords.forEach((word) => {
    if (anchorWordSet.has(word)) {
      overlapCount += 1;
    }
  });

  if (overlapCount === 0) {
    return 0;
  }

  let score = (overlapCount * 4) + ((overlapCount / Math.max(anchorWordSet.size, 1)) * 2);

  if (previousLineEnd) {
    if (line.lineIndex === previousLineEnd.lineIndex + 1) score += 3;
    else if (line.lineIndex === previousLineEnd.lineIndex) score += 1;
  }

  score += Math.min(1.5, (Number(line.repeatedWindowCount) || 0) * 0.5);
  return score;
}

function resolveCurrentLine(bridge, currentLineWords, previousLineEnd) {
  const normalizedCurrentLineWords = normalizeTokenList(currentLineWords);
  if (normalizedCurrentLineWords.length === 0) {
    return null;
  }

  let bestLine = null;
  let bestScore = 0;

  (Array.isArray(bridge?.lines) ? bridge.lines : []).forEach((line) => {
    const score = scoreCurrentLineCandidate(line, normalizedCurrentLineWords, previousLineEnd);
    if (score > bestScore) {
      bestLine = line;
      bestScore = score;
    }
  });

  return bestScore > 0 ? bestLine : null;
}

export function resolvePlsVerseIRState(context) {
  const bridge = context?.plsPhoneticFeatures?.verseIRBridge;
  if (!bridge || typeof bridge !== 'object') {
    return null;
  }

  const previousLineEnd = resolvePreviousLineEnd(bridge, context?.prevLineEndWord);
  const currentLine = resolveCurrentLine(bridge, context?.currentLineWords, previousLineEnd);

  if (!previousLineEnd && !currentLine) {
    return null;
  }

  return {
    compiler: bridge.compiler || null,
    previousLineEnd,
    currentLine,
  };
}
