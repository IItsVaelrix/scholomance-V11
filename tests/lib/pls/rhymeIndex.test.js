import { describe, it, expect, beforeAll } from 'vitest';
import { RhymeIndex } from '../../../src/lib/pls/rhymeIndex.js';

// Minimal mock PhonemeEngine that returns known analyses for test words
const mockPhonemeEngine = {
  analyzeWord(word) {
    const upper = String(word).toUpperCase();
    const dict = {
      NIGHT: { vowelFamily: 'AY', rhymeKey: 'AY-T', syllableCount: 1, coda: 'T', phonemes: ['N', 'AY1', 'T'] },
      LIGHT: { vowelFamily: 'AY', rhymeKey: 'AY-T', syllableCount: 1, coda: 'T', phonemes: ['L', 'AY1', 'T'] },
      FIGHT: { vowelFamily: 'AY', rhymeKey: 'AY-T', syllableCount: 1, coda: 'T', phonemes: ['F', 'AY1', 'T'] },
      SIGHT: { vowelFamily: 'AY', rhymeKey: 'AY-T', syllableCount: 1, coda: 'T', phonemes: ['S', 'AY1', 'T'] },
      TIME:  { vowelFamily: 'AY', rhymeKey: 'AY-M', syllableCount: 1, coda: 'M', phonemes: ['T', 'AY1', 'M'] },
      LIME:  { vowelFamily: 'AY', rhymeKey: 'AY-M', syllableCount: 1, coda: 'M', phonemes: ['L', 'AY1', 'M'] },
      FACE:  { vowelFamily: 'EY', rhymeKey: 'EY-S', syllableCount: 1, coda: 'S', phonemes: ['F', 'EY1', 'S'] },
      BASE:  { vowelFamily: 'EY', rhymeKey: 'EY-S', syllableCount: 1, coda: 'S', phonemes: ['B', 'EY1', 'S'] },
      PLAY:  { vowelFamily: 'EY', rhymeKey: 'EY-open', syllableCount: 1, coda: null, phonemes: ['P', 'L', 'EY1'] },
      DREAM: { vowelFamily: 'IY', rhymeKey: 'IY-M', syllableCount: 1, coda: 'M', phonemes: ['D', 'R', 'IY1', 'M'] },
      BEAUTIFUL: { vowelFamily: 'IY', rhymeKey: 'IY-L', syllableCount: 3, coda: 'L', phonemes: ['B', 'IY1', 'T', 'AH0', 'F', 'AH0', 'L'] },
    };
    return dict[upper] || null;
  }
};

describe('RhymeIndex', () => {
  let index;

  beforeAll(() => {
    index = new RhymeIndex();
    const wordList = [
      'night', 'light', 'fight', 'sight',
      'time', 'lime',
      'face', 'base',
      'play',
      'dream',
      'beautiful',
      // duplicates for frequency
      'night', 'night', 'light',
    ];
    index.build(wordList, mockPhonemeEngine);
  });

  it('marks itself as built', () => {
    expect(index.built).toBe(true);
  });

  it('returns exact rhyme key matches', () => {
    const matches = index.getByRhymeKey('AY-T');
    const tokens = matches.map(m => m.token);
    expect(tokens).toContain('NIGHT');
    expect(tokens).toContain('LIGHT');
    expect(tokens).toContain('FIGHT');
    expect(tokens).toContain('SIGHT');
    expect(tokens).not.toContain('TIME'); // same family but different coda
  });

  it('returns vowel family matches', () => {
    const matches = index.getByVowelFamily('AY');
    const tokens = matches.map(m => m.token);
    expect(tokens).toContain('NIGHT');
    expect(tokens).toContain('TIME');
    expect(tokens).toContain('LIME');
  });

  it('tracks frequency from duplicate corpus entries', () => {
    const matches = index.getByRhymeKey('AY-T');
    const night = matches.find(m => m.token === 'NIGHT');
    const fight = matches.find(m => m.token === 'FIGHT');
    expect(night.frequency).toBe(3); // appeared 3 times
    expect(fight.frequency).toBe(1);
  });

  it('filters by prefix', () => {
    const matches = index.getByPrefix('LI');
    const tokens = matches.map(m => m.token);
    expect(tokens).toContain('LIGHT');
    expect(tokens).toContain('LIME');
    expect(tokens).not.toContain('NIGHT');
  });

  it('returns empty for unknown rhyme key', () => {
    expect(index.getByRhymeKey('ZZ-open')).toHaveLength(0);
  });

  it('returns empty for unknown vowel family', () => {
    expect(index.getByVowelFamily('ZZ')).toHaveLength(0);
  });
});
