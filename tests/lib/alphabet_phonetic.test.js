import { describe, it, expect } from 'vitest';
import { PhonemeEngine } from '../../src/lib/phoneme.engine';

describe('Alphabet Phonetic Mapping', () => {
  it('should identify EY family for standalone "A"', () => {
    const result = PhonemeEngine.analyzeWord('A');
    expect(result.vowelFamily).toBe('EY');
  });

  it('should identify IY family for standalone "B"', () => {
    const result = PhonemeEngine.analyzeWord('B');
    expect(result.vowelFamily).toBe('IY');
  });

  it('should identify AY (EY) family for standalone "I"', () => {
    const result = PhonemeEngine.analyzeWord('I');
    expect(result.vowelFamily).toBe('EY');
  });

  it('should identify OW family for standalone "O"', () => {
    const result = PhonemeEngine.analyzeWord('O');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should recognize digraph PH as F', () => {
    const result = PhonemeEngine.analyzeWord('PHASE');
    expect(result.phonemes).toContain('F');
  });

  it('should recognize digraph TH', () => {
    const result = PhonemeEngine.analyzeWord('THORN');
    expect(result.phonemes).toContain('TH');
  });

  it('should only activate rhyme for score > 0.60', () => {
    // Perfect rhyme: 1.0 > 0.60
    const cat = PhonemeEngine.analyzeDeep('cat');
    const bat = PhonemeEngine.analyzeDeep('bat');
    const match1 = PhonemeEngine.scoreMultiSyllableMatch(cat, bat);
    expect(match1.score).toBeGreaterThan(0.60);

    // Vowel match only (assonance): 0.57 < 0.60 (Should be deactivated per user request)
    const cat2 = PhonemeEngine.analyzeDeep('cat');
    const map = PhonemeEngine.analyzeDeep('map');
    const match2 = PhonemeEngine.scoreMultiSyllableMatch(cat2, map);
    expect(match2.score).toBe(0);
    expect(match2.type).toBe('none');
  });
});
