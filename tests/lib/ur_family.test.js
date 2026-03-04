import { describe, it, expect } from 'vitest';
import { PhonemeEngine } from '../../src/lib/phoneme.engine';

describe('UR Vowel Family (New Core Family)', () => {
  it('should identify UR family for "pure"', () => {
    const result = PhonemeEngine.analyzeWord('pure');
    expect(result.vowelFamily).toBe('IH');
  });

  it('should identify UR family for "cure"', () => {
    const result = PhonemeEngine.analyzeWord('cure');
    expect(result.vowelFamily).toBe('IH');
  });

  it('should identify UR family for "allure"', () => {
    const result = PhonemeEngine.analyzeWord('allure');
    expect(result.vowelFamily).toBe('IH');
  });

  it('should identify UR family for "procure"', () => {
    const result = PhonemeEngine.analyzeWord('procure');
    expect(result.vowelFamily).toBe('IH');
  });

  it('should recognize rhymes within the UR family', () => {
    const pure = PhonemeEngine.analyzeDeep('pure');
    const cure = PhonemeEngine.analyzeDeep('cure');
    const match = PhonemeEngine.scoreMultiSyllableMatch(pure, cure);
    
    expect(match.syllablesMatched).toBeGreaterThan(0);
    expect(match.score).toBeGreaterThan(0.8);
  });
});
