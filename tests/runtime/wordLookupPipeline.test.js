import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupWordLookupPipeline,
  requestWordLookup,
  EVENTS,
} from '../../codex/runtime/wordLookupPipeline.js';
import { emit, on, clearAllListeners } from '../../codex/runtime/eventBus.js';
import { clearCache } from '../../codex/runtime/cache.js';
import { resetRateLimit } from '../../codex/runtime/rateLimit.js';

// Mock adapter for testing
function createMockAdapter(responses = {}) {
  return {
    constructor: { name: 'MockAdapter' },
    isAvailable: vi.fn().mockReturnValue(true),
    lookup: vi.fn().mockImplementation(async (word) => {
      const key = word.toLowerCase();
      return responses[key] || null;
    }),
  };
}

describe('[Runtime] WordLookupPipeline', () => {
  let mockAdapter;
  let unsubscribe;

  beforeEach(() => {
    // Clear all state before each test
    clearAllListeners();
    clearCache();
    resetRateLimit('word_lookup');

    mockAdapter = createMockAdapter({
      hello: {
        word: 'HELLO',
        definition: { text: 'A greeting', partOfSpeech: 'interjection', source: 'Test' },
        definitions: ['A greeting'],
        pos: ['interjection'],
        synonyms: ['hi', 'hey'],
        antonyms: ['goodbye'],
        rhymes: ['jello', 'fellow'],
      },
      world: {
        word: 'WORLD',
        definition: { text: 'The earth', partOfSpeech: 'noun', source: 'Test' },
        definitions: ['The earth'],
        pos: ['noun'],
        synonyms: ['earth', 'globe'],
        antonyms: [],
        rhymes: ['hurled', 'curled'],
      },
    });

    unsubscribe = setupWordLookupPipeline([mockAdapter]);
  });

  afterEach(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    clearAllListeners();
  });

  describe('Event Flow', () => {
    it('emits result for valid word lookup', async () => {
      const resultPromise = new Promise((resolve) => {
        on(EVENTS.RESPONSE, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: 'hello',
        requestId: 'test-1',
        responseEvent: EVENTS.RESPONSE,
      });

      const result = await resultPromise;
      expect(result.word).toBe('hello');
      expect(result.data.definition.text).toBe('A greeting');
      expect(result.source).toBe('MockAdapter');
    });

    it('emits error for empty word', async () => {
      const errorPromise = new Promise((resolve) => {
        on(`${EVENTS.RESPONSE}:error`, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: '',
        requestId: 'test-empty',
        responseEvent: EVENTS.RESPONSE,
      });

      const error = await errorPromise;
      expect(error.code).toBe('EMPTY_WORD');
    });

    it('emits error for word not found', async () => {
      const errorPromise = new Promise((resolve) => {
        on(`${EVENTS.RESPONSE}:error`, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: 'xyznonexistent',
        requestId: 'test-notfound',
        responseEvent: EVENTS.RESPONSE,
      });

      const error = await errorPromise;
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('Caching', () => {
    it('returns cached result on second lookup', async () => {
      // First lookup
      await new Promise((resolve) => {
        const unsub = on(EVENTS.RESPONSE, () => {
          unsub();
          resolve();
        });
        emit(EVENTS.REQUEST, {
          word: 'hello',
          requestId: 'cache-1',
          responseEvent: EVENTS.RESPONSE,
        });
      });

      // Reset adapter call count
      mockAdapter.lookup.mockClear();

      // Second lookup - should hit cache
      const resultPromise = new Promise((resolve) => {
        on(EVENTS.RESPONSE, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: 'hello',
        requestId: 'cache-2',
        responseEvent: EVENTS.RESPONSE,
      });

      const result = await resultPromise;
      expect(result.source).toBe('cache');
      expect(mockAdapter.lookup).not.toHaveBeenCalled();
    });
  });

  describe('Adapter Fallback Chain', () => {
    it('tries next adapter when first fails', async () => {
      const failingAdapter = createMockAdapter();
      failingAdapter.lookup.mockRejectedValue(new Error('First adapter failed'));

      const workingAdapter = createMockAdapter({
        test: {
          word: 'TEST',
          definition: { text: 'A test', partOfSpeech: 'noun', source: 'Backup' },
        },
      });

      // Clear and setup with two adapters
      clearAllListeners();
      clearCache();
      const unsub = setupWordLookupPipeline([failingAdapter, workingAdapter]);

      const resultPromise = new Promise((resolve) => {
        on(EVENTS.RESPONSE, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: 'test',
        requestId: 'fallback-test',
        responseEvent: EVENTS.RESPONSE,
      });

      const result = await resultPromise;
      expect(result.data.definition.text).toBe('A test');
      expect(workingAdapter.lookup).toHaveBeenCalled();

      unsub();
    });

    it('skips unavailable adapters', async () => {
      const unavailableAdapter = createMockAdapter();
      unavailableAdapter.isAvailable.mockReturnValue(false);

      const availableAdapter = createMockAdapter({
        skip: {
          word: 'SKIP',
          definition: { text: 'Skipped unavailable', partOfSpeech: 'verb', source: 'Available' },
        },
      });

      // Clear and setup
      clearAllListeners();
      clearCache();
      const unsub = setupWordLookupPipeline([unavailableAdapter, availableAdapter]);

      const resultPromise = new Promise((resolve) => {
        on(EVENTS.RESPONSE, (payload) => {
          resolve(payload);
        });
      });

      emit(EVENTS.REQUEST, {
        word: 'skip',
        requestId: 'skip-test',
        responseEvent: EVENTS.RESPONSE,
      });

      await resultPromise;
      expect(unavailableAdapter.lookup).not.toHaveBeenCalled();
      expect(availableAdapter.lookup).toHaveBeenCalled();

      unsub();
    });
  });

  describe('requestWordLookup()', () => {
    it('returns LexicalEntry for valid word', async () => {
      const result = await requestWordLookup('world');
      expect(result).not.toBeNull();
      expect(result.word).toBe('WORLD');
      expect(result.definition.text).toBe('The earth');
    });

    it('rejects for word not found', async () => {
      await expect(requestWordLookup('nonexistent')).rejects.toThrow('Word not found');
    });

    it('times out after specified duration', async () => {
      // Create adapter that never resolves
      const slowAdapter = createMockAdapter();
      slowAdapter.lookup.mockImplementation(() => new Promise(() => {}));

      clearAllListeners();
      clearCache();
      const unsub = setupWordLookupPipeline([slowAdapter]);

      await expect(requestWordLookup('slow', { timeout: 100 })).rejects.toThrow('timed out');

      unsub();
    });
  });
});
