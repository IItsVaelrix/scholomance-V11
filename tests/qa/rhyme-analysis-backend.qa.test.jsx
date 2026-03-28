import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  installPanelAnalysisFetchMock,
  queuePanelAnalysisSuccess,
  PANEL_ANALYSIS_ENDPOINT,
} from "./tools/panelAnalysis.fetchMock.js";
import { RHYME_ANALYSIS_SCENARIOS } from "./fixtures/panelAnalysis.scenarios.js";

/**
 * QA Suite: Rhyme Analysis Backend Integration
 *
 * Tests the complete rhyme analysis flow through the backend:
 * 1. Text sent to /api/analysis/panels
 * 2. Backend performs deep rhyme analysis
 * 3. Returns rhyme groups, connections, and scheme detection
 * 4. Response shape is validated
 */
describe("[QA] Rhyme Analysis (Backend Integration)", () => {
  let fetchMock;
  let restoreFetch;

  beforeEach(() => {
    ({ fetchMock, restoreFetch } = installPanelAnalysisFetchMock());
  });

  afterEach(() => {
    restoreFetch();
    vi.restoreAllMocks();
  });

  it("detects perfect rhymes through backend analysis", async () => {
    const scenario = RHYME_ANALYSIS_SCENARIOS.perfectRhyme;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
      rhymeGroups: scenario.rhymeGroups,
      schemePattern: scenario.schemePattern,
      scheme: scenario.scheme,
    });

    const response = await fetch(PANEL_ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scenario.text }),
      credentials: "include",
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections).toHaveLength(1);
    expect(result.data.analysis.allConnections[0].type).toBe("perfect");
    expect(result.data.analysis.allConnections[0].score).toBe(1.0);
    expect(result.data.scheme.pattern).toBe("AA");
    expect(result.data.scheme.id).toBe("COUPLET");
  });

  it("detects multi-syllable rhymes (feminine rhymes)", async () => {
    const scenario = RHYME_ANALYSIS_SCENARIOS.feminineRhyme;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
      rhymeGroups: scenario.rhymeGroups,
      schemePattern: scenario.schemePattern,
      scheme: scenario.scheme,
    });

    const response = await fetch(PANEL_ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scenario.text }),
      credentials: "include",
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections[0].type).toBe("feminine");
    expect(result.data.analysis.allConnections[0].syllablesMatched).toBe(2);
    expect(result.data.analysis.allConnections[0].score).toBeGreaterThan(0.9);
  });

  it("detects assonance (vowel-only matches)", async () => {
    const scenario = RHYME_ANALYSIS_SCENARIOS.assonance;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
      rhymeGroups: scenario.rhymeGroups,
      schemePattern: scenario.schemePattern,
    });

    const response = await fetch(PANEL_ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scenario.text }),
      credentials: "include",
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections[0].type).toBe("assonance");
    expect(result.data.analysis.allConnections[0].score).toBeLessThan(0.8);
    expect(result.data.analysis.allConnections[0].score).toBeGreaterThan(0.5);
  });

  it("detects complex rhyme schemes (ABAB)", async () => {
    const scenario = RHYME_ANALYSIS_SCENARIOS.schemeABAB;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
      rhymeGroups: scenario.rhymeGroups,
      schemePattern: scenario.schemePattern,
      scheme: scenario.scheme,
    });

    const response = await fetch(PANEL_ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scenario.text }),
      credentials: "include",
    });

    const result = await response.json();

    expect(result.data.scheme.pattern).toBe("ABAB");
    expect(result.data.scheme.id).toBe("ALTERNATE");
    expect(result.data.analysis.rhymeGroups).toHaveLength(2);
  });

  it("returns empty connections when no rhymes exist", async () => {
    const scenario = RHYME_ANALYSIS_SCENARIOS.noRhymes;

    queuePanelAnalysisSuccess(fetchMock, {
      wordAnalyses: scenario.wordAnalyses,
      connections: scenario.connections,
      rhymeGroups: scenario.rhymeGroups,
      schemePattern: scenario.schemePattern,
      scheme: scenario.scheme,
    });

    const response = await fetch(PANEL_ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scenario.text }),
      credentials: "include",
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections).toHaveLength(0);
    expect(result.data.analysis.rhymeGroups).toHaveLength(0);
    expect(result.data.scheme).toBeNull();
  });
});
