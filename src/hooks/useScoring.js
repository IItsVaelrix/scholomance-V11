import { useState, useEffect, useRef } from 'react';
import { analyzeText } from '../../codex/core/analysis.pipeline.js';
import { createCombatScoringEngine } from '../../codex/core/scoring.defaults.js';

export function useScoring(text) {
  const [scoreData, setScoreData] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const engineRef = useRef(null);

  if (!engineRef.current) {
    engineRef.current = createCombatScoringEngine();
  }

  useEffect(() => {
    if (!text) {
      setScoreData(null);
      return;
    }

    setIsScoring(true);
    const timeoutId = setTimeout(async () => {
      try {
        const doc = analyzeText(text);
        const result = await engineRef.current.calculateScore(doc);
        setScoreData(result);
      } catch (err) {
        console.error('Scoring error:', err);
      } finally {
        setIsScoring(false);
      }
    }, 500); // Debounce scoring

    return () => clearTimeout(timeoutId);
  }, [text]);

  return { scoreData, isScoring };
}
