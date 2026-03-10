/**
 * BattleLog.jsx
 * The Chronicle — primary MUD text surface.
 * Scrolling narrative of all combat events with typewriter reveal on new entries.
 *
 * Accessibility: role="log", aria-live="polite", aria-relevant="additions"
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.js';

const TYPE_STYLES = {
  system:   { color: '#6b5a2a', prefix: '—' },
  player:   { color: '#c9a227', prefix: '▶' },
  opponent: { color: '#00e5ff', prefix: '◀' },
};

const TYPEWRITER_SPEED_MS = 16; // ms per character

/**
 * Renders the latest battle log entry character by character.
 * All previous entries render instantly.
 */
function TypewriterText({ text, color }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, TYPEWRITER_SPEED_MS);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className="log-text" style={{ color }}>
      {displayed}
      {!done && <span className="log-cursor" aria-hidden="true" />}
    </span>
  );
}

export function BattleLog({ entries = [] }) {
  const bottomRef      = useRef(null);
  const prevLengthRef  = useRef(entries.length);
  const prefersReduced = usePrefersReducedMotion();
  const [latestId, setLatestId] = useState(null);

  // Track the newest entry for typewriter effect
  useEffect(() => {
    if (entries.length > prevLengthRef.current && entries.length > 0) {
      const newest = entries[entries.length - 1];
      if (!prefersReduced) {
        setLatestId(newest.id ?? null);
      }
    }
    prevLengthRef.current = entries.length;
    bottomRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [entries.length, prefersReduced]);

  return (
    <aside
      className="battle-log"
      aria-label="Battle chronicle"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="battle-log-header" aria-hidden="true">
        <span>◈ CHRONICLE</span>
        <span className="battle-log-entry-count">{entries.length} lines</span>
      </div>

      <div className="battle-log-entries" role="log">
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => {
            const style    = TYPE_STYLES[entry.type] ?? TYPE_STYLES.system;
            const isLatest = !prefersReduced && entry.id === latestId;

            return (
              <motion.div
                key={entry.id ?? i}
                className={`battle-log-entry battle-log-entry--${entry.type}`}
                initial={prefersReduced ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12 }}
              >
                <span
                  className="log-prefix"
                  aria-hidden="true"
                  style={{ color: style.color }}
                >
                  {style.prefix}
                </span>

                {isLatest ? (
                  <TypewriterText text={entry.text} color={style.color} />
                ) : (
                  <span className="log-text" style={{ color: style.color }}>
                    {entry.text}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </aside>
  );
}
