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

function makeWordSeries(prefix, count) {
  return Array.from({ length: count }, (_, index) => {
    const ch = String.fromCharCode(97 + (index % 26));
    const cycle = Math.floor(index / 26);
    return cycle > 0 ? `${prefix}${ch}${cycle}` : `${prefix}${ch}`;
  });
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

  it('caps CODEx-judged suggestions at top 15 per group', async () => {
    const synonyms = makeWordSeries('ally', 24);
    const antonyms = makeWordSeries('foe', 24);
    const rhymes = makeWordSeries('echo', 24);
    const slantRhymes = makeWordSeries('near', 24);

    const fetchMock = vi.fn(async (url) => {
      const href = String(url);
      if (href === 'http://dict.local/api/lexicon/lookup/ember') {
        return jsonResponse({
          definition: { text: 'A burning coal', partOfSpeech: 'noun' },
          entries: [],
          synonyms,
          antonyms,
          rhymes,
          slantRhymes,
        });
      }
      throw new Error(`Unexpected URL: ${href}`);
    });

    const service = createWordLookupService({
      fetchImpl: fetchMock,
      scholomanceDictApiUrl: 'http://dict.local/api/lexicon',
    });

    const result = await service.lookupWord('ember');
    expect(result.source).toBe('scholomance-local');
    expect(result.data?.synonyms).toHaveLength(15);
    expect(result.data?.antonyms).toHaveLength(15);
    expect(result.data?.rhymes).toHaveLength(15);
    expect(result.data?.slantRhymes).toHaveLength(15);
  });

  it('uses available max when fewer than 15 suggestions exist', async () => {
    const fetchMock = vi.fn(async (url) => {
      const href = String(url);
      if (href === 'http://dict.local/api/lexicon/lookup/orbit') {
        return jsonResponse({
          definition: { text: 'Path around a body', partOfSpeech: 'noun' },
          entries: [],
          synonyms: ['cycle', 'circuit', 'loop', 'arc'],
          antonyms: ['stillness', 'stasis'],
          rhymes: ['morbid', 'forbid', 'sorbid'],
          slantRhymes: ['orchid'],
        });
      }
      throw new Error(`Unexpected URL: ${href}`);
    });

    const service = createWordLookupService({
      fetchImpl: fetchMock,
      scholomanceDictApiUrl: 'http://dict.local/api/lexicon',
    });

    const result = await service.lookupWord('orbit');
    expect(result.source).toBe('scholomance-local');
    expect(result.data?.synonyms).toHaveLength(4);
    expect(result.data?.antonyms).toHaveLength(2);
    expect(result.data?.rhymes).toHaveLength(3);
    expect(result.data?.slantRhymes).toHaveLength(1);
  });
});
