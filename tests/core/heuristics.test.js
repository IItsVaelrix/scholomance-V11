import { describe, it, expect } from 'vitest';
import { createScoringEngine } from '../../codex/core/scoring.engine.js';
import { phonemeDensityHeuristic } from '../../codex/core/heuristics/phoneme_density.js';
import { meterRegularityHeuristic } from '../../codex/core/heuristics/meter_regularity.js';
import { alliterationDensityHeuristic } from '../../codex/core/heuristics/alliteration_density.js';

// Mock AnalyzedDocument
const mockDoc = {
  raw: "Hello hello heavy heart",
  allWords: [
    { text: "Hello", start: 0, end: 5, phonetics: { phonemes: Array(8).fill('X'), vowelFamily: 'OW', syllableCount: 2 } }, // High density
    { text: "hello", start: 6, end: 11, phonetics: { phonemes: ['X'], vowelFamily: 'OW', syllableCount: 2 } },
    { text: "heavy", start: 12, end: 17, phonetics: { phonemes: ['X'], vowelFamily: 'EH', syllableCount: 2 } },
    { text: "heart", start: 18, end: 23, phonetics: { phonemes: ['X'], vowelFamily: 'AA', syllableCount: 1 } }
  ],
  lines: [
    { text: "Hello hello heavy heart", syllableCount: 7, start: 0, end: 23, words: [] }
  ],
  stats: { wordCount: 4 }
};

describe('Heuristics Integration', () => {
  it('Phoneme Density detects high density words', () => {
    const result = phonemeDensityHeuristic.scorer(mockDoc);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].message).toContain('High phoneme density');
    expect(result.diagnostics[0].start).toBe(0);
  });

  it('Meter Regularity checks syllable consistency', () => {
    const result = meterRegularityHeuristic.scorer(mockDoc);
    expect(result.diagnostics.length).toBe(1); // One line
    expect(result.diagnostics[0].metadata.syllableCount).toBe(7);
  });

  it('Alliteration Density detects alliteration', () => {
    // "Hello hello heavy heart" -> all start with H
    const result = alliterationDensityHeuristic.scorer(mockDoc);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].message).toBe('Alliteration chain');
    expect(result.diagnostics[0].metadata.words.length).toBeGreaterThan(1);
  });

  it('Scoring Engine runs correctly with mock doc', () => {
    const engine = createScoringEngine([phonemeDensityHeuristic]);
    const score = engine.calculateScore(mockDoc);
    
    expect(score.totalScore).toBeGreaterThan(0);
    expect(score.traces[0].heuristic).toBe('phoneme_density');
  });
});
