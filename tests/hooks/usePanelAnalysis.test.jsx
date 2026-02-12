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
              allConnections: [],
              rhymeGroups: [['A', [0, 1]]],
              statistics: { totalLines: 2 },
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
  });
});
