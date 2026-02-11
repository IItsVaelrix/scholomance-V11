import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";

/**
 * Side panel displaying detected rhyme scheme and statistics.
 */
export default function RhymeSchemePanel({
  scheme = null,
  meter = null,
  statistics = null,
  onGroupHover = null,
  onGroupLeave = null,
  visible = true,
  literaryDevices = [],
  emotion = "Neutral",
  isEmbedded = false,
}) {
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);
  const [showPatternMap, setShowPatternMap] = useState(false);

  if (!visible || !scheme) return null;

  const groupEntries = scheme.groups ? Array.from(scheme.groups.entries()) : [];

  const content = (
    <>
      {!isEmbedded && (
        <div className="scheme-header">
          <h3 className="scheme-name">{scheme.name}</h3>
          <button
            type="button"
            className="scheme-pattern-badge"
            onClick={() => setShowPatternMap(!showPatternMap)}
            title="Click to view pattern map"
          >
            {scheme.pattern ? (scheme.pattern.length > 8 ? "Complex Pattern" : scheme.pattern) : "-"}
          </button>
          {scheme.confidence < 1 && (
            <div className="scheme-confidence">
              <div
                className="confidence-bar"
                style={{ width: `${scheme.confidence * 100}%` }}
                title={`${Math.round(scheme.confidence * 100)}% confidence`}
              />
            </div>
          )}
        </div>
      )}

      {isEmbedded && (
        <div className="scheme-embedded-header">
           <button
            type="button"
            className="scheme-pattern-badge"
            onClick={() => setShowPatternMap(!showPatternMap)}
          >
            Pattern: {scheme.pattern || "-"}
          </button>
        </div>
      )}

      {/* Pattern Breakdown Card */}
      <AnimatePresence>
        {showPatternMap && scheme.pattern && (
          <motion.div
            className="pattern-breakdown-card"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="pattern-breakdown-header">
              <span>Pattern Map</span>
              <button type="button" onClick={() => setShowPatternMap(false)}>
                x
              </button>
            </div>
            <div className="pattern-breakdown-list">
              {scheme.pattern.split("").map((char, i) => (
                <div key={i} className="pattern-map-row">
                  <span className="line-num">Line {i + 1}</span>
                  <span className="family-chip">{char}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheme Lore */}
      {scheme.lore && (
        <div className="scheme-lore">
          <p>{scheme.lore}</p>
        </div>
      )}

      {/* Meter Detection */}
      {meter && meter.meterName !== "Free Verse" && (
        <div className="meter-section">
          <h4 className="section-title">Meter</h4>
          <div className="meter-name">{meter.meterName}</div>
          <div className="meter-details">
            <span className="meter-foot">{meter.footName}</span>
            <span className="meter-consistency">{Math.round(meter.consistency * 100)}% consistent</span>
          </div>
        </div>
      )}

      {/* Rhyme Groups */}
      {groupEntries.length > 0 && (
        <div className="scheme-groups">
          <button
            type="button"
            className="section-toggle-btn"
            onClick={() => setIsGroupsExpanded(!isGroupsExpanded)}
          >
            <h4 className="section-title">Rhyme Groups</h4>
            <span className="section-toggle-icon">{isGroupsExpanded ? "-" : "+"}</span>
            {!isGroupsExpanded && <span className="section-badge">{groupEntries.length}</span>}
          </button>

          <AnimatePresence>
            {isGroupsExpanded && (
              <motion.div
                className="groups-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                {groupEntries.map(([label, lineIndices]) => (
                  <button
                    key={label}
                    type="button"
                    className="rhyme-group-btn"
                    onMouseEnter={() => onGroupHover?.(label)}
                    onMouseLeave={onGroupLeave}
                    onFocus={() => onGroupHover?.(label)}
                    onBlur={onGroupLeave}
                  >
                    <span className="group-label">{label}</span>
                    <span className="group-lines">
                      {lineIndices.length === 1
                        ? `Line ${lineIndices[0] + 1}`
                        : `Lines ${lineIndices.map((l) => l + 1).join(", ")}`}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="scheme-stats">
          <h4 className="section-title">Analysis</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{statistics.perfectCount}</span>
              <span className="stat-label">Perfect</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.nearCount}</span>
              <span className="stat-label">Near</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.slantCount}</span>
              <span className="stat-label">Slant</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.internalCount}</span>
              <span className="stat-label">Internal</span>
            </div>
            <div className="stat-item stat-item--wide">
              <span className="stat-value">{statistics.multiSyllableCount}</span>
              <span className="stat-label">Multi-syllable</span>
            </div>
            <div className="stat-item stat-item--wide">
              <span className="stat-value">{statistics.totalSyllables}</span>
              <span className="stat-label">Total Syllables</span>
            </div>
          </div>
        </div>
      )}

      {/* Heuristic Layer - Emotion and Literary Devices */}
      {(emotion !== "Neutral" || literaryDevices.length > 0) && (
        <div className="heuristic-section">
          <h4 className="section-title">Heuristics</h4>

          {/* Emotion Detection */}
          {emotion !== "Neutral" && (
            <div className="emotion-display">
              <span className="emotion-label">Dominant Tone</span>
              <span className="emotion-value">{emotion}</span>
            </div>
          )}

          {/* Literary Devices */}
          {literaryDevices.length > 0 && (
            <div className="literary-devices">
              {literaryDevices.map((device) => (
                <div key={device.id} className="device-item">
                  <div className="device-header">
                    <span className="device-name">{device.name}</span>
                    <span className="device-count">{device.count}x</span>
                  </div>
                  <p className="device-definition">{device.definition}</p>
                  {device.examples.length > 0 && (
                    <div className="device-examples">
                      {device.examples.map((ex, i) => (
                        <span key={i} className="device-example">
                          {ex}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isEmbedded) {
    return (
      <aside className="rhyme-scheme-panel embedded">
        {content}
      </aside>
    );
  }

  return (
    <motion.aside
      className="rhyme-scheme-panel"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {content}
    </motion.aside>
  );
}

RhymeSchemePanel.propTypes = {
  scheme: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    pattern: PropTypes.string,
    description: PropTypes.string,
    lore: PropTypes.string,
    confidence: PropTypes.number,
    groups: PropTypes.instanceOf(Map),
  }),
  meter: PropTypes.shape({
    footType: PropTypes.string,
    footName: PropTypes.string,
    feetPerLine: PropTypes.number,
    meterName: PropTypes.string,
    consistency: PropTypes.number,
  }),
  statistics: PropTypes.shape({
    totalLines: PropTypes.number,
    totalWords: PropTypes.number,
    totalSyllables: PropTypes.number,
    perfectCount: PropTypes.number,
    nearCount: PropTypes.number,
    slantCount: PropTypes.number,
    internalCount: PropTypes.number,
    multiSyllableCount: PropTypes.number,
    endRhymeCount: PropTypes.number,
  }),
  onGroupHover: PropTypes.func,
  onGroupLeave: PropTypes.func,
  visible: PropTypes.bool,
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
};
