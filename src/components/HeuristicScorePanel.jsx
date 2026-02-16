/**
 * HeuristicScorePanel
 * Floating panel showing real-time CODEx heuristic score breakdown and literary genre.
 */

import { motion, AnimatePresence } from 'framer-motion';
import './HeuristicScorePanel.css';

const HEURISTIC_LABELS = {
  phoneme_density: 'Phoneme Density',
  alliteration_density: 'Alliteration',
  rhyme_quality: 'Rhyme Quality',
  meter_regularity: 'Meter',
  literary_device_richness: 'Literary Devices',
  vocabulary_richness: 'Vocabulary',
  phonetic_hacking: 'Phonetic Hacking',
};

function HeuristicBar({ trace, index }) {
  const percentage = Math.round(trace.rawScore * 100);
  const label = HEURISTIC_LABELS[trace.heuristic] || trace.heuristic;

  return (
    <div className="heuristic-item">
      <div className="heuristic-item-header">
        <span className="heuristic-name">{label}</span>
        <span className="heuristic-score">{trace.contribution.toFixed(0)}</span>
      </div>
      <div className="heuristic-bar">
        <motion.div
          className="heuristic-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
        />
      </div>
      <p className="heuristic-explanation">{trace.explanation}</p>
    </div>
  );
}

export default function HeuristicScorePanel({ scoreData, genreProfile, visible, isEmbedded = false, onClose = null }) {
  if (!visible || !scoreData) return null;

  const content = (
    <>
      {!isEmbedded && (
        <div className="score-header">
          <span className="score-label">CODEx Score</span>
          <motion.span
            className="score-value"
            key={scoreData.totalScore}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {scoreData.totalScore}
          </motion.span>
          {onClose && (
            <button type="button" className="panel-close-btn" onClick={onClose}>
              &#x2715;
            </button>
          )}
        </div>
      )}

      {isEmbedded && (
        <div className="score-embedded-summary">
          Total Score: <span className="score-value-small">{scoreData.totalScore}</span>
        </div>
      )}

      {genreProfile && (
        <div className="genre-profile-section">
          <div className="genre-label">Detected Genre</div>
          <div className="genre-value">
            {genreProfile.genre} 
            <span className="genre-confidence">{(genreProfile.confidence * 100).toFixed(0)}% confidence</span>
          </div>
        </div>
      )}

      <div className="heuristic-breakdown">
        {scoreData.traces.map((trace, i) => (
          <HeuristicBar key={trace.heuristic} trace={trace} index={i} />
        ))}
      </div>

      <div className="score-footer">
        <span className="score-footer-label">
          {scoreData.traces.length} heuristics &middot; weight total 1.00
        </span>
      </div>
    </>
  );

  if (isEmbedded) {
    return (
      <aside className="heuristic-score-panel embedded">
        {content}
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {visible && scoreData && (
        <motion.aside
          className="heuristic-score-panel"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          aria-label="CODEx Score Panel"
        >
          {content}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
