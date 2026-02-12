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

  it('includes syntax summary and connection syntax metadata when enabled', async () => {
    const previous = process.env.ENABLE_SYNTAX_RHYME_LAYER;
    process.env.ENABLE_SYNTAX_RHYME_LAYER = 'true';

    try {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analysis/panels',
        payload: {
          text: [
            'Silver light in lucid air',
            'Crimson night with answered prayer',
          ].join('\n'),
        },
      });

      await app.close();

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.data.analysis.syntaxSummary).toBeTruthy();
      expect(payload.data.analysis.syntaxSummary.tokenCount).toBeGreaterThan(0);
      const firstConnection = payload.data.analysis.allConnections[0];
      expect(firstConnection?.syntax).toBeTruthy();
      expect(typeof firstConnection?.syntax?.gate).toBe('string');
      expect(Array.isArray(firstConnection?.syntax?.reasons)).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.ENABLE_SYNTAX_RHYME_LAYER;
      } else {
        process.env.ENABLE_SYNTAX_RHYME_LAYER = previous;
      }
    }
  });
});
