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
  scroll_power: 'Scroll Power',
  meter_regularity: 'Meter',
  literary_device_richness: 'Literary Devices',
  vocabulary_richness: 'Vocabulary',
  phonetic_hacking: 'Phonetic Hacking',
  emotional_resonance: 'Emotional Resonance',
};

function getScoreBand(score) {
  const numeric = Number(score) || 0;
  if (numeric >= 90) return 'Distinction';
  if (numeric >= 75) return 'High Merit';
  if (numeric >= 60) return 'Merit';
  if (numeric >= 45) return 'Pass';
  return 'Provisional';
}

function formatMetric(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(digits);
}

function HeuristicBar({ trace, index }) {
  const percentage = Math.round((Number(trace.rawScore) || 0) * 100);
  const label = HEURISTIC_LABELS[trace.heuristic] || trace.heuristic;
  const rank = String(index + 1).padStart(2, '0');
  const contribution = Number(trace.contribution) || 0;
  const weight = Number(trace.weight) || 0;
  const diagnostics = Array.isArray(trace.diagnostics) ? trace.diagnostics : [];
  const topDiagnostic = diagnostics.length > 0 ? diagnostics[0] : null;

  return (
    <div className="heuristic-item">
      <div className="heuristic-item-header">
        <span className="heuristic-name">
          <span className="heuristic-rank">{rank}</span>
          <span>{label}</span>
        </span>
        <span className="heuristic-score-pack">
          <span className="heuristic-score">{contribution.toFixed(0)}</span>
          <span className="heuristic-percent">{percentage}%</span>
        </span>
      </div>

      <div className="heuristic-bar" aria-hidden="true">
        <motion.div
          className="heuristic-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
        />
      </div>

      <div className="heuristic-metrics" role="group" aria-label={`${label} metrics`}>
        <span className="heuristic-metric">Raw {percentage}%</span>
        <span className="heuristic-metric">Weight {formatMetric(weight, 2)}</span>
        <span className="heuristic-metric">Contribution {formatMetric(contribution, 1)}</span>
      </div>

      <p className="heuristic-explanation">{trace.commentary || trace.explanation}</p>

      {topDiagnostic?.message && (
        <p className="heuristic-diagnostic">
          Note: {topDiagnostic.message}
        </p>
      )}
    </div>
  );
}

export default function HeuristicScorePanel({ scoreData, genreProfile, visible, isEmbedded = false, onClose = null }) {
  if (!visible || !scoreData) return null;
  const totalWeight = scoreData.traces.reduce((sum, trace) => sum + (Number(trace.weight) || 0), 0);
  const scoreBand = getScoreBand(scoreData.totalScore);

  const content = (
    <>
      {!isEmbedded && (
        <div className="score-header">
          <div className="score-header-meta">
            <span className="score-label">CODEx Metrics</span>
            <span className="score-subtitle">Scholastic Heuristic Ledger</span>
          </div>
          <div className="score-seal" aria-label={`Total score ${scoreData.totalScore}`}>
            <motion.span
              className="score-value"
              key={scoreData.totalScore}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {scoreData.totalScore}
            </motion.span>
            <span className="score-band">{scoreBand}</span>
          </div>
          {onClose && (
            <button type="button" className="panel-close-btn" onClick={onClose}>
              &#x2715;
            </button>
          )}
        </div>
      )}

      {isEmbedded && (
        <div className="score-embedded-summary">
          <span className="score-embedded-kicker">Academic Index</span>
          <span className="score-value-small">{scoreData.totalScore}</span>
          <span className="score-embedded-band">{scoreBand}</span>
        </div>
      )}

      {genreProfile && (
        <div className="genre-profile-section">
          <div className="genre-label">Detected Genre</div>
          <div className="genre-value">
            <span>{genreProfile.genre}</span>
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
          {scoreData.traces.length} heuristics &middot; weight total {totalWeight.toFixed(2)} &middot; band {scoreBand}
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

