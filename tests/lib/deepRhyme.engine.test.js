import { describe, it, expect } from 'vitest';
import { DeepRhymeEngine } from '../../src/lib/deepRhyme.engine.js';

function createMockPhonemeEngine() {
  return {
    analyzeDeep(word) {
      const normalized = String(word || '').toLowerCase();
      const rhymeKey = normalized.endsWith('a') ? 'A-OPEN' : 'B-OPEN';
      return {
        rhymeKey,
        syllableCount: 1,
        stressPattern: '1',
        syllables: [{ stress: 1, vowelFamily: 'A', coda: '' }],
      };
    },
    scoreMultiSyllableMatch(analysisA, analysisB) {
      const isMatch = analysisA?.rhymeKey === analysisB?.rhymeKey;
      return {
        score: isMatch ? 1 : 0,
        syllablesMatched: isMatch ? 1 : 0,
        type: 'masculine',
      };
    },
  };
}

function createAssonanceMockPhonemeEngine() {
  const lexicon = {
    box: { rhymeKey: 'A-KS', vowelFamily: 'A', coda: 'KS' },
    chops: { rhymeKey: 'A-PS', vowelFamily: 'A', coda: 'PS' },
  };

  return {
    analyzeDeep(word) {
      const normalized = String(word || '').toLowerCase();
      const entry = lexicon[normalized] || { rhymeKey: 'E-T', vowelFamily: 'EH', coda: 'T' };
      return {
        rhymeKey: entry.rhymeKey,
        syllableCount: 1,
        stressPattern: '1',
        syllables: [{ stress: 1, vowelFamily: entry.vowelFamily, coda: entry.coda }],
      };
    },
    scoreMultiSyllableMatch(analysisA, analysisB) {
      const sylA = analysisA?.syllables?.[analysisA.syllables.length - 1];
      const sylB = analysisB?.syllables?.[analysisB.syllables.length - 1];
      if (!sylA || !sylB) {
        return { score: 0, syllablesMatched: 0, type: 'none' };
      }

      // Assonance: same vowel family, different coda.
      if (sylA.vowelFamily === sylB.vowelFamily && sylA.coda !== sylB.coda) {
        return { score: 0.65, syllablesMatched: 1, type: 'masculine' };
      }

      if (analysisA?.rhymeKey === analysisB?.rhymeKey) {
        return { score: 1, syllablesMatched: 1, type: 'masculine' };
      }

      return { score: 0, syllablesMatched: 0, type: 'none' };
    },
  };
}

describe('DeepRhymeEngine duplicate-scheme scanning', () => {
  it('keeps full scan for 2 same-scheme line endings', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      'line one alpha',
      'line two omega',
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(1);
    expect(result.schemePattern).toBe('AA');
  });

  it('avoids quadratic scans when same scheme repeats more than twice', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      'verse one alpha',
      'verse two omega',
      'verse three luna',
      'verse four sonata',
    ].join('\n'));

    // Previous behavior produced 6 (4 choose 2) connections.
    // New behavior uses minimal adjacent chaining for repeated schemes.
    expect(result.endRhymeConnections).toHaveLength(3);
    expect(result.schemePattern).toBe('AAAA');

    const groupSizes = Array.from(result.rhymeGroups.values()).map((lines) => lines.length);
    expect(groupSizes).toContain(4);
  });

  it('detects assonance candidates even when rhyme keys differ', () => {
    const engine = new DeepRhymeEngine(createAssonanceMockPhonemeEngine());
    const result = engine.analyzeDocument([
      'dark box',
      'sharp chops',
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(1);
    expect(result.endRhymeConnections[0].type).toBe('assonance');
  });

  it('does not count repeated lexical endings as rhyme connections', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      "I'm a joy boy",
      "I'm a joy boy",
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(0);
    expect(result.schemePattern).toBe('AB');
  });
});
