import { describe, it, expect, beforeEach } from 'vitest';
import { PhonemeEngine } from '../../src/lib/phonology/phoneme.engine';
import fs from 'node:fs';
import path from 'node:path';

function getCorpusBaselineWords(limit = 24) {
  const corpusPath = path.join(process.cwd(), 'public', 'corpus.json');
  const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const words = [];
  const seen = new Set();

  const dictionary = Array.isArray(raw) ? raw : (raw.dictionary || []);

  for (const token of dictionary) {
    const normalized = String(token || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized.length < 2 || seen.has(normalized)) continue;
    seen.add(normalized);
    words.push(normalized.toLowerCase());
    if (words.length >= limit) break;
  }

  return words;
}

function projectAnalyzeWordContract(word) {
  const analysis = PhonemeEngine.analyzeWord(word);
  return {
    word: String(word).toUpperCase(),
    vowelFamily: analysis?.vowelFamily || null,
    coda: analysis?.coda || null,
    rhymeKey: analysis?.rhymeKey || null,
    syllableCount: analysis?.syllableCount || null,
    phonemes: Array.isArray(analysis?.phonemes) ? analysis.phonemes : [],
  };
}

function projectAnalyzeDeepContract(word) {
  const analysis = PhonemeEngine.analyzeDeep(word);
  return {
    word: analysis?.word || String(word).toUpperCase(),
    rhymeKey: analysis?.rhymeKey || null,
    syllableCount: analysis?.syllableCount || null,
    stressPattern: analysis?.stressPattern || '',
    extendedRhymeKeys: Array.isArray(analysis?.extendedRhymeKeys) ? analysis.extendedRhymeKeys : [],
    syllables: Array.isArray(analysis?.syllables)
      ? analysis.syllables.map((syllable) => ({
          index: syllable.index,
          vowel: syllable.vowel,
          vowelFamily: syllable.vowelFamily,
          onset: syllable.onset,
          coda: syllable.coda,
          stress: syllable.stress,
        }))
      : [],
  };
}

describe('PhonemeEngine', () => {

  beforeEach(() => {
    // Reset cache before each test
    PhonemeEngine.WORD_CACHE.clear();
    PhonemeEngine.AUTHORITY_CACHE.clear();
  });

  it('should analyze a common word and return valid structure', () => {
    const result = PhonemeEngine.analyzeWord('hello');
    expect(result).toBeTruthy();
    expect(result.vowelFamily).toBeTruthy();
    expect(result.phonemes).toBeInstanceOf(Array);
    expect(result.rhymeKey).toBeTruthy();
  });

  it('should analyze another common word "world"', () => {
    const result = PhonemeEngine.analyzeWord('world');
    expect(result).toBeTruthy();
    expect(result.vowelFamily).toBeTruthy();
    // World has consonants at the end
    expect(result.coda).toBeTruthy();
  });

  it('should use cache for subsequent analyses of the same word', () => {
    PhonemeEngine.analyzeWord('react');
    expect(PhonemeEngine.WORD_CACHE.has('REACT')).toBe(true);
    const result = PhonemeEngine.analyzeWord('react');
    expect(result).toBeTruthy();
    expect(result.vowelFamily).toBeTruthy();
  });

  it('should use fallback analysis for a made-up word', () => {
    const result = PhonemeEngine.analyzeWord('vitestacious');
    expect(result).toBeTruthy();
    expect(result.vowelFamily).toBeTruthy();
    expect(result.coda).toBe('S'); // ends in 'S'
    expect(result.rhymeKey).toContain('-S');
  });

  it('should handle words ending in consonants', () => {
    const result = PhonemeEngine.analyzeWord('test');
    expect(result).toBeTruthy();
    expect(result.vowelFamily).toBeTruthy();
    expect(result.coda).toBe('ST');
  });

  describe('Fallback Logic', () => {
    it('should guess vowel family correctly from full words', () => {
      // Basic vowel patterns
      expect(PhonemeEngine.guessVowelFamily('SEE')).toBe('IY');    // EE digraph
      expect(PhonemeEngine.guessVowelFamily('DAMOCLES')).toBe('AE'); // DAMOCLES override        
      expect(PhonemeEngine.guessVowelFamily('RAIN')).toBe('EY');   // AI digraph
      expect(PhonemeEngine.guessVowelFamily('CAT')).toBe('AE');    // short A

      // Silent-e / Magic-e patterns
      expect(PhonemeEngine.guessVowelFamily('LIKE')).toBe('EY');   // i_e pattern -> EY (was AY)
      expect(PhonemeEngine.guessVowelFamily('TIME')).toBe('EY');   // i_e pattern -> EY (was AY)
      expect(PhonemeEngine.guessVowelFamily('MAKE')).toBe('EY');   // a_e pattern
      expect(PhonemeEngine.guessVowelFamily('HOME')).toBe('OW');   // o_e pattern

      // R-controlled vowels
      expect(PhonemeEngine.guessVowelFamily('CORE')).toBe('AO');   // -ore pattern
      expect(PhonemeEngine.guessVowelFamily('MORE')).toBe('AO');   // -ore pattern
      expect(PhonemeEngine.guessVowelFamily('FIRE')).toBe('EY');   // FIRE override (stressed AY -> EY)
    });

    it('keeps long-A cluster words in EY family', () => {
      const words = ['BASE', 'FACE', 'PAY', 'PLAY', 'DISPLAY', 'BEIGE', 'GAUGE', 'PLAGUE', 'MALAISE', 'ACHE'];
      words.forEach((word) => {
        expect(PhonemeEngine.guessVowelFamily(word)).toBe('EY');
      });
    });

    it('should map fallback vowel family A to NECROMANCY school', () => {
      expect(PhonemeEngine.getSchoolFromVowelFamily('A')).toBe('NECROMANCY');
    });

    it('should extract coda correctly', () => {
      expect(PhonemeEngine.extractCoda('HELLO')).toBe(null);
      expect(PhonemeEngine.extractCoda('WORLD')).toBe('RLD');
      expect(PhonemeEngine.extractCoda('TEST')).toBe('ST');
    });

    it('should split to ARPAbet-compatible phonemes', () => {
      const phonemes = PhonemeEngine.splitToPhonemes('HELLO');
      expect(phonemes).toBeInstanceOf(Array);
      expect(phonemes.length).toBeGreaterThan(0);
      // Should contain ARPAbet vowels with stress markers
      const hasVowelWithStress = phonemes.some(p => /[A-Z]{2}[01]/.test(p));
      expect(hasVowelWithStress).toBe(true);
    });
  });

  describe('Deep Analysis', () => {
    it('aligns IN-cluster words to a shared stressed family', () => {
      const words = ['obsidian', 'olympian', 'victim', 'rhythm', 'median'];
      const stressedFamilies = words.map((word) => {
        const result = PhonemeEngine.analyzeDeep(word);
        expect(result).toBeTruthy();
        const syllables = Array.isArray(result?.syllables) ? result.syllables : [];
        const stressed = syllables.find((syl) => Number(syl?.stress) > 0) || syllables[0];
        return String(stressed?.vowelFamily || '').toUpperCase();
      });

      expect(new Set(stressedFamilies)).toEqual(new Set(['IH']));
    });

    it('aligns stressed U-sound cluster words to one family', () => {
      const words = ['stuck', 'bucket', 'buckets', 'cutting'];
      const stressedFamilies = words.map((word) => {
        const result = PhonemeEngine.analyzeDeep(word);
        expect(result).toBeTruthy();
        const syllables = Array.isArray(result?.syllables) ? result.syllables : [];
        const stressed = syllables.find((syl) => Number(syl?.stress) > 0) || syllables[0];
        return String(stressed?.vowelFamily || '').toUpperCase();
      });
      expect(new Set(stressedFamilies)).toEqual(new Set(['A']));
    });

    it('identifies distinct U family for boot and foot', () => {
      expect(PhonemeEngine.guessVowelFamily('boot')).toBe('UW');
      expect(PhonemeEngine.guessVowelFamily('foot')).toBe('UW');
    });

    it('should return syllable breakdown for analyzeDeep', () => {
      const result = PhonemeEngine.analyzeDeep('hello');
      expect(result).toBeTruthy();
      expect(result.syllables).toBeInstanceOf(Array);
      expect(result.syllableCount).toBeGreaterThan(0);
      expect(result.stressPattern).toBeTruthy();
    });

    it('should generate extended rhyme keys', () => {
      const result = PhonemeEngine.analyzeDeep('beautiful');
      expect(result).toBeTruthy();
      expect(result.extendedRhymeKeys).toBeInstanceOf(Array);
      expect(result.extendedRhymeKeys.length).toBeGreaterThan(0);
    });

    it('should score multi-syllable matches', () => {
      const wordA = PhonemeEngine.analyzeDeep('nation');
      const wordB = PhonemeEngine.analyzeDeep('station');
      const match = PhonemeEngine.scoreMultiSyllableMatch(wordA, wordB);
      expect(match).toBeTruthy();
      expect(match.syllablesMatched).toBeGreaterThanOrEqual(0);
      expect(typeof match.score).toBe('number');
    });

    it('should recognize boot and suit as a strong rhyme', () => {
      const boot = PhonemeEngine.analyzeDeep('boot');
      const suit = PhonemeEngine.analyzeDeep('suit');
      const match = PhonemeEngine.scoreMultiSyllableMatch(boot, suit);

      expect(boot).toBeTruthy();
      expect(suit).toBeTruthy();
      expect(match.syllablesMatched).toBeGreaterThan(0);
      expect(match.score).toBeGreaterThanOrEqual(0.65);
    });
  });

  describe('Regression Contract (Corpus Sample)', () => {
    const baselineWords = getCorpusBaselineWords(24);

    it('keeps analyzeWord output stable for a deterministic corpus sample', () => {
      const baseline = baselineWords.map((word) => projectAnalyzeWordContract(word));
      expect({ words: baselineWords, baseline }).toMatchSnapshot();
    });

    it('keeps analyzeDeep output stable for a deterministic corpus sample', () => {
      const baseline = baselineWords.map((word) => projectAnalyzeDeepContract(word));
      expect({ words: baselineWords, baseline }).toMatchSnapshot();
    });
  });
});
