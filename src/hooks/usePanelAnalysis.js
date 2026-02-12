import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { DeepRhymeEngine } from "../lib/deepRhyme.engine.js";
import { isComplexScheme, detectScheme, analyzeMeter } from "../lib/rhymeScheme.detector.js";
import { analyzeLiteraryDevices, detectEmotion } from "../lib/literaryDevices.detector.js";
import { analyzeText } from "../../codex/core/analysis.pipeline.js";
import { createScoringEngine } from "../../codex/core/scoring.engine.js";

import { alliterationDensityHeuristic } from "../../codex/core/heuristics/alliteration_density.js";
import { literaryDeviceRichnessHeuristic } from "../../codex/core/heuristics/literary_device_richness.js";
import { meterRegularityHeuristic } from "../../codex/core/heuristics/meter_regularity.js";
import { phonemeDensityHeuristic } from "../../codex/core/heuristics/phoneme_density.js";
import { rhymeQualityHeuristic } from "../../codex/core/heuristics/rhyme_quality.js";
import { vocabularyRichnessHeuristic } from "../../codex/core/heuristics/vocabulary_richness.js";

const ANALYSIS_DEBOUNCE_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;

const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);

const USE_SERVER_PANEL_ANALYSIS = parseBooleanFlag(import.meta.env.VITE_USE_SERVER_PANEL_ANALYSIS, true);
const ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK,
  true
);

const SCORE_HEURISTICS = [
  phonemeDensityHeuristic,
  alliterationDensityHeuristic,
  rhymeQualityHeuristic,
  meterRegularityHeuristic,
  literaryDeviceRichnessHeuristic,
  vocabularyRichnessHeuristic,
];

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

function parseBooleanFlag(rawValue, defaultValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return defaultValue;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function createScoreEngine() {
  const engine = createScoringEngine();
  SCORE_HEURISTICS.forEach((heuristicDef) => {
    engine.registerHeuristic({
      heuristic: heuristicDef.name,
      scorer: heuristicDef.scorer,
      weight: heuristicDef.weight,
    });
  });
  return engine;
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

function normalizeVowelSummary(value) {
  if (!value || typeof value !== "object") {
    return EMPTY_VOWEL_SUMMARY;
  }

  const families = Array.isArray(value.families)
    ? value.families
      .map((family) => {
        const id = String(family?.id || "").trim().toUpperCase();
        const count = Number(family?.count) || 0;
        const percent = Number(family?.percent) || 0;
        if (!id || count <= 0) return null;
        return { id, count, percent };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
    : [];

  return {
    families,
    totalWords: Number(value.totalWords) || 0,
    uniqueWords: Number(value.uniqueWords) || 0,
  };
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
      scoreData: null,
      vowelSummary: EMPTY_VOWEL_SUMMARY,
      source: rawPayload?.source ?? null,
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
    scoreData: payload.scoreData || null,
    vowelSummary: normalizeVowelSummary(payload.vowelSummary),
    source: rawPayload?.source ?? payload.source ?? null,
  };
}

async function analyzePanelsOnServer(text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/analysis/panels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Panel analysis request failed (${response.status})`);
    }

    const payload = await response.json();
    return normalizePanelPayload(payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Panel analysis timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildLocalVowelSummary(analyzedDoc) {
  if (!analyzedDoc || !Array.isArray(analyzedDoc.allWords)) {
    return EMPTY_VOWEL_SUMMARY;
  }

  const counts = new Map();
  const uniqueWords = new Set();

  analyzedDoc.allWords.forEach((word) => {
    const normalized = String(word?.normalized || "").trim().toUpperCase();
    if (normalized) uniqueWords.add(normalized);

    const familyId = String(word?.phonetics?.vowelFamily || "").trim().toUpperCase();
    if (!familyId) return;
    counts.set(familyId, (counts.get(familyId) || 0) + 1);
  });

  const totalWords = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const families = Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      count,
      percent: totalWords > 0 ? count / totalWords : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    families,
    totalWords,
    uniqueWords: uniqueWords.size,
  };
}

function analyzePanelsLocally(text, deepRhymeEngine, scoreEngine) {
  const analyzedDoc = analyzeText(text);
  const scoreData = scoreEngine.calculateScore(analyzedDoc);
  const deepAnalysis = deepRhymeEngine.analyzeDocument(text);
  const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
  const meter = analyzeMeter(deepAnalysis.lines);
  const literaryDevices = analyzeLiteraryDevices(text);
  const emotion = detectEmotion(text);

  return normalizePanelPayload({
    source: "local-runtime",
    data: {
      analysis: deepAnalysis,
      scheme,
      meter,
      literaryDevices,
      emotion,
      scoreData,
      vowelSummary: buildLocalVowelSummary(analyzedDoc),
    },
  });
}

export function usePanelAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [schemeDetection, setSchemeDetection] = useState(null);
  const [meterDetection, setMeterDetection] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [vowelSummary, setVowelSummary] = useState(EMPTY_VOWEL_SUMMARY);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeConnections, setActiveConnections] = useState([]);
  const [highlightedGroup, setHighlightedGroup] = useState(null);
  const [literaryDevices, setLiteraryDevices] = useState([]);
  const [emotion, setEmotion] = useState("Neutral");
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);
  const lastTextRef = useRef(null);
  const requestIdRef = useRef(0);
  const deepRhymeEngineRef = useRef(null);
  const scoreEngineRef = useRef(null);

  if (!deepRhymeEngineRef.current) {
    deepRhymeEngineRef.current = new DeepRhymeEngine();
  }
  if (!scoreEngineRef.current) {
    scoreEngineRef.current = createScoreEngine();
  }

  const resetAnalysisState = useCallback(() => {
    setAnalysis(null);
    setSchemeDetection(null);
    setMeterDetection(null);
    setScoreData(null);
    setVowelSummary(EMPTY_VOWEL_SUMMARY);
    setActiveConnections([]);
    setHighlightedGroup(null);
    setLiteraryDevices([]);
    setEmotion("Neutral");
    setSource(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  const applyResultIfCurrent = useCallback((requestId, result) => {
    if (requestId !== requestIdRef.current) {
      return;
    }

    const normalized = normalizePanelPayload(result);
    const nextAnalysis = normalized.analysis;

    setAnalysis(nextAnalysis);
    setSchemeDetection(normalized.scheme);
    setMeterDetection(normalized.meter);
    setScoreData(normalized.scoreData);
    setVowelSummary(normalized.vowelSummary);
    setActiveConnections(nextAnalysis?.allConnections || []);
    setLiteraryDevices(normalized.literaryDevices);
    setEmotion(normalized.emotion);
    setSource(normalized.source);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  const analyzeDocument = useCallback((text) => {
    const nextText = typeof text === "string" ? text : String(text || "");
    const trimmedText = nextText.trim();

    if (!trimmedText) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      lastTextRef.current = null;
      requestIdRef.current += 1;
      resetAnalysisState();
      return;
    }

    if (nextText === lastTextRef.current) {
      return;
    }
    lastTextRef.current = nextText;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setIsAnalyzing(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        let result = null;

        if (USE_SERVER_PANEL_ANALYSIS) {
          try {
            result = await analyzePanelsOnServer(nextText);
          } catch (serverError) {
            if (!ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK) {
              throw serverError;
            }
          }
        }

        if (!result) {
          result = analyzePanelsLocally(
            nextText,
            deepRhymeEngineRef.current,
            scoreEngineRef.current
          );
        }

        applyResultIfCurrent(requestId, result);
      } catch (analysisError) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const message = analysisError instanceof Error ? analysisError.message : "Panel analysis failed";
        setError(message);
        setIsAnalyzing(false);
      }
    }, ANALYSIS_DEBOUNCE_MS);
  }, [applyResultIfCurrent, resetAnalysisState]);

  const highlightRhymeGroup = useCallback((groupLabel) => {
    if (!analysis) return;

    const connections = analysis.allConnections.filter(
      (connection) => connection.groupLabel === groupLabel
    );
    setActiveConnections(connections);
    setHighlightedGroup(groupLabel);
  }, [analysis]);

  const clearHighlight = useCallback(() => {
    if (analysis) {
      setActiveConnections(analysis.allConnections);
    } else {
      setActiveConnections([]);
    }
    setHighlightedGroup(null);
  }, [analysis]);

  const getConnectionsForLine = useCallback((lineIndex) => {
    if (!analysis) return [];
    return analysis.allConnections.filter(
      (connection) =>
        connection.wordA.lineIndex === lineIndex ||
        connection.wordB.lineIndex === lineIndex
    );
  }, [analysis]);

  const hasComplexScheme = useMemo(() => {
    return schemeDetection ? isComplexScheme(schemeDetection.id) : false;
  }, [schemeDetection]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    analysis,
    schemeDetection,
    meterDetection,
    hasComplexScheme,
    literaryDevices,
    emotion,
    scoreData,
    vowelSummary,
    isAnalyzing,
    source,
    error,
    analyzeDocument,
    activeConnections,
    highlightedGroup,
    highlightRhymeGroup,
    clearHighlight,
    getConnectionsForLine,
  };
}
