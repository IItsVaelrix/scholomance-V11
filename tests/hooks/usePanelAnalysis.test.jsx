import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('usePanelAnalysis hook', () => {
  const originalFetch = global.fetch;
  const originalWorker = global.Worker;

  beforeEach(() => {
    vi.useFakeTimers();
    global.Worker = undefined;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return {
          source: 'server-analysis',
          data: {
            analysis: {
              allConnections: [
                {
                  type: 'near',
                  score: 0.72,
                  wordA: { lineIndex: 0, wordIndex: 0, charStart: 0, word: 'Flame' },
                  wordB: { lineIndex: 0, wordIndex: 2, charStart: 10, word: 'Name' },
                  syntax: {
                    gate: 'allow_weak',
                    multiplier: 0.88,
                    reasons: ['contains_function_non_terminal'],
                  },
                },
              ],
              rhymeGroups: [['A', [0, 1]]],
              statistics: { totalLines: 2 },
              syntaxSummary: {
                enabled: true,
                tokenCount: 1,
                roleCounts: { content: 1, function: 0 },
                lineRoleCounts: { line_start: 1, line_mid: 0, line_end: 0 },
                stressRoleCounts: { primary: 1, secondary: 0, unstressed: 0, unknown: 0 },
                rhymePolicyCounts: { allow: 1, allow_weak: 0, suppress: 0 },
                reasonCounts: { content_default: 1 },
                hhm: {
                  enabled: true,
                  model: 'hidden_harkov_model',
                  stanzaSizeBars: 4,
                  stanzaCount: 1,
                  tokenCount: 1,
                  logicOrder: ['SYNTAX', 'PREDICTOR', 'SPELLCHECK', 'JUDICIARY', 'PHONEME', 'HEURISTICS', 'METER'],
                  stageWeights: {
                    SYNTAX: 0.27,
                    PREDICTOR: 0.14,
                    SPELLCHECK: 0.1,
                    JUDICIARY: 0.08,
                    PHONEME: 0.18,
                    HEURISTICS: 0.15,
                    METER: 0.08,
                  },
                  contextAware: true,
                  dictionarySources: [{ id: 'scholomance', name: 'Scholomance Dictionary', linked: true, priority: 1 }],
                  stanzas: [],
                },
                tokens: [
                  {
                    word: 'Flame',
                    normalized: 'flame',
                    lineNumber: 0,
                    wordIndex: 0,
                    charStart: 0,
                    charEnd: 5,
                    role: 'content',
                    lineRole: 'line_start',
                    stressRole: 'primary',
                    stem: 'flame',
                    rhymePolicy: 'allow',
                    reasons: ['content_default'],
                    hhm: {
                      model: 'hidden_harkov_model',
                      stanzaIndex: 0,
                      stanzaBar: 1,
                      hiddenState: 'stress_anchor',
                      tokenWeight: 0.92,
                      logicOrder: ['SYNTAX', 'PREDICTOR', 'SPELLCHECK', 'JUDICIARY', 'PHONEME', 'HEURISTICS', 'METER'],
                      stageWeights: {
                        SYNTAX: 0.27,
                        PREDICTOR: 0.14,
                        SPELLCHECK: 0.1,
                        JUDICIARY: 0.08,
                        PHONEME: 0.18,
                        HEURISTICS: 0.15,
                        METER: 0.08,
                      },
                      stageScores: {
                        SYNTAX: { order: 1, signal: 0.9, weight: 0.27, weighted: 0.243 },
                      },
                    },
                  },
                ],
              },
            },
            scheme: {
              id: 'COUPLET',
              name: 'Couplet',
              pattern: 'AA',
              confidence: 1,
              groups: [['A', [0, 1]]],
            },
            meter: null,
            literaryDevices: [],
            emotion: 'Neutral',
            scoreData: {
              totalScore: 77,
              traces: [],
              plsPhoneticFeatures: {
                rhymeAffinityScore: 0.82,
                constellationDensity: 0.61,
                internalRecurrenceScore: 0.44,
                phoneticNoveltyScore: 0.37,
              },
            },
            vowelSummary: {
              families: [{ id: 'AY', count: 2, percent: 1 }],
              totalWords: 2,
              uniqueWords: 2,
            },
            rhymeAstrology: {
              enabled: true,
              features: {
                rhymeAffinityScore: 0.82,
                constellationDensity: 0.61,
                internalRecurrenceScore: 0.44,
                phoneticNoveltyScore: 0.37,
              },
              inspector: {
                anchors: [
                  {
                    word: 'Flame',
                    normalizedWord: 'FLAME',
                    lineIndex: 0,
                    wordIndex: 0,
                    charStart: 0,
                    charEnd: 5,
                    sign: 'EY1M',
                    tokenId: 0,
                    activeWindowIds: [7],
                    compilerRef: {
                      tokenId: 0,
                      lineIndex: 0,
                      tokenIndexInLine: 0,
                      tokenSpan: [0, 0],
                      activeWindowIds: [7],
                      charStart: 0,
                      charEnd: 5,
                      syllableCount: 1,
                      stressPattern: '1',
                      rhymeTailSignature: 'EY1-M',
                      primaryStressedVowelFamily: 'EY',
                      terminalVowelFamily: 'EY',
                      isLineStart: true,
                      isLineEnd: false,
                    },
                    topMatches: [{ token: 'name', overallScore: 0.92 }],
                    constellations: [],
                    diagnostics: { queryTimeMs: 2.3, cacheHit: false, candidateCount: 12 },
                  },
                ],
                clusters: [
                  {
                    id: 'ey1m-a',
                    label: 'Burning Choir',
                    anchorWord: 'Flame',
                    sign: 'EY1M',
                    dominantVowelFamily: ['EY'],
                    dominantStressPattern: '1',
                    densityScore: 0.63,
                    cohesionScore: 0.71,
                    membersCount: 8,
                  },
                ],
                windows: [
                  {
                    id: 7,
                    lineIndex: 0,
                    lineSpan: [0, 0],
                    tokenIds: [0, 1],
                    tokenSpan: [0, 1],
                    charStart: 0,
                    charEnd: 10,
                    syllableLength: 2,
                    signature: '2:EY/EY:M/M:11',
                    stressContour: '11',
                    codaContour: 'M/M',
                    vowelSequence: ['EY', 'EY'],
                    occurrenceCount: 2,
                    repeated: true,
                    anchorTokenIds: [0],
                    anchorWords: ['FLAME'],
                  },
                ],
                spans: [
                  {
                    id: 'anchor:0',
                    kind: 'anchor_token',
                    lineIndex: 0,
                    charStart: 0,
                    charEnd: 5,
                    tokenIds: [0],
                    anchorTokenId: 0,
                    windowId: null,
                    label: 'Flame',
                    sign: 'EY1M',
                    clusterIds: ['ey1m-a'],
                  },
                ],
              },
              diagnostics: {
                anchorCount: 1,
                cacheHitCount: 0,
                averageQueryTimeMs: 2.3,
              },
            },
          },
        };
      },
    });
  });

  async function loadHook() {
    vi.resetModules();
    return (await import('../../src/hooks/usePanelAnalysis.js')).usePanelAnalysis;
  }

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.doUnmock('../../src/lib/workers/analysis.client.js');
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    global.Worker = originalWorker;
  });

  it('uses backend panel-analysis endpoint by default', async () => {
    const usePanelAnalysis = await loadHook();
    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/analysis/panels',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(result.current.source).toBe('server-analysis');
    expect(result.current.scoreData?.totalScore).toBe(77);
    expect(result.current.schemeDetection?.groups).toBeInstanceOf(Map);
    expect(result.current.analysis?.rhymeGroups).toBeInstanceOf(Map);
    expect(result.current.analysis?.syntaxSummary?.tokenByIdentity).toBeInstanceOf(Map);
    expect(result.current.analysis?.syntaxSummary?.hhm?.logicOrder).toEqual(['SYNTAX', 'PREDICTOR', 'SPELLCHECK', 'JUDICIARY', 'PHONEME', 'HEURISTICS', 'METER']);
    expect(result.current.analysis?.syntaxSummary?.tokens?.[0]?.hhm?.stanzaBar).toBe(1);
    expect(result.current.analysis?.allConnections?.[0]?.syntax?.gate).toBe('allow_weak');
    expect(result.current.scoreData?.plsPhoneticFeatures?.rhymeAffinityScore).toBe(0.82);
    expect(result.current.rhymeAstrology?.enabled).toBe(true);
    expect(result.current.rhymeAstrology?.inspector?.anchors?.[0]?.sign).toBe('EY1M');
    expect(result.current.rhymeAstrology?.inspector?.anchors?.[0]?.compilerRef?.tokenId).toBe(0);
    expect(result.current.rhymeAstrology?.inspector?.windows?.[0]?.signature).toBe('2:EY/EY:M/M:11');
    expect(result.current.rhymeAstrology?.inspector?.spans?.[0]?.kind).toBe('anchor_token');
    expect(result.current.rhymeAstrology?.inspector?.clusters?.[0]?.label).toBe('Burning Choir');
  });

  it('falls back to client-side analysis when server fails', async () => {
    vi.doMock('../../src/lib/workers/analysis.client.js', () => ({
      analyzeDocumentAsync: vi.fn().mockResolvedValue({
        lines: [
          {
            lineIndex: 0,
            text: 'Flame and name',
            words: [],
            syllableTotal: 0,
            stressPattern: '',
            internalRhymes: [],
            endRhymeKey: null,
            endWord: null,
          },
        ],
        allConnections: [],
        rhymeGroups: new Map(),
        schemePattern: '',
        statistics: null,
        syntaxSummary: null,
        compiler: null,
      }),
      warmAnalysisWorker: vi.fn(),
    }));

    const usePanelAnalysis = await loadHook();

    // Mock fetch: reject the panel analysis call, allow other fetches
    global.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/api/analysis/panels')) {
        return Promise.reject(new Error('server unavailable'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    // Advance past the debounce timer
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Flush multiple microtask ticks for the async fallback chain
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect([null, 'Server unavailable \u2014 using local analysis']).toContain(result.current.error);
    // Source should be 'client' from fallback
    expect(result.current.source).toBe('client');
  });
});
