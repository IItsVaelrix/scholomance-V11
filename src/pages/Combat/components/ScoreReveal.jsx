/**
 * ScoreReveal.jsx
 * Post-cast breakdown panel — reveals each heuristic contribution one by one.
 *
 * "The aftermath of battle rendered as light and shadow." — CLAUDE.md
 *
 * Props:
 *   scoreData    — from useScoring (ScoreTrace[])
 *   damage       — final damage dealt
 *   spellText    — the player's scroll text
 *   opponentHP   — opponent HP after this hit (to show victory check)
 *   onContinue() — dismiss and continue to opponent turn
 *   isVisible    — controls AnimatePresence
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.js';

const HEURISTIC_LABELS = {
  phoneme_density:          'Phoneme Density',
  alliteration_density:     'Alliteration',
  alliterationDensity:      'Alliteration',
  rhyme_quality:            'Rhyme Quality',
  rhymeQuality:             'Rhyme Quality',
  scroll_power:             'Scroll Power',
  scrollPower:              'Scroll Power',
  meter_regularity:         'Meter',
  meterRegularity:          'Meter',
  literary_device_richness: 'Literary Devices',
  literaryDeviceRichness:   'Literary Devices',
  vocabulary_richness:      'Vocabulary',
  vocabularyRichness:       'Vocabulary',
  phonetic_hacking:         'Phonetic Hacking',
  phoneticHacking:          'Phonetic Hacking',
  emotional_resonance:      'Emotional Resonance',
  emotionalResonance:       'Emotional Resonance',
};

function getLabel(heuristic) {
  return HEURISTIC_LABELS[heuristic] ?? heuristic.replace(/_/g, ' ');
}

function getBarColor(contribution) {
  if (contribution >= 15) return '#c9a227';   // gold — excellent
  if (contribution >= 9)  return '#22aa44';   // green — good
  if (contribution >= 4)  return '#4488ff';   // blue — moderate
  return '#5a4a2a';                            // dim — low
}

function TraceRow({ trace, index, revealed }) {
  const prefersReduced = usePrefersReducedMotion();
  const contrib = Math.round(trace.contribution ?? 0);
  const pct = Math.min(100, Math.max(0, contrib * 4.5)); // scale to bar width
  const color = getBarColor(contrib);
  const label = getLabel(trace.heuristic ?? '');

  return (
    <AnimatePresence>
      {revealed && (
        <motion.div
          className="score-trace-row"
          initial={prefersReduced ? {} : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0 }}
          aria-label={`${label}: ${contrib} damage contribution`}
        >
          <span className="trace-row-label">{label}</span>
          <div className="trace-row-bar-track" role="presentation">
            <motion.div
              className="trace-row-bar-fill"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
          <span className="trace-row-value" style={{ color }}>
            {contrib > 0 ? `+${contrib}` : `${contrib}`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ScoreReveal({ scoreData, damage, spellText, opponentHP, onContinue, isVisible }) {
  const prefersReduced = usePrefersReducedMotion();
  const [revealedCount, setRevealedCount] = useState(0);
  const [totalVisible, setTotalVisible] = useState(false);

  const traces = scoreData?.traces ?? scoreData?.explainTrace ?? [];

  // Cascade reveal: one row every 220ms
  useEffect(() => {
    if (!isVisible || !traces.length) return;
    setRevealedCount(0);
    setTotalVisible(false);

    if (prefersReduced) {
      setRevealedCount(traces.length);
      setTotalVisible(true);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRevealedCount(i);
      if (i >= traces.length) {
        clearInterval(interval);
        setTimeout(() => setTotalVisible(true), 300);
      }
    }, 220);

    return () => clearInterval(interval);
  }, [isVisible, traces.length, prefersReduced]);

  const motionProps = prefersReduced
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            className="score-reveal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          />

          <motion.div
            className="score-reveal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Spell score breakdown"
            {...motionProps}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="score-reveal-header">
              <span className="score-reveal-glyph" aria-hidden="true">⚔</span>
              <h2 className="score-reveal-title">VERSE AFTERMATH</h2>
              <span className="score-reveal-glyph" aria-hidden="true">⚔</span>
            </div>

            {/* Spell text excerpt */}
            {spellText && (
              <p className="score-reveal-spell-text">
                "{spellText.slice(0, 80)}{spellText.length > 80 ? '…' : ''}"
              </p>
            )}

            {/* Heuristic trace rows */}
            <div className="score-reveal-traces" aria-label="Heuristic breakdown">
              {traces.map((trace, i) => (
                <TraceRow
                  key={trace.heuristic ?? i}
                  trace={trace}
                  index={i}
                  revealed={i < revealedCount}
                />
              ))}
            </div>

            <div className="score-reveal-divider" aria-hidden="true" />

            {/* Total damage */}
            <AnimatePresence>
              {totalVisible && (
                <motion.div
                  className="score-reveal-total"
                  initial={prefersReduced ? {} : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'backOut' }}
                  aria-label={`Total damage: ${damage}`}
                >
                  <span className="score-reveal-total-label">TOTAL DAMAGE</span>
                  <span className="score-reveal-total-value">{damage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Opponent HP status */}
            {totalVisible && opponentHP <= 0 && (
              <motion.p
                className="score-reveal-victory-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                aria-live="assertive"
              >
                ✦ The opponent's resonance is shattered. ✦
              </motion.p>
            )}

            {/* Continue button */}
            <AnimatePresence>
              {totalVisible && (
                <motion.button
                  className="score-reveal-continue"
                  onClick={onContinue}
                  initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  aria-label={opponentHP <= 0 ? 'Claim victory' : 'Continue to opponent turn'}
                >
                  {opponentHP <= 0 ? 'CLAIM VICTORY' : 'CONTINUE →'}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
