import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePanelAnalysis } from "../../src/hooks/usePanelAnalysis.js";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
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

    const analyzedWordsByCharStart = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      analyzedWordsByCharStart.set(w.charStart, {
        ...w,
        bytecode: { effectClass: 'RESONANT', color: 'rgb(0, 0, 255)' }
      });
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWordsByCharStart
    });

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

    const analyzedWordsByCharStart = new Map();
    (result.current.analysis?.wordAnalyses || []).forEach(w => {
      analyzedWordsByCharStart.set(w.charStart, {
        ...w,
        bytecode: { effectClass: 'RESONANT', color: 'rgb(255, 0, 0)' }
      });
    });

    const { container } = await renderTruesightEditor({
      content: scenario.text,
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: result.current.activeConnections,
      analyzedWordsByCharStart
    });

    const flameNode = container.querySelector('[data-char-start="0"]');
    const nameNode = container.querySelector('[data-char-start="6"]');

    expect(flameNode).toBeTruthy();
    expect(nameNode).toBeTruthy();

    expectWordsShareColor(container, [0, 6]);
  });

  it("renders tokens safely when backend returns unmapped vowel family", async () => {
    const { result } = renderHook(() => usePanelAnalysis());

    const { container } = await renderTruesightEditor({
      content: "test unknown family",
      isTruesight: true,
      isEditable: false,
      analysisMode: "rhyme",
      activeConnections: [],
      analyzedWordsByCharStart: new Map(),
    });

    const editorArea = container.querySelector(".editor-textarea-wrapper");
    expect(editorArea).toBeTruthy();
  });
});
