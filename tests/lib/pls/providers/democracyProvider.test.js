import { describe, it, expect } from 'vitest';
import { democracyProvider } from '../../../../src/lib/pls/providers/democracyProvider.js';

describe('democracyProvider', () => {
  const mockEngines = {
    trie: {
      predict: (prefix) => (prefix === 'li' ? ['light', 'lime'] : []),
      predictNext: () => [],
    },
    spellchecker: {
      suggest: (prefix) => (prefix === 'li' ? ['light', 'life'] : []),
    },
    phonemeEngine: {
      analyzeWord: (word) => {
        const dict = {
          NIGHT: { rhymeKey: 'AY-T' },
          LIGHT: { rhymeKey: 'AY-T' },
          LIME: { rhymeKey: 'AY-M' },
        };
        return dict[String(word).toUpperCase()] || null;
      },
    },
  };

  const mockContext = {
    prefix: 'li',
    prevWord: null,
    prevLineEndWord: 'night',
  };

  it('assigns democracy scores based on layer consensus', async () => {
    const candidates = [
      { token: 'light', scores: {} }, // Trie, Spellcheck, and Phoneme (AY-T)
      { token: 'lime', scores: {} },  // Trie only
      { token: 'life', scores: {} },  // Spellcheck only
      { token: 'void', scores: {} },  // None
    ];

    const results = await democracyProvider(mockContext, mockEngines, candidates);

    const light = results.find(r => r.token === 'light');
    const lime = results.find(r => r.token === 'lime');
    const life = results.find(r => r.token === 'life');
    const void_cand = results.find(r => r.token === 'void');

    expect(light.scores.democracy).toBeGreaterThan(lime.scores.democracy);
    expect(light.scores.democracy).toBeGreaterThan(life.scores.democracy);
    expect(lime.scores.democracy).toBeGreaterThan(void_cand.scores.democracy);
    expect(life.scores.democracy).toBeGreaterThan(void_cand.scores.democracy);
    expect(void_cand.scores.democracy).toBe(0);
  });

  it('handles missing engines gracefully', async () => {
    const candidates = [{ token: 'light', scores: {} }];
    const results = await democracyProvider(mockContext, {}, candidates);
    expect(results[0].scores.democracy).toBe(0);
  });
});
