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

/**
 * QA Suite: Truesight Color Coding with Backend Analysis
 *
 * Tests the complete backend-driven flow:
 * 1. usePanelAnalysis hook sends POST /api/analysis/panels
 * 2. Backend returns connections + word analyses
 * 3. Hook normalizes data into Maps for ScrollEditor props
 * 4. ScrollEditor renders Truesight overlay with colors
 *
 * Strategy: renderHook tests verify the data pipeline,
 * then render harness tests verify the visual output.
 */
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
    expect(result.current.source).toBe("server-analysis");
    expect(result.current.error).toBe(null);
    expect(result.current.analysis?.allConnections).toHaveLength(1);

    // Now verify the visual output using the hook's normalized data
    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWords: new Map(
        (result.current.analysis?.wordAnalyses || []).map((w) => [
          w.normalizedWord,
          { vowelFamily: w.vowelFamily, syllables: [{}] },
        ])
      ),
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

    expect(result.current.source).toBe("server-analysis");
    expect(result.current.analysis?.allConnections).toHaveLength(1);

    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWords: new Map(
        (result.current.analysis?.wordAnalyses || []).map((w) => [
          w.normalizedWord,
          { vowelFamily: w.vowelFamily, syllables: [{}] },
        ])
      ),
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

    // Use a longer timeout and waitFor to ensure the async fallback completes
    await vi.waitFor(() => {
      if (result.current.error === null) {
        // Still waiting for debounce or request
        vi.advanceTimersByTime(100);
        throw new Error("Waiting for error state");
      }
      expect(result.current.error).toBeTruthy();
    }, { timeout: 2000, interval: 50 });

    // Render with empty data — should not crash
    const { container } = renderTruesightEditor({
      content: "test error handling",
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: [],
      analyzedWords: new Map(),
    });

    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(0);
  });

  it("debounces rapid requests and sends only the latest payload", async () => {
    const scenario = PANEL_ANALYSIS_SCENARIOS.stopWordExclusion;
    queuePanelAnalysisSuccess(fetchMock, scenario, { cache: "HIT" });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument("first draft");
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    // Only the latest text should have been sent
    const analysisCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/analysis/panels")
    );
    expect(analysisCalls).toHaveLength(1);
    expectPanelAnalysisRequest(fetchMock, scenario.text);
  });

  it("uses cached analysis results for repeated text", async () => {
    const scenario = PANEL_ANALYSIS_SCENARIOS.stopWordPromotion;
    queuePanelAnalysisSuccess(fetchMock, scenario, { cache: "MISS" });

    const { result } = renderHook(() => usePanelAnalysis());

    // First analysis
    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    const firstCallCount = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/analysis/panels")
    ).length;
    expect(firstCallCount).toBe(1);
    expect(result.current.analysis?.allConnections).toHaveLength(1);

    // Second analysis with identical text — should use client-side cache
    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    const totalCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/analysis/panels")
    ).length;

    // Should not have made a second server request for identical text
    expect(totalCalls).toBe(1);
  });
});
