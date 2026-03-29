import { useRef, useLayoutEffect, useEffect, useState, useId } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../hooks/useTheme.jsx";
import { getVowelColorsForSchool } from "../data/schoolPalettes.js";
import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from "../data/schools.js";
import { normalizeVowelFamily } from "../lib/phonology/vowelFamily.js";
import SigilChamber from "./SigilChamber.jsx";
import "./WordTooltip.css";

/* ── Ink transitions — content fades in like ink soaking into parchment ── */
const INK_EXIT = {
  opacity: 0,
  filter: "blur(1.5px) brightness(1.6)",
  y: -6,
  transition: { duration: 0.16, ease: "easeIn" },
};
const INK_INITIAL = { opacity: 0, filter: "blur(2.5px) brightness(0.5)", y: 8 };
const INK_ANIMATE = {
  opacity: 1,
  filter: [
    "blur(2px) brightness(0.55)",
    "blur(0.4px) brightness(1.22)",
    "blur(0px) brightness(1)",
  ],
  y: 0,
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
};

/* ── Depth gem pop — syllable count on word change ────────────────────── */
const GEM_EXIT    = { opacity: 0, scale: 1.35, transition: { duration: 0.11, ease: "easeIn" } };
const GEM_INITIAL = { opacity: 0, scale: 0.65 };
const GEM_ANIMATE = { opacity: 1, scale: 1, transition: { duration: 0.28, delay: 0.1, ease: [0.22, 1, 0.36, 1] } };

const TOOLTIP_MIN_WIDTH    = 300;
const TOOLTIP_MIN_HEIGHT   = 380;
const TOOLTIP_MAX_WIDTH    = 680;
const TOOLTIP_MAX_HEIGHT   = 720;
const TOOLTIP_DEFAULT_WIDTH  = 390;
const TOOLTIP_DEFAULT_HEIGHT = 540;

const DRAG_IGNORE_SELECTOR = [
  ".card-resize-handle",
  ".card-close-btn",
  ".card-text-box",
  "button",
  "a",
  "input",
  "textarea",
  "select",
].join(", ");

/* ── Arcane classification ────────────────────────────────────────────── */
const getRarity = (word) => {
  if (!word) return "common";
  const len = word.length;
  if (len >= 12) return "legendary";
  if (len >= 9)  return "epic";
  if (len >= 6)  return "rare";
  return "common";
};

const RARITY_NAMES = {
  common:    "Common Tongue",
  rare:      "Arcane Script",
  epic:      "Eldritch Text",
  legendary: "Mythic Inscription",
};

const WordTooltip = ({
  wordData,
  analysis,
  isLoading,
  error,
  x,
  y,
  onDrag,
  onClose,
  onSuggestionClick,
  sessionHistory,
  sessionIndex,
  onSessionNavigate,
}) => {
  const { theme } = useTheme();
  const vowelPalette  = getVowelColorsForSchool("DEFAULT", theme);
  const containerRef  = useRef(null);
  const titleId       = useId();

  const [size, setSize] = useState({ width: TOOLTIP_DEFAULT_WIDTH, height: TOOLTIP_DEFAULT_HEIGHT });
  const [pos,  setPos]  = useState({ x, y });
  const posRef          = useRef({ x, y });
  const posInitialized  = useRef(false);
  const [isInteracting, setIsInteracting] = useState(false);

  /* Card-local navigation history (suggestion rune clicks) */
  const [cardHistory,      setCardHistory]      = useState([]);
  const [cardHistoryIndex, setCardHistoryIndex] = useState(0);

  const setTooltipPos = (nextPos) => {
    posRef.current = nextPos;
    setPos(nextPos);
  };
  const applyLivePosition = (nextPos) => {
    const node = containerRef.current;
    if (!node) return;
    node.style.left = `${nextPos.x}px`;
    node.style.top  = `${nextPos.y}px`;
  };

  /* Snap to x/y only on first appearance — thereafter the card owns its position */
  useLayoutEffect(() => {
    if (posInitialized.current) return;
    posInitialized.current = true;
    const nextPos = { x, y };
    posRef.current = nextPos;
    setPos(nextPos);
    applyLivePosition(nextPos);
  }, [x, y]);

  /* Reset card history when session entry changes */
  const prevSessionIndexRef = useRef(sessionIndex);
  useEffect(() => {
    if (prevSessionIndexRef.current === sessionIndex) return;
    prevSessionIndexRef.current = sessionIndex;
    const word = sessionHistory[sessionIndex]?.word;
    if (word) {
      setCardHistory([word]);
      setCardHistoryIndex(0);
    }
  }, [sessionIndex, sessionHistory]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (sessionHistory.length <= 1) return;
      const tooltipHasFocus =
        containerRef.current &&
        (containerRef.current === document.activeElement ||
          containerRef.current.contains(document.activeElement));
      if (!tooltipHasFocus) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") onSessionNavigate(sessionIndex - 1);
      else onSessionNavigate(sessionIndex + 1);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onSessionNavigate, sessionHistory.length, sessionIndex]);

  /* ── Card history: suggestion rune click ─────────────────────────────── */
  const handleSuggestionRune = (word) => {
    const newHistory = [...cardHistory.slice(0, cardHistoryIndex + 1), word];
    setCardHistory(newHistory);
    setCardHistoryIndex(newHistory.length - 1);
    onSuggestionClick(word);
  };

  /* ── Card history: breadcrumb ancestor click ──────────────────────────── */
  const handleBreadcrumbClick = (index) => {
    if (index === cardHistoryIndex) return;
    setCardHistoryIndex(index);
    onSuggestionClick(cardHistory[index]);
  };

  /* ── High-performance drag ────────────────────────────────────────────── */
  const handleDragStart = (e) => {
    if (e.button !== 0 && e.button !== undefined) return;
    if (!(e.target instanceof Element)) return;
    if (e.target.closest(DRAG_IGNORE_SELECTOR)) return;
    if (e.cancelable) e.preventDefault();

    const target    = e.currentTarget;
    const pointerId = e.pointerId;
    let hasPointerCapture = false;
    if (typeof pointerId === "number" && target.setPointerCapture) {
      try { target.setPointerCapture(pointerId); hasPointerCapture = true; } catch { /**/ }
    }
    setIsInteracting(true);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startPos      = { ...posRef.current };
    let latestPos       = startPos;

    const handlePointerMove = (moveEvent) => {
      if (typeof pointerId === "number" && moveEvent.pointerId !== pointerId) return;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      latestPos = {
        x: startPos.x + (moveEvent.clientX - startPointerX),
        y: startPos.y + (moveEvent.clientY - startPointerY),
      };
      posRef.current = latestPos;
      applyLivePosition(latestPos);
    };

    const handlePointerEnd = (endEvent) => {
      if (typeof pointerId === "number" && endEvent.pointerId !== pointerId) return;
      if (hasPointerCapture && typeof pointerId === "number" && target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      setIsInteracting(false);
      setTooltipPos(latestPos);
      onDrag(latestPos);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
  };

  /* ── High-performance resize — 8 directions ──────────────────────────── */
  const handleResizeStart = (direction) => (e) => {
    e.stopPropagation();
    if (e.button !== 0 && e.button !== undefined) return;
    const target    = e.currentTarget;
    const pointerId = e.pointerId;
    let hasPointerCapture = false;
    if (typeof pointerId === "number" && target.setPointerCapture) {
      try { target.setPointerCapture(pointerId); hasPointerCapture = true; } catch { /**/ }
    }
    setIsInteracting(true);

    const startW    = size.width;
    const startH    = size.height;
    const startX    = e.clientX;
    const startY    = e.clientY;
    const startPosX = posRef.current.x;
    const startPosY = posRef.current.y;
    let latestResizePos = { x: startPosX, y: startPosY };
    const movesPosition = direction.includes("w") || direction.includes("n");

    const handlePointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newW = startW, newH = startH, newPosX = startPosX, newPosY = startPosY;

      if (direction.includes("e")) newW = Math.min(TOOLTIP_MAX_WIDTH,  Math.max(TOOLTIP_MIN_WIDTH,  startW + dx));
      if (direction.includes("w")) { newW = Math.min(TOOLTIP_MAX_WIDTH,  Math.max(TOOLTIP_MIN_WIDTH,  startW - dx)); newPosX = startPosX + (startW - newW); }
      if (direction.includes("s")) newH = Math.min(TOOLTIP_MAX_HEIGHT, Math.max(TOOLTIP_MIN_HEIGHT, startH + dy));
      if (direction.includes("n")) { newH = Math.min(TOOLTIP_MAX_HEIGHT, Math.max(TOOLTIP_MIN_HEIGHT, startH - dy)); newPosY = startPosY + (startH - newH); }

      latestResizePos = { x: newPosX, y: newPosY };
      setSize({ width: newW, height: newH });
      setTooltipPos(latestResizePos);
    };

    const handlePointerUp = () => {
      if (hasPointerCapture && typeof pointerId === "number" && target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
      setIsInteracting(false);
      if (movesPosition) onDrag(latestResizePos);
    };

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerUp);
  };

  /* ── Suggestion rune pills ────────────────────────────────────────────── */
  const renderSuggestionRunes = (words) =>
    words.map((w, i) => (
      <button key={i} className="suggestion-rune" onClick={() => handleSuggestionRune(w)} type="button">
        {w}
      </button>
    ));

  /* ── Breadcrumb trail ─────────────────────────────────────────────────── */
  const renderBreadcrumb = () => {
    if (cardHistory.length <= 1) return null;
    const end       = cardHistoryIndex + 1;
    const start     = Math.max(0, end - 6);
    const truncated = start > 0;
    const visible   = cardHistory.slice(start, end);

    return (
      <div className="card-breadcrumb" aria-label="Word navigation history">
        {truncated && (
          <span className="card-breadcrumb-item">
            <span className="card-breadcrumb-ancestor card-breadcrumb-truncated">…</span>
            <span className="card-breadcrumb-sep" aria-hidden="true">›</span>
          </span>
        )}
        {visible.map((w, relIdx) => {
          const absIdx    = start + relIdx;
          const isCurrent = absIdx === cardHistoryIndex;
          return (
            <span key={absIdx} className="card-breadcrumb-item">
              {relIdx > 0 && <span className="card-breadcrumb-sep" aria-hidden="true">›</span>}
              {isCurrent ? (
                <span className="card-breadcrumb-current">{w}</span>
              ) : (
                <button className="card-breadcrumb-ancestor" onClick={() => handleBreadcrumbClick(absIdx)} type="button">
                  {w}
                </button>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  /* ── Main card content ────────────────────────────────────────────────── */
  const cardContent = () => {
    /* Loading state */
    if (isLoading && !wordData && !analysis) {
      return (
        <div className="word-card word-card--loading">
          <div className="card-frame" onPointerDown={handleDragStart}>
            <div className="card-inner" aria-busy="true">
              <div className="card-loading-spinner" />
              <p className="card-loading-text">Consulting the arcane fabric…</p>
            </div>
          </div>
        </div>
      );
    }

    /* Error state */
    if (error && !wordData && !analysis) {
      return (
        <div className="word-card word-card--error">
          <div className="card-frame" onPointerDown={handleDragStart}>
            <button
              className="card-close-btn"
              onClick={() => onClose({ restoreFocus: false })}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close card"
            >
              ✕
            </button>
            <div className="card-inner" role="alert">
              <div className="card-error-icon" aria-hidden="true">⚠️</div>
              <p className="card-error-text">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    /* ── Data extraction ──────────────────────────────────────────────── */
    const localCore        = analysis?.core           || null;
    const rhymeContext     = analysis?.rhyme           || null;
    const astrologyContext = analysis?.rhymeAstrology  || null;

    const word        = String(wordData?.word || analysis?.token?.word || "Unknown");
    const definition  = wordData?.definition || null;
    const definitions = Array.isArray(wordData?.definitions)  ? wordData.definitions  : [];
    const synonyms    = Array.isArray(wordData?.synonyms)     ? wordData.synonyms     : [];
    const antonyms    = Array.isArray(wordData?.antonyms)     ? wordData.antonyms     : [];
    const rhymes      = Array.isArray(wordData?.rhymes)       ? wordData.rhymes       : [];
    const slantRhymes = Array.isArray(wordData?.slantRhymes)  ? wordData.slantRhymes  : [];
    const rhymeKey    = wordData?.rhymeKey || localCore?.rhymeKey || null;
    const ipa         = typeof wordData?.ipa === "string" ? wordData.ipa : null;
    const partOfSpeech = definition?.partOfSpeech;

    const allDefs = definitions.length > 0
      ? [...new Set(definitions)].slice(0, 5)
      : (definition?.text ? [definition.text] : ["No arcane inscriptions found."]);

    const rawVowelFamily = localCore?.vowelFamily || wordData?.vowelFamily;
    const vowelFamily   = normalizeVowelFamily(rawVowelFamily);
    const schoolId      = VOWEL_FAMILY_TO_SCHOOL[vowelFamily] || "DEFAULT";
    const schoolName    = localCore?.schoolName || SCHOOLS[schoolId]?.name;
    const schoolIcon    = localCore?.schoolGlyph || SCHOOLS[schoolId]?.glyph || "✦";
    const fallbackColor = theme === "light" ? "#1a1a2e" : "#f8f9ff";
    
    // 20-vowel lookup: try raw first for granular variation, fallback to normalized family
    const vowelColor    = rawVowelFamily && vowelPalette[rawVowelFamily] 
      ? vowelPalette[rawVowelFamily] 
      : (vowelPalette[vowelFamily] || fallbackColor);
    const rarity        = getRarity(word);
    const syllables     = wordData?.syllableCount || localCore?.syllableCount || 1;

    const rhymeLinks          = Array.isArray(rhymeContext?.links)           ? rhymeContext.links.slice(0, 6)           : [];
    const astrologyTopMatches = Array.isArray(astrologyContext?.topMatches)  ? astrologyContext.topMatches.slice(0, 4)  : [];
    const astrologyClusters   = Array.isArray(astrologyContext?.clusters)    ? astrologyContext.clusters.slice(0, 3)    : [];
    const astrologySign       = typeof astrologyContext?.sign === "string"   ? astrologyContext.sign                    : "";
    const hasSuggestions      = synonyms.length > 0 || antonyms.length > 0 || rhymes.length > 0 || slantRhymes.length > 0;

    return (
      <div className={`word-card word-card--${rarity}`} data-school={schoolId}>
        <div className="card-frame" onPointerDown={handleDragStart}>
          <button
            className="card-close-btn"
            onClick={() => onClose({ restoreFocus: false })}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close card"
          >
            ✕
          </button>

          {/* ── Phaser Sigil Chamber — living ritual circle ─────────────── */}
          <SigilChamber
            color={vowelColor}
            glyph={schoolIcon}
            syllables={syllables}
            word={word}
          />

          {/* ── Text content — ink-soaks in on word change ───────────────── */}
          <div className="card-inner">
            <AnimatePresence mode="wait">
              <motion.div
                key={word}
                initial={INK_INITIAL}
                animate={INK_ANIMATE}
                exit={INK_EXIT}
                style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              >
                {/* ── Word inscription — primary drag zone ─────────────── */}
                <header
                  className="card-inscription-header"
                  style={{ cursor: isInteracting ? "grabbing" : "grab" }}
                  title="Drag to move"
                >
                  <div className="card-inscription-ornament" aria-hidden="true" />
                  <h3 id={titleId} className="card-word-name">{word}</h3>
                  {ipa && (
                    <span className="card-ipa" aria-label={`Pronunciation: ${ipa}`}>{ipa}</span>
                  )}
                  <div className="card-inscription-ornament" aria-hidden="true" />
                </header>

                {/* ── School · Part of speech ──────────────────────────── */}
                <div className="card-type-line">
                  <span className="card-type">
                    {schoolName || "Unknown School"} · {partOfSpeech || "Lexeme"}
                  </span>
                </div>

                {/* ── Arcane Properties row ────────────────────────────── */}
                <div className="card-arcane-props" aria-label="Arcane properties">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${word}-syl`}
                      className="arcane-prop"
                      initial={GEM_INITIAL}
                      animate={GEM_ANIMATE}
                      exit={GEM_EXIT}
                      aria-label={`${syllables} syllables`}
                    >
                      <span className="arcane-prop-value" style={{ color: vowelColor }}>{syllables}</span>
                      <span className="arcane-prop-label">depth</span>
                    </motion.div>
                  </AnimatePresence>

                  <div
                    className="arcane-prop arcane-prop--rarity"
                    data-rarity={rarity}
                    aria-label={`Rarity: ${RARITY_NAMES[rarity]}`}
                  >
                    <div className="arcane-rarity-gem" data-rarity={rarity} />
                    <span className="arcane-prop-label arcane-prop-label--rarity">{RARITY_NAMES[rarity]}</span>
                  </div>

                  {rhymeKey && (
                    <div className="arcane-prop" aria-label={`Echo key: ${rhymeKey}`}>
                      <span className="arcane-prop-value" style={{ color: vowelColor }}>{rhymeKey}</span>
                      <span className="arcane-prop-label">echo</span>
                    </div>
                  )}
                </div>

                {/* ── Scrollable inscription text box ──────────────────── */}
                <div className="card-text-box" role="region" aria-label="Word definitions">
                  {renderBreadcrumb()}

                  {partOfSpeech && (
                    <p className="card-definition-type">{partOfSpeech}</p>
                  )}
                  {allDefs.map((def, idx) => (
                    <p key={idx} className="card-definition">{def}</p>
                  ))}

                  {hasSuggestions && <div className="card-flavor-divider" />}

                  {synonyms.length > 0 && (
                    <p className="card-flavor-text">
                      <span className="flavor-label">Harmonic Kin:</span>{" "}
                      {renderSuggestionRunes(synonyms)}
                    </p>
                  )}
                  {antonyms.length > 0 && (
                    <p className="card-flavor-text">
                      <span className="flavor-label">Dissonant Kin:</span>{" "}
                      {renderSuggestionRunes(antonyms)}
                    </p>
                  )}
                  {rhymes.length > 0 && (
                    <p className="card-flavor-text">
                      <span className="flavor-label">Echo Kin:</span>{" "}
                      {renderSuggestionRunes(rhymes)}
                    </p>
                  )}
                  {slantRhymes.length > 0 && (
                    <p className="card-flavor-text">
                      <span className="flavor-label">Shadow Echo:</span>{" "}
                      {renderSuggestionRunes(slantRhymes)}
                    </p>
                  )}

                  {rhymeLinks.length > 0 && (
                    <div className="card-insight-section">
                      <p className="card-insight-title">Resonance Links</p>
                      {rhymeLinks.map((link, i) => (
                        <p key={i} className="card-insight-line">
                          {link.linkedWord} · {link.type} ({(link.score || 0).toFixed(2)})
                        </p>
                      ))}
                    </div>
                  )}

                  {astrologyContext?.enabled &&
                    (astrologySign || astrologyClusters.length > 0 || astrologyTopMatches.length > 0) && (
                    <div className="card-insight-section card-insight-section--astrology">
                      <p className="card-insight-title">
                        <span className="card-astro-icon" aria-hidden="true">✶</span>
                        Rhyme Astrology
                      </p>
                      {astrologySign && (
                        <div className="card-astro-sign-badge">
                          <span className="card-astro-sign-label">Sign</span>
                          <span className="card-astro-sign">{astrologySign}</span>
                        </div>
                      )}
                      {astrologyClusters.length > 0 && (
                        <div className="card-astro-clusters">
                          {astrologyClusters.map((cluster) => (
                            <span key={cluster.id || cluster.label} className="card-astro-cluster-chip">
                              {cluster.label || cluster.id}
                            </span>
                          ))}
                        </div>
                      )}
                      {astrologyTopMatches.length > 0 && (
                        <div className="card-astro-matches">
                          <p className="card-astro-matches-label">Echoes</p>
                          {astrologyTopMatches.map((match, i) => {
                            const token   = String(match?.token || "");
                            const score   = Number(match?.overallScore || 0);
                            const reasons = Array.isArray(match?.reasons) ? match.reasons.slice(0, 2) : [];
                            if (!token) return null;
                            return (
                              <div key={i} className="card-astro-match-row">
                                <div className="card-astro-match-header">
                                  <span className="card-astro-match-word">{token}</span>
                                  <span className="card-astro-match-score">{Math.round(score * 100)}%</span>
                                </div>
                                <div className="card-astro-match-bar-track">
                                  <div className="card-astro-match-bar-fill" style={{ width: `${Math.round(score * 100)}%` }} />
                                </div>
                                {reasons.length > 0 && (
                                  <div className="card-astro-reason-pills">
                                    {reasons.map((reason, ri) => (
                                      <span key={ri} className="card-astro-reason-pill">{reason}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Session history navigation ────────────────────────── */}
                {sessionHistory.length > 1 && (
                  <div className="card-session-nav" role="navigation" aria-label="Session word history">
                    <button
                      className="session-nav-btn"
                      type="button"
                      onClick={() => onSessionNavigate(sessionIndex - 1)}
                      disabled={sessionIndex <= 0}
                      aria-label="Previous session word"
                    >
                      ◂
                    </button>
                    <span className="session-nav-pos">
                      {sessionIndex + 1} / {sessionHistory.length}
                    </span>
                    <button
                      className="session-nav-btn"
                      type="button"
                      onClick={() => onSessionNavigate(sessionIndex + 1)}
                      disabled={sessionIndex >= sessionHistory.length - 1}
                      aria-label="Next session word"
                    >
                      ▸
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Corner L-bracket ornaments ────────────────────────────── */}
          <div className="card-corner card-corner--tl" aria-hidden="true" />
          <div className="card-corner card-corner--tr" aria-hidden="true" />
          <div className="card-corner card-corner--bl" aria-hidden="true" />
          <div className="card-corner card-corner--br" aria-hidden="true" />

          {/* ── Resize handles — 8 directions ─────────────────────────── */}
          <div className="card-resize-handle card-resize-handle--n"  onPointerDown={handleResizeStart("n")}  aria-hidden="true" />
          <div className="card-resize-handle card-resize-handle--s"  onPointerDown={handleResizeStart("s")}  aria-hidden="true" />
          <div className="card-resize-handle card-resize-handle--e"  onPointerDown={handleResizeStart("e")}  aria-hidden="true" />
          <div className="card-resize-handle card-resize-handle--w"  onPointerDown={handleResizeStart("w")}  aria-hidden="true" />
          <div className="card-resize-handle card-resize-handle--ne" onPointerDown={handleResizeStart("ne")} aria-hidden="true" />
          <div className="card-resize-handle card-resize-handle--nw" onPointerDown={handleResizeStart("nw")} aria-hidden="true" />
          <div
            className="card-resize-handle card-resize-handle--se"
            onPointerDown={handleResizeStart("se")}
            role="separator"
            aria-label="Resize card"
            aria-valuenow={size.width}
          />
          <div className="card-resize-handle card-resize-handle--sw" onPointerDown={handleResizeStart("sw")} aria-hidden="true" />
        </div>
      </div>
    );
  };

  /* ── Mobile bottom sheet ──────────────────────────────────────────────── */
  const isMobileView = typeof window !== "undefined" && window.innerWidth <= 640;

  if (isMobileView) {
    return (
      <>
        <motion.div
          className="mobile-bottom-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal="true"
          tabIndex="-1"
          className={`word-tooltip-mobile-sheet ${isInteracting ? "is-interacting" : ""}`}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <div className="mobile-bottom-sheet-handle" />
          <div className="word-tooltip-mobile-header">
            <h3 id={titleId} className="mobile-bottom-sheet-title">
              {wordData?.word || "Word"}
            </h3>
            <button type="button" className="mobile-bottom-sheet-close" onClick={onClose} aria-label="Close word card">
              ✕
            </button>
          </div>
          <div className="word-tooltip-mobile-body">
            {cardContent()}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      tabIndex="-1"
      className={`word-tooltip-container ${isInteracting ? "is-interacting" : ""}`}
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        width: size.width,
        height: size.height,
        zIndex: 1300,
        touchAction: "none",
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      {cardContent()}
    </motion.div>
  );
};

WordTooltip.propTypes = {
  wordData: PropTypes.shape({
    word: PropTypes.string.isRequired,
    vowelFamily: PropTypes.string,
    definition: PropTypes.shape({
      text: PropTypes.string,
      partOfSpeech: PropTypes.string,
      source: PropTypes.string,
    }),
    definitions: PropTypes.arrayOf(PropTypes.string),
    synonyms: PropTypes.arrayOf(PropTypes.string),
    antonyms: PropTypes.arrayOf(PropTypes.string),
    rhymes: PropTypes.arrayOf(PropTypes.string),
    slantRhymes: PropTypes.arrayOf(PropTypes.string),
    rhymeKey: PropTypes.string,
    syllableCount: PropTypes.number,
    ipa: PropTypes.string,
  }),
  analysis: PropTypes.shape({
    core: PropTypes.shape({
      vowelFamily: PropTypes.string,
      schoolName: PropTypes.string,
      schoolGlyph: PropTypes.string,
      skin: PropTypes.string,
      syllableCount: PropTypes.number,
      rhymeKey: PropTypes.string,
    }),
    rhyme: PropTypes.shape({
      links: PropTypes.arrayOf(
        PropTypes.shape({
          type: PropTypes.string,
          score: PropTypes.number,
          linkedWord: PropTypes.string,
          gate: PropTypes.string,
          reasons: PropTypes.arrayOf(PropTypes.string),
        })
      ),
      gateReasons: PropTypes.arrayOf(PropTypes.string),
    }),
    rhymeAstrology: PropTypes.shape({
      enabled: PropTypes.bool,
      sign: PropTypes.string,
      topMatches: PropTypes.arrayOf(
        PropTypes.shape({ token: PropTypes.string, overallScore: PropTypes.number })
      ),
      clusters: PropTypes.arrayOf(
        PropTypes.shape({ id: PropTypes.string, label: PropTypes.string, sign: PropTypes.string })
      ),
    }),
    syntax: PropTypes.shape({
      role: PropTypes.string,
      lineRole: PropTypes.string,
      stressRole: PropTypes.string,
      rhymePolicy: PropTypes.string,
      reasons: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  onDrag: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuggestionClick: PropTypes.func,
  sessionHistory: PropTypes.arrayOf(
    PropTypes.shape({ word: PropTypes.string, localAnalysis: PropTypes.object })
  ),
  sessionIndex: PropTypes.number,
  onSessionNavigate: PropTypes.func,
};

WordTooltip.defaultProps = {
  wordData: null,
  analysis: null,
  isLoading: false,
  error: null,
  onSuggestionClick: () => {},
  sessionHistory: [],
  sessionIndex: -1,
  onSessionNavigate: () => {},
};

export default WordTooltip;
