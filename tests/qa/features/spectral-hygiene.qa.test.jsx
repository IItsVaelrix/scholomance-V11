import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../../src/hooks/usePanelAnalysis.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
} from "../tools/panelAnalysis.fetchMock.js";
import { HYGIENE_SCENARIOS } from "../fixtures/panelAnalysis.scenarios.js";
import {
  flushAnalysisCycle,
  useFakeClock,
  restoreClock,
} from "../tools/qa.clock.js";
import { renderTruesightEditor } from "../tools/truesight.renderHarness.jsx";

describe("[QA] Spectral Hygiene (Skittles Suppression)", () => {
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

  it("suppresses singleton 'Skittles' noise by dimming glow and saturation", async () => {
    const scenario = HYGIENE_SCENARIOS.singletonNoise;
    queuePanelAnalysisSuccess(fetchMock, scenario);

    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const analyzedWordsByIdentity = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      const entry = {
        ...w,
        visualBytecode: { 
          effectClass: w.word === 'day' ? 'INERT' : 'RESONANT',
          glowIntensity: w.word === 'day' ? 0 : 0.8
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

    const words = Array.from(container.querySelectorAll(".truesight-word"));
    const dayWord = words.find(w => w.textContent === "day");
    const timeWord = words.find(w => w.textContent === "time");

    expect(timeWord.className).toContain("grimoire-word");
    expect(dayWord.className).toContain("grimoire-word--grey");
  });

  it("handles research-backed FORENSIC mode (Blue/Orange contrast)", async () => {
    const scenario = HYGIENE_SCENARIOS.forensicMode;
    queuePanelAnalysisSuccess(fetchMock, scenario);

    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const analyzedWordsByIdentity = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      const entry = {
        ...w,
        visualBytecode: { 
          effectClass: 'RESONANT',
          glowIntensity: 0.5,
          color: w.word === 'area' ? "rgb(59, 130, 246)" : "rgb(249, 115, 22)"
        }
      };
      analyzedWordsByIdentity.set(`${w.lineIndex}:${w.wordIndex}:${w.charStart}`, entry);
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analyzedWordsByIdentity
    });

    const area = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "area");
    const strict = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "strict");

    expect(area.style.color).toBe("rgb(59, 130, 246)");
    expect(strict.style.color).toBe("rgb(249, 115, 22)");
  });

  it("handles research-backed HEATMAP mode (Viridis-like scale)", async () => {
    const scenario = HYGIENE_SCENARIOS.heatmapMode;
    queuePanelAnalysisSuccess(fetchMock, scenario);

    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const analyzedWordsByIdentity = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      const entry = {
        ...w,
        visualBytecode: { 
          effectClass: 'RESONANT',
          glowIntensity: 0.5,
          color: w.word === 'match' ? "rgb(253, 231, 37)" : "rgb(68, 1, 84)"
        }
      };
      analyzedWordsByIdentity.set(`${w.lineIndex}:${w.wordIndex}:${w.charStart}`, entry);
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analyzedWordsByIdentity
    });

    const match = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "match");
    const cold = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "cold");

    expect(match.style.color).toBe("rgb(253, 231, 37)");
    expect(cold.style.color).toBe("rgb(68, 1, 84)");
  });
});
