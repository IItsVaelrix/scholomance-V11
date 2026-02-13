import { describe, expect, it } from 'vitest';
import { createOpsMetrics } from '../../codex/server/observability.metrics.js';

describe('observability metrics', () => {
  it('includes panel analysis metrics in snapshot defaults', () => {
    const metrics = createOpsMetrics();
    const snapshot = metrics.snapshot();

    expect(snapshot.panelAnalysisRequests).toBe(0);
    expect(snapshot.panelAnalysisCacheHitsMemory).toBe(0);
    expect(snapshot.panelAnalysisCacheHitsRedis).toBe(0);
    expect(snapshot.panelAnalysisCacheMisses).toBe(0);
    expect(snapshot.panelAnalysisErrors).toBe(0);
    expect(snapshot.panelAnalysisDurationMsTotal).toBe(0);
    expect(snapshot.panelAnalysisCacheHitRatio).toBe(0);
    expect(snapshot.panelAnalysisAvgDurationMs).toBe(0);
  });

  it('records panel analysis cache and duration signals', () => {
    const metrics = createOpsMetrics();

    metrics.recordPanelAnalysis({ source: 'memory', durationMs: 10, ok: true });
    metrics.recordPanelAnalysis({ source: 'redis', durationMs: 20, ok: true });
    metrics.recordPanelAnalysis({ source: 'miss', durationMs: 30, ok: false });

    const snapshot = metrics.snapshot();
    expect(snapshot.panelAnalysisRequests).toBe(3);
    expect(snapshot.panelAnalysisCacheHitsMemory).toBe(1);
    expect(snapshot.panelAnalysisCacheHitsRedis).toBe(1);
    expect(snapshot.panelAnalysisCacheMisses).toBe(1);
    expect(snapshot.panelAnalysisErrors).toBe(1);
    expect(snapshot.panelAnalysisDurationMsTotal).toBe(60);
    expect(snapshot.panelAnalysisCacheHitRatio).toBeCloseTo(2 / 3, 4);
    expect(snapshot.panelAnalysisAvgDurationMs).toBe(20);
  });
});
