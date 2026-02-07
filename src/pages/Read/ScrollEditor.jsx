import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { motion } from "framer-motion";
import SyllableCounter from "./SyllableCounter.jsx";
import RhymeConnectionOverlay from "../../components/RhymeConnectionOverlay.jsx";
import MarkdownRenderer from "../../components/MarkdownRenderer.jsx";
import { usePhonemeEngine } from "../../hooks/usePhonemeEngine.jsx";
import { ANALYSIS_MODES } from "./TruesightControls.jsx";

const MAX_CONTENT_LENGTH = 50000;
const CONTENT_DEBOUNCE_MS = 300;
const SAVE_STATUS_TIMEOUT_MS = 2000;
const TOKEN_REGEX = /[A-Za-z']+|\s+|[^A-Za-z'\s]+/g;
const WORD_TOKEN_REGEX = /^[A-Za-z']+$/;

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
  isEditing = false,
  isEditable = true,
  disabled = false,
  isTruesight = false,
  analysisMode = ANALYSIS_MODES.VOWEL,
  onContentChange,
  analyzedWords = new Map(),
  onWordClick,
  deepAnalysis = null,
  activeConnections = [],
  highlightedLines = [],
  vowelColors = null,
  theme = 'dark',
}, ref) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [wordPositions, setWordPositions] = useState(new Map());
  const textareaRef = useRef(null);
  const truesightOverlayRef = useRef(null);
  const wordRefs = useRef(new Map());
  const saveStatusTimeoutRef = useRef(null);
  const { engine } = usePhonemeEngine();

  const overlayTokens = useMemo(() => {
    const tokens = content.match(TOKEN_REGEX) || [];
    let offset = 0;
    let lineIndex = 0;
    return tokens.map((token) => {
      const start = offset;
      const currentLine = lineIndex;
      offset += token.length;
      // Track line breaks
      const newlines = (token.match(/\n/g) || []).length;
      lineIndex += newlines;
      return { token, start, lineIndex: currentLine };
    });
  }, [content]);

  // Group tokens by line for line-level animation (dissolve + collapse)
  const overlayLines = useMemo(() => {
    const lines = [];
    let currentTokens = [];
    let currentIdx = 0;
    for (const token of overlayTokens) {
      if (token.lineIndex !== currentIdx && currentTokens.length > 0) {
        lines.push({ lineIndex: currentIdx, tokens: currentTokens });
        currentTokens = [];
        currentIdx = token.lineIndex;
      }
      currentTokens.push(token);
    }
    if (currentTokens.length > 0) {
      lines.push({ lineIndex: currentIdx, tokens: currentTokens });
    }
    return lines;
  }, [overlayTokens]);

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

  // Pre-compute Set for O(1) highlighted line lookups (Fix 1)
  const highlightedLinesSet = useMemo(() => new Set(highlightedLines || []), [highlightedLines]);

  // Pre-compute Set of words involved in connections for selective measurement (Fix 4)
  const connectedCharStarts = useMemo(() => {
    if (!activeConnections) return new Set();
    const set = new Set();
    for (const conn of activeConnections) {
      set.add(conn.wordA.charStart);
      set.add(conn.wordB.charStart);
    }
    return set;
  }, [activeConnections]);

  // Track word positions for connection lines - debounced and selective (Fix 4)
  useEffect(() => {
    if (analysisMode !== ANALYSIS_MODES.RHYME || !truesightOverlayRef.current || !deepAnalysis) {
      return;
    }

    let timeoutId = null;

    const scheduleUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          const containerRect = truesightOverlayRef.current?.getBoundingClientRect();
          if (!containerRect) return;

          const positions = new Map();
          const scrollLeft = truesightOverlayRef.current.scrollLeft;
          const scrollTop = truesightOverlayRef.current.scrollTop;

          // Only measure words involved in connections
          wordRefs.current.forEach((el, charStart) => {
            if (!connectedCharStarts.has(charStart) || !el) return;

            const rect = el.getBoundingClientRect();
            positions.set(charStart, {
              left: rect.left - containerRect.left + scrollLeft,
              right: rect.right - containerRect.left + scrollLeft,
              top: rect.top - containerRect.top + scrollTop,
              centerX: (rect.left + rect.right) / 2 - containerRect.left + scrollLeft,
              centerY: rect.top - containerRect.top + rect.height / 2 + scrollTop,
            });
          });

          setWordPositions(positions);
        });
      }, 500);
    };

    scheduleUpdate();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [analysisMode, deepAnalysis, connectedCharStarts]);

  // Format definitions for markdown syntax and school color tags
  const formats = {
    heading: { prefix: '## ', suffix: '', lineStart: true },
    bullet:  { prefix: '- ', suffix: '', lineStart: true },
    number:  { prefix: '1. ', suffix: '', lineStart: true },
    quote:   { prefix: '> ', suffix: '', lineStart: true },
  };

  // Apply formatting to selected text
  const applyFormat = useCallback((type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // Use DOM value directly to avoid race conditions with React state
    const value = textarea.value;
    const selected = value.substring(start, end);

    const fmt = formats[type];
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
  }, [formats]);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent]);

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
    return () => {
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  // Sync scroll positions between textarea and overlay
  const handleScroll = useCallback(() => {
    if (truesightOverlayRef.current && textareaRef.current) {
      truesightOverlayRef.current.scrollTop = textareaRef.current.scrollTop;
      truesightOverlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleOverlayScroll = useCallback(() => {
    if (truesightOverlayRef.current && textareaRef.current) {
      textareaRef.current.scrollTop = truesightOverlayRef.current.scrollTop;
      textareaRef.current.scrollLeft = truesightOverlayRef.current.scrollLeft;
    }
  }, []);

  const clearSaveStatusTimeout = useCallback(() => {
    if (saveStatusTimeoutRef.current) {
      window.clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = null;
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    clearSaveStatusTimeout();

    try {
      await onSave?.(title, content);

      if (onSave) {
        setSaveStatus("Scroll saved.");
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus("");
        }, SAVE_STATUS_TIMEOUT_MS);
      }
    } catch (error) {
      setSaveStatus("Failed to inscribe.");
      saveStatusTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus("");
      }, SAVE_STATUS_TIMEOUT_MS);
    } finally {
      setIsSaving(false);
    }
  }, [content, title, onSave, clearSaveStatusTimeout]);

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
    }, [handleSave, onCancel, applyFormat]);

  const handleContentChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (nextValue.length > MAX_CONTENT_LENGTH) {
      setContent(nextValue.slice(0, MAX_CONTENT_LENGTH));
      return;
    }
    setContent(nextValue);
  }, []);

  const handleWordClick = useCallback((event, word) => {
    const cleaned = String(word || "").replace(/[^A-Za-z']/g, "");
    if (!cleaned) return;
    onWordClick?.(cleaned, event);
  }, [onWordClick]);

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
        <SyllableCounter content={content} engine={engine} />
        <div className="editor-textarea-wrapper">
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
              className="truesight-overlay"
              aria-hidden="true"
              onScroll={handleOverlayScroll}
            >
              {/* Rhyme connection lines overlay - hidden in RHYME mode, diagram panel used instead */}
              <RhymeConnectionOverlay
                connections={activeConnections}
                wordPositions={wordPositions}
                containerRef={truesightOverlayRef}
                visible={false}
              />

              {overlayLines.map(({ lineIndex: li, tokens }) => {
                const isGroupActive = highlightedLinesSet.size > 0;
                const isHighlighted = highlightedLinesSet.has(li);
                const isLineDimmed = isGroupActive && !isHighlighted;

                return (
                  <div
                    key={li}
                    className={`truesight-line${isLineDimmed ? ' truesight-line--dimmed' : ''}${isHighlighted ? ' truesight-line--highlighted' : ''}`}
                  >
                    {tokens.map(({ token, start, lineIndex }) => {
                      const isWord = WORD_TOKEN_REGEX.test(token);
                      const clean = isWord ? token.toUpperCase() : "";
                      const analysis = isWord ? analyzedWords.get(clean) : null;
                      const charStart = start;

                      if (!isWord || !analysis || STOP_WORDS.has(clean)) {
                        return <span key={start}>{token}</span>;
                      }

                      const activeColors = vowelColors || VOWEL_COLORS;
                      const fallbackColor = theme === 'light' ? "#1a1a2e" : "#f8f9ff";
                      const color = activeColors[analysis.vowelFamily] || fallbackColor;

                      // O(1) lookup for multi-syllable rhyme (Fix 1)
                      const isMultiSyllable = multiSyllableCharStarts.has(charStart);

                      // O(1) lookup for highlighted line (Fix 1)
                      const isLineHighlighted = highlightedLinesSet.has(lineIndex);

                      return (
                        <button
                          key={start}
                          type="button"
                          ref={(el) => {
                            if (el) {
                              wordRefs.current.set(charStart, el);
                            } else {
                              wordRefs.current.delete(charStart);
                            }
                          }}
                          className={`grimoire-word ${isMultiSyllable ? 'word--multi-rhyme' : ''} ${isLineHighlighted ? 'grimoire-word--rhyme-highlight' : ''}`}
                          style={{ color }}
                          onClick={(e) => handleWordClick(e, token)}
                          data-char-start={charStart}
                          data-syllables={isMultiSyllable ? analysis.syllables?.length : undefined}
                        >
                          {token}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isEditable && (
        <div className="editor-footer">
          <div className="editor-hint">
            <kbd>Ctrl</kbd>+<kbd>S</kbd> to save
            {onCancel && (
              <>
                {" "}&middot; <kbd>Esc</kbd> to cancel
              </>
            )}
          </div>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {saveStatus}
      </span>
    </motion.div>
  );
});

export default ScrollEditor;
