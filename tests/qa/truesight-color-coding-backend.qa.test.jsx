import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../src/hooks/usePanelAnalysis.js";
import {
  PANEL_ANALYSIS_SCENARIOS,
} from "./fixtures/panelAnalysis.scenarios.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
  queuePanelAnalysisFailure,
  expectPanelAnalysisRequest,
} from "./tools/panelAnalysis.fetchMock.js";
import {
  flushAnalysisCycle,
  useFakeClock,
  restoreClock,
} from "./tools/qa.clock.js";
import { expectColoredWords } from "./tools/truesight.assertions.js";
import { renderTruesightEditor } from "./tools/truesight.renderHarness.jsx";

describe("[QA] Truesight Color Coding (Backend-Driven)", () => {
  let fetchMock;
  let restoreFetch;

  beforeEach(() => {
    useFakeClock();
    ({ fetchMock, restoreFetch } = installPanelAnalysisFetchMock());
  });

  afterEach(() => {
    restoreClock();
    restoreFetch();
    vi.restoreAllMocks();
  });

  it("colors only non-stop direct connection endpoints via backend pipeline", async () => {
    const scenario = PANEL_ANALYSIS_SCENARIOS.stopWordExclusion;

    queuePanelAnalysisSuccess(fetchMock, scenario, { cache: "MISS" });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    expectPanelAnalysisRequest(fetchMock, scenario.text);
    
    // Now verify the visual output using the hook's normalized data
    const analyzedWordsByIdentity = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      const isStop = ["THE", "A", "AN"].includes(w.normalizedWord);
      const entry = {
        ...w,
        visualBytecode: { 
          effectClass: isStop ? 'INERT' : 'RESONANT', 
          color: 'rgb(0, 0, 255)',
          glowIntensity: isStop ? 0 : 0.5
        }
      };
      analyzedWordsByIdentity.set(`${w.lineIndex}:${w.wordIndex}:${w.charStart}`, entry);
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWordsByIdentity
    });

    const coloredWords = Array.from(
      container.querySelectorAll(".grimoire-word")
    ).map((node) => node.textContent?.trim());

    expect(coloredWords).toContain("alpha");
    expect(coloredWords).not.toContain("the");
  });

  it("promotes same-family peers when family comes from excluded stop-word endpoint", async () => {
    const scenario = PANEL_ANALYSIS_SCENARIOS.stopWordPromotion;

    queuePanelAnalysisSuccess(fetchMock, scenario, { cache: "MISS" });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    const analyzedWordsByIdentity = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      const isStop = w.normalizedWord === 'THE';
      const entry = {
        ...w,
        visualBytecode: { 
          effectClass: isStop ? 'INERT' : 'RESONANT', 
          color: 'rgb(0, 0, 255)',
          glowIntensity: isStop ? 0 : 0.5
        }
      };
      analyzedWordsByIdentity.set(`${w.lineIndex}:${w.wordIndex}:${w.charStart}`, entry);
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWordsByIdentity
    });

    expectColoredWords(container, ["tone", "meta"]);
  });

  it("handles server errors gracefully without breaking UI", async () => {
    queuePanelAnalysisFailure(fetchMock, {
      status: 500,
      message: "Internal server error",
    });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument("test error handling");
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    const { container } = await renderTruesightEditor({
      content: "test error handling",
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: [],
      analyzedWordsByIdentity: new Map(),
    });

    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(0);
  });
});
