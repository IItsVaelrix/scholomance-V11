import { useRef, useLayoutEffect, useEffect, useState, useId } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useTheme } from "../hooks/useTheme.jsx";
import { getVowelColorsForSchool } from "../data/schoolPalettes.js";
import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from "../data/schools.js";
import { normalizeVowelFamily } from "../lib/vowelFamily.js";
import "./WordTooltip.css";

const TOOLTIP_MIN_WIDTH = 300;
const TOOLTIP_MIN_HEIGHT = 350;
const TOOLTIP_DEFAULT_WIDTH = 390;
const TOOLTIP_DEFAULT_HEIGHT = 510;

const SCHOOL_ICONS = {
  Evocation: "\uD83D\uDD25",
  Conjuration: "\u2728",
  Abjuration: "\uD83D\uDEE1\uFE0F",
  Divination: "\uD83D\uDC41\uFE0F",
  Enchantment: "\uD83D\uDCAB",
  Illusion: "\uD83C\uDF00",
  Necromancy: "\uD83D\uDC80",
  Transmutation: "\u2697\uFE0F",
};

function getSchoolNameFromVowelFamily(vowelFamily) {
  const normalized = normalizeVowelFamily(vowelFamily);
  const schoolId = VOWEL_FAMILY_TO_SCHOOL[normalized];
  if (!schoolId) return null;
  return SCHOOLS[schoolId]?.name || schoolId;
}

const getRarity = (word) => {
  if (!word) return "common";
  const len = word.length;
  if (len >= 12) return "legendary";
  if (len >= 9) return "epic";
  if (len >= 6) return "rare";
  return "common";
};

const WordTooltip = ({ wordData, analysis, isLoading, error, x, y, onDrag, onClose }) => {
  const { theme } = useTheme();
  const vowelPalette = getVowelColorsForSchool("DEFAULT", theme);
  const containerRef = useRef(null);
  const titleId = useId();
  
  const [size, setSize] = useState({ width: TOOLTIP_DEFAULT_WIDTH, height: TOOLTIP_DEFAULT_HEIGHT });
  const [pos, setPos] = useState({ x, y });
  const [isInteracting, setIsInteracting] = useState(false);

  // Sync incoming position
  useLayoutEffect(() => {
    setPos({ x, y });
  }, [x, y]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // High-performance Drag Logic
  const handleDragStart = (e) => {
    if (e.button !== 0) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setIsInteracting(true);

    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const handlePointerMove = (moveEvent) => {
      const nextX = moveEvent.clientX - startX;
      const nextY = moveEvent.clientY - startY;
      setPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = (upEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
      setIsInteracting(false);
      onDrag({ x: pos.x, y: pos.y });
    };

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerUp);
  };

  // High-performance Resize Logic
  const handleResizeStart = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setIsInteracting(true);

    const startWidth = size.width;
    const startHeight = size.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setSize({
        width: Math.max(TOOLTIP_MIN_WIDTH, startWidth + deltaX),
        height: Math.max(TOOLTIP_MIN_HEIGHT, startHeight + deltaY)
      });
    };

    const handlePointerUp = (upEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
      setIsInteracting(false);
    };

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerUp);
  };

  const cardContent = () => {
    if (isLoading && !wordData && !analysis) {
      return (
        <div className="word-card word-card--loading">
          <div className="card-frame">
            <div className="card-inner" aria-busy="true">
              <div className="card-loading-spinner" />
              <p className="card-loading-text">Divining word essence...</p>
            </div>
          </div>
        </div>
      );
    }

    if (error && !wordData && !analysis) {
      return (
        <div className="word-card word-card--error">
          <div className="card-frame">
            <button className="card-close-btn" onClick={onClose} aria-label="Close card">&#x2715;</button>
            <div className="card-inner" role="alert">
              <div className="card-error-icon" aria-hidden="true">&#x26A0;&#xFE0F;</div>
              <p className="card-error-text">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    const localCore = analysis?.core || null;
    const rhymeContext = analysis?.rhyme || null;

    const word = String(wordData?.word || analysis?.token?.word || "Unknown");
    const definition = wordData?.definition || null;
    const definitions = Array.isArray(wordData?.definitions) ? wordData.definitions : [];
    const synonyms = Array.isArray(wordData?.synonyms) ? wordData.synonyms : [];
    const antonyms = Array.isArray(wordData?.antonyms) ? wordData.antonyms : [];
    const rhymes = Array.isArray(wordData?.rhymes) ? wordData.rhymes : [];
    const slantRhymes = Array.isArray(wordData?.slantRhymes) ? wordData.slantRhymes : [];
    const rhymeKey = wordData?.rhymeKey || localCore?.rhymeKey || null;
    const ipa = typeof wordData?.ipa === "string" ? wordData.ipa : null;

    const partOfSpeech = definition?.partOfSpeech;
    const allDefs = definitions.length > 0
      ? [...new Set(definitions)].slice(0, 5)
      : (definition?.text ? [definition.text] : ["No arcane definitions found."]);

    const vowelFamily = normalizeVowelFamily(localCore?.vowelFamily || wordData?.vowelFamily);
    const schoolName = localCore?.schoolName || getSchoolNameFromVowelFamily(vowelFamily);
    const schoolIcon = localCore?.schoolGlyph || (schoolName ? (SCHOOL_ICONS[schoolName] || "\u2736") : "\u2736");
    const fallbackColor = theme === "light" ? "#1a1a2e" : "#f8f9ff";
    const vowelColor = vowelFamily ? (vowelPalette[vowelFamily] || fallbackColor) : fallbackColor;
    const rarity = getRarity(word);
    const syllables = wordData?.syllableCount || localCore?.syllableCount || 1;

    const rhymeLinks = Array.isArray(rhymeContext?.links) ? rhymeContext.links.slice(0, 6) : [];

    return (
      <div className={`word-card word-card--${rarity}`}>
        <div className="card-frame">
          <button className="card-close-btn" onClick={onClose} aria-label="Close card">&#x2715;</button>

          <div className="card-mana-cost" style={{ backgroundColor: vowelColor }} aria-label={`${syllables} syllables`}>
            <span className="mana-value" aria-hidden="true">{syllables}</span>
          </div>

          <div className="card-inner">
            <header className="card-name-banner" onPointerDown={handleDragStart} style={{ cursor: "grab" }} title="Drag to move">
              <h3 id={titleId} className="card-name">{word}</h3>
            </header>

            <div className="card-art-frame" style={{ borderColor: vowelColor }} aria-hidden="true">
              <div className="card-art" style={{ background: `radial-gradient(ellipse at center, ${vowelColor}22 0%, transparent 70%)` }}>
                <span className="card-school-icon">{schoolIcon}</span>
                {vowelFamily && <span className="card-vowel-glyph" style={{ color: vowelColor }}>{vowelFamily}</span>}
              </div>
            </div>

            <div className="card-type-line">
              <span className="card-type">
                {schoolName || "Arcane"} {partOfSpeech ? `\u2014 ${partOfSpeech}` : "Word"}
              </span>
            </div>

            <div className="card-text-box" role="region" aria-label="Word definitions">
              {allDefs.map((def, idx) => <p key={idx} className="card-definition">{def}</p>)}
              
              {ipa && <p className="card-insight-line">IPA: {ipa}</p>}

              {(synonyms.length > 0 || antonyms.length > 0 || rhymes.length > 0 || slantRhymes.length > 0) && <div className="card-flavor-divider" />}

              {synonyms.length > 0 && <p className="card-flavor-text"><span className="flavor-label">Allies:</span> {synonyms.join(", ")}</p>}
              {antonyms.length > 0 && <p className="card-flavor-text"><span className="flavor-label">Foes:</span> {antonyms.join(", ")}</p>}
              {rhymes.length > 0 && <p className="card-flavor-text"><span className="flavor-label">Resonates:</span> {rhymes.join(", ")}</p>}
              {slantRhymes.length > 0 && <p className="card-flavor-text"><span className="flavor-label">Near Echo:</span> {slantRhymes.join(", ")}</p>}

              {rhymeLinks.length > 0 && (
                <div className="card-insight-section">
                  <p className="card-insight-title">Connections</p>
                  {rhymeLinks.map((link, i) => (
                    <p key={i} className="card-insight-line">
                      {link.linkedWord} | {link.type} ({(link.score || 0).toFixed(2)})
                    </p>
                  ))}
                </div>
              )}
            </div>

            <footer className="card-footer">
              {rhymeKey && (
                <div className="card-stat card-stat--left" title="Rhyme Key">
                  <span className="stat-icon" aria-hidden="true">&#x266A;</span>
                  <span className="stat-value">{rhymeKey}</span>
                </div>
              )}
              <div className="card-rarity-gem" data-rarity={rarity} aria-label={`Rarity: ${rarity}`} />
              <div className="card-stat card-stat--right" title="Syllables">
                <span className="stat-value">{syllables}</span>
                <span className="stat-icon" aria-hidden="true">&#x25C6;</span>
              </div>
            </footer>
          </div>

          <div className="card-corner card-corner--tl" aria-hidden="true" />
          <div className="card-corner card-corner--tr" aria-hidden="true" />
          <div className="card-corner card-corner--bl" aria-hidden="true" />
          <div className="card-corner card-corner--br" aria-hidden="true" />
          
          <div
            className="card-resize-handle"
            onPointerDown={handleResizeStart}
            role="separator"
            aria-label="Resize card"
            aria-valuenow={size.width}
            style={{ cursor: "nwse-resize", pointerEvents: "all" }}
          />
        </div>
      </div>
    );
  };

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
        top: 0,
        left: 0,
        width: size.width,
        height: size.height,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        zIndex: 1000,
        touchAction: "none"
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
};

WordTooltip.defaultProps = {
  wordData: null,
  analysis: null,
  isLoading: false,
  error: null,
};

export default WordTooltip;
