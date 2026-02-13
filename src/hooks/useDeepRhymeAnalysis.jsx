import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { isComplexScheme } from "../lib/rhymeScheme.detector.js";

const ANALYSIS_DEBOUNCE_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_CACHE_ENTRIES = 50;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const USE_SERVER_ANALYSIS = parseBooleanFlag(import.meta.env.VITE_USE_SERVER_ANALYSIS, true);

function parseBooleanFlag(rawValue, defaultValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return defaultValue;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function getPanelAnalysisEndpoint() {
  return API_BASE_URL ? `${API_BASE_URL}/api/analysis/panels` : "/api/analysis/panels";
}

function normalizeGroupMap(value) {
  if (value instanceof Map) {
    return value;
  }
  if (!Array.isArray(value)) {
    return new Map();
  }
  const map = new Map();
  value.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) return;
    const [group, lineIndices] = entry;
    map.set(
      String(group),
      Array.isArray(lineIndices)
        ? lineIndices.filter((lineIndex) => Number.isInteger(lineIndex))
        : []
    );
  });
  return map;
}

function normalizePanelPayload(rawPayload) {
  const payload = rawPayload?.data ?? rawPayload;
  if (!payload || typeof payload !== "object") {
    return {
      analysis: null,
      scheme: null,
      meter: null,
      literaryDevices: [],
      emotion: "Neutral",
    };
  }

  const analysis = payload.analysis
    ? {
      ...payload.analysis,
      allConnections: Array.isArray(payload.analysis.allConnections) ? payload.analysis.allConnections : [],
      rhymeGroups: normalizeGroupMap(payload.analysis.rhymeGroups),
    }
    : null;

  const scheme = payload.scheme
    ? {
      ...payload.scheme,
      groups: normalizeGroupMap(payload.scheme.groups),
    }
    : null;

  return {
    analysis,
    scheme,
    meter: payload.meter || null,
    literaryDevices: Array.isArray(payload.literaryDevices) ? payload.literaryDevices : [],
    emotion: typeof payload.emotion === "string" ? payload.emotion : "Neutral",
  };
}

/**
 * Hook for deep rhyme analysis of document content.
 * Uses server-side analysis as the canonical source of truth.
 */
export function useDeepRhymeAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [schemeDetection, setSchemeDetection] = useState(null);
  const [meterDetection, setMeterDetection] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeConnections, setActiveConnections] = useState([]);
  const [highlightedGroup, setHighlightedGroup] = useState(null);
  const [literaryDevices, setLiteraryDevices] = useState([]);
  const [emotion, setEmotion] = useState("Neutral");
  const [error, setError] = useState(null);

  const isReady = true;

  const abortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const debounceTimerRef = useRef(null);
  const lastTextRef = useRef(null);
  const requestIdRef = useRef(0);

  const resetAnalysisState = useCallback(() => {
    setAnalysis(null);
    setSchemeDetection(null);
    setMeterDetection(null);
    setActiveConnections([]);
    setHighlightedGroup(null);
    setLiteraryDevices([]);
    setEmotion("Neutral");
    setError(null);
    setIsAnalyzing(false);
  }, []);

  const applyResult = useCallback((result) => {
    const nextResult = normalizePanelPayload(result);
    const nextAnalysis = nextResult.analysis;
    const connections = Array.isArray(nextAnalysis?.allConnections) ? nextAnalysis.allConnections : [];

    setAnalysis(nextAnalysis);
    setSchemeDetection(nextResult.scheme);
    setMeterDetection(nextResult.meter);
    setActiveConnections(connections);
    setHighlightedGroup(null);
    setLiteraryDevices(nextResult.literaryDevices);
    setEmotion(nextResult.emotion);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  /**
   * Analyzes a document for rhyme patterns.
   * Debounces API requests and caches recent responses.
   */
  const analyzeDocument = useCallback((text) => {
    const nextText = typeof text === "string" ? text : String(text || "");
    const trimmedText = nextText.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!trimmedText) {
      lastTextRef.current = null;
      requestIdRef.current += 1;
      resetAnalysisState();
      return;
    }

    if (!USE_SERVER_ANALYSIS) {
      setIsAnalyzing(false);
      setError("Analysis disabled by VITE_USE_SERVER_ANALYSIS=false");
      return;
    }

    if (nextText === lastTextRef.current) {
      return;
    }
    lastTextRef.current = nextText;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const cacheKey = trimmedText;

    if (cacheRef.current.has(cacheKey)) {
      applyResult(cacheRef.current.get(cacheKey));
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let didTimeout = false;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(getPanelAnalysisEndpoint(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ text: nextText }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.status}`);
        }

        const result = await response.json();
        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalized = normalizePanelPayload(result);
        cacheRef.current.set(cacheKey, normalized);
        if (cacheRef.current.size > MAX_CACHE_ENTRIES) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey !== undefined) {
            cacheRef.current.delete(firstKey);
          }
        }

        applyResult(normalized);
      } catch (analysisError) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (analysisError?.name === "AbortError") {
          if (didTimeout) {
            setError("Analysis request timed out");
            setIsAnalyzing(false);
          }
          return;
        }

        const message = analysisError instanceof Error ? analysisError.message : "Panel analysis failed";
        console.error("[useDeepRhymeAnalysis] Analysis failed:", analysisError);
        setError(message);
        setIsAnalyzing(false);
      } finally {
        clearTimeout(timeoutId);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }, ANALYSIS_DEBOUNCE_MS);
  }, [applyResult, resetAnalysisState]);

  /**
   * Highlights connections for a specific rhyme group.
   */
  const highlightRhymeGroup = useCallback((groupLabel) => {
    if (!analysis) return;

    const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
    const connections = allConnections.filter(
      (conn) => conn.groupLabel === groupLabel
    );
    setActiveConnections(connections);
    setHighlightedGroup(groupLabel);
  }, [analysis]);

  /**
   * Clears the current highlight, showing all connections.
   */
  const clearHighlight = useCallback(() => {
    if (analysis) {
      const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
      setActiveConnections(allConnections);
    } else {
      setActiveConnections([]);
    }
    setHighlightedGroup(null);
  }, [analysis]);

  /**
   * Gets all connections involving a specific line.
   */
  const getConnectionsForLine = useCallback((lineIndex) => {
    if (!analysis) return [];

    const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
    return allConnections.filter(
      (conn) =>
        conn.wordA.lineIndex === lineIndex ||
        conn.wordB.lineIndex === lineIndex
    );
  }, [analysis]);

  /**
   * Checks if current scheme is complex (for XP bonuses).
   */
  const hasComplexScheme = useMemo(() => {
    return schemeDetection ? isComplexScheme(schemeDetection.id) : false;
  }, [schemeDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      requestIdRef.current += 1;
    };
  }, []);

  return {
    // Analysis results
    analysis,
    schemeDetection,
    meterDetection,
    hasComplexScheme,
    literaryDevices,
    emotion,

    // State
    isAnalyzing,
    isReady,
    error,

    // Actions
    analyzeDocument,

    // Connection highlighting
    activeConnections,
    highlightedGroup,
    highlightRhymeGroup,
    clearHighlight,
    getConnectionsForLine,
  };
}
