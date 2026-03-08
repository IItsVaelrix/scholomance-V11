import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import { RHYME_TYPES } from "../data/rhymeScheme.patterns.js";
import { useTheme } from "../hooks/useTheme.jsx";

const MAX_REPEATS_PER_RHYME_PAIR = 2;

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function getRhymeRepeatKey(connection) {
  const type = String(connection?.type || "").toLowerCase();
  const subtype = String(connection?.subtype || "").toLowerCase();
  const wordA = normalizeWord(connection?.wordA?.word);
  const wordB = normalizeWord(connection?.wordB?.word);
  const [left, right] = wordA <= wordB ? [wordA, wordB] : [wordB, wordA];
  return `${type}:${subtype}:${left}:${right}`;
}

function capRhymeRepeats(connections, maxRepeats = MAX_REPEATS_PER_RHYME_PAIR) {
  if (!Array.isArray(connections) || connections.length === 0) return [];

  const seenCounts = new Map();
  const filtered = [];

  for (const conn of connections) {
    const key = getRhymeRepeatKey(conn);
    const count = seenCounts.get(key) || 0;
    if (count >= maxRepeats) continue;

    seenCounts.set(key, count + 1);
    filtered.push(conn);
  }

  return filtered;
}

/**
 * Scrollable rhyme connection list panel.
 * Groups rhyme connections by type (Perfect, Near, Slant, etc.).
 * Repeated pair entries are capped to 2 occurrences per type/subtype.
 */
export default function RhymeDiagramPanel({
  connections,
  lineCount: _lineCount,
  visible,
  onConnectionClick,
  onPairSelect,
  highlightedLines,
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedPairKey, setSelectedPairKey] = useState(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState(null);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredConnections = useMemo(() => {
    return capRhymeRepeats(connections, MAX_REPEATS_PER_RHYME_PAIR);
  }, [connections]);

  const groupedConnections = useMemo(() => {
    const groups = {};

    Object.entries(RHYME_TYPES).forEach(([key, { id, name, color, lightColor }]) => {
      groups[id] = {
        id,
        key,
        name,
        color: isLight ? (lightColor || color) : color,
        connections: [],
      };
    });

    filteredConnections.forEach((conn) => {
      const type = String(conn?.type || "").toLowerCase();
      if (groups[type]) {
        groups[type].connections.push(conn);
      }
    });

    return Object.values(groups).filter((group) => group.connections.length > 0);
  }, [filteredConnections, isLight]);

  if (!visible) return null;

  return (
    <motion.div
      className="rhyme-diagram-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="diagram-header">
        <h4 className="diagram-title">Rhyme Power</h4>
        <span className="diagram-count">{filteredConnections.length}</span>
      </div>

      {!selectedPairKey && groupedConnections.length > 0 && (
        <div className="rhyme-type-toolbar">
          {groupedConnections.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`rhyme-type-pill${activeTypeFilter === group.id ? " rhyme-type-pill--active" : ""}`}
              style={{ "--pill-color": group.color }}
              onClick={() => setActiveTypeFilter((prev) => (prev === group.id ? null : group.id))}
              title={`${group.name} (${group.connections.length})`}
            >
              <span className="rhyme-type-pill-dot" />
              <span className="rhyme-type-pill-name">{group.name}</span>
              <span className="rhyme-type-pill-count">{group.connections.length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rhyme-connections-list">
        {selectedPairKey ? (
          // Isolated view — only the selected pair
          (() => {
            const allConns = groupedConnections.flatMap((g) => g.connections.map((c) => ({ ...c, groupColor: g.color, groupName: g.name })));
            const focused = allConns.find((c) => {
              const lineA = c.wordA.lineIndex;
              const lineB = c.wordB.lineIndex;
              return `${c.type}:${normalizeWord(c.wordA.word)}:${normalizeWord(c.wordB.word)}:${lineA}:${lineB}` === selectedPairKey;
            });
            if (!focused) return null;
            const lineA = focused.wordA.lineIndex;
            const lineB = focused.wordB.lineIndex;
            const lines = [lineA, lineB];
            return (
              <motion.div
                className="rhyme-focused-pair"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="rhyme-focused-header">
                  <span
                    className="rhyme-type-dot"
                    style={{ background: focused.groupColor, boxShadow: `0 0 6px ${focused.groupColor}` }}
                  />
                  <span className="rhyme-focused-type">{focused.groupName}</span>
                  <button
                    type="button"
                    className="rhyme-focused-clear"
                    onClick={() => { setSelectedPairKey(null); onPairSelect?.(null); }}
                    title="Show all"
                  >
                    ✕
                  </button>
                </div>
                <button
                  type="button"
                  className="rhyme-conn-btn rhyme-conn-btn--highlighted"
                  onClick={() => {
                    setSelectedPairKey(null);
                    onPairSelect?.(null);
                    onConnectionClick?.(lines);
                  }}
                >
                  <span className="rhyme-conn-words">
                    <span className="rhyme-conn-word">{focused.wordA.word}</span>
                    <span className="rhyme-conn-arrow">&harr;</span>
                    <span className="rhyme-conn-word">{focused.wordB.word}</span>
                  </span>
                  <span className="rhyme-conn-lines">
                    L{lineA + 1}&ndash;{lineB + 1}
                  </span>
                </button>
              </motion.div>
            );
          })()
        ) : (
          groupedConnections
          .filter((group) => !activeTypeFilter || group.id === activeTypeFilter)
          .map((group) => {
            const isExpanded = Boolean(expandedGroups[group.id]);

            return (
              <div key={group.key} className="rhyme-type-group">
                <button
                  type="button"
                  className="rhyme-type-header-btn"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="rhyme-type-header">
                    <span
                      className="rhyme-type-dot"
                      style={{ background: group.color, boxShadow: `0 0 6px ${group.color}` }}
                    />
                    <span className="rhyme-type-name">{group.name}</span>
                    <span className="rhyme-type-count">{group.connections.length}</span>
                    <span className="group-toggle-icon">{isExpanded ? "\u2212" : "+"}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className="rhyme-type-items"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      {group.connections.map((conn, index) => {
                        const lineA = conn.wordA.lineIndex;
                        const lineB = conn.wordB.lineIndex;
                        const lines = [lineA, lineB];
                        const isHighlighted =
                          highlightedLines?.includes(lineA) || highlightedLines?.includes(lineB);
                        const pairKey = `${conn.type}:${normalizeWord(conn.wordA.word)}:${normalizeWord(conn.wordB.word)}:${lineA}:${lineB}`;

                        return (
                          <button
                            key={`${conn.wordA.word}-${conn.wordB.word}-${lineA}-${lineB}-${index}`}
                            type="button"
                            className={`rhyme-conn-btn ${isHighlighted ? "rhyme-conn-btn--highlighted" : ""}`}
                            onClick={() => {
                              setSelectedPairKey(pairKey);
                              onPairSelect?.(lines);
                              onConnectionClick?.(lines);
                            }}
                          >
                            <span className="rhyme-conn-words">
                              <span className="rhyme-conn-word">{conn.wordA.word}</span>
                              <span className="rhyme-conn-arrow">&harr;</span>
                              <span className="rhyme-conn-word">{conn.wordB.word}</span>
                            </span>
                            <span className="rhyme-conn-lines">
                              L{lineA + 1}&ndash;{lineB + 1}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}

        {groupedConnections.length === 0 && (
          <div className="rhyme-empty">
            <p>No rhyme connections detected yet.</p>
            <span>Enable Truesight and write some verse.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

RhymeDiagramPanel.propTypes = {
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      subtype: PropTypes.string,
      syllablesMatched: PropTypes.number,
      wordA: PropTypes.shape({
        lineIndex: PropTypes.number.isRequired,
        word: PropTypes.string,
      }).isRequired,
      wordB: PropTypes.shape({
        lineIndex: PropTypes.number.isRequired,
        word: PropTypes.string,
      }).isRequired,
    })
  ),
  lineCount: PropTypes.number,
  visible: PropTypes.bool,
  onConnectionClick: PropTypes.func,
  onPairSelect: PropTypes.func,
  highlightedLines: PropTypes.arrayOf(PropTypes.number),
};

RhymeDiagramPanel.defaultProps = {
  connections: [],
  lineCount: 0,
  visible: true,
  onConnectionClick: null,
  onPairSelect: null,
  highlightedLines: [],
};
