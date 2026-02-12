import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelAnalysis } from '../../src/hooks/usePanelAnalysis.js';

describe('usePanelAnalysis hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
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
            },
            vowelSummary: {
              families: [{ id: 'AY', count: 2, percent: 1 }],
              totalWords: 2,
              uniqueWords: 2,
            },
          },
        };
      },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('uses backend panel-analysis endpoint by default', async () => {
    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
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
    expect(result.current.analysis?.allConnections?.[0]?.syntax?.gate).toBe('allow_weak');
  });

  it('falls back to local runtime analysis when server analysis fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('server unavailable'));

    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.source).toBe('local-runtime');
    expect(result.current.error).toBe(null);
    expect(result.current.analysis).toBeTruthy();
    expect(Array.isArray(result.current.analysis?.allConnections)).toBe(true);
    expect(result.current.scoreData).toBeTruthy();
  });
});
