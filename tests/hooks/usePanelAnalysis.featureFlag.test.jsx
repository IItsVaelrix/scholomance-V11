import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('usePanelAnalysis feature flags', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('skips network analysis when VITE_USE_SERVER_PANEL_ANALYSIS=false', async () => {
    vi.stubEnv('VITE_USE_SERVER_PANEL_ANALYSIS', 'false');
    global.fetch = vi.fn();

    const { usePanelAnalysis } = await import('../../src/hooks/usePanelAnalysis.js');
    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.source).toBe('feature-flag-disabled');
    expect(result.current.error).toBe('Panel analysis disabled by VITE_USE_SERVER_PANEL_ANALYSIS=false');
    expect(result.current.isAnalyzing).toBe(false);
  });
});
