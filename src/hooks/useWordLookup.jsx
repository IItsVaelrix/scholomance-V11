/**
 * useWordLookup Hook
 * Defaults to backend /api/word-lookup for canonical lookup behavior.
 * Optional local runtime fallback can be enabled for offline/dev mode.
 */

import { useState, useCallback, useRef } from 'react';
import { on, emit } from '../../codex/runtime/eventBus.js';
import { EVENTS } from '../../codex/runtime/wordLookupPipeline.js';

const LOOKUP_TIMEOUT_MS = 10000;
const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', 'off', 'no']);

function parseBooleanFlag(rawValue, defaultValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

const USE_SERVER_WORD_LOOKUP = parseBooleanFlag(import.meta.env.VITE_USE_SERVER_WORD_LOOKUP, true);
const ENABLE_LOCAL_WORD_LOOKUP_FALLBACK = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_LOCAL_WORD_LOOKUP_FALLBACK,
  false,
);

async function lookupWordFromServer(word) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/word-lookup/${encodeURIComponent(word)}`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });

    if (response.status === 404) {
      return { data: null, source: 'not-found', error: 'Word not found' };
    }
    if (!response.ok) {
      throw new Error(`Lookup request failed (${response.status})`);
    }

    const payload = await response.json();
    return {
      data: payload?.data ?? null,
      source: payload?.source ?? 'server',
      error: payload?.data ? null : 'Word not found',
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Lookup timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function lookupWordFromRuntime(word, requestId) {
  return new Promise((resolve) => {
    let isDone = false;
    let timeoutId = null;
    let unsubscribeResult = null;
    let unsubscribeError = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribeResult) unsubscribeResult();
      if (unsubscribeError) unsubscribeError();
    };

    unsubscribeResult = on(EVENTS.RESPONSE, (payload) => {
      if (payload.requestId !== requestId || isDone) return;
      isDone = true;
      cleanup();
      resolve({
        data: payload.data ?? null,
        source: payload.source ?? 'runtime',
        error: payload.data ? null : 'Word not found',
      });
    });

    unsubscribeError = on(`${EVENTS.RESPONSE}:error`, (payload) => {
      if (payload.requestId !== requestId || isDone) return;
      isDone = true;
      cleanup();
      resolve({
        data: null,
        source: 'runtime',
        error: payload.error || 'Word lookup failed',
      });
    });

    timeoutId = setTimeout(() => {
      if (isDone) return;
      isDone = true;
      cleanup();
      resolve({
        data: null,
        source: 'runtime',
        error: 'Lookup timed out',
      });
    }, LOOKUP_TIMEOUT_MS);

    emit(EVENTS.REQUEST, {
      word,
      requestId,
      responseEvent: EVENTS.RESPONSE,
    });
  });
}

export function useWordLookup() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const requestIdCounterRef = useRef(0);
  const activeRequestIdRef = useRef(null);

  const lookup = useCallback(async (word) => {
    const trimmedWord = String(word || '').trim();
    if (!trimmedWord) {
      setError('Empty word');
      setData(null);
      setSource(null);
      return null;
    }

    requestIdCounterRef.current += 1;
    const requestId = `lookup_${requestIdCounterRef.current}_${Date.now()}`;
    activeRequestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    const applyStateIfCurrent = (result) => {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }
      setIsLoading(false);
      setData(result.data ?? null);
      setSource(result.source ?? null);
      setError(result.error ?? null);
    };

    try {
      if (USE_SERVER_WORD_LOOKUP) {
        try {
          const serverResult = await lookupWordFromServer(trimmedWord);
          applyStateIfCurrent(serverResult);
          return serverResult.data;
        } catch (serverError) {
          if (!ENABLE_LOCAL_WORD_LOOKUP_FALLBACK) {
            throw serverError;
          }
        }
      }

      const runtimeResult = await lookupWordFromRuntime(trimmedWord, requestId);
      applyStateIfCurrent(runtimeResult);
      return runtimeResult.data;
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Word lookup failed';
      applyStateIfCurrent({ data: null, source: null, error: message });
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setSource(null);
    activeRequestIdRef.current = null;
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

