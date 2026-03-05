import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { patternColor } from "../lib/patternColor.js";
import "./AnalyzePanel.css";
import "./InfoBeamPanel.css";

const HIDDEN_STATE_LABELS = {
  terminal_anchor: "Terminal",
  stress_anchor: "Stressed",
  function_gate: "Function",
  lexical_chain: "Lexical",
  line_launch: "Launch",
  flow: "Flow",
};

const HIDDEN_STATE_COLORS = {
  terminal_anchor: "#c9a840",
  stress_anchor: "#a78bfa",
  function_gate: "#94a3b8",
  lexical_chain: "#67e8f9",
  line_launch: "#60a5fa",
  flow: "#475569",
};

function PatternChip({ letter }) {
  const color = patternColor(letter);
  return (
    <span className="analyze-pattern-chip" style={{ "--chip-color": color }}>
      {letter}
    </span>
  );
}

PatternChip.propTypes = { letter: PropTypes.string.isRequired };

function StanzaCard({ stanza }) {
  const stateCounts = stanza.hiddenStateCounts || {};
  const total = Object.values(stateCounts).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0] || "flow";

  return (
    <div className="analyze-stanza-card">
      <div className="analyze-stanza-header">
        <span className="analyze-stanza-index">Stanza {stanza.stanzaIndex + 1}</span>
        <span
          className="analyze-stanza-dominant"
          style={{ "--state-color": HIDDEN_STATE_COLORS[dominant] || "#475569" }}
        >
          {HIDDEN_STATE_LABELS[dominant] || dominant}
        </span>
        <span className="analyze-stanza-tokens">{stanza.tokenCount}t</span>
      </div>
      <div className="analyze-state-bar">
        {sorted.map(([state, count]) => (
          <div
            key={state}
            className="analyze-state-segment"
            style={{
              width: `${(count / total) * 100}%`,
              "--state-color": HIDDEN_STATE_COLORS[state] || "#475569",
            }}
            title={`${HIDDEN_STATE_LABELS[state] || state}: ${count}`}
          />
        ))}
      </div>
    </div>
  );
}

StanzaCard.propTypes = {
  stanza: PropTypes.shape({
    stanzaIndex: PropTypes.number,
    tokenCount: PropTypes.number,
    hiddenStateCounts: PropTypes.object,
  }).isRequired,
};

export default function AnalyzePanel({
  scheme = null,
  meter = null,
  statistics = null,
  literaryDevices = [],
  emotion = "Neutral",
  genreProfile = null,
  hhmSummary = null,
  scoreData = null,
  onGroupHover = null,
  onGroupLeave = null,
  infoBeamEnabled = false,
  onInfoBeamToggle = null,
  onGroupClick = null,
  activeInfoBeamFamily = null,
}) {
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const groupEntries = scheme?.groups ? Array.from(scheme.groups.entries()) : [];
  const patternLetters = scheme?.pattern ? [...scheme.pattern] : [];
  const hasContent = scheme || meter || statistics || hhmSummary?.enabled || literaryDevices.length > 0;

  return (
    <div className="analyze-panel">
      {/* Score badge */}
      {scoreData && (
        <div className="analyze-score-badge">
          <motion.span
            className="analyze-score-value"
            key={scoreData.totalScore}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {scoreData.totalScore}
          </motion.span>
          <span className="analyze-score-label">CODEx Score</span>
        </div>
      )}

      {/* Scroll Profile */}
      {(genreProfile || emotion !== "Neutral") && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C8;</span> Scroll Profile
          </h4>
          <div className="analyze-profile-row">
            {genreProfile && (
              <div className="analyze-profile-item">
                <span className="analyze-profile-label">Genre</span>
                <span className="analyze-profile-value">{genreProfile.genre}</span>
                {genreProfile.confidence != null && (
                  <div className="analyze-confidence-bar">
                    <motion.div
                      className="analyze-confidence-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(genreProfile.confidence * 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            )}
            {emotion !== "Neutral" && (
              <div className="analyze-profile-item">
                <span className="analyze-profile-label">Tone</span>
                <span className="analyze-profile-value analyze-tone-value">{emotion}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Poetic Form */}
      {(scheme || (meter && meter.meterName !== "Free Verse")) && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C9;</span> Poetic Form
          </h4>
          {scheme && (
            <div className="analyze-scheme-block">
              <div className="analyze-scheme-name">{scheme.name || "Unknown Form"}</div>
              {patternLetters.length > 0 && (
                <div className="analyze-pattern-row">
                  {patternLetters.map((letter, i) => (
                    <PatternChip key={i} letter={letter} />
                  ))}
                </div>
              )}
              {scheme.confidence != null && scheme.confidence < 1 && (
                <div className="analyze-confidence-bar analyze-confidence-bar--sm">
                  <motion.div
                    className="analyze-confidence-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(scheme.confidence * 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              )}
              {scheme.lore && (
                <p className="analyze-scheme-lore">{scheme.lore}</p>
              )}
            </div>
          )}
          {meter && meter.meterName !== "Free Verse" && (
            <div className="analyze-meter-block">
              <span className="analyze-meter-name">{meter.meterName}</span>
              {meter.footName && (
                <span className="analyze-meter-detail">{meter.footName}</span>
              )}
              <span className="analyze-meter-consistency">
                {Math.round(meter.consistency * 100)}% consistent
              </span>
            </div>
          )}
        </section>
      )}

      {/* Rhyme Profile */}
      {statistics && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25C7;</span> Rhyme Profile
          </h4>
          <div className="analyze-stats-grid">
            {[
              { label: "Perfect", value: statistics.perfectCount },
              { label: "Near", value: statistics.nearCount },
              { label: "Slant", value: statistics.slantCount },
              { label: "Internal", value: statistics.internalCount },
              { label: "Multi-syl", value: statistics.multiSyllableCount },
              { label: "Syllables", value: statistics.totalSyllables },
            ].map(({ label, value }) => (
              <div key={label} className="analyze-stat-cell">
                <span className="analyze-stat-value">{value ?? "—"}</span>
                <span className="analyze-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Verse Structure — HHM stanza data */}
      {hhmSummary?.enabled && hhmSummary.stanzas?.length > 0 && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25EB;</span> Verse Structure
          </h4>
          <div className="analyze-hhm-meta">
            <span>{hhmSummary.stanzaCount} stanza{hhmSummary.stanzaCount !== 1 ? "s" : ""}</span>
            <span className="analyze-dot">·</span>
            <span>{hhmSummary.tokenCount} tokens</span>
            <span className="analyze-dot">·</span>
            <span>{hhmSummary.stanzaSizeBars}-bar groups</span>
          </div>
          <div className="analyze-stanzas">
            {hhmSummary.stanzas.map((stanza) => (
              <StanzaCard key={stanza.stanzaIndex} stanza={stanza} />
            ))}
          </div>
          <div className="analyze-state-legend">
            {Object.entries(HIDDEN_STATE_LABELS).map(([key, label]) => (
              <span
                key={key}
                className="analyze-legend-item"
                style={{ "--state-color": HIDDEN_STATE_COLORS[key] }}
              >
                <span className="analyze-legend-dot" />
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Literary Craft */}
      {literaryDevices.length > 0 && (
        <section className="analyze-section">
          <h4 className="analyze-section-title">
            <span className="analyze-glyph">&#x25B3;</span> Literary Craft
          </h4>
          <div className="analyze-devices">
            {literaryDevices.map((device) => (
              <div key={device.id} className="analyze-device">
                <div className="analyze-device-header">
                  <span className="analyze-device-name">{device.name}</span>
                  <span className="analyze-device-count">{device.count}&times;</span>
                </div>
                {device.definition && (
                  <p className="analyze-device-def">{device.definition}</p>
                )}
                {device.examples?.length > 0 && (
                  <div className="analyze-device-examples">
                    {device.examples.slice(0, 2).map((ex, i) => (
                      <span key={i} className="analyze-device-example">&ldquo;{ex}&rdquo;</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rhyme Groups */}
      {groupEntries.length > 0 && (
        <section className="analyze-section">
          <div className="analyze-section-toggle-row">
            <button
              type="button"
              className="analyze-section-toggle"
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              aria-expanded={groupsExpanded}
            >
              <h4 className="analyze-section-title">
                <span className="analyze-glyph">&#x25CE;</span> Rhyme Groups
              </h4>
              <span className="analyze-toggle-icon">{groupsExpanded ? "−" : "+"}</span>
              {!groupsExpanded && (
                <span className="analyze-badge">{groupEntries.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`infobeam-toggle${infoBeamEnabled ? " active" : ""}`}
              onClick={(e) => { e.stopPropagation(); onInfoBeamToggle?.(); }}
              title="InfoBeam — click a group to view rhyme order"
              aria-pressed={infoBeamEnabled}
            >
              ◈
            </button>
          </div>
          <AnimatePresence>
            {groupsExpanded && (
              <motion.div
                className="analyze-groups"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                {groupEntries.map(([label, lineIndices]) => {
                  const color = patternColor(label);
                  const isBeamActive = activeInfoBeamFamily === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`analyze-group-btn${infoBeamEnabled ? " analyze-group-btn--beam" : ""}`}
                      style={{ "--chip-color": color }}
                      data-beam-active={isBeamActive ? "true" : undefined}
                      onMouseEnter={() => onGroupHover?.(label)}
                      onMouseLeave={onGroupLeave}
                      onFocus={() => onGroupHover?.(label)}
                      onBlur={onGroupLeave}
                      onClick={infoBeamEnabled ? () => onGroupClick?.(label) : undefined}
                    >
                      <span className="analyze-group-label">{label}</span>
                      <span className="analyze-group-lines">
                        {lineIndices.length === 1
                          ? `Line ${lineIndices[0] + 1}`
                          : `Lines ${lineIndices.map((l) => l + 1).join(", ")}`}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="analyze-empty">
          <span className="analyze-empty-glyph">&#x2736;</span>
          <p>Write a scroll to reveal its structure.</p>
        </div>
      )}
    </div>
  );
}

AnalyzePanel.propTypes = {
  scheme: PropTypes.shape({
    name: PropTypes.string,
    pattern: PropTypes.string,
    lore: PropTypes.string,
    confidence: PropTypes.number,
    groups: PropTypes.instanceOf(Map),
  }),
  meter: PropTypes.shape({
    footName: PropTypes.string,
    meterName: PropTypes.string,
    consistency: PropTypes.number,
    feetPerLine: PropTypes.number,
  }),
  statistics: PropTypes.shape({
    perfectCount: PropTypes.number,
    nearCount: PropTypes.number,
    slantCount: PropTypes.number,
    internalCount: PropTypes.number,
    multiSyllableCount: PropTypes.number,
    totalSyllables: PropTypes.number,
  }),
  literaryDevices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      definition: PropTypes.string,
      count: PropTypes.number,
      examples: PropTypes.arrayOf(PropTypes.string),
    })
  ),
  emotion: PropTypes.string,
  genreProfile: PropTypes.shape({
    genre: PropTypes.string,
    confidence: PropTypes.number,
  }),
  hhmSummary: PropTypes.object,
  scoreData: PropTypes.object,
  onGroupHover: PropTypes.func,
  onGroupLeave: PropTypes.func,
  infoBeamEnabled: PropTypes.bool,
  onInfoBeamToggle: PropTypes.func,
  onGroupClick: PropTypes.func,
  activeInfoBeamFamily: PropTypes.string,
};
