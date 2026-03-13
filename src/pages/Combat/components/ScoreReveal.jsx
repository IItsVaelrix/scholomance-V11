/**
 * ScoreReveal.jsx
 * Inline terminal score reveal — renders inside the combat terminal column.
 *
 * Two parts:
 *   1. Typewriter text lines — MUD-style aftermath narrative
 *   2. Score bars box — compact XP-style bar chart panel
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

import { useState, useEffect, useRef } from 'react';
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

/** Dot-leader between label and value, MUD style */
function formatTraceLine(label, value) {
  const maxLen = 32;
  const valStr = value > 0 ? `+${value}` : `${value}`;
  const dots = Math.max(2, maxLen - label.length - valStr.length);
  return `${label} ${'·'.repeat(dots)} ${valStr}`;
}

const TYPEWRITER_MS = 14;

/** Single typewriter line */
function TypewriterLine({ text, color, onDone, instant }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (instant) {
      setDisplayed(text);
      setDone(true);
      onDone?.();
      return;
    }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
        onDone?.();
      }
    }, TYPEWRITER_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);

  return (
    <div className="sr-typewriter-line" style={{ color }}>
      <span>{displayed}</span>
      {!done && <span className="sr-cursor" aria-hidden="true" />}
    </div>
  );
}

export function ScoreReveal({ scoreData, damage, spellText, opponentHP, onContinue, isVisible }) {
  const prefersReduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);
  // phase 0 = hidden, 1..N = typewriter lines, N+1 = bars visible, N+2 = total, N+3 = button
  const [barsRevealedCount, setBarsRevealedCount] = useState(0);
  const [totalVisible, setTotalVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const scrollRef = useRef(null);

  const traces = scoreData?.traces ?? scoreData?.explainTrace ?? [];

  // Build the typewriter lines
  const lines = [];
  lines.push({ text: '✦ VERSE AFTERMATH ✦', color: '#c9a227', type: 'header' });
  if (spellText) {
    const excerpt = spellText.length > 72 ? spellText.slice(0, 72) + '...' : spellText;
    lines.push({ text: `"${excerpt}"`, color: 'rgba(232, 223, 200, 0.55)', type: 'spell' });
  }
  lines.push({ text: '─'.repeat(34), color: 'rgba(107, 90, 42, 0.4)', type: 'divider' });
  for (const trace of traces) {
    const label = getLabel(trace.heuristic ?? '');
    const contrib = Math.round(trace.contribution ?? 0);
    lines.push({ text: formatTraceLine(label, contrib), color: getBarColor(contrib), type: 'trace' });
  }
  lines.push({ text: '─'.repeat(34), color: 'rgba(107, 90, 42, 0.4)', type: 'divider' });
  lines.push({ text: `◈ TOTAL DAMAGE: ${damage ?? 0} ◈`, color: '#c9a227', type: 'total' });
  if (opponentHP <= 0) {
    lines.push({ text: '✦ The opponent\'s resonance is shattered. ✦', color: 'rgba(201, 162, 39, 0.65)', type: 'victory' });
  }

  const totalLines = lines.length;

  // Reset on visibility change
  useEffect(() => {
    if (!isVisible) {
      setPhase(0);
      setBarsRevealedCount(0);
      setTotalVisible(false);
      setButtonVisible(false);
      return;
    }

    if (prefersReduced) {
      setPhase(totalLines);
      setBarsRevealedCount(traces.length);
      setTotalVisible(true);
      setButtonVisible(true);
      return;
    }

    // Start first line after a brief pause
    const t = setTimeout(() => setPhase(1), 200);
    return () => clearTimeout(t);
  }, [isVisible, totalLines, traces.length, prefersReduced]);

  // Auto-scroll as lines appear
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'end' });
  }, [phase, barsRevealedCount, prefersReduced]);

  // Advance to next typewriter line
  const handleLineDone = () => {
    setPhase(prev => {
      const next = prev + 1;
      if (next > totalLines) {
        // All typewriter lines done — start bar cascade
        startBarCascade();
        return prev; // don't increment past totalLines
      }
      return next;
    });
  };

  const startBarCascade = () => {
    if (prefersReduced) {
      setBarsRevealedCount(traces.length);
      setTotalVisible(true);
      setButtonVisible(true);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setBarsRevealedCount(i);
      if (i >= traces.length) {
        clearInterval(interval);
        setTimeout(() => {
          setTotalVisible(true);
          setTimeout(() => setButtonVisible(true), 300);
        }, 250);
      }
    }, 180);
  };

  if (!isVisible) return null;

  return (
    <div className="sr-inline-container" role="region" aria-label="Spell score breakdown">

      {/* Part 1: Typewriter text block */}
      <div className="sr-typewriter-block" aria-label="Verse aftermath narrative">
        {lines.map((line, i) => {
          if (i >= phase && !prefersReduced) return null;
          const isCurrentlyTyping = i === phase - 1 && !prefersReduced;
          return (
            <TypewriterLine
              key={`${i}-${line.text}`}
              text={line.text}
              color={line.color}
              instant={!isCurrentlyTyping}
              onDone={isCurrentlyTyping ? handleLineDone : undefined}
            />
          );
        })}
      </div>

      {/* Part 2: Score bars box */}
      <AnimatePresence>
        {(barsRevealedCount > 0 || prefersReduced) && (
          <motion.div
            className="sr-bars-box"
            initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            aria-label="Heuristic breakdown bars"
          >
            <div className="sr-bars-header" aria-hidden="true">
              <span className="sr-bars-title">RESONANCE ANALYSIS</span>
            </div>

            <div className="sr-bars-list">
              {traces.map((trace, i) => {
                const revealed = i < barsRevealedCount;
                if (!revealed && !prefersReduced) return null;
                const contrib = Math.round(trace.contribution ?? 0);
                const pct = Math.min(100, Math.max(0, contrib * 4.5));
                const color = getBarColor(contrib);
                const label = getLabel(trace.heuristic ?? '');

                return (
                  <motion.div
                    key={trace.heuristic ?? i}
                    className="sr-bar-row"
                    initial={prefersReduced ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-label={`${label}: ${contrib} damage contribution`}
                  >
                    <span className="sr-bar-label">{label}</span>
                    <div className="sr-bar-track">
                      <motion.div
                        className="sr-bar-fill"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={prefersReduced ? { duration: 0 } : { duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                      />
                    </div>
                    <span className="sr-bar-value" style={{ color }}>
                      {contrib > 0 ? `+${contrib}` : contrib}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Total damage */}
            <AnimatePresence>
              {totalVisible && (
                <motion.div
                  className="sr-total-row"
                  initial={prefersReduced ? {} : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'backOut' }}
                  aria-label={`Total damage: ${damage}`}
                >
                  <span className="sr-total-label">TOTAL DAMAGE</span>
                  <span className="sr-total-value">{damage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Continue button */}
            <AnimatePresence>
              {buttonVisible && (
                <motion.button
                  className="sr-continue-btn"
                  onClick={onContinue}
                  initial={prefersReduced ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  aria-label={opponentHP <= 0 ? 'Claim victory' : 'Continue to opponent turn'}
                >
                  {opponentHP <= 0 ? '✦ CLAIM VICTORY' : 'CONTINUE →'}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} aria-hidden="true" />
    </div>
  );
}
