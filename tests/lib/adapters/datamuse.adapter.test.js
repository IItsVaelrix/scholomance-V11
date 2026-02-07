import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatamuseAdapter } from '../../../codex/services/adapters/datamuse.adapter.js';

describe('[Services] DatamuseAdapter', () => {
  let adapter;
  let fetchMock;

  beforeEach(() => {
    adapter = new DatamuseAdapter();

    // Mock fetch globally
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lookup()', () => {
    it('returns null for empty word', async () => {
      const result = await adapter.lookup('');
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null for null word', async () => {
      const result = await adapter.lookup(null);
      expect(result).toBeNull();
    });

    it('returns normalized LexicalEntry for valid word', async () => {
      // Mock responses
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'happy' }, { word: 'joyful' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'snappy' }, { word: 'clappy' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'happy', tags: ['adj'] }]),
        });

      const result = await adapter.lookup('happy');

      expect(result).not.toBeNull();
      expect(result.word).toBe('HAPPY');
      expect(result.synonyms).toEqual(['happy', 'joyful']);
      expect(result.rhymes).toEqual(['snappy', 'clappy']);
    });

    it('returns null when word not found', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await adapter.lookup('xyznonexistent');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await adapter.lookup('test');
      expect(result).toBeNull();
    });
  });

  describe('synonyms()', () => {
    it('returns empty array for empty word', async () => {
      const result = await adapter.synonyms('');
      expect(result).toEqual([]);
    });

    it('returns array of synonyms for valid word', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { word: 'happy', score: 100 },
          { word: 'joyful', score: 90 },
        ]),
      });

      const result = await adapter.synonyms('glad');
      expect(result).toEqual(['happy', 'joyful']);
    });

    it('returns empty array on error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await adapter.synonyms('test');
      expect(result).toEqual([]);
    });
  });

  describe('rhymes()', () => {
    it('returns empty array for empty word', async () => {
      const result = await adapter.rhymes('');
      expect(result).toEqual([]);
    });

    it('returns array of rhyming words', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { word: 'cat', score: 100 },
          { word: 'bat', score: 95 },
          { word: 'rat', score: 90 },
        ]),
      });

      const result = await adapter.rhymes('hat');
      expect(result).toEqual(['cat', 'bat', 'rat']);
    });
  });

  describe('related()', () => {
    it('returns empty array for empty word', async () => {
      const result = await adapter.related('');
      expect(result).toEqual([]);
    });

    it('returns grouped related words', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'snow' }, { word: 'ice' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'season' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ word: 'spring' }]),
        });

      const result = await adapter.related('winter');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('relation');
      expect(result[0]).toHaveProperty('words');
    });
  });

  describe('isAvailable()', () => {
    it('always returns true (no auth required)', () => {
      expect(adapter.isAvailable()).toBe(true);
    });
  });
});
