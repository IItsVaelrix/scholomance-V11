/**
 * Adapter Registry
 * Exports adapter classes and a factory for creating the adapter chain.
 *
 * The adapter chain implements a fallback strategy:
 * 1. Local Scholomance Dictionary (fastest, offline-capable)
 * 2. Datamuse API (free, no auth needed)
 *
 * @see AI_Architecture_V2.md section 3.2
 */

import { DictionaryAdapter } from './dictionary.adapter.js';
import { LocalDictionaryAdapter, createLocalAdapter as createLocalAdapterSync } from './local.adapter.js';
import { DatamuseAdapter, createDatamuseAdapter as createDatamuseAdapterSync } from './datamuse.adapter.js';
import { PersistenceAdapter } from './persistence.adapter.js';
import { TransportAdapter } from './transport.adapter.js';

// Re-export adapter classes
export {
  DictionaryAdapter,
  LocalDictionaryAdapter,
  createLocalAdapterSync as createLocalAdapter,
  DatamuseAdapter,
  createDatamuseAdapterSync as createDatamuseAdapter,
  PersistenceAdapter,
  TransportAdapter,
};

/**
 * Creates the default adapter chain for word lookup.
 * Order: Local → Datamuse (fallback chain, local-first strategy)
 *
 * @param {Object} options - Configuration options.
 * @param {Object} [options.scholomanceAPI] - The ScholomanceDictionaryAPI instance.
 * @param {Object} [options.datamuseOptions] - Options for the Datamuse adapter.
 * @returns {import('./dictionary.adapter.js').DictionaryAdapter[]} Array of adapters in priority order.
 */
export function createAdapterChain(options = {}) {
  const adapters = [];

  // 1. Local Scholomance Dictionary (primary)
  if (options.scholomanceAPI) {
    const localAdapter = createLocalAdapterSync(options.scholomanceAPI);
    if (localAdapter.isAvailable()) {
      adapters.push(localAdapter);
    }
  }

  // 2. Datamuse API (fallback)
  adapters.push(createDatamuseAdapterSync(options.datamuseOptions));

  return adapters;
}

/**
 * Creates an adapter chain using dynamic imports (for ESM environments).
 * This is the preferred method in browser/Vite environments.
 *
 * @param {Object} options - Configuration options.
 * @param {Object} [options.scholomanceAPI] - The ScholomanceDictionaryAPI instance.
 * @param {Object} [options.datamuseOptions] - Options for the Datamuse adapter.
 * @returns {Promise<import('./dictionary.adapter.js').DictionaryAdapter[]>} Array of adapters in priority order.
 */
export async function createAdapterChainAsync(options = {}) {
  const adapters = [];

  // 1. Local Scholomance Dictionary (primary)
  if (options.scholomanceAPI) {
    const { createLocalAdapter } = await import('./local.adapter.js');
    const localAdapter = createLocalAdapter(options.scholomanceAPI);
    if (localAdapter.isAvailable()) {
      adapters.push(localAdapter);
    }
  }

  // 2. Datamuse API (fallback)
  const { createDatamuseAdapter } = await import('./datamuse.adapter.js');
  adapters.push(createDatamuseAdapter(options.datamuseOptions));

  return adapters;
}

/**
 * Looks up a word using the adapter chain with fallback.
 * Tries each adapter in order until one succeeds.
 *
 * @param {import('./dictionary.adapter.js').DictionaryAdapter[]} adapters - The adapter chain.
 * @param {string} word - The word to look up.
 * @returns {Promise<{result: import('../../core/schemas').LexicalEntry|null, source: string|null}>}
 */
export async function lookupWithFallback(adapters, word) {
  for (const adapter of adapters) {
    try {
      const result = await adapter.lookup(word);
      if (result) {
        return {
          result,
          source: adapter.constructor.name,
        };
      }
    } catch (error) {
      console.warn(`[AdapterChain] ${adapter.constructor.name} failed:`, error);
      // Continue to next adapter
    }
  }

  return { result: null, source: null };
}
