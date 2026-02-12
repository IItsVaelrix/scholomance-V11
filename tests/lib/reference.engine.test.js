import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceEngine } from '../../src/lib/reference.engine.js';

describe('ReferenceEngine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('fetches canonical server lookup route', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return {
          word: 'arcana',
          source: 'scholomance-local',
          data: {
            definition: { text: 'Secret knowledge', partOfSpeech: 'noun' },
            synonyms: ['mysteries'],
            antonyms: [],
            rhymes: ['ana'],
            lore: { school: 'Divination' },
            raw: { provider: 'scholomance' },
          },
        };
      },
    });

    const result = await ReferenceEngine.fetchAll('arcana');
    expect(global.fetch).toHaveBeenCalledWith('/api/word-lookup/arcana');
    expect(result.definition?.text).toBe('Secret knowledge');
    expect(result.synonyms).toEqual(['mysteries']);
    expect(result.rhymes).toEqual(['ana']);
  });

  it('returns cached result for repeated lookups', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return {
          word: 'echo',
          data: {
            definition: { text: 'Reflected sound' },
            synonyms: [],
            antonyms: [],
            rhymes: [],
          },
        };
      },
    });

    const first = await ReferenceEngine.fetchAll('echo');
    const second = await ReferenceEngine.fetchAll('echo');

    expect(first.definition?.text).toBe('Reflected sound');
    expect(second.definition?.text).toBe('Reflected sound');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

