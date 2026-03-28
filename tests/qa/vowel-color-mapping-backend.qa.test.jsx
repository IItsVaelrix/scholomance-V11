import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../src/hooks/usePanelAnalysis.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
  queuePanelAnalysisFailure,
} from "./tools/panelAnalysis.fetchMock.js";
import { VOWEL_COLOR_SCENARIOS } from "./fixtures/panelAnalysis.scenarios.js";
import {
  flushAnalysisCycle,
  useFakeClock,
  restoreClock,
} from "./tools/qa.clock.js";
import {
  expectWordsShareColor,
} from "./tools/truesight.assertions.js";
import { renderTruesightEditor } from "./tools/truesight.renderHarness.jsx";

/**
 * QA Suite: Vowel Family Color Mapping with Backend Analysis
 *
 * Tests that vowel families returned from the backend are correctly
 * mapped to school colors in the Truesight overlay.
 *
 * Strategy: renderHook tests verify the data pipeline,
 * then render harness tests verify the visual output.
 */
describe("[QA] Vowel Family Color Mapping (Backend-Driven)", () => {
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

  it("maps same vowel family words to matching school colors", async () => {
    const scenario = VOWEL_COLOR_SCENARIOS.owFamily;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
    });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    // Verify hook received data
    expect(result.current.source).toBe("server-analysis");
    expect(result.current.error).toBe(null);

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

    // Both OW-family words should share the same color
    const soulNode = container.querySelector('[data-char-start="0"]');
    const holeNode = container.querySelector('[data-char-start="5"]');

    expect(soulNode).toBeTruthy();
    expect(holeNode).toBeTruthy();

    expectWordsShareColor(container, [0, 5]);
  });

  it("keeps same-family words color matched on cache-hit responses", async () => {
    const scenario = VOWEL_COLOR_SCENARIOS.eyFamily;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
    }, { cache: "HIT" });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    // Verify hook received data
    expect(result.current.source).toBe("server-analysis");

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

    const flameNode = container.querySelector('[data-char-start="0"]');
    const nameNode = container.querySelector('[data-char-start="6"]');

    expect(flameNode).toBeTruthy();
    expect(nameNode).toBeTruthy();

    expectWordsShareColor(container, [0, 6]);
  });

  it("renders tokens safely when backend returns unmapped vowel family", async () => {
    queuePanelAnalysisFailure(fetchMock, {
      status: 400,
      message: "Unknown vowel family",
    });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument("test unknown family");
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
      content: "test unknown family",
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: [],
      analyzedWords: new Map(),
    });

    // Editor should remain functional
    const editorArea = container.querySelector("textarea, [contenteditable], .scroll-editor-content");
    expect(editorArea).toBeTruthy();
  });
});