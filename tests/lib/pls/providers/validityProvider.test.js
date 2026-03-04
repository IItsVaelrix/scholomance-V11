import { describe, it, expect } from 'vitest';
import { validityProvider } from '../../../../src/lib/pls/providers/validityProvider.js';

describe('validityProvider', () => {
  it('returns candidates unchanged when dictionary API is unavailable', async () => {
    const candidates = [{ token: 'dime', scores: { rhyme: 0.6 } }];
    const results = await validityProvider({}, { dictionaryAPI: null }, candidates);
    expect(results).toEqual(candidates);
  });

  it('assigns validity scores for known and unknown words', async () => {
    const candidates = [
      { token: 'dime', scores: { rhyme: 0.6 } },
      { token: 'xqzword', scores: { rhyme: 0.1 } },
    ];

    const dictionaryAPI = {
      async validateBatch() {
        return ['dime'];
      },
    };

    const results = await validityProvider({}, { dictionaryAPI }, candidates);
    expect(results[0].scores.validity).toBe(1.0);
    expect(results[1].scores.validity).toBe(0.2);
  });

  it('returns candidates unchanged when validation fails', async () => {
    const candidates = [{ token: 'dime', scores: { rhyme: 0.6 } }];
    const dictionaryAPI = {
      async validateBatch() {
        throw new Error('down');
      },
    };

    const results = await validityProvider({}, { dictionaryAPI }, candidates);
    expect(results).toEqual(candidates);
  });
});
