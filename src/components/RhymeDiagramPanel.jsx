import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from 'prop-types';
import { RHYME_TYPES } from "../data/rhymeScheme.patterns.js";
import { useTheme } from "../hooks/useTheme.jsx";

/**
 * Scrollable rhyme connection list panel.
 * Groups rhyme connections by type (Perfect, Near, Slant, etc.)
 * and displays them as interactive buttons — mirrors the Scheme panel's group list.
 */
export default function RhymeDiagramPanel({
  connections,
  lineCount,
  visible,
  onConnectionHover,
  onConnectionLeave,
  highlightedLines,
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Group connections by rhyme type
  const groupedConnections = useMemo(() => {
    const groups = {};

    // Initialize groups in order
    Object.entries(RHYME_TYPES).forEach(([key, { id, name, color, lightColor }]) => {
      groups[id] = { key, name, color: isLight ? (lightColor || color) : color, connections: [] };
    });

    connections.forEach((conn) => {
      const type = conn.type.toLowerCase();
      if (groups[type]) {
        groups[type].connections.push(conn);
      }
    });

    // Return only groups with connections
    return Object.values(groups).filter((g) => g.connections.length > 0);
  }, [connections, isLight]);

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
        <span className="diagram-count">{connections.length}</span>
      </div>

      <div className="rhyme-connections-list">
        {groupedConnections.map((group) => (
          <div key={group.key} className="rhyme-type-group">
            <div className="rhyme-type-header">
              <span
                className="rhyme-type-dot"
                style={{ background: group.color, boxShadow: `0 0 6px ${group.color}` }}
              />
              <span className="rhyme-type-name">{group.name}</span>
              <span className="rhyme-type-count">{group.connections.length}</span>
            </div>

            <div className="rhyme-type-items">
              {group.connections.map((conn, i) => {
                const lineA = conn.wordA.lineIndex;
                const lineB = conn.wordB.lineIndex;
                const lines = [lineA, lineB];
                const isHighlighted =
                  highlightedLines?.includes(lineA) || highlightedLines?.includes(lineB);

                return (
                  <button
                    key={`${conn.wordA.word}-${conn.wordB.word}-${i}`}
                    type="button"
                    className={`rhyme-conn-btn ${isHighlighted ? 'rhyme-conn-btn--highlighted' : ''}`}
                    onMouseEnter={() => onConnectionHover?.(lines)}
                    onMouseLeave={onConnectionLeave}
                    onFocus={() => onConnectionHover?.(lines)}
                    onBlur={onConnectionLeave}
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
            </div>
          </div>
        ))}

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
  onConnectionHover: PropTypes.func,
  onConnectionLeave: PropTypes.func,
  highlightedLines: PropTypes.arrayOf(PropTypes.number),
};

RhymeDiagramPanel.defaultProps = {
  connections: [],
  lineCount: 0,
  visible: true,
  onConnectionHover: null,
  onConnectionLeave: null,
  highlightedLines: [],
};
