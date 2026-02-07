/**
 * CODEx Pipeline Provider
 * Initializes and provides access to CODEx runtime pipelines.
 *
 * This provider should wrap components that need access to the word lookup pipeline.
 * It initializes the adapters and pipelines on mount.
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { initializePipelines } from '../../codex/runtime/pipeline.js';
import { createLocalAdapter } from '../../codex/services/adapters/local.adapter.js';
import { createFreeDictionaryAdapter } from '../../codex/services/adapters/freeDictionary.adapter.js';
import { createDatamuseAdapter } from '../../codex/services/adapters/datamuse.adapter.js';
import { ScholomanceDictionaryAPI } from '../lib/scholomanceDictionary.api.js';

const CODExContext = createContext(null);

/**
 * Feature flag for using the new CODEx pipeline vs legacy ReferenceEngine.
 * Set via environment variable or defaults to true.
 */
const USE_CODEX_PIPELINE = import.meta.env.VITE_USE_CODEX_PIPELINE !== 'false';

/**
 * Provider component that initializes CODEx pipelines.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function CODExProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!USE_CODEX_PIPELINE) {
      console.log('[CODEx] Pipeline disabled via feature flag, using legacy ReferenceEngine');
      setIsInitialized(true);
      return;
    }

    // Create adapter chain (local-first strategy)
    const adapters = [];

    // 1. Local Scholomance Dictionary (primary)
    if (ScholomanceDictionaryAPI.isEnabled()) {
      const localAdapter = createLocalAdapter(ScholomanceDictionaryAPI);
      adapters.push(localAdapter);
      console.log('[CODEx] Local dictionary adapter enabled');
    } else {
      console.log('[CODEx] Local dictionary not configured, skipping');
    }

    // 2. Free Dictionary API (definitions, synonyms, antonyms, IPA)
    adapters.push(createFreeDictionaryAdapter());
    console.log('[CODEx] Free Dictionary adapter added for definitions');

    // 3. Datamuse API (rhymes, synonyms fallback)
    adapters.push(createDatamuseAdapter());
    console.log('[CODEx] Datamuse adapter added for rhymes/fallback');

    // Initialize pipelines
    const result = initializePipelines({ dictionaryAdapters: adapters });
    cleanupRef.current = result.cleanup;
    setIsInitialized(true);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const value = {
    isInitialized,
    useCODExPipeline: USE_CODEX_PIPELINE,
  };

  return (
    <CODExContext.Provider value={value}>
      {children}
    </CODExContext.Provider>
  );
}

/**
 * Hook to access CODEx pipeline state.
 * @returns {{ isInitialized: boolean, useCODExPipeline: boolean }}
 */
export function useCODExPipeline() {
  const context = useContext(CODExContext);
  if (!context) {
    // If used outside provider, return defaults
    return {
      isInitialized: false,
      useCODExPipeline: USE_CODEX_PIPELINE,
    };
  }
  return context;
}

export default CODExProvider;
