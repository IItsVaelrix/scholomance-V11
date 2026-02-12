import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { motion } from "framer-motion";
import SyllableCounter from "./SyllableCounter.jsx";
import MarkdownRenderer from "../../components/MarkdownRenderer.jsx";
import { normalizeVowelFamily } from "../../lib/vowelFamily.js";
import { LINE_TOKEN_REGEX, WORD_TOKEN_REGEX } from "../../lib/wordTokenization.js";

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

    lines.push({ lineIndex, tokens });
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

// Vowel family color mapping for Truesight (ARPAbet codes from CMU engine)
const VOWEL_COLORS = {
  IY: "#60a5fa",   // Blue - FLEECE (high front)
  IH: "#818cf8",   // Indigo - KIT (near-high front)
  EY: "#a78bfa",   // Violet - FACE (mid front diphthong)
  EH: "#c084fc",   // Purple - DRESS (mid front lax)
  AE: "#f472b6",   // Pink - TRAP (low front)
  A: "#fb7185",    // Rose - PALM/LOT (low back, merged)
  AA: "#fb7185",   // Rose - same as A
  AO: "#fbbf24",   // Amber - THOUGHT (mid back rounded)
  OW: "#facc15",   // Yellow - GOAT (mid back diphthong)
  UH: "#a3e635",   // Lime - FOOT (near-high back)
  UW: "#4ade80",   // Green - GOOSE (high back)
  AH: "#2dd4bf",   // Teal - STRUT (mid central)
  ER: "#22d3ee",   // Cyan - NURSE (r-colored)
  AY: "#f97316",   // Orange - PRICE (diphthong)
  AW: "#ef4444",   // Red - MOUTH (diphthong)
  OY: "#ec4899",   // Magenta - CHOICE (diphthong)
};

const ScrollEditor = forwardRef(function ScrollEditor({
  initialTitle = "",
  initialContent = "",
  onSave,
  onCancel,
  isEditable = true,
  disabled = false,
  isTruesight = false,
  onContentChange,
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  lineSyllableCounts = [],
  highlightedLines = [],
  vowelColors = null,
  theme = 'dark',
  onWordActivate,
}, ref) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT);
  const textareaRef = useRef(null);
  const truesightOverlayRef = useRef(null);
  const showSyllableCounter = isEditable || isTruesight;

  const BUFFER = 10;

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

  // Pre-compute Set for O(1) multi-syllable word lookups (Fix 1)
  const multiSyllableCharStarts = useMemo(() => {
    const set = new Set();
    if (!activeConnections) return set;
    for (const conn of activeConnections) {
      if (conn.syllablesMatched >= 2) {
        set.add(conn.wordA.charStart);
        set.add(conn.wordB.charStart);
      }
    }
    return set;
  }, [activeConnections]);

  const normalizedWordByCharStart = useMemo(() => {
    const map = new Map();
    for (const { tokens } of overlayLines) {
      for (const { token, start } of tokens) {
        if (!WORD_TOKEN_REGEX.test(token)) continue;
        map.set(start, normalizeWordToken(token));
      }
    }
    return map;
  }, [overlayLines]);

  const allowLegacyWordFallback = useMemo(() => (
    analyzedWordsByIdentity.size === 0 && analyzedWordsByCharStart.size === 0
  ), [analyzedWordsByIdentity, analyzedWordsByCharStart]);

  // Build color activation context from active connections.
  // 1) Color direct connected words.
  // 2) If a stop-word endpoint is excluded, allow family substitution only when that
  //    family has no non-stop connected representative.
  const connectionColorContext = useMemo(() => {
    const connectedTokenCharStarts = new Set();
    const stopWordFamilies = new Set();
    const nonStopWordFamilies = new Set();

    if (!Array.isArray(activeConnections) || activeConnections.length === 0) {
      return {
        connectedTokenCharStarts,
        substitutionFamilies: new Set(),
      };
    }

    const resolveNormalizedWord = (wordRef) => {
      if (!wordRef || typeof wordRef !== "object") return "";
      if (Number.isInteger(wordRef.charStart)) {
        const normalizedByOffset = normalizedWordByCharStart.get(wordRef.charStart);
        if (normalizedByOffset) {
          return normalizedByOffset;
        }
      }
      return normalizeWordToken(wordRef.word);
    };

    const resolveWordFamily = (wordRef, normalizedWord) => {
      if (!wordRef || typeof wordRef !== "object") return "";

      const directFamily = normalizeVowelFamily(wordRef.vowelFamily);
      if (directFamily) return directFamily;

      if (Number.isInteger(wordRef.charStart)) {
        const byOffsetFamily = normalizeVowelFamily(analyzedWordsByCharStart.get(wordRef.charStart)?.vowelFamily);
        if (byOffsetFamily) return byOffsetFamily;
      }

      if (allowLegacyWordFallback) {
        const analyzedFamily = normalizeVowelFamily(analyzedWords.get(normalizedWord)?.vowelFamily);
        if (analyzedFamily) return analyzedFamily;
      }

      return "";
    };

    const registerWordRef = (wordRef) => {
      if (!wordRef || typeof wordRef !== "object") return;

      if (Number.isInteger(wordRef.charStart)) {
        connectedTokenCharStarts.add(wordRef.charStart);
      }

      const normalizedWord = resolveNormalizedWord(wordRef);
      const family = resolveWordFamily(wordRef, normalizedWord);
      if (!family) return;

      if (STOP_WORDS.has(normalizedWord)) {
        stopWordFamilies.add(family);
        return;
      }

      nonStopWordFamilies.add(family);
    };

    for (const conn of activeConnections) {
      registerWordRef(conn?.wordA);
      registerWordRef(conn?.wordB);
    }

    const substitutionFamilies = new Set();
    for (const family of stopWordFamilies) {
      if (!nonStopWordFamilies.has(family)) {
        substitutionFamilies.add(family);
      }
    }

    return {
      connectedTokenCharStarts,
      substitutionFamilies,
    };
  }, [activeConnections, allowLegacyWordFallback, analyzedWords, analyzedWordsByCharStart, normalizedWordByCharStart]);

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
      // Line-start formats (headings, lists)
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      newContent = value.slice(0, lineStart) + fmt.prefix + value.slice(lineStart);
      newCursorPos = end + fmt.prefix.length;
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

  const syncEditorHeight = useCallback(() => {
    if (!isEditable && !isTruesight) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const previousHeight = textarea.style.height;
    // Reset before measuring so height can shrink when content is deleted.
    textarea.style.height = "0px";
    const measuredHeight = Math.max(MIN_EDITOR_HEIGHT, textarea.scrollHeight + 8);
    textarea.style.height = previousHeight;

    setEditorHeight((prev) =>
      Math.abs(prev - measuredHeight) > 1 ? measuredHeight : prev
    );
  }, [isEditable, isTruesight]);

  useEffect(() => {
    syncEditorHeight();
  }, [content, title, isEditable, isTruesight, syncEditorHeight]);

  useEffect(() => {
    if (!isEditable && !isTruesight) {
      setEditorHeight(MIN_EDITOR_HEIGHT);
      return undefined;
    }

    const handleResize = () => {
      syncEditorHeight();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isEditable, isTruesight, syncEditorHeight]);

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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const measured = parseFloat(window.getComputedStyle(textarea).lineHeight);
    if (Number.isFinite(measured) && measured > 0) {
      setLineHeightPx(measured);
    }
  }, [editorHeight, isTruesight]);

  // Sync scroll positions between textarea and overlay
  useEffect(() => {
    if (isTruesight && textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  }, [isTruesight]);

  useEffect(() => {
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

    if (truesightOverlayRef.current) {
      truesightOverlayRef.current.scrollTop = top;
      truesightOverlayRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  const handleOverlayScroll = useCallback(() => {
    if (truesightOverlayRef.current && textareaRef.current) {
      const top = truesightOverlayRef.current.scrollTop;
      textareaRef.current.scrollTop = top;
      textareaRef.current.scrollLeft = truesightOverlayRef.current.scrollLeft;
      setScrollTop(top);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setIsSaving(true);

    try {
      await onSave?.(title, content);
    } finally {
      setIsSaving(false);
    }
  }, [content, title, onSave]);

  // Expose editor controls to parent toolbar.
  useImperativeHandle(ref, () => ({
    applyFormat,
    save: handleSave,
  }), [applyFormat, handleSave]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    }, [handleSave, onCancel]);

  const handleContentChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (nextValue.length > MAX_CONTENT_LENGTH) {
      setContent(nextValue.slice(0, MAX_CONTENT_LENGTH));
      return;
    }
    setContent(nextValue);
  }, []);

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
        ) : (
          <h2 className="editor-title-display">{title || "Untitled Scroll"}</h2>
        )}
      </div>

      <div className={`editor-body ${!isEditable ? "read-only" : ""}`}>
        {showSyllableCounter && (
          <SyllableCounter
            content={content}
            lineCounts={lineSyllableCounts}
            scrollTop={scrollTop}
            viewportHeight={editorHeight}
            lineHeightPx={lineHeightPx}
          />
        )}
        <div
          className="editor-textarea-wrapper"
          style={isEditable || isTruesight ? { height: `${editorHeight}px` } : undefined}
        >
          {/* Read-only rendered markdown (hidden during editing or Truesight) */}
          {!isEditable && !isTruesight && (
            <MarkdownRenderer content={content} />
          )}
          {/* Textarea: visible when editing, or in read-only+Truesight for overlay sync */}
          <textarea
            id="scroll-content"
            ref={textareaRef}
            className={`editor-textarea ${isTruesight ? "truesight-transparent" : ""} ${!isEditable && !isTruesight ? "editor-textarea--hidden" : ""}`}
            placeholder={isEditable
              ? "Inscribe thy verses upon this sacred parchment..."
              : ""}
            value={content}
            onChange={handleContentChange}
            onKeyDown={isEditable ? handleKeyDown : undefined}
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
              ref={truesightOverlayRef}
              className={`truesight-overlay ${isEditable ? "truesight-overlay--editing" : ""}`}
              aria-hidden="true"
              onScroll={handleOverlayScroll}
            >
              <div style={{ paddingTop, paddingBottom }}>
                {windowedLines.map(({ lineIndex: li, tokens }) => {
                  const isGroupActive = highlightedLinesSet.size > 0;
                  const isHighlighted = highlightedLinesSet.has(li);
                  const isLineDimmed = isGroupActive && !isHighlighted;

                  return (
                    <div
                      key={li}
                      className={`truesight-line${isLineDimmed ? ' truesight-line--dimmed' : ''}${isHighlighted ? ' truesight-line--highlighted' : ''}`}
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
                            analyzedWordsByCharStart.get(charStart) ||
                            (allowLegacyWordFallback ? analyzedWords.get(clean) : null)
                          )
                          : null;

                        if (!isWord || !analysis) {
                          return <span key={start}>{token}</span>;
                        }

                        const isStopWord = STOP_WORDS.has(clean);

                        const wordVowelFamily = normalizeVowelFamily(analysis.vowelFamily);
                        const isDirectConnectionWord = connectionColorContext.connectedTokenCharStarts.has(charStart);
                        const isFamilySubstituteWord = (
                          !isDirectConnectionWord &&
                          Boolean(wordVowelFamily) &&
                          connectionColorContext.substitutionFamilies.has(wordVowelFamily)
                        );
                        const shouldColorWord = !isStopWord && (isDirectConnectionWord || isFamilySubstituteWord);
                        const wordPayload = {
                          word: token,
                          normalizedWord: clean,
                          lineIndex,
                          wordIndex: Number.isInteger(wordIndex) ? wordIndex : -1,
                          charStart,
                          charEnd,
                          vowelFamily: wordVowelFamily || null,
                          isStopWord,
                        };

                        if (!shouldColorWord && !onWordActivate) {
                          return <span key={start}>{token}</span>;
                        }

                        const activeColors = vowelColors || VOWEL_COLORS;
                        const fallbackColor = theme === 'light' ? "#1a1a2e" : "#f8f9ff";
                        const color = shouldColorWord
                          ? (activeColors[wordVowelFamily] || fallbackColor)
                          : undefined;

                        // O(1) lookup for multi-syllable rhyme (Fix 1)
                        const isMultiSyllable = shouldColorWord && multiSyllableCharStarts.has(charStart);

                        // O(1) lookup for highlighted line (Fix 1)
                        const isLineHighlighted = highlightedLinesSet.has(lineIndex);

                        if (!onWordActivate) {
                          return (
                            <span
                              key={start}
                              className={`grimoire-word ${isMultiSyllable ? 'word--multi-rhyme' : ''} ${isLineHighlighted ? 'grimoire-word--rhyme-highlight' : ''}`}
                              style={{ color }}
                              data-char-start={charStart}
                              data-syllables={isMultiSyllable ? (Number(analysis.syllableCount) || undefined) : undefined}
                            >
                              {token}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={start}
                            type="button"
                            className={shouldColorWord
                              ? `grimoire-word grimoire-word--interactive ${isMultiSyllable ? 'word--multi-rhyme' : ''} ${isLineHighlighted ? 'grimoire-word--rhyme-highlight' : ''}`
                              : "truesight-word-token"
                            }
                            style={shouldColorWord ? { color } : undefined}
                            data-char-start={charStart}
                            data-line-index={lineIndex}
                            data-word-index={wordIndex}
                            onMouseEnter={(event) => emitWordActivation("hover", wordPayload, event)}
                            onMouseLeave={(event) => emitWordActivation("leave", wordPayload, event)}
                            onFocus={(event) => emitWordActivation("hover", wordPayload, event)}
                            onBlur={(event) => emitWordActivation("leave", wordPayload, event)}
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

    </motion.div>
  );
});

export default ScrollEditor;
