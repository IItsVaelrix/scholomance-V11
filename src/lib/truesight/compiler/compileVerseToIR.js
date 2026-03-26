import { PhonemeEngine } from '../../phonology/phoneme.engine.js';
import { normalizeVowelFamily } from '../../phonology/vowelFamily.js';
import { WORD_REGEX_GLOBAL } from '../../wordTokenization.js';
import { getTruesightAnalysisModeConfig, resolveTruesightAnalysisMode } from './analysisModes.js';

export const VERSE_IR_VERSION = '1.0.0';

const STOP_WORD_LIKE = new Set([
  'a', 'an', 'and', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'if',
  'in', 'is', 'it', 'of', 'on', 'or', 'so', 'the', 'to', 'was', 'were',
]);

function createWordRegex() {
  return new RegExp(WORD_REGEX_GLOBAL.source, WORD_REGEX_GLOBAL.flags);
}

function normalizeToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/^['-]+|['-]+$/g, '');
}

function normalizeSurfaceText(text) {
  return String(text || '').toLowerCase();
}

function inferLineBreakStyle(text) {
  const source = String(text || '');
  const hasCrLf = source.includes('\r\n');
  const hasLf = /(^|[^\r])\n/.test(source);
  const hasCr = /\r(?!\n)/.test(source);

  if (hasCrLf && !hasLf && !hasCr) return 'crlf';
  if (!hasCrLf && hasLf && !hasCr) return 'lf';
  if (!hasCrLf && !hasLf && hasCr) return 'cr';
  if (!hasCrLf && !hasLf && !hasCr) return 'none';
  return 'mixed';
}

function extractTerminalVowelFamilyFromRhymeKey(rhymeKey) {
  if (typeof rhymeKey !== 'string' || !rhymeKey) return null;
  return normalizeVowelFamily(rhymeKey.split('-')[0] || null);
}

function buildStressPatternFromSyllables(syllables) {
  return (Array.isArray(syllables) ? syllables : [])
    .map((syllable) => (Number(syllable?.stress) > 0 ? '1' : '0'))
    .join('');
}

function buildConsonantSkeleton(phonemes) {
  return (Array.isArray(phonemes) ? phonemes : [])
    .map((phoneme) => String(phoneme || '').replace(/[0-9]/g, '').trim().toUpperCase())
    .filter((phoneme) => phoneme && !/^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/.test(phoneme))
    .join('');
}

function cloneSyllable(syllable) {
  if (!syllable || typeof syllable !== 'object') {
    return null;
  }

  return Object.freeze({
    index: Number.isInteger(Number(syllable.index)) ? Number(syllable.index) : 0,
    vowel: String(syllable.vowel || ''),
    vowelFamily: normalizeVowelFamily(syllable.vowelFamily) || null,
    onset: String(syllable.onset || ''),
    coda: String(syllable.coda || ''),
    onsetPhonemes: Object.freeze(Array.isArray(syllable.onsetPhonemes) ? [...syllable.onsetPhonemes] : []),
    codaPhonemes: Object.freeze(Array.isArray(syllable.codaPhonemes) ? [...syllable.codaPhonemes] : []),
    stress: Number(syllable.stress) || 0,
  });
}

function cloneAnalysis(tokenText, deepAnalysis) {
  if (!deepAnalysis || typeof deepAnalysis !== 'object') {
    return null;
  }

  const syllables = Object.freeze(
    (Array.isArray(deepAnalysis.syllables) ? deepAnalysis.syllables : [])
      .map(cloneSyllable)
      .filter(Boolean)
  );

  return Object.freeze({
    word: String(deepAnalysis.word || tokenText || '').toUpperCase(),
    vowelFamily: normalizeVowelFamily(deepAnalysis.vowelFamily) || null,
    phonemes: Object.freeze(Array.isArray(deepAnalysis.phonemes) ? [...deepAnalysis.phonemes] : []),
    syllables,
    syllableCount: Number(deepAnalysis.syllableCount) || syllables.length || 0,
    rhymeKey: typeof deepAnalysis.rhymeKey === 'string' ? deepAnalysis.rhymeKey : null,
    extendedRhymeKeys: Object.freeze(
      Array.isArray(deepAnalysis.extendedRhymeKeys) ? [...deepAnalysis.extendedRhymeKeys] : []
    ),
    stressPattern: String(deepAnalysis.stressPattern || buildStressPatternFromSyllables(syllables)),
  });
}

function deriveBasicAnalysisFromDeepAnalysis(deepAnalysis) {
  if (!deepAnalysis || typeof deepAnalysis !== 'object') {
    return null;
  }

  const syllables = Array.isArray(deepAnalysis.syllables) ? deepAnalysis.syllables : [];
  const lastSyllable = syllables[syllables.length - 1] || null;

  return {
    vowelFamily: normalizeVowelFamily(deepAnalysis.vowelFamily) || null,
    phonemes: Array.isArray(deepAnalysis.phonemes) ? deepAnalysis.phonemes : [],
    coda: lastSyllable?.coda || null,
    rhymeKey: typeof deepAnalysis.rhymeKey === 'string' ? deepAnalysis.rhymeKey : null,
    syllableCount: Number(deepAnalysis.syllableCount) || syllables.length || 0,
  };
}

function deriveDeepAnalysisFromBasicAnalysis(tokenText, basicAnalysis, phonemeEngine) {
  if (!basicAnalysis || typeof basicAnalysis !== 'object') {
    return null;
  }

  const phonemes = Array.isArray(basicAnalysis.phonemes) ? [...basicAnalysis.phonemes] : [];
  const syllables = typeof phonemeEngine?.analyzeSyllables === 'function'
    ? phonemeEngine.analyzeSyllables(phonemes).map(cloneSyllable).filter(Boolean)
    : [];

  return cloneAnalysis(tokenText, {
    word: String(tokenText || '').toUpperCase(),
    vowelFamily: normalizeVowelFamily(basicAnalysis.vowelFamily) || null,
    phonemes,
    syllables,
    syllableCount: Number(basicAnalysis.syllableCount) || syllables.length || 0,
    rhymeKey: typeof basicAnalysis.rhymeKey === 'string' ? basicAnalysis.rhymeKey : null,
    extendedRhymeKeys: [],
    stressPattern: buildStressPatternFromSyllables(syllables),
  });
}

function findPrimaryStressedSyllable(analysis) {
  const syllables = Array.isArray(analysis?.syllables) ? analysis.syllables : [];
  return syllables.find((syllable) => Number(syllable?.stress) > 0) || syllables[0] || null;
}

function buildRhymeTailSignature(analysis, basicAnalysis) {
  if (Array.isArray(analysis?.extendedRhymeKeys) && analysis.extendedRhymeKeys.length > 0) {
    return String(analysis.extendedRhymeKeys[0]);
  }

  if (typeof analysis?.rhymeKey === 'string' && analysis.rhymeKey) {
    return analysis.rhymeKey;
  }

  if (typeof basicAnalysis?.rhymeKey === 'string' && basicAnalysis.rhymeKey) {
    return basicAnalysis.rhymeKey;
  }

  const fallbackFamily = normalizeVowelFamily(analysis?.vowelFamily || basicAnalysis?.vowelFamily) || 'A';
  const fallbackCoda = String(basicAnalysis?.coda || '').trim().toUpperCase() || 'open';
  return `${fallbackFamily}-${fallbackCoda}`;
}

function buildTokenSyllableUnits(token) {
  const syllables = Array.isArray(token.analysis?.syllables) ? token.analysis.syllables : [];
  if (syllables.length === 0) {
    return [{
      tokenId: token.id,
      lineIndex: token.lineIndex,
      syllableIndexInToken: 0,
      charStart: token.charStart,
      charEnd: token.charEnd,
      vowelFamily: token.primaryStressedVowelFamily || token.terminalVowelFamily || null,
      stress: Number(token.stressPattern?.[0]) || 0,
      coda: token.coda.join(''),
      phonemeSpan: [...token.phonemes],
    }];
  }

  return syllables.map((syllable, syllableIndexInToken) => ({
    tokenId: token.id,
    lineIndex: token.lineIndex,
    syllableIndexInToken,
    charStart: token.charStart,
    charEnd: token.charEnd,
    vowelFamily: normalizeVowelFamily(syllable.vowelFamily) || null,
    stress: Number(syllable.stress) || 0,
    coda: String(syllable.coda || ''),
    phonemeSpan: [
      ...(Array.isArray(syllable.onsetPhonemes) ? syllable.onsetPhonemes : []),
      String(syllable.vowel || ''),
      ...(Array.isArray(syllable.codaPhonemes) ? syllable.codaPhonemes : []),
    ].filter(Boolean),
  }));
}

function createIndexMap() {
  return new Map();
}

function appendIndexValue(indexMap, key, value) {
  if (!key && key !== 0) return;
  if (!indexMap.has(key)) {
    indexMap.set(key, []);
  }
  indexMap.get(key).push(value);
}

function finalizeIndexMap(indexMap) {
  for (const [key, values] of indexMap.entries()) {
    indexMap.set(key, Object.freeze([...values]));
  }
  return indexMap;
}

export function splitVerseLines(rawText) {
  const source = String(rawText || '');
  if (!source) {
    return [];
  }

  const lines = [];
  let cursor = 0;

  while (cursor < source.length) {
    const lineStart = cursor;

    while (cursor < source.length && source[cursor] !== '\n' && source[cursor] !== '\r') {
      cursor += 1;
    }

    const textEnd = cursor;
    let lineBreak = '';

    if (cursor < source.length) {
      if (source[cursor] === '\r' && source[cursor + 1] === '\n') {
        lineBreak = '\r\n';
        cursor += 2;
      } else {
        lineBreak = source[cursor];
        cursor += 1;
      }
    }

    lines.push({
      lineIndex: lines.length,
      text: source.slice(lineStart, textEnd),
      normalizedText: normalizeSurfaceText(source.slice(lineStart, textEnd)),
      tokenIds: [],
      charStart: lineStart,
      charEnd: textEnd,
      lineBreak,
      lineBreakStart: lineBreak ? textEnd : -1,
      lineBreakEnd: lineBreak ? textEnd + lineBreak.length : -1,
      rawSlice: source.slice(lineStart, cursor),
      isTerminalLine: false,
    });
  }

  if (source.endsWith('\r') || source.endsWith('\n')) {
    lines.push({
      lineIndex: lines.length,
      text: '',
      normalizedText: '',
      tokenIds: [],
      charStart: source.length,
      charEnd: source.length,
      lineBreak: '',
      lineBreakStart: -1,
      lineBreakEnd: -1,
      rawSlice: '',
      isTerminalLine: false,
    });
  }

  if (lines.length > 0) {
    lines[lines.length - 1].isTerminalLine = true;
  }

  return lines;
}

function buildTokenIR({
  tokenText,
  charStart,
  lineIndex,
  tokenIndexInLine,
  globalTokenIndex,
  totalTokensInLine,
  phonemeEngine,
}) {
  const normalized = normalizeToken(tokenText);
  const deepAnalysis = typeof phonemeEngine?.analyzeDeep === 'function'
    ? cloneAnalysis(tokenText, phonemeEngine.analyzeDeep(tokenText))
    : null;
  const basicAnalysis = typeof phonemeEngine?.analyzeWord === 'function'
    ? phonemeEngine.analyzeWord(tokenText)
    : deriveBasicAnalysisFromDeepAnalysis(deepAnalysis);
  const resolvedAnalysis = deepAnalysis || deriveDeepAnalysisFromBasicAnalysis(tokenText, basicAnalysis, phonemeEngine);
  const phonemes = Object.freeze(
    Array.isArray(resolvedAnalysis?.phonemes)
      ? [...resolvedAnalysis.phonemes]
      : Array.isArray(basicAnalysis?.phonemes)
        ? [...basicAnalysis.phonemes]
        : []
  );
  const syllables = Array.isArray(resolvedAnalysis?.syllables) ? resolvedAnalysis.syllables : [];
  const stressedSyllable = findPrimaryStressedSyllable(resolvedAnalysis);
  const terminalSyllable = syllables[syllables.length - 1] || null;
  const vowelFamily = Object.freeze(
    syllables
      .map((syllable) => normalizeVowelFamily(syllable.vowelFamily))
      .filter(Boolean)
  );
  const stressPattern = String(resolvedAnalysis?.stressPattern || buildStressPatternFromSyllables(syllables));

  return Object.freeze({
    id: globalTokenIndex,
    text: tokenText,
    normalized,
    normalizedUpper: normalized.toUpperCase(),
    lineIndex,
    tokenIndexInLine,
    globalTokenIndex,
    charStart,
    charEnd: charStart + tokenText.length,
    syllableCount: Number(resolvedAnalysis?.syllableCount) || Number(basicAnalysis?.syllableCount) || syllables.length || 0,
    phonemes,
    stressPattern,
    onset: Object.freeze(Array.isArray(syllables[0]?.onsetPhonemes) ? [...syllables[0].onsetPhonemes] : []),
    nucleus: Object.freeze(
      syllables
        .map((syllable) => String(syllable?.vowel || '').replace(/[0-9]/g, '').toUpperCase())
        .filter(Boolean)
    ),
    coda: Object.freeze(Array.isArray(terminalSyllable?.codaPhonemes) ? [...terminalSyllable.codaPhonemes] : []),
    vowelFamily,
    primaryStressedVowelFamily: normalizeVowelFamily(
      stressedSyllable?.vowelFamily || resolvedAnalysis?.vowelFamily || basicAnalysis?.vowelFamily
    ) || null,
    terminalVowelFamily: normalizeVowelFamily(
      terminalSyllable?.vowelFamily || extractTerminalVowelFamilyFromRhymeKey(resolvedAnalysis?.rhymeKey || basicAnalysis?.rhymeKey)
    ) || null,
    rhymeTailSignature: buildRhymeTailSignature(resolvedAnalysis, basicAnalysis),
    consonantSkeleton: buildConsonantSkeleton(phonemes),
    extendedRhymeKeys: Object.freeze(
      Array.isArray(resolvedAnalysis?.extendedRhymeKeys) ? [...resolvedAnalysis.extendedRhymeKeys] : []
    ),
    flags: Object.freeze({
      isLineStart: tokenIndexInLine === 0,
      isLineEnd: tokenIndexInLine === totalTokensInLine - 1,
      isStopWordLike: STOP_WORD_LIKE.has(normalized),
      unknownPhonetics: phonemes.length === 0,
    }),
    analysis: resolvedAnalysis,
  });
}

function buildSyllableWindows(lines, tokens, maxWindowSyllables, maxWindowTokenSpan) {
  const windows = [];
  const syllablesByLine = new Map();

  for (const token of tokens) {
    if (!syllablesByLine.has(token.lineIndex)) {
      syllablesByLine.set(token.lineIndex, []);
    }
    syllablesByLine.get(token.lineIndex).push(...buildTokenSyllableUnits(token));
  }

  for (const line of lines) {
    const syllables = syllablesByLine.get(line.lineIndex) || [];
    if (syllables.length === 0) {
      continue;
    }

    for (let startIndex = 0; startIndex < syllables.length; startIndex += 1) {
      for (let length = 1; length <= maxWindowSyllables; length += 1) {
        const endExclusive = startIndex + length;
        if (endExclusive > syllables.length) {
          break;
        }

        const windowSyllables = syllables.slice(startIndex, endExclusive);
        const tokenIds = [...new Set(windowSyllables.map((syllable) => syllable.tokenId))];
        if (tokenIds.length > maxWindowTokenSpan) {
          continue;
        }

        const firstSyllable = windowSyllables[0];
        const lastSyllable = windowSyllables[windowSyllables.length - 1];
        const firstToken = tokens[firstSyllable.tokenId];
        const lastToken = tokens[lastSyllable.tokenId];
        const vowelSequence = windowSyllables
          .map((syllable) => normalizeVowelFamily(syllable.vowelFamily))
          .filter(Boolean);
        const stressContour = windowSyllables
          .map((syllable) => (Number(syllable.stress) > 0 ? '1' : '0'))
          .join('');
        const codaContour = windowSyllables
          .map((syllable) => String(syllable.coda || '').trim().toUpperCase() || 'open')
          .join('/');

        windows.push(Object.freeze({
          id: windows.length,
          tokenSpan: Object.freeze([firstToken.id, lastToken.id]),
          lineSpan: Object.freeze([line.lineIndex, line.lineIndex]),
          charStart: firstToken.charStart,
          charEnd: lastToken.charEnd,
          syllableLength: windowSyllables.length,
          phonemeSpan: Object.freeze(windowSyllables.flatMap((syllable) => syllable.phonemeSpan)),
          vowelSequence: Object.freeze(vowelSequence),
          stressContour,
          codaContour,
          signature: `${windowSyllables.length}:${vowelSequence.join('/')}:${codaContour}:${stressContour}`,
        }));
      }
    }
  }

  return Object.freeze(windows);
}

function buildVerseIndexes(lines, tokens, syllableWindows) {
  const tokenIdsByLineIndex = Object.freeze(lines.map((line) => Object.freeze([...line.tokenIds])));
  const lineEndTokenIds = [];
  const tokenIdsByRhymeTail = createIndexMap();
  const tokenIdsByVowelFamily = createIndexMap();
  const tokenIdsByTerminalVowelFamily = createIndexMap();
  const tokenIdsByStressedVowelFamily = createIndexMap();
  const tokenIdsByConsonantSkeleton = createIndexMap();
  const tokenIdsByStressContour = createIndexMap();
  const windowIdsBySyllableLength = createIndexMap();
  const windowIdsBySignature = createIndexMap();

  for (const line of lines) {
    const tokenIds = Array.isArray(line.tokenIds) ? line.tokenIds : [];
    if (tokenIds.length > 0) {
      lineEndTokenIds.push(tokenIds[tokenIds.length - 1]);
    }
  }

  for (const token of tokens) {
    appendIndexValue(tokenIdsByRhymeTail, token.rhymeTailSignature, token.id);
    appendIndexValue(tokenIdsByConsonantSkeleton, token.consonantSkeleton || `__empty__:${token.id}`, token.id);
    appendIndexValue(tokenIdsByStressContour, token.stressPattern || '0', token.id);
    appendIndexValue(tokenIdsByTerminalVowelFamily, token.terminalVowelFamily || `__none__:${token.id}`, token.id);
    appendIndexValue(tokenIdsByStressedVowelFamily, token.primaryStressedVowelFamily || `__none__:${token.id}`, token.id);
    [...new Set(token.vowelFamily)].forEach((family) => appendIndexValue(tokenIdsByVowelFamily, family, token.id));
  }

  for (const window of syllableWindows) {
    appendIndexValue(windowIdsBySyllableLength, window.syllableLength, window.id);
    appendIndexValue(windowIdsBySignature, window.signature, window.id);
  }

  return Object.freeze({
    tokenIdsByLineIndex,
    lineEndTokenIds: Object.freeze(lineEndTokenIds),
    tokenIdsByRhymeTail: finalizeIndexMap(tokenIdsByRhymeTail),
    tokenIdsByVowelFamily: finalizeIndexMap(tokenIdsByVowelFamily),
    tokenIdsByTerminalVowelFamily: finalizeIndexMap(tokenIdsByTerminalVowelFamily),
    tokenIdsByStressedVowelFamily: finalizeIndexMap(tokenIdsByStressedVowelFamily),
    tokenIdsByConsonantSkeleton: finalizeIndexMap(tokenIdsByConsonantSkeleton),
    tokenIdsByStressContour: finalizeIndexMap(tokenIdsByStressContour),
    windowIdsBySyllableLength: finalizeIndexMap(windowIdsBySyllableLength),
    windowIdsBySignature: finalizeIndexMap(windowIdsBySignature),
  });
}

function buildFeatureTables(lines, tokens, syllableWindows) {
  return Object.freeze({
    tokenNeighborhoods: Object.freeze(tokens.map((token, tokenIndex) => Object.freeze({
      tokenId: token.id,
      lineIndex: token.lineIndex,
      prevTokenId: tokenIndex > 0 && tokens[tokenIndex - 1].lineIndex === token.lineIndex ? tokens[tokenIndex - 1].id : null,
      nextTokenId: tokenIndex + 1 < tokens.length && tokens[tokenIndex + 1].lineIndex === token.lineIndex ? tokens[tokenIndex + 1].id : null,
    }))),
    lineAdjacency: Object.freeze(lines.map((line, lineIndex) => Object.freeze({
      lineIndex: line.lineIndex,
      prevLineIndex: lineIndex > 0 ? lines[lineIndex - 1].lineIndex : null,
      nextLineIndex: lineIndex + 1 < lines.length ? lines[lineIndex + 1].lineIndex : null,
    }))),
    summary: Object.freeze({
      tokenCount: tokens.length,
      lineCount: lines.length,
      syllableWindowCount: syllableWindows.length,
    }),
  });
}

export function createEmptyVerseIR(options = {}) {
  const mode = resolveTruesightAnalysisMode(options.mode);
  return Object.freeze({
    version: VERSE_IR_VERSION,
    rawText: '',
    normalizedText: '',
    lines: Object.freeze([]),
    tokens: Object.freeze([]),
    syllableWindows: Object.freeze([]),
    indexes: Object.freeze({
      tokenIdsByLineIndex: Object.freeze([]),
      lineEndTokenIds: Object.freeze([]),
      tokenIdsByRhymeTail: new Map(),
      tokenIdsByVowelFamily: new Map(),
      tokenIdsByTerminalVowelFamily: new Map(),
      tokenIdsByStressedVowelFamily: new Map(),
      tokenIdsByConsonantSkeleton: new Map(),
      tokenIdsByStressContour: new Map(),
      windowIdsBySyllableLength: new Map(),
      windowIdsBySignature: new Map(),
    }),
    featureTables: Object.freeze({
      tokenNeighborhoods: Object.freeze([]),
      lineAdjacency: Object.freeze([]),
      summary: Object.freeze({
        tokenCount: 0,
        lineCount: 0,
        syllableWindowCount: 0,
      }),
    }),
    metadata: Object.freeze({
      mode,
      lineBreakStyle: 'none',
      tokenCount: 0,
      lineCount: 0,
      syllableWindowCount: 0,
      whitespaceFidelity: true,
    }),
  });
}

export function compileVerseToIR(rawText, options = {}) {
  const source = typeof rawText === 'string' ? rawText : String(rawText || '');
  const mode = resolveTruesightAnalysisMode(options.mode);
  if (!source) {
    return createEmptyVerseIR({ mode });
  }

  const phonemeEngine = options.phonemeEngine || PhonemeEngine;
  const modeConfig = getTruesightAnalysisModeConfig(mode);
  const lines = splitVerseLines(source);
  const tokens = [];

  for (const line of lines) {
    const matches = [...line.text.matchAll(createWordRegex())];
    for (let tokenIndexInLine = 0; tokenIndexInLine < matches.length; tokenIndexInLine += 1) {
      const match = matches[tokenIndexInLine];
      const token = buildTokenIR({
        tokenText: match[0],
        charStart: line.charStart + match.index,
        lineIndex: line.lineIndex,
        tokenIndexInLine,
        globalTokenIndex: tokens.length,
        totalTokensInLine: matches.length,
        phonemeEngine,
      });
      tokens.push(token);
      line.tokenIds.push(token.id);
    }
    line.tokenIds = Object.freeze([...line.tokenIds]);
    Object.freeze(line);
  }

  const frozenTokens = Object.freeze(tokens);
  const syllableWindows = buildSyllableWindows(
    lines,
    frozenTokens,
    modeConfig.maxWindowSyllables,
    modeConfig.maxWindowTokenSpan
  );
  const indexes = buildVerseIndexes(lines, frozenTokens, syllableWindows);
  const featureTables = buildFeatureTables(lines, frozenTokens, syllableWindows);

  return Object.freeze({
    version: VERSE_IR_VERSION,
    rawText: source,
    normalizedText: normalizeSurfaceText(source),
    lines: Object.freeze(lines),
    tokens: frozenTokens,
    syllableWindows,
    indexes,
    featureTables,
    metadata: Object.freeze({
      mode,
      lineBreakStyle: inferLineBreakStyle(source),
      tokenCount: frozenTokens.length,
      lineCount: lines.length,
      syllableWindowCount: syllableWindows.length,
      whitespaceFidelity: true,
    }),
  });
}
