import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { DeepRhymeEngine } from "../lib/deepRhyme.engine.js";
import { isComplexScheme, detectScheme, analyzeMeter } from "../lib/rhymeScheme.detector.js";
import { analyzeLiteraryDevices, detectEmotion } from "../lib/literaryDevices.detector.js";
import { normalizeVowelFamily } from "../lib/vowelFamily.js";
import { buildSyntaxLayer } from "../lib/syntax.layer.js";
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
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

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

const USE_SERVER_PANEL_ANALYSIS = parseBooleanFlag(import.meta.env.VITE_USE_SERVER_PANEL_ANALYSIS, true);
const ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK,
  true
);
const ENABLE_SYNTAX_RHYME_LAYER = parseBooleanFlag(import.meta.env.VITE_ENABLE_SYNTAX_RHYME_LAYER, false);

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

function getPrimaryStressedVowelFamily(analyzedWord) {
  const syllables = Array.isArray(analyzedWord?.deepPhonetics?.syllables)
    ? analyzedWord.deepPhonetics.syllables
    : [];
  const stressed = syllables.find((syllable) => Number(syllable?.stress) > 0) || syllables[0];
  const fallback = analyzedWord?.phonetics?.vowelFamily;
  return normalizeVowelFamily(stressed?.vowelFamily || fallback);
}

function buildAnalysisWordProfiles(analyzedDoc) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  const profiles = [];

  for (const line of lines) {
    const lineIndex = Number.isInteger(line?.number) ? line.number : 0;
    const words = Array.isArray(line?.words) ? line.words : [];
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const analyzedWord = words[wordIndex];
      profiles.push({
        word: String(analyzedWord?.text || ""),
        normalizedWord: String(analyzedWord?.normalized || "").toUpperCase(),
        lineIndex,
        wordIndex,
        charStart: Number.isInteger(analyzedWord?.start) ? analyzedWord.start : -1,
        charEnd: Number.isInteger(analyzedWord?.end) ? analyzedWord.end : -1,
        vowelFamily: getPrimaryStressedVowelFamily(analyzedWord) || null,
        syllableCount: Number(analyzedWord?.syllableCount) || 0,
        rhymeKey: analyzedWord?.deepPhonetics?.rhymeKey || analyzedWord?.phonetics?.rhymeKey || null,
      });
    }
  }

  return profiles;
}

function buildLineSyllableCounts(analyzedDoc) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  return lines.map((line) => Number(line?.syllableCount) || 0);
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

  const familyCounts = new Map();
  if (Array.isArray(value.families)) {
    value.families.forEach((family) => {
      const id = normalizeVowelFamily(family?.id);
      const count = Number(family?.count) || 0;
      if (!id || count <= 0) return;
      familyCounts.set(id, (familyCounts.get(id) || 0) + count);
    });
  }

  const totalWordsFromFamilies = Array.from(familyCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalWords = Number(value.totalWords) || totalWordsFromFamilies;
  const families = Array.from(familyCounts.entries())
    .map(([id, count]) => ({
      id,
      count,
      percent: totalWords > 0 ? count / totalWords : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    families,
    totalWords,
    uniqueWords: Number(value.uniqueWords) || 0,
  };
}

function normalizeSyntaxSummary(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const tokens = Array.isArray(value.tokens)
    ? value.tokens
      .map((token) => {
        const lineNumber = Number(token?.lineNumber);
        const wordIndex = Number(token?.wordIndex);
        const charStart = Number(token?.charStart);
        if (!Number.isInteger(lineNumber) || !Number.isInteger(wordIndex) || !Number.isInteger(charStart)) {
          return null;
        }
        return {
          word: String(token?.word || ""),
          normalized: String(token?.normalized || "").toLowerCase(),
          lineNumber,
          wordIndex,
          charStart,
          charEnd: Number.isInteger(Number(token?.charEnd)) ? Number(token?.charEnd) : -1,
          role: String(token?.role || "content"),
          lineRole: String(token?.lineRole || "line_mid"),
          stressRole: String(token?.stressRole || "unknown"),
          stem: String(token?.stem || ""),
          rhymePolicy: String(token?.rhymePolicy || "allow"),
          reasons: Array.isArray(token?.reasons) ? token.reasons.map((reason) => String(reason)) : [],
        };
      })
      .filter(Boolean)
    : [];

  const tokenByIdentity = new Map();
  const tokenByCharStart = new Map();
  tokens.forEach((token) => {
    const identity = `${token.lineNumber}:${token.wordIndex}:${token.charStart}`;
    tokenByIdentity.set(identity, token);
    tokenByCharStart.set(token.charStart, token);
  });

  return {
    enabled: Boolean(value.enabled),
    tokenCount: Number(value.tokenCount) || tokens.length,
    roleCounts: value.roleCounts || { content: 0, function: 0 },
    lineRoleCounts: value.lineRoleCounts || { line_start: 0, line_mid: 0, line_end: 0 },
    stressRoleCounts: value.stressRoleCounts || { primary: 0, secondary: 0, unstressed: 0, unknown: 0 },
    rhymePolicyCounts: value.rhymePolicyCounts || { allow: 0, allow_weak: 0, suppress: 0 },
    reasonCounts: value.reasonCounts || {},
    tokens,
    tokenByIdentity,
    tokenByCharStart,
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
      syntaxSummary: normalizeSyntaxSummary(payload.analysis.syntaxSummary),
      wordAnalyses: Array.isArray(payload.analysis.wordAnalyses) ? payload.analysis.wordAnalyses : [],
      lineSyllableCounts: Array.isArray(payload.analysis.lineSyllableCounts)
        ? payload.analysis.lineSyllableCounts.map((value) => Number(value) || 0)
        : [],
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

function buildLocalVowelSummary(analyzedDoc) {
  if (!analyzedDoc || !Array.isArray(analyzedDoc.allWords)) {
    return EMPTY_VOWEL_SUMMARY;
  }

  const counts = new Map();
  const uniqueWords = new Set();

  analyzedDoc.allWords.forEach((word) => {
    const normalized = String(word?.normalized || "").trim().toUpperCase();
    if (normalized) uniqueWords.add(normalized);

    const familyId = normalizeVowelFamily(word?.phonetics?.vowelFamily);
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
  const syntaxLayer = ENABLE_SYNTAX_RHYME_LAYER ? buildSyntaxLayer(analyzedDoc) : null;

  const deepAnalysis = deepRhymeEngine.analyzeDocument(
    text,
    syntaxLayer ? { syntaxLayer } : {}
  );
  const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
  const meter = analyzeMeter(deepAnalysis.lines);
  const literaryDevices = analyzeLiteraryDevices(text);
  const emotion = detectEmotion(text);

  return {
    source: "local-runtime",
    data: {
      analysis: {
        ...deepAnalysis,
        wordAnalyses: buildAnalysisWordProfiles(analyzedDoc),
        lineSyllableCounts: buildLineSyllableCounts(analyzedDoc),
      },
      scheme,
      meter,
      literaryDevices,
      emotion,
      scoreData,
      vowelSummary: buildLocalVowelSummary(analyzedDoc),
    },
  };
}

function getPanelAnalysisEndpoint() {
  return API_BASE_URL ? `${API_BASE_URL}/api/analysis/panels` : "/api/analysis/panels";
}

async function analyzePanelsOnServer(text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getPanelAnalysisEndpoint(), {
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
            result = analyzePanelsLocally(
              nextText,
              deepRhymeEngineRef.current,
              scoreEngineRef.current
            );
          }
        } else {
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
