import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { panelAnalysisRoutes } from '../../codex/server/routes/panelAnalysis.routes.js';

describe('[Server] panelAnalysis.routes', () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    await app.register(panelAnalysisRoutes);
    return app;
  }

  it('returns unified panel analysis payload', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/panels',
      payload: {
        text: [
          'Stars carve scars in silent skies',
          'Fires rise where desire replies',
        ].join('\n'),
      },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.source).toBe('server-analysis');
    expect(payload.data).toBeTruthy();
    expect(payload.data.scoreData).toBeTruthy();
    expect(typeof payload.data.scoreData.totalScore).toBe('number');
    expect(Array.isArray(payload.data.scoreData.traces)).toBe(true);
    expect(Array.isArray(payload.data.analysis.rhymeGroups)).toBe(true);
    expect(Array.isArray(payload.data.scheme.groups)).toBe(true);
    expect(Array.isArray(payload.data.vowelSummary.families)).toBe(true);
  });

  it('rejects invalid body payload', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/panels',
      payload: {},
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    const payload = response.json();
    expect(payload.error).toBe('Invalid request');
    expect(Array.isArray(payload.details)).toBe(true);
  });
});
