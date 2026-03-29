import { useState, useEffect, useMemo, useCallback } from 'react';
import { ScholomanceCorpusAPI } from '../../lib/scholomanceCorpus.api.js';
import { motion, AnimatePresence } from 'framer-motion';
import './ChroniclePanel.css';

/**
 * ChroniclePanel — Displays historical literary matches from the Super Corpus.
 */
export default function ChroniclePanel({ currentLineText = "" }) {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const trimmedLine = useMemo(() => currentLineText.trim(), [currentLineText]);

  const fetchMatches = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await ScholomanceCorpusAPI.search(query, 5);
      setMatches(results);
    } catch (err) {
      console.error('[ChroniclePanel] Search failed:', err);
      setError('Corpus connection unstable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (trimmedLine) {
        fetchMatches(trimmedLine);
      } else {
        setMatches([]);
      }
    }, 800); // Debounce corpus searches

    return () => clearTimeout(timer);
  }, [trimmedLine, fetchMatches]);

  if (!trimmedLine && matches.length === 0) {
    return (
      <div className="chronicle-empty">
        <p>Historic echoes will appear as you write...</p>
      </div>
    );
  }

  return (
    <div className="chronicle-panel">
      <header className="chronicle-header">
        <span className="chronicle-glyph">📜</span>
        <h4 className="chronicle-title">Literary Chronicles</h4>
      </header>

      {isLoading && (
        <div className="chronicle-loading">
          <motion.div 
            className="loading-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <span>Consulting the archives...</span>
        </div>
      )}

      {error && <div className="chronicle-error">{error}</div>}

      <div className="chronicle-matches">
        <AnimatePresence mode="popLayout">
          {matches.map((match, idx) => (
            <motion.div 
              key={match.id}
              className="chronicle-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.1 }}
            >
              <p className="chronicle-text">"{match.text}"</p>
              <div className="chronicle-meta">
                {match.author && <span className="chronicle-author">— {match.author}</span>}
                {match.title && <span className="chronicle-work">in {match.title}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!isLoading && trimmedLine && matches.length === 0 && (
          <div className="chronicle-no-results">
            No direct matches in the archives for this unique phrasing.
          </div>
        )}
      </div>
    </div>
  );
}
