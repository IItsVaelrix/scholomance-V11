import { describe, expect, it, vi } from 'vitest';
import { createWordLookupService } from '../../codex/server/services/wordLookup.service.js';

function jsonResponse(body, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

describe('[Server] WordLookupService', () => {
  it('prefers Scholomance dictionary when available', async () => {
    const fetchMock = vi.fn(async (url) => {
      const href = String(url);
      if (href === 'http://dict.local/api/lexicon/lookup/arcana') {
        return jsonResponse({
          definition: { text: 'Secret knowledge', partOfSpeech: 'noun' },
          entries: [],
          synonyms: ['mysteries'],
          antonyms: [],
          rhymes: [],
        });
      }
      throw new Error(`Unexpected URL: ${href}`);
    });

    const service = createWordLookupService({
      fetchImpl: fetchMock,
      scholomanceDictApiUrl: 'http://dict.local/api/lexicon',
    });

    const result = await service.lookupWord('Arcana');
    expect(result.source).toBe('scholomance-local');
    expect(result.word).toBe('arcana');
    expect(result.data?.definition?.text).toBe('Secret knowledge');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to external APIs when local misses', async () => {
    const fetchMock = vi.fn(async (url) => {
      const href = String(url);
      if (href === 'http://dict.local/api/lexicon/lookup/hello') {
        return jsonResponse({}, false);
      }
      if (href === 'https://api.dictionaryapi.dev/api/v2/entries/en/hello') {
        return jsonResponse([
          {
            meanings: [
              {
                partOfSpeech: 'interjection',
                definitions: [{ definition: 'A greeting' }],
              },
            ],
            phonetics: [{ text: '/həˈləʊ/' }],
          },
        ]);
      }
      if (href.startsWith('https://api.datamuse.com/words?rel_syn=hello')) {
        return jsonResponse([]);
      }
      if (href.startsWith('https://api.datamuse.com/words?rel_rhy=hello')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected URL: ${href}`);
    });

    const service = createWordLookupService({
      fetchImpl: fetchMock,
      scholomanceDictApiUrl: 'http://dict.local/api/lexicon',
    });

    const result = await service.lookupWord('hello');
    expect(result.source).toBe('external-api');
    expect(result.data?.definition?.text).toBe('A greeting');
    expect(result.data?.ipa).toBe('/həˈləʊ/');
  });

  it('serves cache hits from redis before network', async () => {
    const redis = {
      get: vi.fn(async () => JSON.stringify({ word: 'CACHED', definition: null })),
      setEx: vi.fn(async () => {}),
    };
    const fetchMock = vi.fn();

    const service = createWordLookupService({
      redis,
      fetchImpl: fetchMock,
      scholomanceDictApiUrl: 'http://dict.local/api/lexicon',
    });

    const result = await service.lookupWord('cached');
    expect(result.source).toBe('redis-cache');
    expect(result.data).toEqual({ word: 'CACHED', definition: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redis.setEx).not.toHaveBeenCalled();
  });
});

