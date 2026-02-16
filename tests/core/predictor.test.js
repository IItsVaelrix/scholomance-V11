import { describe, it, expect, beforeAll } from 'vitest';
import { TriePredictor } from '../../codex/core/trie.js';
import { Spellchecker } from '../../codex/core/spellchecker.js';

describe('Predictive Text Logic (Trie-based N-gram)', () => {
  let predictor;

  beforeAll(() => {
    predictor = new TriePredictor();
    const corpus = ['into', 'the', 'void', 'into', 'the', 'abyss'];
    for (let i = 0; i < corpus.length - 1; i++) {
      predictor.insert(corpus[i], corpus[i + 1]);
    }
    predictor.insert(corpus[corpus.length - 1]);
  });

  it('predicts words by prefix', () => {
    const results = predictor.predict('in');
    expect(results).toContain('into');
  });

  it('predicts next word based on context (Bigram)', () => {
    const results = predictor.predictNext('the');
    expect(results).toContain('void');
    expect(results).toContain('abyss');
  });

  it('returns empty for unknown prefixes', () => {
    const results = predictor.predict('xyz');
    expect(results).toHaveLength(0);
  });

  it('executes predictions in under 50ms', () => {
    const start = performance.now();
    predictor.predict('v');
    const end = performance.now();
    expect(end - start).toBeLessThan(50);
  });
});

describe('Spellchecker Logic (Levenshtein-based)', () => {
  let spellchecker;

  beforeAll(() => {
    spellchecker = new Spellchecker();
    spellchecker.init(['hello', 'world', 'ritual', 'scholomance', 'void']);
  });

  it('correctly identifies valid words', () => {
    expect(spellchecker.check('hello')).toBe(true);
    expect(spellchecker.check('VOID')).toBe(true);
  });

  it('identifies misspelled words', () => {
    expect(spellchecker.check('helo')).toBe(false);
    expect(spellchecker.check('riutual')).toBe(false);
  });

  it('provides corrections for misspelled words', () => {
    const suggestions = spellchecker.suggest('helo');
    expect(suggestions).toContain('hello');
  });

  it('respects the edit distance threshold (limit 2)', () => {
    const suggestions = spellchecker.suggest('scholomancy'); // distance 1 from scholomance
    expect(suggestions).toContain('scholomance');
    
    const tooFar = spellchecker.suggest('abcdefg');
    expect(tooFar).not.toContain('hello');
  });

  it('disambiguates sound-alike words (e.g., bruise vs brooze)', () => {
    spellchecker.init(['bruise', 'juice', 'fruit']);
    
    // "brooze" sounds like "bruise"
    const suggestions = spellchecker.suggest('brooze');
    expect(suggestions).toContain('bruise');

    // "froot" sounds like "fruit"
    const frootSuggestions = spellchecker.suggest('froot');
    expect(frootSuggestions).toContain('fruit');
  });
});
