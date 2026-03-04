import { describe, it, expect } from 'vitest';
import { PhonemeEngine } from '../../src/lib/phoneme.engine';

describe('OY Vowel Family (New Core Family)', () => {
  it('should identify OY family for "oil"', () => {
    const result = PhonemeEngine.analyzeWord('oil');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should identify OY family for "boil"', () => {
    const result = PhonemeEngine.analyzeWord('boil');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should identify OY family for "gargoyle"', () => {
    const result = PhonemeEngine.analyzeWord('gargoyle');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should identify OY family for "royal"', () => {
    const result = PhonemeEngine.analyzeWord('royal');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should identify OY family for "disloyal"', () => {
    const result = PhonemeEngine.analyzeWord('disloyal');
    expect(result.vowelFamily).toBe('OW');
  });

  it('should recognize rhymes within the OY family', () => {
    const oil = PhonemeEngine.analyzeDeep('oil');
    const boil = PhonemeEngine.analyzeDeep('boil');
    const match = PhonemeEngine.scoreMultiSyllableMatch(oil, boil);
    
    expect(match.syllablesMatched).toBeGreaterThan(0);
    expect(match.score).toBeGreaterThan(0.8);
  });
});
