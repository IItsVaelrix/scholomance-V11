import { useRef, useLayoutEffect, useEffect } from "react";
import PropTypes from "prop-types";
import { motion, useMotionValue } from "framer-motion";
import { usePhonemeEngine } from "../hooks/usePhonemeEngine.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import { DEFAULT_VOWEL_COLORS, getVowelColorsForSchool } from "../data/schoolPalettes.js";
import "./WordTooltip.css";

// Dark fallback (kept for safety if palette lookup fails)
const VOWEL_COLORS_DARK = DEFAULT_VOWEL_COLORS;

// Magic school icons (unicode symbols for visual flair)
const SCHOOL_ICONS = {
  Evocation: "🔥",
  Conjuration: "✨",
  Abjuration: "🛡️",
  Divination: "👁️",
  Enchantment: "💫",
  Illusion: "🌀",
  Necromancy: "💀",
  Transmutation: "⚗️",
};

// Rarity based on syllable count or other metrics
const getRarity = (word) => {
  if (!word) return "common";
  const len = word.length;
  if (len >= 12) return "legendary";
  if (len >= 9) return "epic";
  if (len >= 6) return "rare";
  return "common";
};

const WordTooltip = ({ wordData, isLoading, error, x, y, onDrag, onClose }) => {
  const { engine } = usePhonemeEngine();
  const { theme } = useTheme();
  const vowelPalette = getVowelColorsForSchool('DEFAULT', theme);
  const tooltipRef = useRef(null);

  // Use motion values for smooth dragging without state updates during drag
  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);

  // Reset motion values synchronously when position props change (before paint)
  useLayoutEffect(() => {
    motionX.set(0);
    motionY.set(0);
  }, [x, y, motionX, motionY]);

  // Handle Escape key to close tooltip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const cardContent = () => {
    // Loading state card
    if (isLoading) {
      return (
        <div className="word-card word-card--loading">
          <div className="card-frame">
            <div className="card-inner">
              <div className="card-loading-spinner" />
              <p className="card-loading-text">Divining word essence...</p>
            </div>
          </div>
        </div>
      );
    }

    // Error state card
    if (error) {
      return (
        <div className="word-card word-card--error">
          <div className="card-frame">
            <button className="card-close-btn" onClick={onClose} aria-label="Close">
              &#x2715;
            </button>
            <div className="card-inner">
              <div className="card-error-icon">⚠️</div>
              <p className="card-error-text">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    // Empty state card
    if (!wordData) {
      return (
        <div className="word-card word-card--empty">
          <div className="card-frame">
            <button className="card-close-btn" onClick={onClose} aria-label="Close">
              &#x2715;
            </button>
            <div className="card-inner">
              <div className="card-empty-icon">?</div>
              <p className="card-empty-text">Unknown arcane word</p>
            </div>
          </div>
        </div>
      );
    }

    const {
      word,
      definition,
      definitions,
      synonyms,
      antonyms,
      rhymes,
      rhymeKey,
      syllableCount,
    } = wordData;

    const partOfSpeech = definition?.partOfSpeech;

    // Collect up to 5 unique definitions
    const allDefs = definitions?.length
      ? [...new Set(definitions)].slice(0, 5)
      : definition?.text
        ? [definition.text]
        : ["No definition found."];

    // Phoneme analysis
    const analysis = engine.analyzeWord(word);
    const vowelFamily = analysis ? analysis.vowelFamily : null;
    const magicSchool = vowelFamily ? engine.getSchoolFromVowelFamily(vowelFamily) : null;
    const fallbackColor = theme === 'light' ? "#1a1a2e" : "#f8f9ff";
    const vowelColor = vowelFamily ? (vowelPalette[vowelFamily] || fallbackColor) : fallbackColor;
    const schoolIcon = magicSchool ? (SCHOOL_ICONS[magicSchool] || "✦") : "✦";
    const rarity = getRarity(word);
    const syllables = syllableCount || analysis?.syllableCount || 1;

    return (
      <div
        className={`word-card word-card--${rarity}`}
        style={{ cursor: "grab" }}
      >
        <div className="card-frame">
          <button className="card-close-btn" onClick={onClose} aria-label="Close">
            &#x2715;
          </button>
          
          {/* Mana/Syllable Cost Crystal */}
          <div className="card-mana-cost" style={{ backgroundColor: vowelColor }}>
            <span className="mana-value">{syllables}</span>
          </div>

          <div className="card-inner">
            {/* Card Name Banner */}
            <div className="card-name-banner">
              <h3 className="card-name">{word}</h3>
            </div>

            {/* Card Art Area - Vowel Family Display */}
            <div className="card-art-frame" style={{ borderColor: vowelColor }}>
              <div className="card-art" style={{
                background: `radial-gradient(ellipse at center, ${vowelColor}22 0%, transparent 70%)`
              }}>
                <span className="card-school-icon">{schoolIcon}</span>
                {vowelFamily && (
                  <span className="card-vowel-glyph" style={{ color: vowelColor }}>
                    {vowelFamily}
                  </span>
                )}
              </div>
            </div>

            {/* Type Line */}
            <div className="card-type-line">
              <span className="card-type">
                {magicSchool || "Arcane"} {partOfSpeech ? `— ${partOfSpeech}` : "Word"}
              </span>
            </div>

            {/* Card Text Box */}
            <div className="card-text-box">
              {allDefs.length === 1 ? (
                <p className="card-definition">{allDefs[0]}</p>
              ) : (
                <ol className="card-definitions-list">
                  {allDefs.map((def, i) => (
                    <li key={i} className="card-definition">{def}</li>
                  ))}
                </ol>
              )}

              {/* Flavor text area for synonyms/antonyms */}
              {(synonyms?.length > 0 || antonyms?.length > 0) && (
                <div className="card-flavor-divider" />
              )}

              {synonyms?.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Allies:</span> {synonyms.slice(0, 5).join(", ")}
                </p>
              )}

              {antonyms?.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Foes:</span> {antonyms.slice(0, 5).join(", ")}
                </p>
              )}

              {rhymes?.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Resonates:</span> {rhymes.slice(0, 5).join(", ")}
                </p>
              )}
            </div>

            {/* Card Footer Stats */}
            <div className="card-footer">
              {rhymeKey && (
                <div className="card-stat card-stat--left" title="Rhyme Key">
                  <span className="stat-icon">♪</span>
                  <span className="stat-value">{rhymeKey}</span>
                </div>
              )}
              <div className="card-rarity-gem" data-rarity={rarity} />
              <div className="card-stat card-stat--right" title="Syllables">
                <span className="stat-value">{syllables}</span>
                <span className="stat-icon">◆</span>
              </div>
            </div>
          </div>

          {/* Corner Decorations */}
          <div className="card-corner card-corner--tl" />
          <div className="card-corner card-corner--tr" />
          <div className="card-corner card-corner--bl" />
          <div className="card-corner card-corner--br" />
        </div>
      </div>
    );
  };

  return (
    <motion.div
      ref={tooltipRef}
      className="word-tooltip-container"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        x: motionX,
        y: motionY,
        zIndex: 1000,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 400 }}
      drag
      dragConstraints={{
        left: -x + 10,
        right: window.innerWidth - x - 390,
        top: -y + 10,
        bottom: window.innerHeight - y - 510,
      }}
      dragElastic={0}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
      onDragEnd={() => {
        // Calculate final position from base + motion offset
        const finalX = x + motionX.get();
        const finalY = y + motionY.get();
        // Update parent state - useLayoutEffect will reset motion values
        // synchronously when the new x/y props arrive
        onDrag({ x: finalX, y: finalY });
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
    >
      {cardContent()}
    </motion.div>
  );
};

WordTooltip.propTypes = {
  wordData: PropTypes.shape({
    word: PropTypes.string.isRequired,
    definition: PropTypes.shape({
      text: PropTypes.string,
      partOfSpeech: PropTypes.string,
      source: PropTypes.string,
    }),
    definitions: PropTypes.arrayOf(PropTypes.string),
    synonyms: PropTypes.arrayOf(PropTypes.string),
    antonyms: PropTypes.arrayOf(PropTypes.string),
    rhymes: PropTypes.arrayOf(PropTypes.string),
    rhymeKey: PropTypes.string,
    syllableCount: PropTypes.number,
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
  isLoading: false,
  error: null,
};

export default WordTooltip;
