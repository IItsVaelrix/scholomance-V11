import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalDictionaryAdapter } from '../../../codex/services/adapters/local.adapter.js';

describe('[Services] LocalDictionaryAdapter', () => {
  let adapter;
  let mockAPI;

  beforeEach(() => {
    // Create mock ScholomanceDictionaryAPI
    mockAPI = {
      isEnabled: vi.fn().mockReturnValue(true),
      lookup: vi.fn(),
    };

    adapter = new LocalDictionaryAdapter(mockAPI);
  });

  describe('isAvailable()', () => {
    it('returns true when API is enabled', () => {
      mockAPI.isEnabled.mockReturnValue(true);
      expect(adapter.isAvailable()).toBe(true);
    });

    it('returns false when API is disabled', () => {
      mockAPI.isEnabled.mockReturnValue(false);
      expect(adapter.isAvailable()).toBe(false);
    });

    it('returns false when API is null', () => {
      adapter = new LocalDictionaryAdapter(null);
      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('lookup()', () => {
    it('returns null when API is not available', async () => {
      mockAPI.isEnabled.mockReturnValue(false);

      const result = await adapter.lookup('test');
      expect(result).toBeNull();
      expect(mockAPI.lookup).not.toHaveBeenCalled();
    });

    it('returns null for empty word', async () => {
      const result = await adapter.lookup('');
      expect(result).toBeNull();
    });

    it('returns null when API returns null', async () => {
      mockAPI.lookup.mockResolvedValue(null);

      const result = await adapter.lookup('nonexistent');
      expect(result).toBeNull();
    });

    it('normalizes API response to LexicalEntry', async () => {
      mockAPI.lookup.mockResolvedValue({
        definition: {
          text: 'A greeting word',
          partOfSpeech: 'interjection',
          source: 'Scholomance',
        },
        synonyms: ['hi', 'hey'],
        antonyms: ['goodbye'],
        rhymes: ['jello', 'fellow'],
        lore: { magicType: 'greeting' },
      });

      const result = await adapter.lookup('hello');

      expect(result).not.toBeNull();
      expect(result.word).toBe('HELLO');
      expect(result.definition).toEqual({
        text: 'A greeting word',
        partOfSpeech: 'interjection',
        source: 'Scholomance',
      });
      expect(result.definitions).toEqual(['A greeting word']);
      expect(result.pos).toEqual(['interjection']);
      expect(result.synonyms).toEqual(['hi', 'hey']);
      expect(result.antonyms).toEqual(['goodbye']);
      expect(result.rhymes).toEqual(['jello', 'fellow']);
      expect(result.lore).toEqual({ magicType: 'greeting' });
    });

    it('handles API response without definition', async () => {
      mockAPI.lookup.mockResolvedValue({
        synonyms: ['fast', 'speedy'],
        rhymes: ['slick', 'trick'],
      });

      const result = await adapter.lookup('quick');

      expect(result).not.toBeNull();
      expect(result.definition).toBeNull();
      expect(result.definitions).toEqual([]);
      expect(result.synonyms).toEqual(['fast', 'speedy']);
    });

    it('handles API errors gracefully', async () => {
      mockAPI.lookup.mockRejectedValue(new Error('API error'));

      const result = await adapter.lookup('test');
      expect(result).toBeNull();
    });
  });

  describe('synonyms()', () => {
    it('returns empty array when unavailable', async () => {
      mockAPI.isEnabled.mockReturnValue(false);

      const result = await adapter.synonyms('test');
      expect(result).toEqual([]);
    });

    it('returns synonyms from API response', async () => {
      mockAPI.lookup.mockResolvedValue({
        synonyms: ['happy', 'joyful', 'cheerful'],
      });

      const result = await adapter.synonyms('glad');
      expect(result).toEqual(['happy', 'joyful', 'cheerful']);
    });

    it('returns empty array when no synonyms in response', async () => {
      mockAPI.lookup.mockResolvedValue({});

      const result = await adapter.synonyms('unique');
      expect(result).toEqual([]);
    });
  });

  describe('rhymes()', () => {
    it('returns rhymes from API response', async () => {
      mockAPI.lookup.mockResolvedValue({
        rhymes: ['cat', 'bat', 'rat'],
      });

      const result = await adapter.rhymes('hat');
      expect(result).toEqual(['cat', 'bat', 'rat']);
    });
  });

  describe('related()', () => {
    it('returns synonyms as similar relation', async () => {
      mockAPI.lookup.mockResolvedValue({
        synonyms: ['fast', 'rapid'],
      });

      const result = await adapter.related('quick');
      expect(result).toEqual([
        { relation: 'similar', words: ['fast', 'rapid'] },
      ]);
    });

    it('returns empty array when no synonyms', async () => {
      mockAPI.lookup.mockResolvedValue({});

      const result = await adapter.related('unique');
      expect(result).toEqual([]);
    });
  });
});
