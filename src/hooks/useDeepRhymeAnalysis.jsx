import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePhonemeEngine } from "./usePhonemeEngine.jsx";
import { DeepRhymeEngine } from "../lib/deepRhyme.engine.js";
import { detectScheme, analyzeMeter, isComplexScheme } from "../lib/rhymeScheme.detector.js";
import { analyzeLiteraryDevices, detectEmotion } from "../lib/literaryDevices.detector.js";

const ANALYSIS_DEBOUNCE_MS = 500;

/**
 * Hook for deep rhyme analysis of document content.
 * Provides document-level rhyme detection, scheme identification,
 * and visual connection data.
 *
 * @returns {{
 *   analysis: object | null,
 *   schemeDetection: object | null,
 *   meterDetection: object | null,
 *   isAnalyzing: boolean,
 *   isReady: boolean,
 *   analyzeDocument: (text: string) => void,
 *   activeConnections: Array,
 *   highlightedGroup: string | null,
 *   highlightRhymeGroup: (label: string) => void,
 *   clearHighlight: () => void,
 *   getConnectionsForLine: (lineIndex: number) => Array,
 * }}
 */
export function useDeepRhymeAnalysis() {
  const { engine, isReady: engineReady } = usePhonemeEngine();

  const [analysis, setAnalysis] = useState(null);
  const [schemeDetection, setSchemeDetection] = useState(null);
  const [meterDetection, setMeterDetection] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeConnections, setActiveConnections] = useState([]);
  const [highlightedGroup, setHighlightedGroup] = useState(null);
  const [literaryDevices, setLiteraryDevices] = useState([]);
  const [emotion, setEmotion] = useState('Neutral');

  const deepEngineRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastTextRef = useRef(null);

  // Initialize deep engine when phoneme engine is ready
  useEffect(() => {
    if (engineReady && engine) {
      deepEngineRef.current = new DeepRhymeEngine(engine);
    }
  }, [engineReady, engine]);

  /**
   * Analyzes a document for rhyme patterns.
   * Debounced to prevent excessive re-analysis.
   */
  const analyzeDocument = useCallback((text) => {
    if (!deepEngineRef.current || !text) {
      setAnalysis(null);
      setSchemeDetection(null);
      setMeterDetection(null);
      setLiteraryDevices([]);
      setEmotion('Neutral');
      return;
    }

    // Skip if text hasn't changed
    if (text === lastTextRef.current) {
      return;
    }
    lastTextRef.current = text;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsAnalyzing(true);

    // Debounce the analysis
    debounceTimerRef.current = setTimeout(() => {
      try {
        // Perform analysis
        const result = deepEngineRef.current.analyzeDocument(text);
        setAnalysis(result);

        // Detect rhyme scheme
        const scheme = detectScheme(result.schemePattern, result.rhymeGroups);
        setSchemeDetection(scheme);

        // Analyze meter
        const meter = analyzeMeter(result.lines);
        setMeterDetection(meter);

        // Set all connections as active by default
        setActiveConnections(result.allConnections);

        // Literary device and emotion analysis
        setLiteraryDevices(analyzeLiteraryDevices(text));
        setEmotion(detectEmotion(text));
      } catch (err) {
        console.error('Deep rhyme analysis error:', err);
        setAnalysis(null);
        setSchemeDetection(null);
        setMeterDetection(null);
      } finally {
        setIsAnalyzing(false);
      }
    }, ANALYSIS_DEBOUNCE_MS);
  }, []);

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
    isReady: Boolean(deepEngineRef.current),

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
