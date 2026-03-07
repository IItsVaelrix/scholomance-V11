import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useColorCodex } from "../../hooks/useColorCodex.js";
import IntelliSense from "../../components/IntelliSense.jsx";
import Gutter from "./Gutter.jsx";
import { normalizeVowelFamily } from "../../lib/phonology/vowelFamily.js";
import { LINE_TOKEN_REGEX, WORD_TOKEN_REGEX } from "../../lib/wordTokenization.js";
import { DEFAULT_VOWEL_COLORS } from "../../data/schoolPalettes.js";

const MAX_CONTENT_LENGTH = 50000;
const CONTENT_DEBOUNCE_MS = 300;
const MIN_EDITOR_HEIGHT = 0;
const DEFAULT_LINE_HEIGHT = 28;
const MARKDOWN_FORMATS = {
  heading: { prefix: "## ", suffix: "", lineStart: true },
  bullet: { prefix: "- ", suffix: "", lineStart: true },
  number: { prefix: "1. ", suffix: "", lineStart: true },
  quote: { prefix: "> ", suffix: "", lineStart: true },
};

function buildOverlayLines(content) {
  const rawLines = String(content || "").split("\n");
  const lines = [];
  let documentOffset = 0;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const lineText = rawLines[lineIndex];
    const tokens = [];
    let wordIndex = 0;

    // Basic syntax detection
    let lineType = "normal";
    if (lineText.startsWith("#")) {
      lineType = "heading";
    } else if (lineText.startsWith("- ") || lineText.startsWith("* ")) {
      lineType = "list-item";
    }

    for (const match of lineText.matchAll(LINE_TOKEN_REGEX)) {
      const token = match[0];
      const localStart = match.index ?? 0;
      const isWord = WORD_TOKEN_REGEX.test(token);
      tokens.push({
        token,
        start: documentOffset + localStart,
        lineIndex,
        wordIndex: isWord ? wordIndex : null,
      });
      if (isWord) {
        wordIndex += 1;
      }
    }

    lines.push({ lineIndex, tokens, lineType });
    documentOffset += lineText.length + 1;
  }

  return lines;
}

function normalizeWordToken(token) {
  return String(token || "")
    .trim()
    .replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "")
    .toUpperCase();
}

function toFiniteInt(value, fallback = -1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.trunc(num);
}

function findSyntaxTokenForCursor(syntaxLayer, lineNumber, targetWordIndex, targetCharStart) {
  if (!syntaxLayer || typeof syntaxLayer !== "object") return null;

  const byIdentity = syntaxLayer.tokenByIdentity;
  const byCharStart = syntaxLayer.tokenByCharStart;
  const tokens = Array.isArray(syntaxLayer.tokens) ? syntaxLayer.tokens : [];

  if (byIdentity?.get && Number.isInteger(targetCharStart) && targetCharStart >= 0) {
    const identity = `${lineNumber}:${targetWordIndex}:${targetCharStart}`;
    const identityToken = byIdentity.get(identity);
    if (identityToken) return identityToken;
  }

  if (byCharStart?.get && Number.isInteger(targetCharStart) && targetCharStart >= 0) {
    const exactCharToken = byCharStart.get(targetCharStart);
    if (exactCharToken) return exactCharToken;
  }

  const lineTokens = tokens
    .filter((token) => toFiniteInt(token?.lineNumber, -1) === lineNumber)
    .sort((a, b) => toFiniteInt(a?.wordIndex, 0) - toFiniteInt(b?.wordIndex, 0));

  if (lineTokens.length === 0) return null;

  if (Number.isInteger(targetCharStart) && targetCharStart >= 0) {
    const rangeMatch = lineTokens.find((token) => {
      const start = toFiniteInt(token?.charStart, -1);
      const end = toFiniteInt(token?.charEnd, -1);
      if (start < 0 || end < start) return false;
      return targetCharStart >= start && targetCharStart <= end;
    });
    if (rangeMatch) return rangeMatch;
  }

  const exactWordIndex = lineTokens.find(
    (token) => toFiniteInt(token?.wordIndex, -1) === targetWordIndex
  );
  if (exactWordIndex) return exactWordIndex;

  const closestPrior = [...lineTokens]
    .reverse()
    .find((token) => toFiniteInt(token?.wordIndex, -1) <= targetWordIndex);
  if (closestPrior) return closestPrior;

  return lineTokens[lineTokens.length - 1];
}

function resolveSyntaxContextForCursor({
  syntaxLayer,
  content,
  cursorOffset,
  prefix,
  currentLineWords,
}) {
  if (!syntaxLayer || typeof syntaxLayer !== "object") return null;

  const beforeCursor = String(content || "").slice(0, Math.max(0, toFiniteInt(cursorOffset, 0)));
  const lineNumber = Math.max(0, beforeCursor.split("\n").length - 1);
  const targetWordIndex = Math.max(0, Array.isArray(currentLineWords) ? currentLineWords.length : 0);
  const targetCharStart = prefix ? Math.max(0, toFiniteInt(cursorOffset, 0) - prefix.length) : -1;

  const syntaxToken = findSyntaxTokenForCursor(
    syntaxLayer,
    lineNumber,
    targetWordIndex,
    targetCharStart
  );
  if (!syntaxToken) return null;

  const role = String(syntaxToken.role || "content");
  const lineRole = String(
    syntaxToken.lineRole || (targetWordIndex === 0 ? "line_start" : "line_mid")
  );
  const stressRole = String(syntaxToken.stressRole || "unknown");
  const rhymePolicy = String(syntaxToken.rhymePolicy || (role === "function" ? "allow_weak" : "allow"));

  const context = { role, lineRole, stressRole, rhymePolicy };
  const tokenHhm = syntaxToken?.hhm && typeof syntaxToken.hhm === "object" ? syntaxToken.hhm : null;
  const summaryHhm = syntaxLayer?.hhm && typeof syntaxLayer.hhm === "object" ? syntaxLayer.hhm : null;

  if (tokenHhm || summaryHhm) {
    context.hhm = {
      tokenWeight: Number(tokenHhm?.tokenWeight) || 1,
      logicOrder: Array.isArray(tokenHhm?.logicOrder)
        ? tokenHhm.logicOrder
        : (Array.isArray(summaryHhm?.logicOrder) ? summaryHhm.logicOrder : []),
      stageWeights: tokenHhm?.stageWeights || summaryHhm?.stageWeights || null,
      stageScores: tokenHhm?.stageScores || null,
      dictionarySources: Array.isArray(summaryHhm?.dictionarySources)
        ? summaryHhm.dictionarySources
        : [],
    };
  }

  return context;
}

// Common function words that don't carry meaningful phonemic weight for analysis.
// These stay default/white in Truesight to reduce visual noise and let content words pop.
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


// Compute cursor pixel position in a textarea.
// Uses canvas text measurement for accurate results with proportional fonts (Georgia serif).
function getCursorCoordsFromTextarea(textarea) {
  if (!textarea) return { x: 0, y: 0 };
  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || DEFAULT_LINE_HEIGHT;
  const rect = textarea.getBoundingClientRect();
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;

  const pos = textarea.selectionStart;
  const text = textarea.value.substring(0, pos);
  const lines = text.split('\n');
  const lineNum = lines.length - 1;
  const currentLineText = lines[lines.length - 1];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const textWidth = ctx.measureText(currentLineText).width;

  return {
    x: rect.left + paddingLeft + textWidth,
    y: rect.top + paddingTop + (lineNum + 1) * lineHeight - textarea.scrollTop,
  };
}

const ScrollEditor = forwardRef(function ScrollEditor({
  initialTitle = "",
  initialContent = "",
  onSave,
  onCancel,
  isEditable = true,
  disabled = false,
  isTruesight = false,
  isPredictive = false,
  predict,
  getCompletions,
  checkSpelling,
  getSpellingSuggestions,
  predictorReady = false,
  onContentChange,
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  lineSyllableCounts = [],
  plsPhoneticFeatures = null,
  highlightedLines = [],
  vowelColors = null,
  colorMap = null,
  syntaxLayer = null,
  analysisMode = 'none',
  theme = 'dark',
  onWordActivate,
  onCursorChange,
  onScrollChange,
}, ref) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT);
  const [intellisenseSuggestions, setIntellisenseSuggestions] = useState([]);
  const [intellisenseIndex, setIntellisenseIndex] = useState(0);
  const [intellisensePos, setIntellisensePos] = useState({ x: 0, y: 0 });
  const [cursorVersion, setCursorVersion] = useState(0);
  const textareaRef = useRef(null);
  const truesightOverlayRef = useRef(null);

  // IntelliSense: PLS-powered completions with rhyme, meter, color awareness
  useEffect(() => {
    if (!isPredictive || !predictorReady) {
      setIntellisenseSuggestions(prev => prev.length === 0 ? prev : []);
      return;
    }
    let cancelled = false;

    const addBasicPredictions = (prefix, prevWord, seenTokens, finalResults) => {
      const basicResults = prefix
        ? (predict?.(prefix, prevWord, 10) || [])
        : (predict?.(null, prevWord, 10) || []);

      for (const token of basicResults) {
        const normalizedToken = String(token || '').trim().toLowerCase();
        if (!normalizedToken || seenTokens.has(normalizedToken)) continue;
        seenTokens.add(normalizedToken);
        finalResults.push({
          token: normalizedToken,
          type: 'prediction',
          score: 0.45,
          isRhyme: false,
          badges: [],
          ghostLine: null,
        });
      }
    };

    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea || cancelled) return;

      void (async () => {
        const pos = textarea.selectionStart;
        const textBefore = content.substring(0, pos);
        const lastWordMatch = textBefore.match(/([a-zA-Z']+)$/);
        const isAfterSpace = pos > 0 && content.charAt(pos - 1) === ' ';

        let prefix = '';
        let prevWord = null;

        if (lastWordMatch && lastWordMatch[1].length >= 1) {
          prefix = lastWordMatch[1];
          const beforePrefix = textBefore.slice(0, textBefore.length - prefix.length);
          const wordsBeforePrefix = beforePrefix.match(/[a-zA-Z']+/g);
          if (wordsBeforePrefix?.length > 0) {
            prevWord = wordsBeforePrefix[wordsBeforePrefix.length - 1];
          }
        } else if (isAfterSpace) {
          const words = textBefore.match(/[a-zA-Z']+/g);
          if (words?.length > 0) prevWord = words[words.length - 1];
        }

        // If neither typing nor after space, nothing to suggest
        if (!prefix && !prevWord) {
          if (!cancelled) setIntellisenseSuggestions([]);
          return;
        }

        // Build PLS context from cursor state
        const lines = textBefore.split('\n');
        const currentLineText = lines[lines.length - 1] || '';
        const currentLineWords = (currentLineText.match(/[a-zA-Z']+/g) || [])
          .map(w => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ''))
          .filter(Boolean);
        // Remove the prefix (in-progress word) from current line words
        if (prefix && currentLineWords.length > 0) {
          const lastCLW = currentLineWords[currentLineWords.length - 1];
          if (lastCLW.toLowerCase() === prefix.toLowerCase()) currentLineWords.pop();
        }

        let prevLineEndWord = null;
        for (let i = lines.length - 2; i >= 0; i--) {
          const lineText = lines[i].trim();
          if (!lineText) continue;
          const lineWords = lineText.match(/[a-zA-Z']+/g);
          if (lineWords?.length > 0) {
            prevLineEndWord = lineWords[lineWords.length - 1];
            break;
          }
        }

        // Gather prior line syllable counts for meter inference
        const priorLineSyllableCounts = [];
        if (lineSyllableCounts?.length > 0) {
          const currentLineIndex = lines.length - 1;
          for (let i = Math.max(0, currentLineIndex - 4); i < currentLineIndex; i++) {
            if (lineSyllableCounts[i]) priorLineSyllableCounts.push(lineSyllableCounts[i]);
          }
        }

        const plsContext = {
          prefix,
          prevWord,
          prevLineEndWord,
          currentLineWords,
          targetSyllableCount: null,
          priorLineSyllableCounts,
          plsPhoneticFeatures,
          syntaxContext: resolveSyntaxContextForCursor({
            syntaxLayer,
            content,
            cursorOffset: pos,
            prefix,
            currentLineWords,
          }),
        };

        // Collect results: PLS completions + spellcheck corrections
        const finalResults = [];
        const seenTokens = new Set();

        // 1. Spelling corrections (highest priority)
        if (prefix && checkSpelling) {
          const isSpelledCorrectly = await checkSpelling(prefix);
          if (cancelled) return;

          if (!isSpelledCorrectly) {
            const spellingSuggestions = await (getSpellingSuggestions?.(prefix, prevWord, 5) || []);
            if (cancelled) return;

            (Array.isArray(spellingSuggestions) ? spellingSuggestions : []).forEach((suggestion) => {
              const normalizedSuggestion = String(suggestion || '').trim().toLowerCase();
              if (!normalizedSuggestion || seenTokens.has(normalizedSuggestion)) return;
              seenTokens.add(normalizedSuggestion);
              finalResults.push({
                token: normalizedSuggestion,
                type: 'correction',
                score: 1.08,
                isRhyme: false,
                badges: [],
                ghostLine: null,
              });
            });
          }
        }

        // 2. PLS completions (rhyme, meter, color-aware)
        if (getCompletions) {
          try {
            const plsResults = await getCompletions(plsContext, { limit: 10 });
            for (const result of (Array.isArray(plsResults) ? plsResults : [])) {
              const normalizedToken = String(result?.token || '').trim().toLowerCase();
              if (!normalizedToken || seenTokens.has(normalizedToken)) continue;
              const badges = Array.isArray(result.badges) ? result.badges : [];
              seenTokens.add(normalizedToken);
              finalResults.push({
                token: normalizedToken,
                type: 'prediction',
                score: Number(result.score) || 0,
                isRhyme: badges.includes('RHYME'),
                badges,
                ghostLine: result.ghostLine,
                scores: result.scores,
              });
            }
          } catch (_error) {
            addBasicPredictions(prefix, prevWord, seenTokens, finalResults);
          }
        } else {
          // Fallback to basic predict if PLS not available
          addBasicPredictions(prefix, prevWord, seenTokens, finalResults);
        }

        if (cancelled) return;
        const ranked = [...finalResults].sort((a, b) => {
          const scoreA = Number(a?.score) || 0;
          const scoreB = Number(b?.score) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          if (a.type !== b.type) return a.type === 'correction' ? -1 : 1;
          return String(a?.token || '').localeCompare(String(b?.token || ''));
        });
        const sliced = ranked.slice(0, 7);
        setIntellisenseSuggestions(sliced);
        setIntellisenseIndex(0);
        if (sliced.length > 0) {
          setIntellisensePos(getCursorCoordsFromTextarea(textarea));
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [content, cursorVersion, isPredictive, predictorReady, predict, getCompletions, checkSpelling, getSpellingSuggestions, lineSyllableCounts, plsPhoneticFeatures, syntaxLayer]);

  // Accept an IntelliSense suggestion: replace partial word and insert
  const handleAcceptSuggestion = useCallback((token) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = content.substring(0, pos);
    const textAfter = content.substring(pos);
    const lastWordMatch = textBefore.match(/([a-zA-Z']+)$/);

    let newContent, newCursorPos;
    if (lastWordMatch) {
      const before = content.substring(0, lastWordMatch.index);
      newContent = before + token + ' ' + textAfter;
      newCursorPos = lastWordMatch.index + token.length + 1;
    } else {
      newContent = textBefore + token + ' ' + textAfter;
      newCursorPos = pos + token.length + 1;
    }

    setContent(newContent);
    onContentChange?.(newContent);
    setIntellisenseSuggestions([]);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content, onContentChange]);

  // Buffer of extra lines rendered above/below the viewport.
  // Kept at 20 (not 10) to absorb wrapped-line drift: logical line N sits lower
  // than N * lineHeightPx when prior lines wrap, so a larger buffer prevents
  // the windowed content from popping in visibly at the edges.
  const BUFFER = 20;

  const overlayLines = useMemo(() => {
    const perfStart = performance.now();
    const lines = buildOverlayLines(content);
    const perfEnd = performance.now();
    if (perfEnd - perfStart > 4) {
      console.warn(`[PERF] overlayLines memo: ${(perfEnd - perfStart).toFixed(2)}ms`);
    }
    return lines;
  }, [content]);

  // Virtualization windowing
  const visibleRange = useMemo(() => {
    if (!isTruesight) return { start: 0, end: 0 };
    
    const startIdx = Math.max(0, Math.floor(scrollTop / lineHeightPx) - BUFFER);
    const endIdx = Math.min(
      overlayLines.length, 
      Math.ceil((scrollTop + editorHeight) / lineHeightPx) + BUFFER
    );
    
    return { start: startIdx, end: endIdx };
  }, [scrollTop, editorHeight, overlayLines.length, isTruesight, lineHeightPx]);

  const windowedLines = useMemo(() => {
    return overlayLines.slice(visibleRange.start, visibleRange.end);
  }, [overlayLines, visibleRange]);

  const paddingTop = visibleRange.start * lineHeightPx;
  const paddingBottom = Math.max(0, (overlayLines.length - visibleRange.end) * lineHeightPx);

  const { theme: effectiveTheme } = useTheme();
  const activeTheme = theme || effectiveTheme;

  const allowLegacyWordFallback = useMemo(() => (
    analyzedWordsByIdentity.size === 0 && analyzedWordsByCharStart.size === 0
  ), [analyzedWordsByIdentity, analyzedWordsByCharStart]);

  const derivedAnalyzedWordsByCharStart = useMemo(() => {
    const derived = new Map(analyzedWordsByCharStart);

    for (const { lineIndex, tokens } of overlayLines) {
      for (const { token, start, wordIndex } of tokens) {
        if (!WORD_TOKEN_REGEX.test(token) || derived.has(start)) continue;
        const identityKey = `${lineIndex}:${Number.isInteger(wordIndex) ? wordIndex : -1}:${start}`;
        const nw = normalizeWordToken(token);
        const fromIdentity = analyzedWordsByIdentity.get(identityKey);
        if (fromIdentity) {
          derived.set(start, { ...fromIdentity, charStart: start, normalizedWord: fromIdentity.normalizedWord || nw });
          continue;
        }
        if (!allowLegacyWordFallback) continue;
        const fromWord = analyzedWords.get(nw);
        if (fromWord) {
          derived.set(start, { ...fromWord, charStart: start, normalizedWord: fromWord.normalizedWord || nw });
        }
      }
    }

    return derived;
  }, [
    analyzedWords,
    analyzedWordsByCharStart,
    analyzedWordsByIdentity,
    allowLegacyWordFallback,
    overlayLines,
  ]);

  const analysisSources = useMemo(() => ({
    analyzedWords,
    analyzedWordsByCharStart: derivedAnalyzedWordsByCharStart,
    analyzedWordsByIdentity,
  }), [analyzedWords, derivedAnalyzedWordsByCharStart, analyzedWordsByIdentity]);

  // Decoupled color logic via useColorCodex hook
  const { colorMap: hookColorMap, shouldColorWord: shouldColorWordHook } = useColorCodex(
    analysisSources, 
    activeConnections,
    vowelColors || DEFAULT_VOWEL_COLORS,
    syntaxLayer, 
    { theme: activeTheme, analysisMode }
  );

  const activeColorMap = colorMap || hookColorMap;

  // Build color activation context from active connections.
  // 1) Color direct connected words.
  // Pre-compute Set for O(1) highlighted line lookups (Fix 1)
  const highlightedLinesSet = useMemo(() => new Set(highlightedLines || []), [highlightedLines]);

  const emitWordActivation = useCallback((trigger, payload, event) => {
    if (!onWordActivate || !payload) return;

    const rect = event?.currentTarget?.getBoundingClientRect?.();
    onWordActivate({
      ...payload,
      trigger,
      source: trigger === "pin" && Number(event?.detail) === 0 ? "keyboard" : "pointer",
      anchorRect: rect
        ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
        : null,
      clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
      clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
    });
  }, [onWordActivate]);

  // Apply formatting to selected text
  const applyFormat = useCallback((type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // Use DOM value directly to avoid race conditions with React state
    const value = textarea.value;
    const selected = value.substring(start, end);

    const fmt = MARKDOWN_FORMATS[type];
    if (!fmt) return;

    let newContent;
    let newCursorPos;

    if (fmt.lineStart) {
      // Line-start formats (headings, lists) — toggle: remove prefix if already present
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      if (value.slice(lineStart).startsWith(fmt.prefix)) {
        newContent = value.slice(0, lineStart) + value.slice(lineStart + fmt.prefix.length);
        newCursorPos = Math.max(lineStart, end - fmt.prefix.length);
      } else {
        newContent = value.slice(0, lineStart) + fmt.prefix + value.slice(lineStart);
        newCursorPos = end + fmt.prefix.length;
      }
    } else {
      // Wrap selection
      newContent = value.slice(0, start) + fmt.prefix + selected + fmt.suffix + value.slice(end);
      newCursorPos = end + fmt.prefix.length + fmt.suffix.length;
    }

    setContent(newContent);

    // Restore cursor position
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, []);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return undefined;

    const measureLineHeight = () => {
      const computed = window.getComputedStyle(textarea);
      const lh = parseFloat(computed.lineHeight);
      if (lh && Number.isFinite(lh) && lh > 0) {
        setLineHeightPx(lh);
      }
    };

    measureLineHeight();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setEditorHeight(entry.contentRect.height);
      }
      measureLineHeight();
    });

    ro.observe(textarea);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!onContentChange) return undefined;
    const timeoutId = window.setTimeout(() => {
      onContentChange(content);
    }, CONTENT_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [content, onContentChange]);

  useEffect(() => {
    if (textareaRef.current && isEditable && !initialContent) {
      textareaRef.current.focus();
    }
  }, [isEditable, initialContent]);

  // Sync scroll positions between textarea and overlay
  useEffect(() => {
    if (isTruesight && textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  }, [isTruesight]);

  useEffect(() => {
    if (!isTruesight) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    if (textarea.scrollTop > maxScrollTop) {
      textarea.scrollTop = maxScrollTop;
    }

    const top = textarea.scrollTop;
    setScrollTop((prev) => (Math.abs(prev - top) > 1 ? top : prev));

    if (truesightOverlayRef.current) {
      truesightOverlayRef.current.scrollTop = top;
      truesightOverlayRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, [content, editorHeight, isTruesight]);

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const top = textarea.scrollTop;
    setScrollTop(top);
    onScrollChange?.(top);

    if (truesightOverlayRef.current) {
      truesightOverlayRef.current.scrollTop = top;
      truesightOverlayRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, [onScrollChange]);

  const handleOverlayScroll = useCallback(() => {
    if (truesightOverlayRef.current && textareaRef.current) {
      const top = truesightOverlayRef.current.scrollTop;
      textareaRef.current.scrollTop = top;
      textareaRef.current.scrollLeft = truesightOverlayRef.current.scrollLeft;
      setScrollTop(top);
      onScrollChange?.(top);
    }
  }, [onScrollChange]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setIsSaving(true);

    try {
      await onSave?.(title, content);
    } finally {
      setIsSaving(false);
    }
  }, [content, title, onSave]);

  const jumpToLine = useCallback((lineNum) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
      offset += lines[i].length + 1;
    }

    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    
    // Scroll into view
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
    textarea.scrollTop = (lineNum - 1) * lineHeight;
  }, [content]);

  const scrollTo = useCallback((y) => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = y;
    }
  }, []);

  // Expose editor controls to parent toolbar.
  useImperativeHandle(ref, () => ({
    applyFormat,
    save: handleSave,
    jumpToLine,
    scrollTo,
    replaceContent(newContent) {
      setContent(newContent);
      onContentChange?.(newContent);
    },
    get clientHeight() { return textareaRef.current?.clientHeight || 0; },
    get scrollHeight() { return textareaRef.current?.scrollHeight || 0; },
  }), [applyFormat, handleSave, jumpToLine, scrollTo, onContentChange]);

  const handleKeyDown = useCallback(
    (e) => {
      // IntelliSense navigation
      if (intellisenseSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setIntellisenseIndex(i => (i + 1) % intellisenseSuggestions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIntellisenseIndex(i => (i - 1 + intellisenseSuggestions.length) % intellisenseSuggestions.length);
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          handleAcceptSuggestion(intellisenseSuggestions[intellisenseIndex].token);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIntellisenseSuggestions([]);
          return;
        }
      }

      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    }, [handleSave, onCancel, intellisenseSuggestions, intellisenseIndex, handleAcceptSuggestion]);

  const emitCursorChange = useCallback((textarea) => {
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    onCursorChange?.({ line, col, offset: pos });
    setCursorVersion(v => v + 1);
  }, [onCursorChange]);

  const handleCursorChange = useCallback((event) => {
    emitCursorChange(event.target);
  }, [emitCursorChange]);

  const handleContentChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (nextValue.length > MAX_CONTENT_LENGTH) {
      setContent(nextValue.slice(0, MAX_CONTENT_LENGTH));
      return;
    }
    setContent(nextValue);
    setCursorVersion(v => v + 1);
    emitCursorChange(event.target);
  }, [emitCursorChange]);

  return (
    <motion.div
      className="scroll-editor"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      role="form"
      aria-label="Scroll editor"
    >
      <div className="editor-header">
        {isEditable ? (
          <div className="editor-title-container">
            <input
              id="scroll-title"
              type="text"
              className="editor-title-input"
              placeholder="Scroll Title..."
              aria-label="Scroll Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled || isSaving}
              maxLength={100}
              aria-required="true"
            />
            <button 
              type="button" 
              className="btn btn-primary save-scroll-btn"
              onClick={handleSave}
              disabled={disabled || isSaving || !content.trim()}
            >
              {isSaving ? "Saving..." : "Save Scroll"}
            </button>
          </div>
        ) : (
          <h2 className="editor-title-display">{title || "Untitled Scroll"}</h2>
        )}
      </div>

      <div className={`editor-body ${!isEditable ? "read-only" : ""}`}>
        <Gutter
          content={content}
          lineCounts={lineSyllableCounts}
          scrollTop={scrollTop}
          viewportHeight={editorHeight}
          lineHeightPx={lineHeightPx}
        />
        <div
          className="editor-textarea-wrapper"
        >
          {/* Read-only plain display — mirrors textarea white-space: pre-wrap exactly */}
          {!isEditable && !isTruesight && (
            <div className="markdown-rendered" aria-label={`Scroll content: ${title || "Untitled"}`}>
              {content}
            </div>
          )}
          {/* Textarea: visible when editing, or in read-only+Truesight for overlay sync */}
          <textarea
            id="scroll-content"
            ref={textareaRef}
            className={`editor-textarea ${isTruesight ? "truesight-transparent" : ""} ${!isEditable && !isTruesight ? "editor-textarea--hidden" : ""}`}
            style={{
              zIndex: isTruesight ? 1 : 10,
              pointerEvents: (!isEditable && isTruesight) ? 'none' : 'auto',
            }}
            aria-hidden={isTruesight && !isEditable && !!onWordActivate}
            placeholder={isEditable
              ? "Inscribe thy verses upon this sacred parchment..."
              : ""}
            value={content}
            onChange={handleContentChange}
            onKeyDown={isEditable ? handleKeyDown : undefined}
            onKeyUp={handleCursorChange}
            onClick={handleCursorChange}
            onBlur={() => setIntellisenseSuggestions([])}
            onScroll={handleScroll}
            disabled={disabled || isSaving}
            readOnly={!isEditable}
            spellCheck="false"
            maxLength={MAX_CONTENT_LENGTH}
            aria-required={isEditable}
            aria-label={`Scroll content: ${title || "Untitled"}`}
          />
          {isTruesight && (
            <div
              key={`overlay-${isTruesight}`}
              ref={truesightOverlayRef}
              className={`truesight-overlay ${isEditable ? "truesight-overlay--editing" : ""}`}
              style={{
                zIndex: 5,
                pointerEvents: isEditable ? 'none' : 'auto'
              }}
              aria-hidden={isEditable || !onWordActivate}
              onScroll={handleOverlayScroll}
            >
              <div style={{ paddingTop, paddingBottom }}>
                {windowedLines.map(({ lineIndex: li, tokens, lineType }) => {
                  const isGroupActive = highlightedLinesSet.size > 0;
                  const isHighlighted = highlightedLinesSet.has(li);
                  const isLineDimmed = isGroupActive && !isHighlighted;

                  return (
                    <div
                      key={li}
                      className={`truesight-line truesight-line--${lineType}${isLineDimmed ? ' truesight-line--dimmed' : ''}${isHighlighted ? ' truesight-line--highlighted' : ''}`}
                    >
                      {tokens.map(({ token, start, lineIndex, wordIndex }) => {
                        const isWord = WORD_TOKEN_REGEX.test(token);
                        const clean = isWord ? token.toUpperCase() : "";
                        const charStart = start;
                        const charEnd = charStart + token.length;
                        const identityKey = `${lineIndex}:${Number.isInteger(wordIndex) ? wordIndex : -1}:${charStart}`;
                        const analysis = isWord
                          ? (
                            analyzedWordsByIdentity.get(identityKey) ||
                            derivedAnalyzedWordsByCharStart.get(charStart) ||
                            (allowLegacyWordFallback ? analyzedWords.get(clean) : null)
                          )
                          : null;

                        if (!isWord) {
                          return <span key={start}>{token}</span>;
                        }

                        const isStopWord = STOP_WORDS.has(clean);
                        const wordVowelFamily = analysis
                          ? normalizeVowelFamily(analysis.vowelFamily)
                          : null;
                        const shouldColorWord = analysis
                          ? shouldColorWordHook(charStart, clean, wordVowelFamily)
                          : false;

                        const activeColors = vowelColors || DEFAULT_VOWEL_COLORS;
                        const fallbackColor = activeTheme === 'light' ? "#1a1a2e" : "#f8f9ff";
                        const codexEntry = shouldColorWord ? (activeColorMap?.get(charStart) ?? null) : null;
                        const color = shouldColorWord
                          ? (codexEntry?.color || activeColors[wordVowelFamily] || fallbackColor)
                          : undefined;
                        const wordOpacity = shouldColorWord
                          ? (codexEntry?.opacity ?? undefined)
                          : undefined;
                        const isMultiSyllable = shouldColorWord && codexEntry?.isMultiSyllable;
                        const isLineHighlighted = highlightedLinesSet.has(lineIndex);

                        const wordPayload = {
                          word: token,
                          normalizedWord: clean,
                          lineIndex,
                          wordIndex: Number.isInteger(wordIndex) ? wordIndex : -1,
                          charStart,
                          charEnd,
                          vowelFamily: shouldColorWord ? (wordVowelFamily || null) : null,
                          isStopWord,
                        };

                        const wordClassName = [
                          'grimoire-word',
                          !shouldColorWord ? 'grimoire-word--grey' : '',
                          isMultiSyllable ? 'word--multi-rhyme' : '',
                          isLineHighlighted ? 'grimoire-word--rhyme-highlight' : '',
                        ].filter(Boolean).join(' ');

                        if (!onWordActivate) {
                          return (
                            <span
                              key={start}
                              className={wordClassName}
                              style={{ color, opacity: wordOpacity }}
                              data-char-start={charStart}
                            >
                              {token}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={start}
                            type="button"
                            className={`${wordClassName} grimoire-word--interactive`}
                            style={{ color, opacity: wordOpacity }}
                            data-char-start={charStart}
                            data-line-index={lineIndex}
                            data-word-index={wordIndex}
                            aria-label={token}
                            onClick={(event) => emitWordActivation("pin", wordPayload, event)}
                          >
                            {token}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isPredictive && intellisenseSuggestions.length > 0 && (
          <IntelliSense
            suggestions={intellisenseSuggestions}
            selectedIndex={intellisenseIndex}
            position={intellisensePos}
            onAccept={handleAcceptSuggestion}
            onHover={setIntellisenseIndex}
            ghostLine={intellisenseSuggestions[intellisenseIndex]?.ghostLine || null}
            badges={intellisenseSuggestions[intellisenseIndex]?.badges || []}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default ScrollEditor;
