import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWordLookup } from '../../src/hooks/useWordLookup.jsx';

describe('useWordLookup hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('uses backend word-lookup route by default', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return {
          word: 'arcana',
          source: 'scholomance-local',
          data: {
            word: 'ARCANA',
            definition: { text: 'Secret knowledge', partOfSpeech: 'noun' },
            definitions: ['Secret knowledge'],
            synonyms: ['mysteries'],
            antonyms: [],
            rhymes: [],
          },
        };
      },
    });

    const { result } = renderHook(() => useWordLookup());
    let lookupResult;
    await act(async () => {
      lookupResult = await result.current.lookup('arcana');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/word-lookup/arcana', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }));
    expect(lookupResult?.definition?.text).toBe('Secret knowledge');
    expect(result.current.source).toBe('scholomance-local');
    expect(result.current.error).toBeNull();
  });

  it('rejects empty words without making a request', async () => {
    const { result } = renderHook(() => useWordLookup());
    let lookupResult;
    await act(async () => {
      lookupResult = await result.current.lookup('  ');
    });

    expect(lookupResult).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Empty word');
  });
});

