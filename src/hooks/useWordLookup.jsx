/**
 * useWordLookup Hook
 * Provides a React-friendly interface to the CODEx word lookup pipeline.
 *
 * Usage:
 * ```jsx
 * const { lookup, data, isLoading, error, clearError } = useWordLookup();
 *
 * // Trigger lookup
 * await lookup("hello");
 *
 * // Or use the result directly
 * const result = await lookup("hello");
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { on, emit } from '../../codex/runtime/eventBus.js';
import { EVENTS } from '../../codex/runtime/wordLookupPipeline.js';

/**
 * Hook for looking up words through the CODEx pipeline.
 * Provides loading states, error handling, and automatic cleanup.
 *
 * @returns {{
 *   lookup: (word: string) => Promise<import('../../codex/core/schemas').LexicalEntry|null>,
 *   data: import('../../codex/core/schemas').LexicalEntry|null,
 *   isLoading: boolean,
 *   error: string|null,
 *   clearError: () => void,
 *   source: string|null,
 * }}
 */
export function useWordLookup() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  // Track pending requests to handle race conditions
  const pendingRequestRef = useRef(null);
  const requestIdCounterRef = useRef(0);

  // Subscribe to events on mount
  useEffect(() => {
    const handleResult = (payload) => {
      // Only handle if this is our pending request
      if (payload.requestId === pendingRequestRef.current) {
        setData(payload.data);
        setSource(payload.source);
        setIsLoading(false);
        setError(null);
        pendingRequestRef.current = null;
      }
    };

    const handleError = (payload) => {
      // Only handle if this is our pending request
      if (payload.requestId === pendingRequestRef.current) {
        setError(payload.error);
        setIsLoading(false);
        pendingRequestRef.current = null;
      }
    };

    const unsubscribeResult = on(EVENTS.RESPONSE, handleResult);
    const unsubscribeError = on(`${EVENTS.RESPONSE}:error`, handleError);

    return () => {
      unsubscribeResult();
      unsubscribeError();
    };
  }, []);

  /**
   * Looks up a word through the CODEx pipeline.
   * @param {string} word - The word to look up.
   * @returns {Promise<import('../../codex/core/schemas').LexicalEntry|null>}
   */
  const lookup = useCallback((word) => {
    return new Promise((resolve, reject) => {
      const trimmedWord = String(word || '').trim();

      if (!trimmedWord) {
        setError('Empty word');
        resolve(null);
        return;
      }

      // Generate unique request ID
      requestIdCounterRef.current += 1;
      const requestId = `hook_${requestIdCounterRef.current}_${Date.now()}`;
      pendingRequestRef.current = requestId;

      setIsLoading(true);
      setError(null);

      // Set up one-time listeners for this specific request
      let resolved = false;
      let unsubResult = null;
      let unsubError = null;

      const cleanup = () => {
        if (unsubResult) unsubResult();
        if (unsubError) unsubError();
      };

      unsubResult = on(EVENTS.RESPONSE, (payload) => {
        if (payload.requestId === requestId && !resolved) {
          resolved = true;
          cleanup();
          resolve(payload.data);
        }
      });

      unsubError = on(`${EVENTS.RESPONSE}:error`, (payload) => {
        if (payload.requestId === requestId && !resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      });

      // Set timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          setIsLoading(false);
          setError('Lookup timed out');
          pendingRequestRef.current = null;
          resolve(null);
        }
      }, 10000);

      // Emit the request
      emit(EVENTS.REQUEST, {
        word: trimmedWord,
        requestId,
        responseEvent: EVENTS.RESPONSE,
      });
    });
  }, []);

  /**
   * Clears the current error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clears all state (data, error, loading).
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setSource(null);
    pendingRequestRef.current = null;
  }, []);

  return {
    lookup,
    data,
    isLoading,
    error,
    clearError,
    reset,
    source,
  };
}

export default useWordLookup;
