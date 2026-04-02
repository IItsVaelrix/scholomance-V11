import { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useColorCodex } from "../../hooks/useColorCodex.js";
import IntelliSense from "../../components/IntelliSense.jsx";
import { computeGridTopology } from "../../lib/truesight/compiler/truesightGrid";
import { computeAdaptiveGridTopology, buildTruesightOverlayLines } from "../../lib/truesight/compiler/adaptiveWhitespaceGrid";
import { loadCorpusFrequencies } from "../../lib/truesight/compiler/corpusWhitespaceGrid";
import { ViewportChannel } from "../../lib/truesight/compiler/viewportBytecode";
import Gutter from "./Gutter.jsx";
import { normalizeVowelFamily } from "../../lib/phonology/vowelFamily.js";
import { WORD_TOKEN_REGEX } from "../../lib/wordTokenization.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { decodeBytecode } from "./bytecodeRenderer.js";
import { VOWEL_FAMILY_TO_SCHOOL } from "../../data/schools.js";

const MAX_CONTENT_LENGTH = 50000;
const DEFAULT_LINE_HEIGHT = 24;

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

/**
 * Resolves a word token at the given character offset.
 * Uses the syntaxLayer if available, otherwise falls back to regex tokenization.
 */
function resolveWordTokenAtOffset(cursorOffset, syntaxLayer, content) {
  if (!syntaxLayer || typeof syntaxLayer !== "object") {
    // Fallback: basic tokenization from content
    const beforeCursor = String(content || "").slice(0, Math.max(0, cursorOffset));
    const lines = beforeCursor.split("\n");
    const lineNumber = Math.max(0, lines.length - 1);
    const currentLineText = lines[lines.length - 1] || "";
    const words = currentLineText.match(WORD_TOKEN_REGEX) || [];
    const targetWordIndex = words.length;
    
    return {
      lineNumber,
      wordIndex: targetWordIndex,
      charStart: beforeCursor.length,
      charEnd: beforeCursor.length,
      token: words[targetWordIndex - 1] || "",
    };
  }

  // Use syntax layer for precise token resolution
  const beforeCursor = String(content || "").slice(0, Math.max(0, cursorOffset));
  const linesBefore = beforeCursor.split("\n");
  const lineNumber = Math.max(0, linesBefore.length - 1);
  const currentLineText = linesBefore[linesBefore.length - 1] || "";
  const words = currentLineText.match(WORD_TOKEN_REGEX) || [];
  const targetWordIndex = words.length;

  const syntaxToken = findSyntaxTokenForCursor(
    syntaxLayer,
    lineNumber,
    targetWordIndex,
    cursorOffset
  );

  if (syntaxToken) {
    return {
      ...syntaxToken,
      lineNumber: toFiniteInt(syntaxToken?.lineNumber, lineNumber),
      wordIndex: toFiniteInt(syntaxToken?.wordIndex, targetWordIndex),
      charStart: toFiniteInt(syntaxToken?.charStart, cursorOffset),
      charEnd: toFiniteInt(syntaxToken?.charEnd, cursorOffset),
    };
  }

  // Fallback
  return {
    lineNumber,
    wordIndex: targetWordIndex,
    charStart: cursorOffset,
    charEnd: cursorOffset,
    token: "",
  };
}

/**
 * Builds a word activation payload from a token entry.
 */
function buildWordPayloadFromToken(tokenEntry) {
  if (!tokenEntry) return null;

  const rawToken = tokenEntry.token || "";
  const normalizedWord = normalizeWordToken(rawToken);
  const vowelFamily = tokenEntry.vowelFamily || null;
  const school = vowelFamily ? VOWEL_FAMILY_TO_SCHOOL[normalizeVowelFamily(vowelFamily)] : null;

  return {
    word: rawToken,
    normalizedWord,
    charStart: toFiniteInt(tokenEntry?.charStart, -1),
    charEnd: toFiniteInt(tokenEntry?.charEnd, -1),
    lineNumber: toFiniteInt(tokenEntry?.lineNumber, -1),
    wordIndex: toFiniteInt(tokenEntry?.wordIndex, -1),
    vowelFamily,
    school,
    analysis: tokenEntry.analysis || null,
    bytecode: tokenEntry.visualBytecode || tokenEntry.trueVisionBytecode || null,
  };
}

/**
 * Emits a word activation event via the onWordActivate callback.
 */
function emitWordActivation(trigger, wordPayload, anchorRect, onWordActivate) {
  if (!onWordActivate || !wordPayload) return;

  const activation = {
    trigger,
    ...wordPayload,
    anchorRect,
  };

  onWordActivate(activation);
}

/**
 * Determines if a word should be colored based on bytecode and context.
 * Used when useColorCodex hook is not available.
 */
function shouldColorWordHook(charStart, normalizedWord, vowelFamily, bytecodeByCharStart, analysisMode, activeConnections) {
  const isStopWord = STOP_WORDS.has(normalizedWord);
  const entry = bytecodeByCharStart?.get(charStart);
  const bytecode = entry?.bytecode;

  // PixelBrain/VoidEcho modes bypass typical stop-word filters for structural analysis
  const isAMPMode = analysisMode === "pixelbrain_transverse" || analysisMode === "void_echo";

  if (!bytecode) {
    if ((analysisMode === "vowel" || isAMPMode) && !isStopWord) {
      return !!vowelFamily;
    }
    return false;
  }

  if (bytecode.effectClass === "INERT" && !isAMPMode) {
    return false;
  }

  if (analysisMode === "vowel" || isAMPMode) {
    return !isStopWord || isAMPMode; // AMP modes color everything
  }

  const isRhymeMode = analysisMode === "rhyme" || (analysisMode === "none" && activeConnections?.length > 0);

  if (isRhymeMode) {
    if (isStopWord) {
      return false;
    }
    return bytecode.glowIntensity > 0 || bytecode.effectClass !== "INERT";
  }

  return bytecode.glowIntensity > 0 || bytecode.effectClass !== "INERT";
}


// Cached styles to avoid layout thrashing during animation frames
let cachedEditorStyles = null;

function getCursorCoordsFromTextarea(textarea, mirrored = false, topology = null) {
  if (!textarea) return { x: 0, y: 0 };
  
  // Use cached styles if available to avoid getComputedStyle layout thrashing
  if (!cachedEditorStyles) {
    const s = window.getComputedStyle(textarea);
    cachedEditorStyles = {
      fontSize: parseFloat(s.fontSize) || 16,
      lineHeightStr: s.lineHeight,
      fontWeight: s.fontWeight,
      fontFamily: s.fontFamily,
      paddingLeft: parseFloat(s.paddingLeft) || 0,
      paddingTop: parseFloat(s.paddingTop) || 0,
    };
    
    // Auto-clear cache after 5 seconds or on resize
    setTimeout(() => { cachedEditorStyles = null; }, 5000);
  }

  const { fontSize, lineHeightStr, fontWeight, fontFamily, paddingLeft, paddingTop } = cachedEditorStyles;
  let lineHeight = parseFloat(lineHeightStr);
  
  if (!lineHeightStr.includes('px') && lineHeight < 10) {
    lineHeight = lineHeight * fontSize;
  }
  if (isNaN(lineHeight)) lineHeight = fontSize * 1.5;

  const rect = textarea.getBoundingClientRect();
  const pos = textarea.selectionStart;
  const text = textarea.value.substring(0, pos);
  const lines = text.split('\n');
  const lineNum = lines.length - 1;
  const currentLineText = lines[lineNum];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(currentLineText).width;

  let x = paddingLeft + textWidth;

  // Apply mirroring if enabled
  if (mirrored && topology) {
    // For a single point (the caret), we use the point mirror formula: x' = (totalWidth - x)
    // We base it on the topology content width
    x = topology.totalWidth - x;
  }

  return {
    x: rect.left + x,
    y: rect.top + paddingTop + (lineNum * lineHeight) + (lineHeight * 0.8) - textarea.scrollTop,
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
  onContentChange,
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  lineSyllableCounts = [],
  highlightedLines = [],
  pinnedLines = null,
  syntaxLayer = null,
  analysisMode = 'none',
  onWordActivate,
  onCursorChange,
  onScrollChange,
  mirrored = false,
  vowelColors = {},
}, ref) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [contentForOverlay, setContentForOverlay] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT);
  const [intellisenseSuggestions, setIntellisenseSuggestions] = useState([]);
  const scrollTopRef = useRef(0);
  const [ghostData, setGhostData] = useState(null);   // { sortedLines, initialYMap }
  const [isGhostPinned, setIsGhostPinned] = useState(false);
  const [intellisenseIndex, setIntellisenseIndex] = useState(0);
  const textareaRef = useRef(null);
  const wordBackgroundLayerRef = useRef(null);
  const markdownRef = useRef(null);
  const isReadOnlyTruesight = isTruesight && !isEditable;
  const isReadOnlyPlain = !isTruesight && !isEditable;

  // Bytecode-driven viewport integration
  const [viewportState, setViewportState] = useState(() => ViewportChannel.getState());
  
  // Subscribe to viewport bytecode channel
  useEffect(() => {
    const unsubscribe = ViewportChannel.bind('scroll-editor', (vp) => {
      setViewportState(vp);
    });
    
    return unsubscribe;
  }, []);
  
  // Load corpus for CEAG (Corpus-Enhanced Adaptive Grid)
  useEffect(() => {
    loadCorpusFrequencies().then(freq => {
      if (freq.size > 0) {
        console.log(`[ScrollEditor] CEAG loaded ${freq.size} corpus words`);
      }
    });
  }, []);
  
  // Bytecode-driven cursor alignment
  // Adaptive grid topology that updates on resize/CSS variable changes
  const wrapperRef = useRef(null);
  const [computedTypography, setComputedTypography] = useState(null);
  const [gridTopology, setGridTopology] = useState(null);
  const [adaptiveTopology, setAdaptiveTopology] = useState(null);
  
  // Compute typography and grid topology from wrapper's computed styles
  const updateTypography = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const styles = window.getComputedStyle(wrapper);
    const topology = computeGridTopology(wrapper);

    // Collect sample tokens from content for adaptive measurement
    const sampleTokens = content?.split(/\s+/).slice(0, 10) || [];
    const adaptiveTopo = computeAdaptiveGridTopology(wrapper, sampleTokens);

    setComputedTypography({
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      wordSpacing: styles.wordSpacing,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
    });

    if (topology) {
      setGridTopology(topology);
    }

    if (adaptiveTopo) {
      setAdaptiveTopology(adaptiveTopo);
      if (adaptiveTopo.baseCellHeight) {
        setLineHeightPx(adaptiveTopo.baseCellHeight);
      }
    }
  }, [content]);
  
  // Initial capture + adaptive updates via ResizeObserver
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    // Initial computation
    updateTypography();
    
    // Adaptive: watch for CSS variable changes via ResizeObserver
    const observer = new ResizeObserver(() => {
      updateTypography();
    });
    
    observer.observe(wrapper);
    
    return () => {
      observer.disconnect();
    };
  }, [updateTypography]);
  
  const cursorSync = useMemo(() => {
    if (!computedTypography || !gridTopology) return null;
    
    return {
      textareaStyles: {
        fontFamily: computedTypography.fontFamily,
        fontSize: computedTypography.fontSize,
        lineHeight: computedTypography.lineHeight,
        letterSpacing: computedTypography.letterSpacing,
        wordSpacing: computedTypography.wordSpacing,
        paddingTop: computedTypography.paddingTop,
        paddingRight: computedTypography.paddingRight,
        paddingBottom: computedTypography.paddingBottom,
        paddingLeft: computedTypography.paddingLeft,
        tabSize: 2,
        MozTabSize: 2,
        boxSizing: 'border-box',
        WebkitTextFillColor: 'currentColor',
        resize: 'none',
        overflow: 'auto',
      },
      overlayStyles: {
        fontFamily: computedTypography.fontFamily,
        fontSize: computedTypography.fontSize,
        lineHeight: computedTypography.lineHeight,
        letterSpacing: computedTypography.letterSpacing,
        wordSpacing: computedTypography.wordSpacing,
        paddingTop: computedTypography.paddingTop,
        paddingRight: computedTypography.paddingRight,
        paddingBottom: computedTypography.paddingBottom,
        paddingLeft: computedTypography.paddingLeft,
        tabSize: 2,
        MozTabSize: 2,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
      },
      gridTopology,
    };
  }, [computedTypography, gridTopology]);

  useEffect(() => {
    const handleResize = () => { cachedEditorStyles = null; };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const reducedMotion = usePrefersReducedMotion();
  const { theme: activeTheme } = useTheme();

  const containerWidth = useMemo(() => {
    if (adaptiveTopology && adaptiveTopology.totalWidth > 0) {
      return adaptiveTopology.totalWidth;
    }
    return 800;
  }, [adaptiveTopology]);

  const { lines: overlayLines, allTokens: allOverlayTokens } = useMemo(
    () => adaptiveTopology ? buildTruesightOverlayLines(contentForOverlay, containerWidth, adaptiveTopology) : { lines: [], allTokens: [] },
    [contentForOverlay, containerWidth, adaptiveTopology]
  );

  const derivedAnalyzedWordsByCharStart = useMemo(() => {
    const map = new Map();
    if (analyzedWordsByCharStart instanceof Map) {
      for (const [charStart, analysis] of analyzedWordsByCharStart.entries()) {
        map.set(Number(charStart), analysis);
      }
    }
    return map;
  }, [analyzedWordsByCharStart]);

  const allowLegacyWordFallback = true;

  const highlightedLinesSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(highlightedLines)) {
      for (const lineIndex of highlightedLines) {
        set.add(Number(lineIndex));
      }
    }
    return set;
  }, [highlightedLines]);

  const { bytecodeByCharStart } = useColorCodex(
    Array.from(analyzedWordsByIdentity.values()).map((analysis) => ({
      charStart: analysis.charStart,
      visualBytecode: analysis.visualBytecode || analysis.trueVisionBytecode,
      vowelFamily: analysis.vowelFamily,
    })),
    activeConnections,
    syntaxLayer,
    { analysisMode }
  );

  const getViewportNode = useCallback(() => {
    if (isReadOnlyTruesight) return wordBackgroundLayerRef.current;
    if (isReadOnlyPlain) return markdownRef.current;
    return textareaRef.current;
  }, [isReadOnlyPlain, isReadOnlyTruesight]);

  const syncScrollPosition = useCallback((top, left = 0, source = null) => {
    const nextTop = Number.isFinite(top) ? Math.max(0, top) : 0;
    const nextLeft = Number.isFinite(left) ? Math.max(0, left) : 0;

    scrollTopRef.current = nextTop;
    setScrollTop((prev) => (Math.abs(prev - nextTop) > 1 ? nextTop : prev));
    onScrollChange?.(nextTop);

    const peers = [textareaRef.current, wordBackgroundLayerRef.current, markdownRef.current];
    for (const node of peers) {
      if (!node || node === source) continue;
      if (Math.abs((node.scrollTop ?? 0) - nextTop) > 1) node.scrollTop = nextTop;
      if (Math.abs((node.scrollLeft ?? 0) - nextLeft) > 1) node.scrollLeft = nextLeft;
    }
  }, [onScrollChange]);

  const handleTextareaScroll = useCallback(() => {
    if (isReadOnlyPlain) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    syncScrollPosition(textarea.scrollTop, textarea.scrollLeft, textarea);
  }, [isReadOnlyPlain, syncScrollPosition]);

  const handleOverlayScroll = useCallback(() => {
    const layer = wordBackgroundLayerRef.current;
    if (!layer) return;
    syncScrollPosition(layer.scrollTop, layer.scrollLeft, layer);
  }, [syncScrollPosition]);

  const handleMarkdownScroll = useCallback(() => {
    if (!isReadOnlyPlain) return;
    const markdown = markdownRef.current;
    if (!markdown) return;
    syncScrollPosition(markdown.scrollTop, markdown.scrollLeft, markdown);
  }, [isReadOnlyPlain, syncScrollPosition]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await onSave?.(title, content);
    } finally {
      setIsSaving(false);
    }
  }, [content, title, onSave]);

  useLayoutEffect(() => {
    if (pinnedLines && pinnedLines.length > 0) {
      const sorted = [...pinnedLines].sort((a, b) => a - b);
      const initialYMap = new Map();
      for (const li of sorted) {
        initialYMap.set(li, li * lineHeightPx - scrollTopRef.current);
      }
      setGhostData({ sortedLines: sorted, initialYMap });
      setIsGhostPinned(true);
    } else {
      setIsGhostPinned(false);
    }
  }, [pinnedLines, lineHeightPx]);

  const jumpToLine = useCallback((lineNum) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
      offset += lines[i].length + 1;
    }
    if (isEditable) {
      textarea.focus();
      textarea.setSelectionRange(offset, offset);
    }
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
    const viewport = getViewportNode();
    const nextTop = Math.max(0, (lineNum - 1) * lineHeight);
    if (viewport) {
      viewport.scrollTop = nextTop;
      syncScrollPosition(viewport.scrollTop, viewport.scrollLeft, viewport);
      return;
    }
    textarea.scrollTop = nextTop;
    syncScrollPosition(textarea.scrollTop, textarea.scrollLeft, textarea);
  }, [content, getViewportNode, isEditable, syncScrollPosition]);

  const scrollTo = useCallback((y) => {
    const viewport = getViewportNode();
    if (!viewport) return;
    viewport.scrollTop = y;
    syncScrollPosition(viewport.scrollTop, viewport.scrollLeft, viewport);
  }, [getViewportNode, syncScrollPosition]);

  const scrollToTopSmooth = useCallback(() => {
    const viewport = getViewportNode();
    if (!viewport) return;
    if ('scrollBehavior' in document.documentElement.style) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const start = viewport.scrollTop;
    if (start === 0) return;
    const duration = 320;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      viewport.scrollTop = start * (1 - ease);
      syncScrollPosition(viewport.scrollTop, viewport.scrollLeft, viewport);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [getViewportNode, syncScrollPosition]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    jumpToLine,
    scrollTo,
    scrollToTopSmooth,
    replaceContent(newContent) {
      setContent(newContent);
      setContentForOverlay(newContent);
      onContentChange?.(newContent);
    },
    get clientHeight() { return getViewportNode()?.clientHeight || 0; },
    get scrollHeight() { return getViewportNode()?.scrollHeight || 0; },
  }), [getViewportNode, handleSave, jumpToLine, scrollTo, scrollToTopSmooth, onContentChange]);

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
    setContentForOverlay(newContent);
    onContentChange?.(newContent);
    setIntellisenseSuggestions([]);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content, onContentChange]);

  const handleKeyDown = useCallback(
    (e) => {
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
          handleAcceptSuggestion(intellisenseSuggestions[intellisenseIndex]?.token);
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
  }, [onCursorChange]);

  const handleCursorChange = useCallback((event) => {
    emitCursorChange(event.target);
  }, [emitCursorChange]);

  const handleTextareaClick = useCallback((event) => {
    const textarea = event.currentTarget;
    emitCursorChange(textarea);
    if (!onWordActivate || textarea.selectionStart !== textarea.selectionEnd) return;
    const tokenEntry = resolveWordTokenAtOffset(textarea.selectionStart, syntaxLayer, content);
    const wordPayload = buildWordPayloadFromToken(tokenEntry);
    if (!wordPayload) return;
    const caretCoords = getCursorCoordsFromTextarea(textarea, mirrored, adaptiveTopology);
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || DEFAULT_LINE_HEIGHT;
    emitWordActivation("pin", wordPayload, {
      anchorRect: {
        left: caretCoords.x,
        right: caretCoords.x + 1,
        top: caretCoords.y - lineHeight,
        bottom: caretCoords.y,
        width: 1,
        height: lineHeight,
      },
      clientX: Number.isFinite(event.clientX) ? event.clientX : caretCoords.x,
      clientY: Number.isFinite(event.clientY) ? event.clientY : caretCoords.y,
      detail: event.detail,
      source: "pointer",
    }, onWordActivate);
  }, [content, emitCursorChange, mirrored, onWordActivate, adaptiveTopology, syntaxLayer]);

  const handleContentChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (nextValue.length > MAX_CONTENT_LENGTH) {
      const truncated = nextValue.slice(0, MAX_CONTENT_LENGTH);
      setContent(truncated);
      setContentForOverlay(truncated);
      return;
    }
    setContent(nextValue);
    emitCursorChange(event.target);
    setContentForOverlay(nextValue);
  }, [emitCursorChange]);

  const containerHeight = viewportState?.height || 800;

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

        {isEditable && (
          <div className="editor-toolbar">
            <button 
              type="button" 
              className="toolbar-btn toolbar-btn--bytecode" 
              onClick={() => {
                const bytecode = allOverlayTokens.map(t => t.token).join(' ');
                navigator.clipboard.writeText(bytecode);
              }} 
              title="Copy Bytecode Stream"
            >
              <span className="material-symbols-outlined">data_object</span>
              <span className="btn-label">COPY_BYTECODE</span>
            </button>
          </div>
        )}
      </div>

      <div className={`editor-body ${!isEditable ? "read-only" : ""}`}>
        <Gutter
          overlayLines={overlayLines}
          lineCounts={lineSyllableCounts}
          scrollTop={scrollTop}
          viewportHeight={containerHeight}
          lineHeightPx={lineHeightPx}
        />
        <div ref={wrapperRef} className="editor-textarea-wrapper">
          {!isEditable && !isTruesight && (
            <div
              ref={markdownRef}
              className="markdown-rendered"
              aria-label={`Scroll content: ${title || "Untitled"}`}
              onScroll={handleMarkdownScroll}
            >
              {content}
            </div>
          )}
          {isTruesight && (
            <div
              ref={wordBackgroundLayerRef}
              className="word-background-layer"
              style={cursorSync?.overlayStyles}
              aria-hidden="true"
              onScroll={handleOverlayScroll}
            >
              <div>
                {overlayLines.map(({ lineIndex: li, rawLineIndex, tokens, lineType }) => {
                  const isGroupActive = highlightedLinesSet.size > 0;
                  const isHighlighted = highlightedLinesSet.has(rawLineIndex);
                  const isLineDimmed = (isGroupActive && !isHighlighted) || isGhostPinned;

                  return (
                    <div
                      key={li}
                      className={`truesight-line truesight-line--${lineType}${isLineDimmed ? ' truesight-line--dimmed' : ''}${isHighlighted ? ' truesight-line--highlighted' : ''}`}
                    >
                      {tokens.map(({ token, localStart, localEnd, lineIndex, wordIndex, x: tokenX, width: tokenWidth }) => {
                        const isWord = WORD_TOKEN_REGEX.test(token);
                        const clean = isWord ? token.toUpperCase() : "";
                        const charStart = localStart;
                        const charEnd = localEnd;
                        const identityKey = `${lineIndex}:${Number.isInteger(wordIndex) ? wordIndex : -1}:${charStart}`;
                        const analysis = isWord
                          ? (
                            analyzedWordsByIdentity.get(identityKey) ||
                            derivedAnalyzedWordsByCharStart.get(charStart) ||
                            (allowLegacyWordFallback ? analyzedWords.get(clean) : null)
                          )
                          : null;

                        const pixelX = tokenX || 0;
                        const pixelWidth = tokenWidth || null;

                        const commonStyle = {
                          position: 'absolute',
                          left: `${pixelX}px`,
                          width: pixelWidth ? `${pixelWidth}px` : 'auto',
                          whiteSpace: 'pre',
                        };

                        if (!isWord) {
                          return <span key={localStart} style={{ ...commonStyle, pointerEvents: 'none' }}>{token}</span>;
                        }

                        const wordVowelFamily = analysis ? normalizeVowelFamily(analysis?.vowelFamily) : null;
                        const bytecode = analysis?.visualBytecode || analysis?.trueVisionBytecode || null;
                        const shouldColor = bytecode && bytecode.effectClass !== 'INERT'
                          ? shouldColorWordHook(charStart, clean, wordVowelFamily, bytecodeByCharStart, analysisMode, activeConnections)
                          : false;
                        const decoded = bytecode && shouldColor ? decodeBytecode(bytecode, { reducedMotion, theme: activeTheme }) : null;
                        const color = decoded?.color || (wordVowelFamily ? vowelColors[wordVowelFamily] : null);
                        const isLineHighlighted = highlightedLinesSet.has(lineIndex);

                        const wordStyle = {
                          ...commonStyle,
                          color: color || undefined,
                          ...(decoded?.style || {}),
                          pointerEvents: 'auto',
                          cursor: 'pointer',
                          ...(isLineHighlighted ? { backgroundColor: 'rgba(101, 31, 255, 0.13)', borderRadius: '0.5rem' } : {}),
                        };

                        return (
                          <span
                            key={localStart}
                            role="button"
                            tabIndex={0}
                            className={[
                              'truesight-word',
                              (shouldColor || wordVowelFamily) ? 'grimoire-word' : 'grimoire-word--grey',
                              decoded?.className || '',
                              isLineHighlighted ? 'grimoire-word--rhyme-highlight' : '',
                            ].filter(Boolean).join(' ')}
                            style={wordStyle}
                            onClick={() => {
                              if (analysis) {
                                onWordActivate?.({ word: token, analysis, charStart, charEnd });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (analysis) onWordActivate?.({ word: token, analysis, charStart, charEnd });
                              }
                            }}
                          >
                            {token}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <textarea
            id="scroll-content"
            ref={textareaRef}
            className={`editor-textarea ${isTruesight ? "truesight-transparent editor-textarea--underlay" : "editor-textarea--foreground"} ${!isEditable && !isTruesight ? "editor-textarea--hidden" : ""} ${isReadOnlyTruesight ? "editor-textarea--read-only-truesight" : ""}`}
            style={cursorSync?.textareaStyles}
            aria-hidden={isTruesight && !isEditable && !!onWordActivate}
            placeholder={isEditable ? "Inscribe thy verses upon this sacred parchment..." : ""}
            value={content}
            onChange={handleContentChange}
            onKeyDown={isEditable ? handleKeyDown : undefined}
            onKeyUp={handleCursorChange}
            onClick={handleTextareaClick}
            onBlur={() => setIntellisenseSuggestions([])}
            onScroll={handleTextareaScroll}
            disabled={disabled || isSaving}
            readOnly={!isEditable}
            spellCheck="false"
            maxLength={MAX_CONTENT_LENGTH}
            aria-required={isEditable}
            aria-label={`Scroll content: ${title || "Untitled"}`}
          />

          {isTruesight && ghostData && (
            <div className="truesight-ghost-layer" aria-hidden="true">
              <AnimatePresence onExitComplete={() => setGhostData(null)}>
                {isGhostPinned && ghostData.sortedLines.map((li, i) => {
                  const lineData = overlayLines.find(l => l.rawLineIndex === li);
                  if (!lineData) return null;
                  const initialY = ghostData.initialYMap.get(li) ?? 0;
                  const targetY = 8 + i * (lineHeightPx + 4);
                  return (
                    <motion.div
                      key={`ghost-${li}`}
                      className="truesight-line truesight-line--highlighted truesight-ghost-line"
                      initial={{ y: initialY, opacity: 0.6, scale: 0.98 }}
                      animate={{ y: targetY, opacity: 1, scale: 1 }}
                      exit={{ y: initialY, opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 140, damping: 20, mass: 0.8, restDelta: 0.001 }}
                      style={{ willChange: "transform, opacity", contain: "layout paint style" }}
                    >
                      {lineData.tokens.map(({ token, localStart, localEnd, wordIndex }) => {
                        const isWord = WORD_TOKEN_REGEX.test(token);
                        if (!isWord) return <span key={localStart}>{token}</span>;
                        const clean = token.toUpperCase();
                        const charStart = localStart;
                        const charEnd = localEnd;
                        const identityKey = `${li}:${Number.isInteger(wordIndex) ? wordIndex : -1}:${charStart}`;
                        const analysis = analyzedWordsByIdentity.get(identityKey)
                          || derivedAnalyzedWordsByCharStart.get(charStart)
                          || (allowLegacyWordFallback ? analyzedWords.get(clean) : null);
                        const wordVowelFamily = analysis ? normalizeVowelFamily(analysis?.vowelFamily) : null;
                        const bytecode = analysis?.visualBytecode || analysis?.trueVisionBytecode || null;
                        const shouldColor = bytecode && bytecode.effectClass !== 'INERT'
                          ? shouldColorWordHook(charStart, clean, wordVowelFamily, bytecodeByCharStart, analysisMode, activeConnections)
                          : false;
                        const decoded = bytecode && shouldColor ? decodeBytecode(bytecode, { reducedMotion, theme: activeTheme }) : null;
                        const color = decoded?.color || (wordVowelFamily ? vowelColors[wordVowelFamily] : null);
                        const isMultiSyllable = (shouldColor || wordVowelFamily) && (decoded?.syllableDepth >= 2);
                        const isRichMultiSyllable = (shouldColor || wordVowelFamily) && (decoded?.syllableDepth >= 3);

                        return (
                          <span
                            key={charStart}
                            role="button"
                            tabIndex={0}
                            className={[
                              "truesight-word",
                              (shouldColor || wordVowelFamily) ? "grimoire-word" : "grimoire-word--grey",
                              decoded?.className || "",
                              isMultiSyllable ? "word--multi-rhyme" : "",
                              isRichMultiSyllable ? "word--multi-rhyme--rich" : "",
                            ].filter(Boolean).join(" ")}
                            style={{ color: color || undefined, ...(decoded?.style || {}), pointerEvents: 'auto', cursor: 'pointer' }}
                            onClick={() => {
                              if (analysis) onWordActivate?.({ word: token, analysis, charStart, charEnd });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (analysis) onWordActivate?.({ word: token, analysis, charStart, charEnd });
                              }
                            }}
                          >
                            {token}
                          </span>
                        );
                      })}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isPredictive && intellisenseSuggestions.length > 0 && (
          <IntelliSense
            suggestions={intellisenseSuggestions}
            selectedIndex={intellisenseIndex}
            position={{ x: 0, y: 0 }}
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
