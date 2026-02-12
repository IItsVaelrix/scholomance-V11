import { describe, it, expect } from 'vitest';
import { createAdapterChain } from '../../../codex/services/adapters/index.js';

describe('adapter registry', () => {
  it('builds a Datamuse fallback chain without local API', () => {
    const adapters = createAdapterChain();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].constructor.name).toBe('DatamuseAdapter');
  });

  it('adds local adapter first when scholomance API is enabled', () => {
    const scholomanceAPI = {
      isEnabled: () => true,
      lookup: async () => null,
    };
    const adapters = createAdapterChain({ scholomanceAPI });
    expect(adapters).toHaveLength(2);
    expect(adapters[0].constructor.name).toBe('LocalDictionaryAdapter');
    expect(adapters[1].constructor.name).toBe('DatamuseAdapter');
  });

  it('skips local adapter when scholomance API is disabled', () => {
    const scholomanceAPI = {
      isEnabled: () => false,
      lookup: async () => null,
    };
    const adapters = createAdapterChain({ scholomanceAPI });
    expect(adapters).toHaveLength(1);
    expect(adapters[0].constructor.name).toBe('DatamuseAdapter');
  });
});
