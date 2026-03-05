import { useState, useEffect, useRef } from 'react';
import { createScoringEngine } from '../../codex/core/scoring.engine.js';
import { analyzeText } from '../../codex/core/analysis.pipeline.js';

import { alliterationDensityHeuristic } from '../../codex/core/heuristics/alliteration_density.js';
import { literaryDeviceRichnessHeuristic } from '../../codex/core/heuristics/literary_device_richness.js';
import { meterRegularityHeuristic } from '../../codex/core/heuristics/meter_regularity.js';
import { phoneticHackingHeuristic } from '../../codex/core/heuristics/phonetic_hacking.js';
import { phonemeDensityHeuristic } from '../../codex/core/heuristics/phoneme_density.js';
import { rhymeQualityHeuristic } from '../../codex/core/heuristics/rhyme_quality.js';
import { scrollPowerHeuristic } from '../../codex/core/heuristics/scroll_power.js';
import { vocabularyRichnessHeuristic } from '../../codex/core/heuristics/vocabulary_richness.js';

const HEURISTICS = [
  phonemeDensityHeuristic,
  alliterationDensityHeuristic,
  rhymeQualityHeuristic,
  scrollPowerHeuristic,
  meterRegularityHeuristic,
  literaryDeviceRichnessHeuristic,
  vocabularyRichnessHeuristic,
  phoneticHackingHeuristic,
];

export function useScoring(text) {
  const [scoreData, setScoreData] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const engineRef = useRef(null);

  if (!engineRef.current) {
    const engine = createScoringEngine();
    HEURISTICS.forEach((h) => {
      engine.registerHeuristic({
        heuristic: h.name,
        scorer: h.scorer,
        weight: h.weight,
      });
    });
    engineRef.current = engine;
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
