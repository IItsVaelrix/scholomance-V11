import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { isComplexScheme } from "../lib/rhymeScheme.detector.js";

const ANALYSIS_DEBOUNCE_MS = 500;

/**
 * Hook for deep rhyme analysis of document content.
 * Offloads analysis to a Web Worker for seamless performance.
 */
export function useDeepRhymeAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [schemeDetection, setSchemeDetection] = useState(null);
  const [meterDetection, setMeterDetection] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeConnections, setActiveConnections] = useState([]);
  const [highlightedGroup, setHighlightedGroup] = useState(null);
  const [literaryDevices, setLiteraryDevices] = useState([]);
  const [emotion, setEmotion] = useState('Neutral');
  const [isReady, setIsReady] = useState(false);

  const workerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastTextRef = useRef(null);
  const analysisIdRef = useRef(0);

  // Initialize Worker
  useEffect(() => {
    // Vite worker syntax
    const worker = new Worker(new URL('../lib/analysis.worker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'READY') {
        setIsReady(true);
      }

      if (type === 'ANALYSIS_COMPLETE') {
        // Only update if this is the most recent analysis request
        if (payload.analysisId === analysisIdRef.current) {
          setAnalysis(payload.result);
          setSchemeDetection(payload.scheme);
          setMeterDetection(payload.meter);
          setActiveConnections(payload.result.allConnections);
          setLiteraryDevices(payload.literary);
          setEmotion(payload.emotion);
          setIsAnalyzing(false);
          
          if (payload.duration > 100) {
             console.log(`[PERF] Offloaded Analysis: ${payload.duration.toFixed(2)}ms (Background thread)`);
          }
        }
      }

      if (type === 'ERROR') {
        console.error('[AnalysisWorker] Error:', payload.error);
        setIsAnalyzing(false);
      }
    };

    worker.postMessage({ type: 'INIT' });
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  /**
   * Analyzes a document for rhyme patterns.
   * Offloaded to worker thread.
   */
  const analyzeDocument = useCallback((text) => {
    if (!workerRef.current || !isReady || !text) {
      setAnalysis(null);
      setSchemeDetection(null);
      setMeterDetection(null);
      setLiteraryDevices([]);
      setEmotion('Neutral');
      return;
    }

    if (text === lastTextRef.current) {
      return;
    }
    lastTextRef.current = text;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsAnalyzing(true);

    debounceTimerRef.current = setTimeout(() => {
      analysisIdRef.current += 1;
      workerRef.current.postMessage({
        type: 'ANALYZE',
        payload: {
          text,
          analysisId: analysisIdRef.current
        }
      });
    }, ANALYSIS_DEBOUNCE_MS);
  }, [isReady]);

  /**
   * Highlights connections for a specific rhyme group.
   */
  const highlightRhymeGroup = useCallback((groupLabel) => {
    if (!analysis) return;

    const connections = analysis.allConnections.filter(
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
      setActiveConnections(analysis.allConnections);
    }
    setHighlightedGroup(null);
  }, [analysis]);

  /**
   * Gets all connections involving a specific line.
   */
  const getConnectionsForLine = useCallback((lineIndex) => {
    if (!analysis) return [];

    return analysis.allConnections.filter(
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
