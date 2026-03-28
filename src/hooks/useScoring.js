import { useState, useEffect, useRef } from 'react';
import { analyzeText } from '../../codex/core/analysis.pipeline.js';
import { createCombatScoringEngine } from '../../codex/core/scoring.defaults.js';
import { buildVowelSummary } from '../lib/phonology/vowelFamily.js';

export function useScoring(text) {
  const [scoreData, setScoreData] = useState(null);
  const [vowelSummary, setVowelSummary] = useState(null);
  const [analyzedWordsByStart, setAnalyzedWordsByStart] = useState(new Map());
  const [isScoring, setIsScoring] = useState(false);
  const engineRef = useRef(null);

  if (!engineRef.current) {
    engineRef.current = createCombatScoringEngine();
  }

  useEffect(() => {
    if (!text) {
      setScoreData(null);
      setVowelSummary(null);
      return;
    }

    setIsScoring(true);
    const timeoutId = setTimeout(async () => {
      try {
        const doc = analyzeText(text);
        const result = await engineRef.current.calculateScore(doc);
        const summary = buildVowelSummary(doc.allWords);
        
        const wordsByStart = new Map();
        doc.allWords.forEach(word => {
          wordsByStart.set(word.start, word);
        });
        
        setScoreData(result);
        setVowelSummary(summary);
        setAnalyzedWordsByStart(wordsByStart);
      } catch (err) {
        console.error('Scoring error:', err);
      } finally {
        setIsScoring(false);
      }
    }, 500); // Debounce scoring

    return () => clearTimeout(timeoutId);
  }, [text]);

  return { scoreData, vowelSummary, analyzedWordsByStart, isScoring };
}
