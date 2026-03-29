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
      analyzedWordsByCharStart: new Map(
        (result.current.analysis?.wordAnalyses || []).map((w) => [
          w.charStart,
          w
        ])
      ),
    });

    const words = Array.from(container.querySelectorAll(".truesight-word"));
    const dayWord = words.find(w => w.textContent === "day");
    const timeWord = words.find(w => w.textContent === "time");

    if (!timeWord) {
      throw new Error(`[STRICT ERROR] Word element 'time' not found in document.`);
    }
    if (!dayWord) {
      throw new Error(`[STRICT ERROR] Word element 'day' not found in document.`);
    }

    // "time" should be resonant
    if (!timeWord.className.includes("vb-effect--resonant")) {
      throw new Error(`[STRICT ERROR] Word 'time' missing resonant class. Received classes: "${timeWord.className}".`);
    }
    const timeGlow = timeWord.style.getPropertyValue("--vb-glow-intensity");
    if (timeGlow !== "0.45") {
      throw new Error(`[STRICT ERROR] Word 'time' has incorrect glow intensity. Received: "${timeGlow}". Expected: "0.45"`);
    }

    // "day" should be INERT (Spectral Hygiene singleton rule)
    if (dayWord.className.includes("vb-effect--resonant")) {
      throw new Error(`[STRICT ERROR] Word 'day' erroneously has resonant class. Bytecode was INERT.`);
    }
    if (!dayWord.className.includes("grimoire-word--grey")) {
      throw new Error(`[STRICT ERROR] Word 'day' missing 'grey' status class for INERT token. Received: "${dayWord.className}"`);
    }
    
    // INERT tokens should have NO glow custom property (fully suppressed)
    const dayGlow = dayWord.style.getPropertyValue("--vb-glow-intensity");
    if (dayGlow !== "") {
      throw new Error(`[STRICT ERROR] Word 'day' has active glow property despite being INERT noise. Received: "${dayGlow}"`);
    }
  });

  it("handles high-density line noise by dimming outliers", async () => {
    // Scenario: One line with many unique sounds.
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
      analyzedWordsByCharStart: new Map(result.current.analysis.wordAnalyses.map(w => [w.charStart, w])),
    });

    const words = Array.from(container.querySelectorAll(".truesight-word"));
    words.forEach(word => {
      if (word.className.includes("vb-effect--resonant") || word.className.includes("vb-effect--harmonic")) {
        throw new Error(`[STRICT ERROR] Word "${word.textContent}" has active effect class despite being high-density noise. Classes: "${word.className}"`);
      }
      if (!word.className.includes("grimoire-word--grey")) {
        throw new Error(`[STRICT ERROR] Word "${word.textContent}" missing 'grey' class for high-density noise.`);
      }
    });
  });
});
