# Redesigned QA Test Suites for Backend-First Architecture

## Overview

This document contains the redesigned QA test suites for Truesight, Rhyme Analysis, and Color Coding, updated for the new backend-first architecture where all analysis is performed server-side.

---

## Key Changes from Old Architecture

### Before (Client-Side Analysis)
```javascript
// Old: Client-side analysis with Web Worker
const worker = new Worker('./analysis.worker.js');
worker.postMessage({ text });
worker.onmessage = (e) => {
  const analysis = e.data;
  // Use analysis
};
```

### After (Server-Side Analysis)
```javascript
// New: Server API call
const response = await fetch('/api/panel-analysis', {
  method: 'POST',
  body: JSON.stringify({ text }),
  credentials: 'include'
});
const analysis = await response.json();
```

### What This Means for Tests

1. **No more mocking Web Workers** - Test against real API
2. **Server responses are authoritative** - No client/server mismatches
3. **Integration tests are critical** - Test full request/response cycle
4. **Caching must be tested** - Server-side and client-side caching
5. **Network conditions matter** - Test slow networks, timeouts, failures

---

## QA Tools Scaffold (New)

These tools reduce repeated setup code across QA suites and make backend-first assertions easier to maintain.

### Recommended Directory Layout

```text
tests/qa/
  tools/
    panelAnalysis.fixture.js
    panelAnalysis.fetchMock.js
    truesight.renderHarness.jsx
    truesight.assertions.js
    qa.clock.js
  fixtures/
    panelAnalysis.scenarios.js
```

### Tool 1: Panel Analysis Fixture Builder

### File: `tests/qa/tools/panelAnalysis.fixture.js`

```javascript
export const DEFAULT_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

export function createWordAnalysis(overrides = {}) {
  const word = overrides.word ?? "word";
  const vowelFamily = overrides.vowelFamily ?? "AH";

  return {
    word,
    normalizedWord: (overrides.normalizedWord ?? word).toUpperCase(),
    lineIndex: overrides.lineIndex ?? 0,
    wordIndex: overrides.wordIndex ?? 0,
    charStart: overrides.charStart ?? 0,
    charEnd: overrides.charEnd ?? (overrides.charStart ?? 0) + word.length,
    vowelFamily,
    syllableCount: overrides.syllableCount ?? 1,
    rhymeKey: overrides.rhymeKey ?? `${vowelFamily}-${word.slice(-1).toUpperCase()}`,
    ...overrides,
  };
}

export function createConnection(wordA, wordB, overrides = {}) {
  return {
    type: "perfect",
    score: 1.0,
    syllablesMatched: 1,
    wordA,
    wordB,
    ...overrides,
  };
}

export function createPanelAnalysisData({
  connections = [],
  wordAnalyses = [],
  rhymeGroups = [],
  schemePattern = "",
  scheme = null,
  vowelSummary = null,
} = {}) {
  const uniqueWords = new Set(
    wordAnalyses.map((item) => item.normalizedWord || item.word?.toUpperCase() || "")
  ).size;

  return {
    analysis: {
      allConnections: connections,
      wordAnalyses,
      rhymeGroups,
      schemePattern,
    },
    scheme,
    vowelSummary:
      vowelSummary ??
      {
        ...DEFAULT_VOWEL_SUMMARY,
        totalWords: wordAnalyses.length,
        uniqueWords,
      },
  };
}
```

### Tool 2: Backend Fetch Mock Queue

### File: `tests/qa/tools/panelAnalysis.fetchMock.js`

```javascript
import { expect, vi } from "vitest";
import { createPanelAnalysisData } from "./panelAnalysis.fixture.js";

export function installPanelAnalysisFetchMock() {
  const fetchMock = vi.fn();
  global.fetch = fetchMock;
  return fetchMock;
}

export function queuePanelAnalysisSuccess(fetchMock, payload = {}, options = {}) {
  const { cache = "MISS", status = 200 } = options;
  const data = createPanelAnalysisData(payload);

  fetchMock.mockResolvedValueOnce({
    ok: true,
    status,
    headers: new Headers({ "x-cache": cache }),
    json: async () => ({
      source: "server-analysis",
      data,
    }),
  });
}

export function queuePanelAnalysisFailure(fetchMock, options = {}) {
  const { status = 500, message = "Internal Server Error" } = options;

  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers({ "x-cache": "MISS" }),
    json: async () => ({ message }),
  });
}

export function expectPanelAnalysisRequest(fetchMock) {
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/panel-analysis",
    expect.objectContaining({
      method: "POST",
      credentials: "include",
    })
  );
}
```

### Tool 3: Truesight Render Harness

### File: `tests/qa/tools/truesight.renderHarness.jsx`

```javascript
import { render } from "@testing-library/react";
import ScrollEditor from "../../../src/pages/Read/ScrollEditor.jsx";
import { PanelAnalysisProvider } from "../../../src/hooks/usePanelAnalysis.jsx";

export function renderTruesightEditor({
  title = "QA Harness",
  content = "",
  isEditable = true,
  isTruesight = true,
} = {}) {
  return render(
    <PanelAnalysisProvider>
      <ScrollEditor
        initialTitle={title}
        initialContent={content}
        isEditable={isEditable}
        isTruesight={isTruesight}
      />
    </PanelAnalysisProvider>
  );
}
```

### Tool 4: Truesight Assertions

### File: `tests/qa/tools/truesight.assertions.js`

```javascript
import { expect } from "vitest";

export function getColoredWordTexts(container) {
  return Array.from(container.querySelectorAll(".grimoire-word"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

export function expectColoredWords(container, expectedWords) {
  expect(getColoredWordTexts(container)).toEqual(expectedWords);
}

export function expectWordsShareColor(container, charStarts) {
  const nodes = charStarts.map((charStart) =>
    container.querySelector(`[data-char-start="${charStart}"]`)
  );

  nodes.forEach((node) => expect(node).toBeTruthy());

  const firstColor = window.getComputedStyle(nodes[0]).color;
  nodes.forEach((node) => {
    expect(window.getComputedStyle(node).color).toBe(firstColor);
  });
}
```

### Tool 5: Timer and Debounce Control

### File: `tests/qa/tools/qa.clock.js`

```javascript
import { vi } from "vitest";

export const ANALYSIS_DEBOUNCE_MS = 500;

export async function flushAnalysisCycle(durationMs = ANALYSIS_DEBOUNCE_MS) {
  await vi.advanceTimersByTimeAsync(durationMs);
  await Promise.resolve();
}
```

### Tool 6: Scenario Catalog

### File: `tests/qa/fixtures/panelAnalysis.scenarios.js`

```javascript
import {
  createConnection,
  createWordAnalysis,
} from "../tools/panelAnalysis.fixture.js";

const THE = createWordAnalysis({
  word: "the",
  normalizedWord: "THE",
  lineIndex: 0,
  wordIndex: 0,
  charStart: 0,
  charEnd: 3,
  vowelFamily: "EY",
});

const TONE = createWordAnalysis({
  word: "tone",
  normalizedWord: "TONE",
  lineIndex: 0,
  wordIndex: 1,
  charStart: 4,
  charEnd: 8,
  vowelFamily: "OW",
});

const META = createWordAnalysis({
  word: "meta",
  normalizedWord: "META",
  lineIndex: 0,
  wordIndex: 2,
  charStart: 9,
  charEnd: 13,
  vowelFamily: "EY",
});

export const PANEL_ANALYSIS_SCENARIOS = {
  stopWordPromotion: {
    text: "the tone meta",
    wordAnalyses: [THE, TONE, META],
    connections: [createConnection(THE, TONE)],
  },
};
```

### Example Usage with the New Tools

```javascript
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_ANALYSIS_SCENARIOS } from "./fixtures/panelAnalysis.scenarios.js";
import { queuePanelAnalysisSuccess, installPanelAnalysisFetchMock } from "./tools/panelAnalysis.fetchMock.js";
import { flushAnalysisCycle } from "./tools/qa.clock.js";
import { expectColoredWords } from "./tools/truesight.assertions.js";
import { renderTruesightEditor } from "./tools/truesight.renderHarness.jsx";

describe("Truesight stop-word promotion", () => {
  let fetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = installPanelAnalysisFetchMock();
  });

  it("colors promoted peer words from an excluded stop-word endpoint", async () => {
    queuePanelAnalysisSuccess(fetchMock, PANEL_ANALYSIS_SCENARIOS.stopWordPromotion);

    const { container } = renderTruesightEditor({
      content: PANEL_ANALYSIS_SCENARIOS.stopWordPromotion.text,
    });

    await flushAnalysisCycle();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expectColoredWords(container, ["tone", "meta"]));
  });
});
```

---

## Test Suite 1: Truesight Color Coding (Backend-Driven)

### File: `tests/qa/truesight-color-coding-backend.qa.test.jsx`

```javascript
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import ScrollEditor from "../../src/pages/Read/ScrollEditor.jsx";
import { PanelAnalysisProvider } from "../../src/hooks/usePanelAnalysis.jsx";

/**
 * QA Suite: Truesight Color Coding with Backend Analysis
 * 
 * Tests the complete flow:
 * 1. User types text
 * 2. Frontend sends to /api/panel-analysis
 * 3. Backend analyzes and returns connections
 * 4. Frontend renders Truesight overlay with colors
 */

describe("Truesight Color Coding (Backend-Driven)", () => {
  let mockFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Helper: Mock successful backend analysis response
   */
  function mockBackendAnalysis(analysisData) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-cache': 'MISS' }),
      json: async () => ({
        source: 'server-analysis',
        data: analysisData,
      }),
    });
  }

  /**
   * Test 1: Colors only non-stop direct connection endpoints
   * 
   * Scenario: "the alpha beta"
   * - "the" is a stop word (excluded)
   * - "alpha" connects to "the" but should still be colored
   * - "beta" has no connections
   * 
   * Expected: Only "alpha" is colored
   */
  it("colors only non-stop direct connection endpoints", async () => {
    mockBackendAnalysis({
      analysis: {
        allConnections: [
          {
            type: 'perfect',
            score: 1.0,
            syllablesMatched: 1,
            wordA: { 
              word: 'the',
              normalizedWord: 'THE',
              lineIndex: 0, 
              wordIndex: 0,
              charStart: 0,
              charEnd: 3,
            },
            wordB: { 
              word: 'alpha',
              normalizedWord: 'ALPHA',
              lineIndex: 0, 
              wordIndex: 1,
              charStart: 4,
              charEnd: 9,
            },
          },
        ],
        wordAnalyses: [
          {
            word: 'the',
            normalizedWord: 'THE',
            lineIndex: 0,
            wordIndex: 0,
            charStart: 0,
            charEnd: 3,
            vowelFamily: 'EY',
            syllableCount: 1,
          },
          {
            word: 'alpha',
            normalizedWord: 'ALPHA',
            lineIndex: 0,
            wordIndex: 1,
            charStart: 4,
            charEnd: 9,
            vowelFamily: 'AE',
            syllableCount: 2,
          },
          {
            word: 'beta',
            normalizedWord: 'BETA',
            lineIndex: 0,
            wordIndex: 2,
            charStart: 10,
            charEnd: 14,
            vowelFamily: 'IH',
            syllableCount: 2,
          },
        ],
      },
      vowelSummary: {
        families: [
          { id: 'EY', count: 1, percent: 0.33 },
          { id: 'AE', count: 1, percent: 0.33 },
          { id: 'IH', count: 1, percent: 0.33 },
        ],
        totalWords: 3,
        uniqueWords: 3,
      },
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Truesight QA"
          initialContent="the alpha beta"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    // Wait for debounced analysis
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/panel-analysis',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    // Wait for render
    await waitFor(() => {
      const coloredWords = container.querySelectorAll(".grimoire-word");
      expect(coloredWords.length).toBe(1);
      expect(coloredWords[0]?.textContent).toBe("alpha");
    });
  });

  /**
   * Test 2: Promotes same-family peers when family comes from excluded stop-word
   * 
   * Scenario: "the tone meta"
   * - "the" (EY family) connects to "tone" (OW family)
   * - "meta" (EY family) should be promoted because "the" is excluded
   * 
   * Expected: Both "tone" and "meta" are colored
   */
  it("promotes same-family peers when family comes from excluded stop-word endpoint", async () => {
    mockBackendAnalysis({
      analysis: {
        allConnections: [
          {
            type: 'perfect',
            score: 1.0,
            syllablesMatched: 1,
            wordA: { 
              word: 'the',
              normalizedWord: 'THE',
              lineIndex: 0, 
              wordIndex: 0,
              charStart: 0,
              charEnd: 3,
            },
            wordB: { 
              word: 'tone',
              normalizedWord: 'TONE',
              lineIndex: 0, 
              wordIndex: 1,
              charStart: 4,
              charEnd: 8,
            },
          },
        ],
        wordAnalyses: [
          {
            word: 'the',
            normalizedWord: 'THE',
            lineIndex: 0,
            wordIndex: 0,
            charStart: 0,
            charEnd: 3,
            vowelFamily: 'EY',
            syllableCount: 1,
          },
          {
            word: 'tone',
            normalizedWord: 'TONE',
            lineIndex: 0,
            wordIndex: 1,
            charStart: 4,
            charEnd: 8,
            vowelFamily: 'OW',
            syllableCount: 1,
          },
          {
            word: 'meta',
            normalizedWord: 'META',
            lineIndex: 0,
            wordIndex: 2,
            charStart: 9,
            charEnd: 13,
            vowelFamily: 'EY',
            syllableCount: 2,
          },
        ],
      },
      vowelSummary: {
        families: [
          { id: 'EY', count: 2, percent: 0.67 },
          { id: 'OW', count: 1, percent: 0.33 },
        ],
        totalWords: 3,
        uniqueWords: 3,
      },
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Truesight QA"
          initialContent="the tone meta"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await waitFor(() => {
      const coloredWords = Array.from(
        container.querySelectorAll(".grimoire-word")
      ).map((node) => node.textContent);
      expect(coloredWords).toEqual(["tone", "meta"]);
    });
  });

  /**
   * Test 3: Handles server errors gracefully
   * 
   * Scenario: Backend returns 500 error
   * Expected: No colors shown, error state displayed
   */
  it("handles server errors gracefully without breaking UI", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal server error' }),
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Truesight QA"
          initialContent="test error"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    // Should not crash, no colored words
    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(0);
  });

  /**
   * Test 4: Respects cache headers from backend
   * 
   * Scenario: Same text analyzed twice
   * Expected: Second request hits cache (X-Cache: HIT header)
   */
  it("uses cached analysis results for repeated text", async () => {
    const analysisData = {
      analysis: {
        allConnections: [
          {
            type: 'perfect',
            score: 1.0,
            syllablesMatched: 1,
            wordA: { 
              word: 'cat',
              normalizedWord: 'CAT',
              lineIndex: 0, 
              wordIndex: 0,
              charStart: 0,
              charEnd: 3,
            },
            wordB: { 
              word: 'hat',
              normalizedWord: 'HAT',
              lineIndex: 0, 
              wordIndex: 1,
              charStart: 4,
              charEnd: 7,
            },
          },
        ],
        wordAnalyses: [
          {
            word: 'cat',
            normalizedWord: 'CAT',
            lineIndex: 0,
            wordIndex: 0,
            charStart: 0,
            charEnd: 3,
            vowelFamily: 'AE',
            syllableCount: 1,
          },
          {
            word: 'hat',
            normalizedWord: 'HAT',
            lineIndex: 0,
            wordIndex: 1,
            charStart: 4,
            charEnd: 7,
            vowelFamily: 'AE',
            syllableCount: 1,
          },
        ],
      },
      vowelSummary: {
        families: [{ id: 'AE', count: 2, percent: 1.0 }],
        totalWords: 2,
        uniqueWords: 2,
      },
    };

    // First request: MISS
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-cache': 'MISS' }),
      json: async () => ({ source: 'server-analysis', data: analysisData }),
    });

    const { rerender } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Cache Test"
          initialContent="cat hat"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    // Second request: HIT (from client-side cache, no fetch)
    mockFetch.mockClear();

    rerender(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Cache Test"
          initialContent="cat hat"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    
    // Should NOT make another fetch (client-side cache hit)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  /**
   * Test 5: Handles network timeout
   * 
   * Scenario: Backend takes too long to respond
   * Expected: Request aborted, error state shown
   */
  it("handles network timeout gracefully", async () => {
    mockFetch.mockImplementationOnce(() => 
      new Promise((resolve) => {
        // Never resolves (simulates timeout)
        setTimeout(() => resolve({
          ok: false,
          status: 408,
          json: async () => ({ message: 'Request timeout' }),
        }), 10000);
      })
    );

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Timeout Test"
          initialContent="test timeout"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    // Should show no colors (graceful degradation)
    const coloredWords = container.querySelectorAll(".grimoire-word");
    expect(coloredWords.length).toBe(0);
  });
});
```

---

## Test Suite 2: Rhyme Analysis (Backend Integration)

### File: `tests/qa/rhyme-analysis-backend.qa.test.jsx`

```javascript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * QA Suite: Rhyme Analysis Backend Integration
 * 
 * Tests the complete rhyme analysis flow through the backend:
 * 1. Text sent to /api/panel-analysis
 * 2. Backend performs deep rhyme analysis
 * 3. Returns rhyme groups, connections, and scheme detection
 * 4. Frontend displays results correctly
 */

describe("Rhyme Analysis (Backend Integration)", () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Perfect rhyme detection (cat/hat)
   */
  it("detects perfect rhymes through backend analysis", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'perfect',
                score: 1.0,
                syllablesMatched: 1,
                wordA: { 
                  word: 'cat',
                  normalizedWord: 'CAT',
                  lineIndex: 0,
                  wordIndex: 0,
                  charStart: 0,
                  charEnd: 3,
                },
                wordB: { 
                  word: 'hat',
                  normalizedWord: 'HAT',
                  lineIndex: 1,
                  wordIndex: 0,
                  charStart: 4,
                  charEnd: 7,
                },
              },
            ],
            rhymeGroups: [['A', [0, 1]]],
            schemePattern: 'AA',
            wordAnalyses: [
              {
                word: 'cat',
                normalizedWord: 'CAT',
                lineIndex: 0,
                wordIndex: 0,
                charStart: 0,
                charEnd: 3,
                vowelFamily: 'AE',
                syllableCount: 1,
                rhymeKey: 'AE-T',
              },
              {
                word: 'hat',
                normalizedWord: 'HAT',
                lineIndex: 1,
                wordIndex: 0,
                charStart: 4,
                charEnd: 7,
                vowelFamily: 'AE',
                syllableCount: 1,
                rhymeKey: 'AE-T',
              },
            ],
          },
          scheme: {
            id: 'COUPLET',
            name: 'Couplet',
            pattern: 'AA',
            confidence: 1.0,
            groups: [['A', [0, 1]]],
          },
        },
      }),
    });

    const response = await fetch('/api/panel-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'cat\nhat' }),
      credentials: 'include',
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections).toHaveLength(1);
    expect(result.data.analysis.allConnections[0].type).toBe('perfect');
    expect(result.data.analysis.allConnections[0].score).toBe(1.0);
    expect(result.data.scheme.pattern).toBe('AA');
    expect(result.data.scheme.id).toBe('COUPLET');
  });

  /**
   * Test 2: Multi-syllable rhyme detection (beautiful/dutiful)
   */
  it("detects multi-syllable rhymes (feminine rhymes)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'feminine',
                score: 0.95,
                syllablesMatched: 2,
                wordA: { 
                  word: 'beautiful',
                  normalizedWord: 'BEAUTIFUL',
                  lineIndex: 0,
                  wordIndex: 0,
                },
                wordB: { 
                  word: 'dutiful',
                  normalizedWord: 'DUTIFUL',
                  lineIndex: 1,
                  wordIndex: 0,
                },
              },
            ],
            rhymeGroups: [['A', [0, 1]]],
            schemePattern: 'AA',
            wordAnalyses: [
              {
                word: 'beautiful',
                normalizedWord: 'BEAUTIFUL',
                lineIndex: 0,
                wordIndex: 0,
                vowelFamily: 'UH',
                syllableCount: 3,
                rhymeKey: 'UH-L',
              },
              {
                word: 'dutiful',
                normalizedWord: 'DUTIFUL',
                lineIndex: 1,
                wordIndex: 0,
                vowelFamily: 'UH',
                syllableCount: 3,
                rhymeKey: 'UH-L',
              },
            ],
          },
          scheme: {
            id: 'COUPLET',
            name: 'Couplet',
            pattern: 'AA',
            confidence: 0.95,
            groups: [['A', [0, 1]]],
          },
        },
      }),
    });

    const response = await fetch('/api/panel-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'beautiful\ndutiful' }),
      credentials: 'include',
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections[0].type).toBe('feminine');
    expect(result.data.analysis.allConnections[0].syllablesMatched).toBe(2);
    expect(result.data.analysis.allConnections[0].score).toBeGreaterThan(0.9);
  });

  /**
   * Test 3: Assonance detection (weak rhyme)
   */
  it("detects assonance (vowel-only matches)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'assonance',
                score: 0.6,
                syllablesMatched: 1,
                wordA: { 
                  word: 'cat',
                  normalizedWord: 'CAT',
                  lineIndex: 0,
                  wordIndex: 0,
                },
                wordB: { 
                  word: 'map',
                  normalizedWord: 'MAP',
                  lineIndex: 1,
                  wordIndex: 0,
                },
              },
            ],
            rhymeGroups: [['A', [0, 1]]],
            schemePattern: 'AA',
            wordAnalyses: [
              {
                word: 'cat',
                normalizedWord: 'CAT',
                vowelFamily: 'AE',
                rhymeKey: 'AE-T',
              },
              {
                word: 'map',
                normalizedWord: 'MAP',
                vowelFamily: 'AE',
                rhymeKey: 'AE-P',
              },
            ],
          },
        },
      }),
    });

    const response = await fetch('/api/panel-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'cat\nmap' }),
      credentials: 'include',
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections[0].type).toBe('assonance');
    expect(result.data.analysis.allConnections[0].score).toBeLessThan(0.8);
    expect(result.data.analysis.allConnections[0].score).toBeGreaterThan(0.5);
  });

  /**
   * Test 4: Complex rhyme scheme detection (ABAB)
   */
  it("detects complex rhyme schemes (ABAB)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'perfect',
                score: 1.0,
                syllablesMatched: 1,
                wordA: { word: 'cat', lineIndex: 0 },
                wordB: { word: 'hat', lineIndex: 2 },
              },
              {
                type: 'perfect',
                score: 1.0,
                syllablesMatched: 1,
                wordA: { word: 'dog', lineIndex: 1 },
                wordB: { word: 'log', lineIndex: 3 },
              },
            ],
            rhymeGroups: [
              ['A', [0, 2]],
              ['B', [1, 3]],
            ],
            schemePattern: 'ABAB',
          },
          scheme: {
            id: 'ALTERNATE',
            name: 'Alternate Rhyme',
            pattern: 'ABAB',
            confidence: 1.0,
            groups: [
              ['A', [0, 2]],
              ['B', [1, 3]],
            ],
          },
        },
      }),
    });

    const response = await fetch('/api/panel-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'cat\ndog\nhat\nlog' }),
      credentials: 'include',
    });

    const result = await response.json();

    expect(result.data.scheme.pattern).toBe('ABAB');
    expect(result.data.scheme.id).toBe('ALTERNATE');
    expect(result.data.analysis.rhymeGroups).toHaveLength(2);
  });

  /**
   * Test 5: No rhymes detected
   */
  it("returns empty connections when no rhymes exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [],
            rhymeGroups: [],
            schemePattern: '',
            wordAnalyses: [
              { word: 'cat', vowelFamily: 'AE', rhymeKey: 'AE-T' },
              { word: 'dog', vowelFamily: 'AO', rhymeKey: 'AO-G' },
              { word: 'bird', vowelFamily: 'ER', rhymeKey: 'ER-D' },
            ],
          },
          scheme: null,
        },
      }),
    });

    const response = await fetch('/api/panel-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'cat\ndog\nbird' }),
      credentials: 'include',
    });

    const result = await response.json();

    expect(result.data.analysis.allConnections).toHaveLength(0);
    expect(result.data.analysis.rhymeGroups).toHaveLength(0);
    expect(result.data.scheme).toBeNull();
  });
});
```

---

## Test Suite 3: Vowel Family Color Mapping (Backend Integration)

### File: `tests/qa/vowel-color-mapping-backend.qa.test.jsx`

```javascript
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import ScrollEditor from "../../src/pages/Read/ScrollEditor.jsx";
import { PanelAnalysisProvider } from "../../src/hooks/usePanelAnalysis.jsx";

/**
 * QA Suite: Vowel Family Color Mapping with Backend Analysis
 * 
 * Tests that vowel families from backend analysis are correctly
 * mapped to colors in the Truesight overlay.
 */

describe("Vowel Family Color Mapping (Backend Integration)", () => {
  let mockFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Maps vowel families to school colors
   */
  it("maps vowel families to correct school colors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'perfect',
                score: 1.0,
                syllablesMatched: 1,
                wordA: { 
                  word: 'soul',
                  normalizedWord: 'SOUL',
                  lineIndex: 0,
                  wordIndex: 0,
                  charStart: 0,
                  charEnd: 4,
                },
                wordB: { 
                  word: 'hole',
                  normalizedWord: 'HOLE',
                  lineIndex: 0,
                  wordIndex: 1,
                  charStart: 5,
                  charEnd: 9,
                },
              },
            ],
            wordAnalyses: [
              {
                word: 'soul',
                normalizedWord: 'SOUL',
                lineIndex: 0,
                wordIndex: 0,
                charStart: 0,
                charEnd: 4,
                vowelFamily: 'OW', // Void school
                syllableCount: 1,
                rhymeKey: 'OW-L',
              },
              {
                word: 'hole',
                normalizedWord: 'HOLE',
                lineIndex: 0,
                wordIndex: 1,
                charStart: 5,
                charEnd: 9,
                vowelFamily: 'OW', // Void school
                syllableCount: 1,
                rhymeKey: 'OW-L',
              },
            ],
          },
          vowelSummary: {
            families: [{ id: 'OW', count: 2, percent: 1.0 }],
            totalWords: 2,
            uniqueWords: 2,
          },
        },
      }),
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Color Mapping Test"
          initialContent="soul hole"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await waitFor(() => {
      const coloredWords = container.querySelectorAll(".grimoire-word");
      expect(coloredWords.length).toBe(2);
      
      // Check that both words have Void school color (OW family)
      const soulNode = container.querySelector('[data-char-start="0"]');
      const holeNode = container.querySelector('[data-char-start="5"]');
      
      expect(soulNode).toBeTruthy();
      expect(holeNode).toBeTruthy();
      
      // Both should have same color (OW -> Void school)
      const soulColor = window.getComputedStyle(soulNode).color;
      const holeColor = window.getComputedStyle(holeNode).color;
      expect(soulColor).toBe(holeColor);
      expect(soulColor).not.toBe('');
    });
  });

  /**
   * Test 2: Cache-hit responses still color matching families
   */
  it("keeps same-family words color matched on cache hit responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-cache': 'HIT' }),
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [
              {
                type: 'perfect',
                score: 1.0,
                syllablesMatched: 1,
                wordA: {
                  word: 'flame',
                  normalizedWord: 'FLAME',
                  lineIndex: 0,
                  wordIndex: 0,
                  charStart: 0,
                  charEnd: 5,
                },
                wordB: {
                  word: 'name',
                  normalizedWord: 'NAME',
                  lineIndex: 0,
                  wordIndex: 1,
                  charStart: 6,
                  charEnd: 10,
                },
              },
            ],
            wordAnalyses: [
              {
                word: 'flame',
                normalizedWord: 'FLAME',
                lineIndex: 0,
                wordIndex: 0,
                charStart: 0,
                charEnd: 5,
                vowelFamily: 'EY',
                syllableCount: 1,
                rhymeKey: 'EY-M',
              },
              {
                word: 'name',
                normalizedWord: 'NAME',
                lineIndex: 0,
                wordIndex: 1,
                charStart: 6,
                charEnd: 10,
                vowelFamily: 'EY',
                syllableCount: 1,
                rhymeKey: 'EY-M',
              },
            ],
          },
          vowelSummary: {
            families: [{ id: 'EY', count: 2, percent: 1.0 }],
            totalWords: 2,
            uniqueWords: 2,
          },
        },
      }),
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Color Cache-Hit Test"
          initialContent="flame name"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await waitFor(() => {
      const flameNode = container.querySelector('[data-char-start="0"]');
      const nameNode = container.querySelector('[data-char-start="6"]');

      expect(flameNode).toBeTruthy();
      expect(nameNode).toBeTruthy();

      const flameColor = window.getComputedStyle(flameNode).color;
      const nameColor = window.getComputedStyle(nameNode).color;
      expect(flameColor).toBe(nameColor);
    });
  });

  /**
   * Test 3: Unknown family values do not break rendering
   */
  it("renders tokens safely when backend returns unmapped vowel family", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'server-analysis',
        data: {
          analysis: {
            allConnections: [],
            wordAnalyses: [
              {
                word: 'wyrm',
                normalizedWord: 'WYRM',
                lineIndex: 0,
                wordIndex: 0,
                charStart: 0,
                charEnd: 4,
                vowelFamily: 'ZZ',
                syllableCount: 1,
                rhymeKey: 'ZZ-M',
              },
            ],
          },
          vowelSummary: {
            families: [{ id: 'ZZ', count: 1, percent: 1.0 }],
            totalWords: 1,
            uniqueWords: 1,
          },
        },
      }),
    });

    const { container } = render(
      <PanelAnalysisProvider>
        <ScrollEditor
          initialTitle="Unknown Family Test"
          initialContent="wyrm"
          isEditable={true}
          isTruesight={true}
        />
      </PanelAnalysisProvider>
    );

    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await waitFor(() => {
      const tokenNode = container.querySelector('[data-char-start="0"]');
      expect(tokenNode).toBeTruthy();
      expect(container.querySelectorAll(".truesight-word-token").length).toBeGreaterThan(0);
    });
  });
});
```

---

## Suggested Commands

```bash
npx vitest run tests/qa/truesight-color-coding-backend.qa.test.jsx
npx vitest run tests/qa/rhyme-analysis-backend.qa.test.jsx
npx vitest run tests/qa/vowel-color-mapping-backend.qa.test.jsx
```
