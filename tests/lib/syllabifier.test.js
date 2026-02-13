import { describe, it, expect } from 'vitest';
import { Syllabifier } from '../../src/lib/syllabifier';
import { Phonotactics } from '../../src/lib/phonotactics';

describe('Phonotactics', () => {
  it('should validate valid onsets', () => {
    expect(Phonotactics.validateOnset(['S', 'T', 'R']).valid).toBe(true);
    expect(Phonotactics.validateOnset(['B']).valid).toBe(true);
    expect(Phonotactics.validateOnset(['P', 'L']).valid).toBe(true);
  });

  it('should reject invalid onsets', () => {
    expect(Phonotactics.validateOnset(['N', 'G']).valid).toBe(false);
    expect(Phonotactics.validateOnset(['T', 'P']).valid).toBe(false); // Violation of SSP
  });

  it('should validate 3-consonant onset rules', () => {
    expect(Phonotactics.validateOnset(['S', 'P', 'L']).valid).toBe(true);
    expect(Phonotactics.validateOnset(['T', 'P', 'L']).valid).toBe(false); // Must start with S
  });
});

describe('Syllabifier', () => {
  it('should split simple words correctly', () => {
    // HELLO: HH AH0 L OW1 -> [HH AH0], [L OW1]
    const phonemes = ['HH', 'AH0', 'L', 'OW1'];
    const syllables = Syllabifier.syllabify(phonemes);
    expect(syllables).toHaveLength(2);
    expect(syllables[0]).toEqual(['HH', 'AH0']);
    expect(syllables[1]).toEqual(['L', 'OW1']);
  });

  it('should apply Maximal Onset Principle', () => {
    // MASTER: M AE1 S T ER0 -> [M AE1], [S T ER0]
    // 'ST' is a valid onset, so it should go to the second syllable
    const phonemes = ['M', 'AE1', 'S', 'T', 'ER0'];
    const syllables = Syllabifier.syllabify(phonemes);
    expect(syllables).toHaveLength(2);
    expect(syllables[0]).toEqual(['M', 'AE1']);
    expect(syllables[1]).toEqual(['S', 'T', 'ER0']);
  });

  it('should respect SSP when splitting', () => {
    // 'RK' is not a valid onset (sonority decreases), so it must be split
    // ARKO: AA1 R K OW1 -> [AA1 R], [K OW1]
    const phonemes = ['AA1', 'R', 'K', 'OW1'];
    const syllables = Syllabifier.syllabify(phonemes);
    expect(syllables).toHaveLength(2);
    expect(syllables[0]).toEqual(['AA1', 'R']);
    expect(syllables[1]).toEqual(['K', 'OW1']);
  });
});
