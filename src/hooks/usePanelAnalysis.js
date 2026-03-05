import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { isComplexScheme, detectScheme, analyzeMeter } from "../lib/rhymeScheme.detector.js";
import { normalizeVowelFamily } from "../lib/phonology/vowelFamily.js";
import { DeepRhymeEngine } from "../lib/deepRhyme.engine.js";
import { parseBooleanEnvFlag } from "./useCODExPipeline.jsx";

const ANALYSIS_DEBOUNCE_MS = 2500;
const REQUEST_TIMEOUT_MS = 15000;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const USE_SERVER_PANEL_ANALYSIS = parseBooleanEnvFlag(import.meta.env.VITE_USE_SERVER_PANEL_ANALYSIS, true);

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

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

function normalizeHhmStageWeights(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const stages = ["SYNTAX", "PREDICTOR", "SPELLCHECK", "JUDICIARY", "PHONEME", "HEURISTICS", "METER"];
  const normalized = {};
  let hasValue = false;
  stages.forEach((stage) => {
    const numeric = Number(value?.[stage]);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    normalized[stage] = numeric;
    hasValue = true;
  });
  return hasValue ? normalized : null;
}

function normalizeHhmStageScores(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const scores = {};
  let hasValue = false;
  Object.entries(value).forEach(([stage, score]) => {
    if (!score || typeof score !== "object") return;
    const signal = Number(score.signal);
    const weight = Number(score.weight);
    const weighted = Number(score.weighted);
    const order = Number(score.order);
    scores[stage] = {
      order: Number.isFinite(order) ? order : 0,
      signal: Number.isFinite(signal) ? signal : 0,
      weight: Number.isFinite(weight) ? weight : 0,
      weighted: Number.isFinite(weighted) ? weighted : 0,
    };
    hasValue = true;
  });
  return hasValue ? scores : null;
}

function normalizeHhmSources(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((source) => {
      if (!source || typeof source !== "object") return null;
      return {
        id: String(source.id || ""),
        name: String(source.name || ""),
        linked: Boolean(source.linked),
        priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : null,
      };
    })
    .filter(Boolean);
}

function normalizeHhmToken(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const tokenWeight = Number(value.tokenWeight);
  return {
    model: String(value.model || "hidden_harkov_model"),
    stanzaIndex: Number.isFinite(Number(value.stanzaIndex)) ? Number(value.stanzaIndex) : -1,
    stanzaBar: Number.isFinite(Number(value.stanzaBar)) ? Number(value.stanzaBar) : -1,
    hiddenState: String(value.hiddenState || "flow"),
    tokenWeight: Number.isFinite(tokenWeight) ? tokenWeight : 1,
    logicOrder: Array.isArray(value.logicOrder) ? value.logicOrder.map((entry) => String(entry)) : [],
    stageWeights: normalizeHhmStageWeights(value.stageWeights),
    stageScores: normalizeHhmStageScores(value.stageScores),
    dictionarySources: normalizeHhmSources(value.dictionarySources),
  };
}

function normalizeHhmSummary(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    enabled: Boolean(value.enabled),
    model: String(value.model || "hidden_harkov_model"),
    stanzaSizeBars: Number.isFinite(Number(value.stanzaSizeBars)) ? Number(value.stanzaSizeBars) : 4,
    stanzaCount: Number.isFinite(Number(value.stanzaCount)) ? Number(value.stanzaCount) : 0,
    tokenCount: Number.isFinite(Number(value.tokenCount)) ? Number(value.tokenCount) : 0,
    logicOrder: Array.isArray(value.logicOrder) ? value.logicOrder.map((entry) => String(entry)) : [],
    stageWeights: normalizeHhmStageWeights(value.stageWeights),
    contextAware: Boolean(value.contextAware),
    dictionarySources: normalizeHhmSources(value.dictionarySources),
    stanzas: Array.isArray(value.stanzas) ? value.stanzas : [],
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
          hhm: normalizeHhmToken(token?.hhm),
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
    hhm: normalizeHhmSummary(value.hhm),
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
    genreProfile: payload.genreProfile || null,
    source: rawPayload?.source ?? payload.source ?? null,
  };
}

const clientEngine = new DeepRhymeEngine();

function buildVowelSummaryFromAnalysis(analysis) {
  if (!analysis?.lines) return EMPTY_VOWEL_SUMMARY;
  const familyCounts = new Map();
  let totalWords = 0;
  for (const line of analysis.lines) {
    const words = line.words || [];
    for (const word of words) {
      if (!word.vowelFamily) continue;
      const normalized = normalizeVowelFamily(word.vowelFamily);
      if (!normalized) continue;
      familyCounts.set(normalized, (familyCounts.get(normalized) || 0) + 1);
      totalWords++;
    }
  }
  const families = Array.from(familyCounts.entries())
    .map(([id, count]) => ({ id, count, percent: totalWords > 0 ? count / totalWords : 0 }))
    .sort((a, b) => b.count - a.count);
  return { families, totalWords, uniqueWords: familyCounts.size };
}

async function runClientSideAnalysis(text) {
  const analysis = await clientEngine.analyzeDocument(text);

  // Flatten lines[].words[] into wordAnalyses for the normalization pipeline.
  // The DeepRhymeEngine returns word data nested inside lines, but the panel
  // payload expects a flat wordAnalyses array with vowelFamily/syllableCount
  // lifted from each word's `analysis` sub-object.
  const wordAnalyses = [];
  const lineSyllableCounts = [];
  if (Array.isArray(analysis.lines)) {
    for (const line of analysis.lines) {
      lineSyllableCounts.push(Number(line.syllableTotal) || 0);
      if (!Array.isArray(line.words)) continue;
      for (const w of line.words) {
        const a = w.analysis;
        const st = w.syntaxToken;
        wordAnalyses.push({
          word: w.word,
          normalizedWord: (w.word || "").toUpperCase(),
          lineIndex: w.lineIndex,
          wordIndex: w.wordIndex,
          charStart: w.charStart,
          charEnd: w.charEnd,
          vowelFamily: a?.vowelFamily || null,
          syllableCount: a?.syllableCount || 0,
          rhymeKey: a?.rhymeKey || null,
          stressPattern: a?.stressPattern || "",
          role: st?.role || "content",
          lineRole: st?.lineRole || "line_mid",
          stressRole: st?.stressRole || "unknown",
          rhymePolicy: st?.rhymePolicy || "allow",
        });
      }
    }
  }
  analysis.wordAnalyses = wordAnalyses;
  analysis.lineSyllableCounts = lineSyllableCounts;

  const scheme = detectScheme(analysis.schemePattern, analysis.rhymeGroups);
  const meter = analyzeMeter(analysis.lines);
  const vowelSummary = buildVowelSummaryFromAnalysis(analysis);
  return {
    data: {
      analysis,
      scheme,
      meter,
      literaryDevices: [],
      emotion: "Neutral",
      scoreData: null,
      genreProfile: null,
      vowelSummary,
    },
    source: "client",
  };
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
  const [genreProfile, setGenreProfile] = useState(null);

  const debounceTimerRef = useRef(null);
  const lastTextRef = useRef(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const lastRequestTimeRef = useRef(0);
  const isPendingRef = useRef(false);

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
    setGenreProfile(null);
    setSource(null);
    setError(null);
    setIsAnalyzing(false);
    isPendingRef.current = false;
  }, []);

  const applyResultIfCurrent = useCallback((requestId, result) => {
    if (requestId !== requestIdRef.current) {
      return;
    }

    const normalized = normalizePanelPayload(result);
    const nextAnalysis = normalized.analysis;
    const allConnections = Array.isArray(nextAnalysis?.allConnections) ? nextAnalysis.allConnections : [];

    setAnalysis(nextAnalysis);
    setSchemeDetection(normalized.scheme);
    setMeterDetection(normalized.meter);
    setScoreData(normalized.scoreData);
    setVowelSummary(normalized.vowelSummary);
    setActiveConnections(allConnections);
    setHighlightedGroup(null);
    setLiteraryDevices(normalized.literaryDevices);
    setEmotion(normalized.emotion);
    setGenreProfile(normalized.genreProfile);
    setSource(normalized.source);
    setError(null);
    setIsAnalyzing(false);
    isPendingRef.current = false;
  }, []);

  const analyzeDocument = useCallback((text) => {
    const nextText = typeof text === "string" ? text : String(text || "");
    const trimmedText = nextText.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!trimmedText) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      lastTextRef.current = null;
      requestIdRef.current += 1;
      resetAnalysisState();
      return;
    }

    if (!USE_SERVER_PANEL_ANALYSIS) {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsAnalyzing(true);
      runClientSideAnalysis(trimmedText)
        .then((result) => applyResultIfCurrent(requestId, result))
        .catch(() => {
          setIsAnalyzing(false);
          setError("Client-side analysis failed");
        });
      return;
    }

    if (nextText === lastTextRef.current && !isPendingRef.current && analysis) {
      return;
    }
    const isActuallyNewText = nextText !== lastTextRef.current;
    lastTextRef.current = nextText;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    console.log(`[usePanelAnalysis] analyzeDocument triggered for requestId: ${requestId}, text: "${nextText.slice(0, 20)}..."`);

    setIsAnalyzing(true);
    if (isActuallyNewText) {
        setError(null);
    }
    isPendingRef.current = true;

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      lastRequestTimeRef.current = Date.now();

      let didTimeout = false;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(getPanelAnalysisEndpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: nextText }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Analysis failed (${response.status})`);
        }

        const payload = await response.json();
        applyResultIfCurrent(requestId, payload);
      } catch (analysisError) {
        if (requestId !== requestIdRef.current) return;

        if (analysisError?.name === "AbortError") {
          if (didTimeout) {
            setError("Analysis timed out");
            setIsAnalyzing(false);
            isPendingRef.current = false;
          }
          return;
        }

        // Attempt client-side fallback on server failure
        try {
          const fallback = await runClientSideAnalysis(nextText);
          applyResultIfCurrent(requestId, fallback);
          // Only show error if we didn't get any result yet
          if (!analysis) {
            setError("Server unavailable — using local analysis");
          }
        } catch {
          setError(analysisError.message || "Analysis failed");
          setIsAnalyzing(false);
          isPendingRef.current = false;
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }, ANALYSIS_DEBOUNCE_MS);
  }, [applyResultIfCurrent, resetAnalysisState, analysis]);

  const highlightRhymeGroup = useCallback((groupLabel) => {
    if (!analysis) return;

    const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
    const connections = allConnections.filter(
      (connection) => connection.groupLabel === groupLabel
    );
    setActiveConnections(connections);
    setHighlightedGroup(groupLabel);
  }, [analysis]);

  const clearHighlight = useCallback(() => {
    if (analysis) {
      const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
      setActiveConnections(allConnections);
    } else {
      setActiveConnections([]);
    }
    setHighlightedGroup(null);
  }, [analysis]);

  const getConnectionsForLine = useCallback((lineIndex) => {
    if (!analysis) return [];
    const allConnections = Array.isArray(analysis.allConnections) ? analysis.allConnections : [];
    return allConnections.filter(
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      requestIdRef.current += 1;
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
    genreProfile,
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
