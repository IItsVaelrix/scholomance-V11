import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from 'prop-types';
import { RHYME_TYPES } from "../data/rhymeScheme.patterns.js";
import { useTheme } from "../hooks/useTheme.jsx";

/**
 * SVG overlay that renders bezier curves connecting rhyming words.
 */
export default function RhymeConnectionOverlay({
  connections = [],
  wordPositions = new Map(),
  containerRef = null,
  visible = true,
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const paths = useMemo(() => {
    if (!connections.length || !wordPositions || wordPositions.size === 0) {
      return [];
    }

    return connections
      .map((conn, i) => {
        const posA = wordPositions.get(conn.wordA.charStart);
        const posB = wordPositions.get(conn.wordB.charStart);

        if (!posA || !posB) return null;

        // Calculate control point offset based on distance
        const verticalDistance = Math.abs(posB.top - posA.top);
        const controlOffset = Math.max(30, verticalDistance * 0.3 + 20);

        // Create bezier curve path
        // For words on different lines, curve to the right
        // For words on the same line, curve above
        const sameLine = conn.wordA.lineIndex === conn.wordB.lineIndex;

        let d;
        if (sameLine) {
          // Curve above for internal rhymes
          const midX = (posA.centerX + posB.centerX) / 2;
          const peakY = Math.min(posA.top, posB.top) - 30;
          d = `M ${posA.centerX} ${posA.top}
               Q ${midX} ${peakY}, ${posB.centerX} ${posB.top}`;
        } else {
          // Curve to the right for end rhymes
          d = `M ${posA.right + 5} ${posA.centerY}
               C ${posA.right + controlOffset} ${posA.centerY},
                 ${posB.right + controlOffset} ${posB.centerY},
                 ${posB.right + 5} ${posB.centerY}`;
        }

        // Get color based on rhyme type
        const rhymeType = RHYME_TYPES[conn.type.toUpperCase()];
        const color = isLight
          ? (rhymeType?.lightColor || rhymeType?.color || '#7c3aed')
          : (rhymeType?.color || '#a78bfa');

        return {
          id: `conn-${i}`,
          d,
          color,
          type: conn.type,
          subtype: conn.subtype,
          syllables: conn.syllablesMatched,
          sameLine,
        };
      })
      .filter(Boolean);
  }, [connections, wordPositions, isLight]);

  if (!visible) return null;

  return (
    <svg
      className="rhyme-connection-svg"
      data-testid="rhyme-connection-svg"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 5,
      }}
    >
      <defs>
        {/* Gradient definitions for each rhyme type */}
        {Object.entries(RHYME_TYPES).map(([type, { color, lightColor }]) => {
          const c = isLight ? (lightColor || color) : color;
          return (
            <linearGradient
              key={type}
              id={`rhyme-grad-${type.toLowerCase()}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={c} stopOpacity="0.2" />
              <stop offset="50%" stopColor={c} stopOpacity="0.7" />
              <stop offset="100%" stopColor={c} stopOpacity="0.2" />
            </linearGradient>
          );
        })}

        {/* Glow filter */}
        <filter id="rhyme-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <AnimatePresence>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            data-testid={`connection-path-${path.id}`}
            d={path.d}
            stroke={`url(#rhyme-grad-${path.type})`}
            strokeWidth={1.5 + path.syllables * 0.5}
            fill="none"
            filter="url(#rhyme-glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}

RhymeConnectionOverlay.propTypes = {
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      subtype: PropTypes.string,
      syllablesMatched: PropTypes.number,
      wordA: PropTypes.shape({
        lineIndex: PropTypes.number.isRequired,
        charStart: PropTypes.number.isRequired,
      }).isRequired,
      wordB: PropTypes.shape({
        lineIndex: PropTypes.number.isRequired,
        charStart: PropTypes.number.isRequired,
      }).isRequired,
    })
  ),
  wordPositions: PropTypes.instanceOf(Map),
  containerRef: PropTypes.object,
  visible: PropTypes.bool,
};
