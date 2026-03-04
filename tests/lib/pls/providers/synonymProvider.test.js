import { describe, it, expect } from 'vitest';
import { synonymProvider } from '../../../../src/lib/pls/providers/synonymProvider.js';

describe('synonymProvider', () => {
  it('returns empty when dictionary API is unavailable', async () => {
    const results = await synonymProvider(
      { prevWord: 'time', prefix: '' },
      { dictionaryAPI: null },
    );
    expect(results).toEqual([]);
  });

  it('returns filtered synonym suggestions with badges', async () => {
    const dictionaryAPI = {
      async lookup() {
        return { synonyms: ['time', 'timeless', 'timbre', 'era'] };
      },
    };

    const results = await synonymProvider(
      { prevWord: 'time', prefix: 'ti' },
      { dictionaryAPI },
    );

    expect(results.map((result) => result.token)).toEqual(['time', 'timeless', 'timbre']);
    expect(results[0].badge).toBe('SYNONYM');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('returns empty when lookup throws', async () => {
    const dictionaryAPI = {
      async lookup() {
        throw new Error('down');
      },
    };

    const results = await synonymProvider(
      { prevWord: 'time', prefix: '' },
      { dictionaryAPI },
    );
    expect(results).toEqual([]);
  });
});
