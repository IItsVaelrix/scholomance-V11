import { useEffect, useMemo } from "react";
import { buildAnalyzedWordCollections } from "../lib/phonemeWordAnalysis.js";
import { usePanelAnalysis } from "./usePanelAnalysis.js";

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

function normalizeOptions(input) {
  if (typeof input === "string") {
    return {
      text: input,
      autoAnalyze: true,
    };
  }

  if (!input || typeof input !== "object") {
    return {
      text: "",
      autoAnalyze: true,
    };
  }

  return {
    text: typeof input.text === "string" ? input.text : String(input.text || ""),
    autoAnalyze: input.autoAnalyze !== false,
  };
}

export function PhonemeEngineProvider({ children }) {
  return children ?? null;
}

export function usePhonemeEngine(input = "") {
  const { text, autoAnalyze } = normalizeOptions(input);
  const panelAnalysis = usePanelAnalysis();
  const analyzeDocument = panelAnalysis.analyzeDocument;

  useEffect(() => {
    if (!autoAnalyze) return;
    analyzeDocument(text);
  }, [analyzeDocument, autoAnalyze, text]);

  const wordCollections = useMemo(
    () => buildAnalyzedWordCollections(panelAnalysis.analysis?.wordAnalyses),
    [panelAnalysis.analysis]
  );

  const vowelSummary = panelAnalysis.vowelSummary || EMPTY_VOWEL_SUMMARY;

  const engine = useMemo(() => ({
    analyzeDocument,
    analysis: panelAnalysis.analysis,
    source: panelAnalysis.source,
    vowelSummary,
    ...wordCollections,
  }), [
    analyzeDocument,
    panelAnalysis.analysis,
    panelAnalysis.source,
    vowelSummary,
    wordCollections,
  ]);

  return {
    isReady: true,
    error: panelAnalysis.error,
    engine,
    analysis: panelAnalysis.analysis,
    source: panelAnalysis.source,
    vowelSummary,
    analyzedWordList: wordCollections.analyzedWordList,
    analyzedWords: wordCollections.analyzedWords,
    analyzedWordsByIdentity: wordCollections.analyzedWordsByIdentity,
    analyzedWordsByCharStart: wordCollections.analyzedWordsByCharStart,
    analyzeDocument,
    isAnalyzing: panelAnalysis.isAnalyzing,
  };
}
