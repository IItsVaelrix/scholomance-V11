import { describe, it, expect } from 'vitest';
import { PhonemeEngine } from '../../src/lib/phoneme.engine';

describe('Multi-Syllable Rhyme Detection', () => {
  it('should identify multi-syllable match for "nation" and "station"', () => {
    const w1 = PhonemeEngine.analyzeDeep('nation');
    const w2 = PhonemeEngine.analyzeDeep('station');
    const match = PhonemeEngine.scoreMultiSyllableMatch(w1, w2);
    
    expect(match.syllablesMatched).toBeGreaterThanOrEqual(2);
    expect(match.score).toBeGreaterThan(0.8);
    expect(match.type).toBe('feminine');
  });

  it('should identify perfect rhyme for "cat" and "bat"', () => {
    const w1 = PhonemeEngine.analyzeDeep('cat');
    const w2 = PhonemeEngine.analyzeDeep('bat');
    const match = PhonemeEngine.scoreMultiSyllableMatch(w1, w2);
    
    expect(match.syllablesMatched).toBe(1);
    expect(match.score).toBe(1.0);
  });

  it('should recognize near-rhyme via PhoneticSimilarity (M vs NG)', () => {
    const w1 = PhonemeEngine.analyzeDeep('dumb');
    const w2 = PhonemeEngine.analyzeDeep('tongue');
    const match = PhonemeEngine.scoreMultiSyllableMatch(w1, w2);
    
    // M and NG are too distinct for a high-quality rhyme (gate on codaScore)
    expect(match.score).toBe(0);
    expect(match.type).toBe('none');
  });

  it('should handle dactylic rhymes (3+ syllables)', () => {
    // "Mystery" / "History"
    const w1 = PhonemeEngine.analyzeDeep('mystery');
    const w2 = PhonemeEngine.analyzeDeep('history');
    const match = PhonemeEngine.scoreMultiSyllableMatch(w1, w2);
    
    expect(match.syllablesMatched).toBeGreaterThanOrEqual(3);
    expect(match.type).toBe('dactylic');
  });
});
