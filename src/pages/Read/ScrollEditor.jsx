import { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationIntent } from "../../ui/animation/hooks/useAnimationIntent";
import { motionToCssVars } from "../../ui/animation/adapters/motionToCssVars";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useColorCodex } from "../../hooks/useColorCodex.js";
import IntelliSense from "../../components/IntelliSense.jsx";
import { computeGridTopology, compileTokensToGrid, gridToPixels } from "../../lib/truesight/compiler/truesightGrid";
import { computeAdaptiveGridTopology, compileAdaptiveGrid, getAdaptiveTokenWidth } from "../../lib/truesight/compiler/adaptiveWhitespaceGrid";
import { loadCorpusFrequencies } from "../../lib/truesight/compiler/corpusWhitespaceGrid";
import { ViewportChannel } from "../../lib/truesight/compiler/viewportBytecode";
import Gutter from "./Gutter.jsx";
import { normalizeVowelFamily } from "../../lib/phonology/vowelFamily.js";
import { LINE_TOKEN_REGEX, WORD_TOKEN_REGEX } from "../../lib/wordTokenization.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { decodeBytecode } from "./bytecodeRenderer.js";

const MAX_CONTENT_LENGTH = 50000;
const CONTENT_DEBOUNCE_MS = 300;
const MIN_EDITOR_HEIGHT = 0;
const DEFAULT_LINE_HEIGHT = 24;
const MARKDOWN_FORMATS = {
  heading: { prefix: "## ", suffix: "", lineStart: true },
  bold: { prefix: "**", suffix: "**", lineStart: false },
  italic: { prefix: "*", suffix: "*", lineStart: false },
  code: { prefix: "`", suffix: "`", lineStart: false },
  bullet: { prefix: "- ", suffix: "", lineStart: true },
  number: { prefix: "1. ", suffix: "", lineStart: true },
  quote: { prefix: "> ", suffix: "", lineStart: true },
};

function buildOverlayLines(content) {
  const rawLines = String(content || "").split("\n");
  const lines = [];
  const allTokens = [];

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
      const localStart = match.index ?? 0;  // Position WITHIN lineText
      const localEnd = localStart + token.length;
      const isWord = WORD_TOKEN_REGEX.test(token);
      const tokenData = {
        token,
        localStart,  // Line-relative position
        localEnd,
        lineIndex,
        wordIndex: isWord ? wordIndex : null,
      };
      tokens.push(tokenData);
      allTokens.push(tokenData);
      if (isWord) {
        wordIndex += 1;
      }
    }

    lines.push({ lineIndex, lineText, tokens, lineType });
  }

  return { lines, allTokens };
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
  documentIdentity = "new",
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
  onTitleChange,
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  lineSyllableCounts = [],
  plsPhoneticFeatures = null,
  highlightedLines = [],
  pinnedLines = null,
  syntaxLayer = null,
  analysisMode = 'none',
  theme = 'dark',
  onWordActivate,
  onCursorChange,
  onScrollChange,
  mirrored = false,
}, ref) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [contentForOverlay, setContentForOverlay] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT);
  const [intellisenseSuggestions, setIntellisenseSuggestions] = useState([]);
  const scrollTopRef = useRef(0);
  const [ghostData, setGhostData] = useState(null);   // { sortedLines, initialYMap }
  const [isGhostPinned, setIsGhostPinned] = useState(false);
  const [intellisenseIndex, setIntellisenseIndex] = useState(0);
  const [intellisensePos, setIntellisensePos] = useState({ x: 0, y: 0 });
  const [cursorVersion, setCursorVersion] = useState(0);
  const textareaRef = useRef(null);
  const truesightOverlayRef = useRef(null);
  const wordBackgroundLayerRef = useRef(null);
  const markdownRef = useRef(null);
  const isReadOnlyTruesight = isTruesight && !isEditable;
  const isReadOnlyPlain = !isTruesight && !isEditable;
  const documentIdentityRef = useRef(documentIdentity);

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
    // (CSS variable changes often trigger layout recalcs)
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

      if (Math.abs((node.scrollTop ?? 0) - nextTop) > 1) {
        node.scrollTop = nextTop;
      }

      if (Math.abs((node.scrollLeft ?? 0) - nextLeft) > 1) {
        node.scrollLeft = nextLeft;
      }
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

  // Capture ghost positions synchronously before scroll animation starts
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
    
    // Use native smooth scroll if available for better GPU/browser optimization
    if ('scrollBehavior' in document.documentElement.style) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
      // We still need to sync peers during the animation, but the browser
      // will handle the heavy lifting of the viewport itself.
      // A one-shot sync after animation might be needed if scroll events don't fire fast enough.
      return;
    }

    const start = viewport.scrollTop;
    if (start === 0) return;
    const duration = 320;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      viewport.scrollTop = start * (1 - ease);
      syncScrollPosition(viewport.scrollTop, viewport.scrollLeft, viewport);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [getViewportNode, syncScrollPosition]);

  // Expose editor controls to parent toolbar.
  useImperativeHandle(ref, () => ({
    save: handleSave,
    jumpToLine,
    scrollTo,
    scrollToTopSmooth,
    replaceContent(newContent) {
      setContent(newContent);
      onContentChange?.(newContent);
    },
    get clientHeight() { return getViewportNode()?.clientHeight || 0; },
    get scrollHeight() { return getViewportNode()?.scrollHeight || 0; },
  }), [getViewportNode, handleSave, jumpToLine, scrollTo, scrollToTopSmooth, onContentChange]);

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
    setCursorVersion(v => v + 1);
  }, [onCursorChange]);

  const handleCursorChange = useCallback((event) => {
    emitCursorChange(event.target);
  }, [emitCursorChange]);

  const handleTextareaClick = useCallback((event) => {
    const textarea = event.currentTarget;
    emitCursorChange(textarea);

    if (!isEditable || !onWordActivate || textarea.selectionStart !== textarea.selectionEnd) {
      return;
    }

    const tokenEntry = resolveWordTokenAtOffset(textarea.selectionStart);
    const wordPayload = buildWordPayloadFromToken(tokenEntry);
    if (!wordPayload) {
      return;
    }

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
    });
  }, [
    buildWordPayloadFromToken,
    emitCursorChange,
    emitWordActivation,
    isEditable,
    onWordActivate,
    resolveWordTokenAtOffset,
    adaptiveTopology,
    mirrored,
  ]);

  const handleContentChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (nextValue.length > MAX_CONTENT_LENGTH) {
      setContent(nextValue.slice(0, MAX_CONTENT_LENGTH));
      return;
    }
    setContent(nextValue);
    setCursorVersion(v => v + 1);
    emitCursorChange(event.target);

    requestAnimationFrame(() => {
      setContentForOverlay(nextValue);
    });
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

        {isEditable && (
          <div className="editor-toolbar">
            <button 
              type="button" 
              className="toolbar-btn toolbar-btn--bytecode" 
              onClick={() => {
                const bytecode = allOverlayTokens.map(t => t.token).join(' ');
                navigator.clipboard.writeText(bytecode).then(() => {
                });
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
          content={content}
          lineCounts={lineSyllableCounts}
          scrollTop={scrollTop}
          viewportHeight={editorHeight}
          lineHeightPx={lineHeightPx}
        />
        <div
          ref={wrapperRef}
          className="editor-textarea-wrapper"
        >
          {/* Read-only plain display — mirrors textarea white-space: pre-wrap exactly */}
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
          {lineFocusMaskGradient && (
            <div
              className="line-focus-mask"
              style={{ background: lineFocusMaskGradient }}
              aria-hidden="true"
            />
          )}
          {/* Word background layer - sits behind textarea, renders colored words for Truesight */}
          {isTruesight && (
            <div
              ref={wordBackgroundLayerRef}
              className="word-background-layer"
              style={cursorSync?.overlayStyles}
              aria-hidden="true"
              onScroll={handleOverlayScroll}
            >
              <div>
                {overlayLines.map(({ lineIndex: li, lineText, tokens, lineType }) => {
                  const isGroupActive = highlightedLinesSet.size > 0;
                  const isHighlighted = highlightedLinesSet.has(li);
                  const isLineDimmed = (isGroupActive && !isHighlighted) || isGhostPinned;

                  const adaptiveCoords = adaptiveTopology ? compileAdaptiveGrid([{
                    lineIndex: li,
                    lineText,
                    tokens: tokens.map(t => ({
                      token: t.token,
                      localStart: t.localStart,
                    })),
                  }], adaptiveTopology, { mirrored }) : null;

                  return (
                    <div
                      key={li}
                      className={`truesight-line truesight-line--${lineType}${isLineDimmed ? ' truesight-line--dimmed' : ''}${isHighlighted ? ' truesight-line--highlighted' : ''}`}
                    >
                      {tokens.map(({ token, localStart, localEnd, lineIndex, wordIndex }, tokenIdx) => {
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

                        const adaptiveCoord = adaptiveCoords?.[tokenIdx] || null;
                        const pixelWidth = adaptiveCoord ? adaptiveCoord.pixelWidth : (adaptiveTopology ? getAdaptiveTokenWidth(token, adaptiveTopology) : null);
                        const pixelX = adaptiveCoord ? adaptiveCoord.x : 0;

                        const commonStyle = {
                          position: 'absolute',
                          left: `${pixelX}px`,
                          width: pixelWidth ? `${pixelWidth}px` : 'auto',
                          whiteSpace: 'pre',
                        };

                        if (!isWord) {
                          return (
                            <span
                              key={localStart}
                              style={{
                                ...commonStyle,
                                pointerEvents: 'none',
                              }}
                            >
                              {token}
                            </span>
                          );
                        }

                        const isStopWord = STOP_WORDS.has(clean);
                        const rawVowelFamily = analysis?.vowelFamily;
                        const wordVowelFamily = analysis
                          ? normalizeVowelFamily(rawVowelFamily)
                          : null;
                        
                        const bytecode = analysis?.visualBytecode || analysis?.trueVisionBytecode || null;
                        
                        const shouldColor = bytecode && bytecode.effectClass !== 'INERT'
                          ? shouldColorWordHook(charStart, clean, wordVowelFamily)
                          : false;

                        const decoded = bytecode && shouldColor
                          ? decodeBytecode(bytecode, { reducedMotion, theme: activeTheme })
                          : null;

                        const color = decoded?.color || null;
                        const isLineHighlighted = highlightedLinesSet.has(lineIndex);

                        const wordStyle = {
                          ...commonStyle,
                          color: color || undefined,
                          ...(decoded?.style || {}),
                          pointerEvents: 'none',
                          ...(isLineHighlighted ? highlightStyle : {}),
                        };

                        return (
                          <span
                            key={localStart}
                            className={[
                              'truesight-word',
                              shouldColor ? 'grimoire-word' : 'grimoire-word--grey',
                              decoded?.className || '',
                              isLineHighlighted ? 'grimoire-word--rhyme-highlight' : '',
                            ].filter(Boolean).join(' ')}
                            style={wordStyle}
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
          {/* Textarea: visible when editing, or in read-only+Truesight for overlay sync */}
          <textarea
            id="scroll-content"
            ref={textareaRef}
            className={`editor-textarea ${isTruesight ? "truesight-transparent editor-textarea--underlay" : "editor-textarea--foreground"} ${!isEditable && !isTruesight ? "editor-textarea--hidden" : ""} ${isReadOnlyTruesight ? "editor-textarea--read-only-truesight" : ""}`}
            style={cursorSync?.textareaStyles}
            aria-hidden={isTruesight && !isEditable && !!onWordActivate}
            placeholder={isEditable
              ? "Inscribe thy verses upon this sacred parchment..."
              : ""}
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

          {/* Ghost layer: pinned lines fly to top on pair select */}
          {isTruesight && ghostData && (
            <div className="truesight-ghost-layer" aria-hidden="true">
              <AnimatePresence onExitComplete={() => setGhostData(null)}>
                {isGhostPinned && ghostData.sortedLines.map((li, i) => {
                  const lineData = overlayLines[li];
                  if (!lineData) return null;
                  const initialY = ghostData.initialYMap.get(li) ?? 0;
                  const targetY = 8 + i * (lineHeightPx + 4);
                  return (
                    <motion.div
                      key={`ghost-${li}`}
                      className={`truesight-line truesight-line--${lineData.lineType} truesight-line--highlighted truesight-ghost-line`}
                      initial={{ y: initialY, opacity: 0.6, scale: 0.98 }}
                      animate={{ y: targetY, opacity: 1, scale: 1 }}
                      exit={{ y: initialY, opacity: 0, scale: 0.98 }}
                      transition={{
                        type: "spring",
                        stiffness: 140,
                        damping: 20,
                        mass: 0.8,
                        restDelta: 0.001
                      }}
                      style={{
                        willChange: "transform, opacity",
                        contain: "layout paint style"
                      }}
                    >
                      {lineData.tokens.map(({ token, start: charStart, lineIndex, wordIndex }) => {
                        const isWord = WORD_TOKEN_REGEX.test(token);
                        if (!isWord) return <span key={charStart}>{token}</span>;

                        const clean = token.toUpperCase();
                        const identityKey = `${lineIndex}:${Number.isInteger(wordIndex) ? wordIndex : -1}:${charStart}`;
                        const analysis = analyzedWordsByIdentity.get(identityKey)
                          || derivedAnalyzedWordsByCharStart.get(charStart)
                          || (allowLegacyWordFallback ? analyzedWords.get(clean) : null);
                        const rawVowelFamily = analysis?.vowelFamily;
                        const wordVowelFamily = analysis ? normalizeVowelFamily(rawVowelFamily) : null;
                        
                        // Get bytecode from analysis (authoritative source from Codex)
                        const bytecode = analysis?.visualBytecode || analysis?.trueVisionBytecode || null;
                        
                        // Determine if word should be colored using bytecode-native logic
                        const shouldColor = bytecode && bytecode.effectClass !== 'INERT'
                          ? shouldColorWordHook(charStart, clean, wordVowelFamily)
                          : false;

                        // Decode bytecode into CSS classes and custom properties
                        const decoded = bytecode && shouldColor
                          ? decodeBytecode(bytecode, { reducedMotion, theme: activeTheme })
                          : null;

                        // Color from bytecode is authoritative
                        const color = decoded?.color || null;
                        const isMultiSyllable = shouldColor && (decoded?.syllableDepth >= 2);
                        const isRichMultiSyllable = shouldColor && (decoded?.syllableDepth >= 3);

                        return (
                          <span
                            key={charStart}
                            className={[
                              "truesight-word",
                              shouldColor ? "grimoire-word" : "grimoire-word--grey",
                              decoded?.className || "",
                              isMultiSyllable ? "word--multi-rhyme" : "",
                              isRichMultiSyllable ? "word--multi-rhyme--rich" : "",
                            ].filter(Boolean).join(" ")}
                            style={{ color: color || undefined, ...(decoded?.style || {}) }}
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
