import { describe, it, expect, vi } from 'vitest';
import { analyzeText } from '../../codex/core/analysis.pipeline.js';

// Mock PhonemeEngine to avoid fetching external JSONs
vi.mock('../../src/lib/phoneme.engine.js', () => {
  const analyzeWord = vi.fn((word) => {
    if (word.toLowerCase() === 'hello') {
      return {
        phonemes: ['HH', 'AH', 'L', 'OW'],
        vowelFamily: 'OW',
        rhymeKey: 'OW-L',
        syllableCount: 2
      };
    }
    if (word.toLowerCase() === 'world') {
      return {
        phonemes: ['W', 'ER', 'L', 'D'],
        vowelFamily: 'ER',
        rhymeKey: 'ER-LD',
        syllableCount: 1
      };
    }
    const normalized = String(word || '').toLowerCase();
    return {
      phonemes: normalized ? normalized.toUpperCase().split('') : [],
      vowelFamily: 'AH',
      rhymeKey: 'AH-open',
      syllableCount: 1
    };
  });

  const analyzeDeep = vi.fn((word) => {
    const lower = String(word || '').toLowerCase();
    if (lower === 'hello') {
      return {
        word: 'HELLO',
        phonemes: ['HH', 'AH1', 'L', 'OW0'],
        syllables: [{ stress: 1 }, { stress: 0 }],
        syllableCount: 2,
        rhymeKey: 'OW-L',
        extendedRhymeKeys: ['OW-L', 'AH-open/OW-L'],
        stressPattern: '10'
      };
    }
    if (lower === 'world') {
      return {
        word: 'WORLD',
        phonemes: ['W', 'ER1', 'L', 'D'],
        syllables: [{ stress: 1 }],
        syllableCount: 1,
        rhymeKey: 'ER-LD',
        extendedRhymeKeys: ['ER-LD'],
        stressPattern: '1'
      };
    }
    const base = analyzeWord(word);
    return {
      word: String(word || '').toUpperCase(),
      phonemes: base.phonemes,
      syllables: [{ stress: 1 }],
      syllableCount: base.syllableCount || 1,
      rhymeKey: base.rhymeKey || 'AH-open',
      extendedRhymeKeys: [base.rhymeKey || 'AH-open'],
      stressPattern: '1'
    };
  });

  return {
    PhonemeEngine: {
      analyzeWord,
      analyzeDeep
    }
  };
});

describe('Analysis Pipeline', () => {
  it('analyzes a simple sentence', () => {
    const text = "Hello world";
    const doc = analyzeText(text);

    expect(doc.raw).toBe(text);
    expect(doc.stats.wordCount).toBe(2);
    expect(doc.stats.totalSyllables).toBe(3); // 2 + 1
    expect(doc.stats.uniqueWordCount).toBe(2);
    expect(doc.stats.sentenceCount).toBe(1);
    
    expect(doc.allWords[0].text).toBe('Hello');
    expect(doc.allWords[0].phonetics.syllableCount).toBe(2);
    expect(doc.allWords[0].stressPattern).toBe('10');
    expect(doc.allWords[1].text).toBe('world');
    expect(doc.lines[0].stressPattern).toBe('101');
  });

  it('handles multiple lines', () => {
    const text = "Hello\nworld";
    const doc = analyzeText(text);

    expect(doc.lines.length).toBe(2);
    expect(doc.lines[0].text).toBe('Hello');
    expect(doc.lines[0].syllableCount).toBe(2);
    expect(doc.lines[1].text).toBe('world');
    expect(doc.lines[1].syllableCount).toBe(1);
    
    // Check indices
    expect(doc.lines[0].start).toBe(0);
    expect(doc.lines[0].end).toBe(5);
    expect(doc.lines[1].start).toBe(6); // 5 + 1 newline
  });

  it('builds algorithmic parsing signals', () => {
    const text = "Flame falls fast\nFlame forms fire\nFlame feeds fate";
    const doc = analyzeText(text);

    expect(doc.parsed.lineStarters[0].token).toBe('flame');
    expect(doc.parsed.lineStarters[0].count).toBe(3);
    expect(doc.parsed.repeatedWords[0].token).toBe('flame');
    expect(doc.parsed.repeatedWords[0].count).toBe(3);
    expect(doc.stats.sentenceCount).toBe(3);
  });

  it('handles empty input', () => {
    const doc = analyzeText('');
    expect(doc.lines.length).toBe(0);
    expect(doc.stats.wordCount).toBe(0);
    expect(doc.stats.uniqueWordCount).toBe(0);
    expect(doc.parsed.repeatedBigrams).toEqual([]);
  });
});
