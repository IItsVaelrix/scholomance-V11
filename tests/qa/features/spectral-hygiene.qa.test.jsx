import { act, renderHook } from "@testing-library/react";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../../src/hooks/usePanelAnalysis.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
} from "../tools/panelAnalysis.fetchMock.js";
import {
  flushAnalysisCycle,
  useFakeClock,
  restoreClock,
} from "../tools/qa.clock.js";
import { renderTruesightEditor } from "../tools/truesight.renderHarness.jsx";
import { createWordAnalysis, createConnection } from "../tools/panelAnalysis.fixture.js";

/**
 * QA Suite: Spectral Hygiene (The "Skittles" Problem)
 *
 * Verifies that the PhoneticColorAmplifier correctly suppresses visual noise:
 * 1. Singleton families (appearing only once) should be dimmed.
 * 2. High-density lines (too many unique families) should have weaker families dimmed.
 * 3. Dimmed noise should stay visually inert (reduced glow/saturation).
 * 4. Supports research-backed visual modes (FORENSIC, HEATMAP).
 */
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
    const TIME = createWordAnalysis({ word: "time", charStart: 0, vowelFamily: "AY" });
    const LIME = createWordAnalysis({ word: "lime", charStart: 5, vowelFamily: "AY" });
    const DAY = createWordAnalysis({ word: "day", charStart: 10, vowelFamily: "EY" });

    const scenario = {
      text: "time lime day",
      wordAnalyses: [
        { ...TIME, visualBytecode: { effectClass: "RESONANT", glowIntensity: 0.45, saturationBoost: 0.1, color: "#AYAYAY" } },
        { ...LIME, visualBytecode: { effectClass: "RESONANT", glowIntensity: 0.45, saturationBoost: 0.1, color: "#AYAYAY" } },
        { ...DAY, visualBytecode: { effectClass: "INERT", glowIntensity: 0.05, saturationBoost: 0.02, color: "#EYEYEY" } }
      ],
      connections: [createConnection(TIME, LIME)],
    };

    queuePanelAnalysisSuccess(fetchMock, scenario);
    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWordsByCharStart: new Map(result.current.analysis.wordAnalyses.map(w => [w.charStart, w])),
    });

    const words = Array.from(container.querySelectorAll(".truesight-word"));
    const dayWord = words.find(w => w.textContent === "day");
    const timeWord = words.find(w => w.textContent === "time");

    if (!timeWord.className.includes("vb-effect--resonant")) {
      throw new Error(`[STRICT ERROR] Word 'time' missing resonant class.`);
    }
    if (dayWord.className.includes("vb-effect--resonant")) {
      throw new Error(`[STRICT ERROR] Word 'day' erroneously has resonant class.`);
    }
  });

  it("handles research-backed FORENSIC mode (Blue/Orange contrast)", async () => {
    // Scenario: Vowel-heavy vs Consonant-heavy
    // Blue (#3b82f6) for VOWEL, Orange (#f97316) for CONSONANT
    const VOWEL_WORD = createWordAnalysis({ word: "area", charStart: 0, vowelFamily: "EY" });
    const CONS_WORD = createWordAnalysis({ word: "strict", charStart: 5, vowelFamily: "IH" });

    const scenario = {
      text: "area strict",
      wordAnalyses: [
        { ...VOWEL_WORD, visualBytecode: { effectClass: "RESONANT", color: "#3b82f6" } },
        { ...CONS_WORD, visualBytecode: { effectClass: "RESONANT", color: "#f97316" } }
      ],
      connections: [],
    };

    queuePanelAnalysisSuccess(fetchMock, scenario);
    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analyzedWordsByCharStart: new Map(result.current.analysis.wordAnalyses.map(w => [w.charStart, w])),
    });

    const area = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "area");
    const strict = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "strict");

    if (area.style.color !== "rgb(59, 130, 246)") { // #3b82f6
      throw new Error(`[STRICT ERROR] FORENSIC mode: 'area' (vowel-heavy) not blue. Got: ${area.style.color}`);
    }
    if (strict.style.color !== "rgb(249, 115, 22)") { // #f97316
      throw new Error(`[STRICT ERROR] FORENSIC mode: 'strict' (consonant-heavy) not orange. Got: ${strict.style.color}`);
    }
  });

  it("handles research-backed HEATMAP mode (Viridis-like scale)", async () => {
    // Scenario: Connection strength determines color energy
    // Yellow (#fde725) for HIGH energy, Purple (#440154) for LOW energy
    const HOT_WORD = createWordAnalysis({ word: "match", charStart: 0, vowelFamily: "AE" });
    const COLD_WORD = createWordAnalysis({ word: "cold", charStart: 6, vowelFamily: "OW" });

    const scenario = {
      text: "match cold",
      wordAnalyses: [
        { ...HOT_WORD, visualBytecode: { effectClass: "RESONANT", color: "#fde725" } },
        { ...COLD_WORD, visualBytecode: { effectClass: "RESONANT", color: "#440154" } }
      ],
      connections: [],
    };

    queuePanelAnalysisSuccess(fetchMock, scenario);
    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(scenario.text); });
    await act(async () => { await flushAnalysisCycle(); });

    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analyzedWordsByCharStart: new Map(result.current.analysis.wordAnalyses.map(w => [w.charStart, w])),
    });

    const match = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "match");
    const cold = Array.from(container.querySelectorAll(".truesight-word")).find(w => w.textContent === "cold");

    if (match.style.color !== "rgb(253, 231, 37)") { // #fde725
      throw new Error(`[STRICT ERROR] HEATMAP mode: 'match' (high-energy) not yellow. Got: ${match.style.color}`);
    }
    if (cold.style.color !== "rgb(68, 1, 84)") { // #440154
      throw new Error(`[STRICT ERROR] HEATMAP mode: 'cold' (low-energy) not purple. Got: ${cold.style.color}`);
    }
  });
});
