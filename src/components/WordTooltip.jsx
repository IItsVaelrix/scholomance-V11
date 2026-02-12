import { useRef, useLayoutEffect, useEffect } from "react";
import PropTypes from "prop-types";
import { motion, useMotionValue } from "framer-motion";
import { useTheme } from "../hooks/useTheme.jsx";
import { getVowelColorsForSchool } from "../data/schoolPalettes.js";
import { SCHOOLS } from "../data/schools.js";
import { normalizeVowelFamily } from "../lib/vowelFamily.js";
import "./WordTooltip.css";

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
const VOWEL_FAMILY_TO_SCHOOL = Object.freeze({
  A: "SONIC",
  AA: "SONIC",
  AE: "SONIC",
  AH: "SONIC",
  AO: "VOID",
  AW: "VOID",
  OW: "VOID",
  UW: "VOID",
  AY: "ALCHEMY",
  EY: "ALCHEMY",
  OY: "ALCHEMY",
  EH: "WILL",
  ER: "WILL",
  UH: "WILL",
  IH: "PSYCHIC",
  IY: "PSYCHIC",
});

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
  const tooltipRef = useRef(null);

  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);

  useLayoutEffect(() => {
    motionX.set(0);
    motionY.set(0);
  }, [x, y, motionX, motionY]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const cardContent = () => {
    if (isLoading && !wordData && !analysis) {
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

    if (error && !wordData && !analysis) {
      return (
        <div className="word-card word-card--error">
          <div className="card-frame">
            <button className="card-close-btn" onClick={onClose} aria-label="Close">
              &#x2715;
            </button>
            <div className="card-inner">
              <div className="card-error-icon">&#x26A0;&#xFE0F;</div>
              <p className="card-error-text">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    if (!wordData && !analysis) {
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

    const localCore = analysis?.core || null;
    const rhymeContext = analysis?.rhyme || null;
    const syntaxGate = analysis?.syntax || null;

    const word = String(wordData?.word || "");
    const definition = wordData?.definition || null;
    const definitions = Array.isArray(wordData?.definitions) ? wordData.definitions : [];
    const synonyms = Array.isArray(wordData?.synonyms) ? wordData.synonyms : [];
    const antonyms = Array.isArray(wordData?.antonyms) ? wordData.antonyms : [];
    const rhymes = Array.isArray(wordData?.rhymes) ? wordData.rhymes : [];
    const rhymeKey = wordData?.rhymeKey || localCore?.rhymeKey || null;
    const ipa = typeof wordData?.ipa === "string" ? wordData.ipa : null;

    const partOfSpeech = definition?.partOfSpeech;
    const allDefs = definitions.length > 0
      ? [...new Set(definitions)].slice(0, 5)
      : definition?.text
        ? [definition.text]
        : isLoading
          ? ["Loading lexicon..."]
          : ["No definition found."];

    const vowelFamily = normalizeVowelFamily(localCore?.vowelFamily || wordData?.vowelFamily);
    const schoolName = localCore?.schoolName || getSchoolNameFromVowelFamily(vowelFamily);
    const schoolIcon = localCore?.schoolGlyph || (schoolName ? (SCHOOL_ICONS[schoolName] || "\u2736") : "\u2736");
    const fallbackColor = theme === "light" ? "#1a1a2e" : "#f8f9ff";
    const vowelColor = vowelFamily ? (vowelPalette[vowelFamily] || fallbackColor) : fallbackColor;
    const rarity = getRarity(word);
    const syllables = wordData?.syllableCount || localCore?.syllableCount || 1;

    const rhymeLinks = Array.isArray(rhymeContext?.links) ? rhymeContext.links.slice(0, 6) : [];
    const gateReasons = Array.isArray(rhymeContext?.gateReasons) ? rhymeContext.gateReasons.slice(0, 6) : [];
    const syntaxReasons = Array.isArray(syntaxGate?.reasons) ? syntaxGate.reasons.slice(0, 6) : [];

    return (
      <div className={`word-card word-card--${rarity}`} style={{ cursor: "grab" }}>
        <div className="card-frame">
          <button className="card-close-btn" onClick={onClose} aria-label="Close">
            &#x2715;
          </button>

          <div className="card-mana-cost" style={{ backgroundColor: vowelColor }}>
            <span className="mana-value">{syllables}</span>
          </div>

          <div className="card-inner">
            <div className="card-name-banner">
              <h3 className="card-name">{word || "Unknown"}</h3>
            </div>

            <div className="card-art-frame" style={{ borderColor: vowelColor }}>
              <div
                className="card-art"
                style={{ background: `radial-gradient(ellipse at center, ${vowelColor}22 0%, transparent 70%)` }}
              >
                <span className="card-school-icon">{schoolIcon}</span>
                {vowelFamily && (
                  <span className="card-vowel-glyph" style={{ color: vowelColor }}>
                    {vowelFamily}
                  </span>
                )}
              </div>
            </div>

            <div className="card-type-line">
              <span className="card-type">
                {schoolName || "Arcane"} {partOfSpeech ? `\u2014 ${partOfSpeech}` : "Word"}
              </span>
            </div>

            <div className="card-text-box">
              {localCore && (
                <div className="card-insight-section">
                  <p className="card-insight-title">Core</p>
                  <p className="card-insight-line">
                    {(localCore.schoolGlyph || schoolIcon)} {(localCore.schoolName || "Unbound")} | Skin {(localCore.skin || "DEFAULT")}
                  </p>
                  {localCore.vowelFamily && (
                    <p className="card-insight-line">Vowel Family: {localCore.vowelFamily}</p>
                  )}
                </div>
              )}

              {allDefs.length === 1 ? (
                <p className="card-definition">{allDefs[0]}</p>
              ) : (
                <ol className="card-definitions-list">
                  {allDefs.map((def, index) => (
                    <li key={index} className="card-definition">{def}</li>
                  ))}
                </ol>
              )}

              {ipa && <p className="card-insight-line">IPA: {ipa}</p>}
              {isLoading && <p className="card-insight-line">Gathering lexicon data...</p>}
              {error && <p className="card-insight-line card-insight-line--error">{error}</p>}

              {(synonyms.length > 0 || antonyms.length > 0) && <div className="card-flavor-divider" />}

              {synonyms.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Allies:</span> {synonyms.slice(0, 5).join(", ")}
                </p>
              )}

              {antonyms.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Foes:</span> {antonyms.slice(0, 5).join(", ")}
                </p>
              )}

              {rhymes.length > 0 && (
                <p className="card-flavor-text">
                  <span className="flavor-label">Resonates:</span> {rhymes.slice(0, 5).join(", ")}
                </p>
              )}

              {rhymeLinks.length > 0 && (
                <div className="card-insight-section">
                  <p className="card-insight-title">Rhyme Context</p>
                  {rhymeLinks.map((link, index) => (
                    <p key={`${link.linkedWord || "word"}-${index}`} className="card-insight-line">
                      {(link.linkedWord || "Unknown")} | {(link.type || "near")} ({(Number(link.score) || 0).toFixed(2)})
                    </p>
                  ))}
                </div>
              )}

              {syntaxGate && (
                <div className="card-insight-section">
                  <p className="card-insight-title">Syntax Gate</p>
                  <p className="card-insight-line">
                    {(syntaxGate.role || "content")} | {(syntaxGate.lineRole || "line_mid")} | {(syntaxGate.stressRole || "unknown")}
                  </p>
                  <p className="card-insight-line">Policy: {syntaxGate.rhymePolicy || "allow"}</p>
                  {syntaxReasons.length > 0 && (
                    <p className="card-insight-line">Reasons: {syntaxReasons.join(", ")}</p>
                  )}
                  {gateReasons.length > 0 && (
                    <p className="card-insight-line">Pair gates: {gateReasons.join(", ")}</p>
                  )}
                </div>
              )}
            </div>

            <div className="card-footer">
              {rhymeKey && (
                <div className="card-stat card-stat--left" title="Rhyme Key">
                  <span className="stat-icon">&#x266A;</span>
                  <span className="stat-value">{rhymeKey}</span>
                </div>
              )}
              <div className="card-rarity-gem" data-rarity={rarity} />
              <div className="card-stat card-stat--right" title="Syllables">
                <span className="stat-value">{syllables}</span>
                <span className="stat-icon">&#x25C6;</span>
              </div>
            </div>
          </div>

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
        position: "fixed",
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
        const finalX = x + motionX.get();
        const finalY = y + motionY.get();
        onDrag({ x: finalX, y: finalY });
      }}
      whileDrag={{ cursor: "grabbing", scale: 1.02 }}
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
