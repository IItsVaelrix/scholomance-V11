import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelAnalysis } from "../../src/hooks/usePanelAnalysis.js";
import { PANEL_ANALYSIS_SCENARIOS } from "./fixtures/panelAnalysis.scenarios.js";
import {
  expectPanelAnalysisRequest,
  installPanelAnalysisFetchMock,
  queuePanelAnalysisFailure,
  queuePanelAnalysisSuccess,
} from "./tools/panelAnalysis.fetchMock.js";
import { flushAnalysisCycle, restoreClock, useFakeClock } from "./tools/qa.clock.js";

describe("Panel analysis backend QA", () => {
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

  it("processes a successful backend response with shared QA fixtures", async () => {
    const scenario = PANEL_ANALYSIS_SCENARIOS.stopWordPromotion;
    queuePanelAnalysisSuccess(fetchMock, scenario, { cache: "MISS" });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectPanelAnalysisRequest(fetchMock, scenario.text);
    expect(result.current.source).toBe("server-analysis");
    expect(result.current.error).toBe(null);
    expect(result.current.analysis?.allConnections).toHaveLength(1);
    expect(result.current.analysis?.wordAnalyses).toHaveLength(3);
  });

  it("surfaces backend failures with shared fetch-mock helper", async () => {
    queuePanelAnalysisFailure(fetchMock, {
      status: 503,
      message: "temporarily unavailable",
    });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument("flame name");
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.analysis).toBe(null);
    expect(result.current.error).toBe("Panel analysis request failed (503)");
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectPanelAnalysisRequest(fetchMock, scenario.text);
  });
});
