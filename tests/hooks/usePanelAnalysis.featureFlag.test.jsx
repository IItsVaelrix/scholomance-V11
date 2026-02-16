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

  it('uses client-side fallback when VITE_USE_SERVER_PANEL_ANALYSIS=false', async () => {
    vi.stubEnv('VITE_USE_SERVER_PANEL_ANALYSIS', 'false');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { usePanelAnalysis } = await import('../../src/hooks/usePanelAnalysis.js');
    const { result } = renderHook(() => usePanelAnalysis());

    act(() => {
      result.current.analyzeDocument('Flame and name');
    });

    // Allow the client-side async analysis to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Should NOT have called the server panel analysis endpoint
    const panelCalls = global.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/analysis/panels')
    );
    expect(panelCalls).toHaveLength(0);

    // Client-side fallback should produce a source of 'client'
    expect(result.current.source).toBe('client');
    expect(result.current.isAnalyzing).toBe(false);
  });
});
