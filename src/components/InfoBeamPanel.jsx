import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import "./InfoBeamPanel.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const entryVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

function highlightWordInLine(line, word) {
  const lower = line.toLowerCase();
  const pos = lower.indexOf(word.toLowerCase());
  if (pos < 0) {
    return { before: line, match: "", after: "" };
  }
  return {
    before: line.slice(0, pos),
    match: line.slice(pos, pos + word.length),
    after: line.slice(pos + word.length),
  };
}

export default function InfoBeamPanel({
  groupLabel,
  groupColor,
  connections,
  scrollLines,
}) {
  const entries = useMemo(() => {
    const seen = new Set();
    const words = [];
    for (const conn of connections) {
      for (const side of [conn.wordA, conn.wordB]) {
        if (!side) continue;
        const key = side.charStart;
        if (seen.has(key)) continue;
        seen.add(key);
        words.push({
          word: side.word,
          lineIndex: side.lineIndex,
          charStart: side.charStart,
        });
      }
    }
    return words.sort((a, b) => a.charStart - b.charStart);
  }, [connections]);

  if (entries.length === 0) {
    return (
      <div className="infobeam-empty">
        No rhyme data for group {groupLabel}
      </div>
    );
  }

  return (
    <div className="infobeam-panel" style={{ "--beam-color": groupColor }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={groupLabel}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={containerVariants}
        >
          {entries.map((entry, i) => {
            const line = scrollLines[entry.lineIndex] ?? "";
            const { before, match, after } = highlightWordInLine(
              line,
              entry.word
            );
            return (
              <motion.div key={entry.charStart} variants={entryVariants}>
                <div className="infobeam-entry">
                  <span className="infobeam-line-chip">
                    L{entry.lineIndex + 1}
                  </span>
                  <div className="infobeam-body">
                    <span className="infobeam-word">{entry.word}</span>
                    <span className="infobeam-context" title={line}>
                      {before}
                      <strong>{match || entry.word}</strong>
                      {after}
                    </span>
                  </div>
                </div>
                {i < entries.length - 1 && (
                  <div className="infobeam-spacer" />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

InfoBeamPanel.propTypes = {
  groupLabel: PropTypes.string.isRequired,
  groupColor: PropTypes.string.isRequired,
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      groupLabel: PropTypes.string,
      wordA: PropTypes.shape({
        word: PropTypes.string,
        lineIndex: PropTypes.number,
        charStart: PropTypes.number,
      }),
      wordB: PropTypes.shape({
        word: PropTypes.string,
        lineIndex: PropTypes.number,
        charStart: PropTypes.number,
      }),
    })
  ).isRequired,
  scrollLines: PropTypes.arrayOf(PropTypes.string).isRequired,
};
