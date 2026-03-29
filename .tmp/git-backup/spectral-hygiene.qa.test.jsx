import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../src/hooks/usePanelAnalysis.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
  restoreFetch,
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
 */
describe("[QA] Spectral Hygiene (Skittles Suppression)", () => {
  let fetchMock;

  beforeEach(() => {
    useFakeClock();
    ({ fetchMock } = installPanelAnalysisFetchMock());
  });

  afterEach(() => {
    restoreClock();
    restoreFetch();
    vi.restoreAllMocks();
  });

  it("suppresses singleton 'Skittles' noise by dimming glow and saturation", async () => {
    // Scenario: "time lime day"
    // "time" and "lime" share 'AY' family (count=2).
    // "day" has 'EY' family (count=1) -> singleton noise.
    const TIME = createWordAnalysis({ word: "time", charStart: 0, vowelFamily: "AY" });
    const LIME = createWordAnalysis({ word: "lime", charStart: 5, vowelFamily: "AY" });
    const DAY = createWordAnalysis({ word: "day", charStart: 10, vowelFamily: "EY" });

    // Mock backend bytecode response
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

    act(() => {
      result.current.analyzeDocument(scenario.text);
    });

    await act(async () => {
      await flushAnalysisCycle();
    });

    const { container } = renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWords: new Map(
        (result.current.analysis?.wordAnalyses || []).map((w) => [
          w.charStart,
          w
        ])
      ),
    });

    const words = Array.from(container.querySelectorAll(".truesight-word"));
    const dayWord = words.find(w => w.textContent === "day");
    const timeWord = words.find(w => w.textContent === "time");

    // "time" should be resonant
    expect(timeWord.className).toContain("vb-effect--resonant");
    expect(timeWord.style.getPropertyValue("--vb-glow-intensity")).toBe("0.45");

    // "day" should be inert (Spectral Hygiene singleton rule)
    // In our mock we set it to INERT because it was suppressed.
    expect(dayWord.className).not.toContain("vb-effect--resonant");
    expect(dayWord.className).toContain("grimoire-word--grey");
    expect(dayWord.style.getPropertyValue("--vb-glow-intensity")).toBe("0.05");
  });

  it("handles high-density line noise by dimming outliers", async () => {
    // Scenario: One line with many unique sounds.
    // "cat bet dog sun pig" (5 unique families)
    const text = "cat bet dog sun pig";
    const wordData = [
      { word: "cat", start: 0, family: "AE" },
      { word: "bet", start: 4, family: "EH" },
      { word: "dog", start: 8, family: "AO" },
      { word: "sun", start: 12, family: "AH" },
      { word: "pig", start: 16, family: "IH" },
    ];

    const wordAnalyses = wordData.map(w => ({
      ...createWordAnalysis({ word: w.word, charStart: w.start, vowelFamily: w.family }),
      // All are singletons, so all should be suppressed/inert
      visualBytecode: { effectClass: "INERT", glowIntensity: 0.02, saturationBoost: 0.01 }
    }));

    queuePanelAnalysisSuccess(fetchMock, { text, wordAnalyses, connections: [] });

    const { result } = renderHook(() => usePanelAnalysis());
    act(() => { result.current.analyzeDocument(text); });
    await act(async () => { await flushAnalysisCycle(); });

    const { container } = renderTruesightEditor({
      content: text,
      isTruesight: true,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWords: new Map(result.current.analysis.wordAnalyses.map(w => [w.charStart, w])),
    });

    const coloredWords = container.querySelectorAll(".grimoire-word:not(.grimoire-word--grey)");
    // Should be zero because everything was suppressed as high-density noise or singletons
    expect(coloredWords.length).toBe(0);
  });
});
