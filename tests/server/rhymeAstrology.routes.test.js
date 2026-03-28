import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { rhymeAstrologyRoutes } from '../../codex/server/routes/rhymeAstrology.routes.js';
import { RHYME_ASTROLOGY_QUERY_ROUTE } from '../../codex/core/rhyme-astrology/contracts.js';

function createResult(cacheHit = false) {
  return {
    query: {
      rawText: 'flame',
      tokens: ['flame'],
      resolvedNodes: [],
      compiler: {
        verseIRVersion: '1.0.0',
        mode: 'live_fast',
        tokenCount: 1,
        lineCount: 1,
        syllableWindowCount: 1,
        lineBreakStyle: 'none',
        whitespaceFidelity: true,
        source: 'compiled',
        anchorTokenId: 0,
        anchorLineIndex: 0,
        activeTokenIds: [0],
        activeWindowIds: [0],
      },
    },
    topMatches: [
      {
        nodeId: 'w_2',
        token: 'frame',
        overallScore: 0.97,
        reasons: ['matching ending signature EY1-M'],
      },
    ],
    constellations: [
      {
        id: 'c_ey_m',
        anchorId: 'w_2',
        label: 'EY-M Cluster',
        dominantVowelFamily: ['EY'],
        dominantStressPattern: '1',
        members: ['w_2', 'w_3'],
        densityScore: 0.7,
        cohesionScore: 0.9,
      },
    ],
    diagnostics: {
      queryTimeMs: 4,
      cacheHit,
      candidateCount: 20,
    },
  };
}

describe('[Server] rhymeAstrology.routes', () => {
  async function buildApp(queryEngine) {
    const app = Fastify({ logger: false });
    await app.register(rhymeAstrologyRoutes, { queryEngine });
    return app;
  }

  it('validates query parameters', async () => {
    const queryEngine = {
      query: vi.fn(),
      close: vi.fn(),
    };
    const app = await buildApp(queryEngine);

    const response = await app.inject({
      method: 'GET',
      url: `${RHYME_ASTROLOGY_QUERY_ROUTE}?mode=word`,
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Invalid request');
    expect(queryEngine.query).not.toHaveBeenCalled();
  });

  it('returns a validated rhyme astrology result', async () => {
    const queryEngine = {
      query: vi.fn(async () => createResult(false)),
      close: vi.fn(),
    };
    const app = await buildApp(queryEngine);

    const response = await app.inject({
      method: 'GET',
      url: `${RHYME_ASTROLOGY_QUERY_ROUTE}?text=flame&mode=word&limit=10&minScore=0.5`,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-rhyme-astrology-cache']).toBe('MISS');
    expect(Number(response.headers['x-rhyme-astrology-query-time-ms'])).toBeGreaterThanOrEqual(0);
    expect(response.json().topMatches[0].token).toBe('frame');
    expect(queryEngine.query).toHaveBeenCalledWith({
      text: 'flame',
      mode: 'word',
      limit: 10,
      minScore: 0.5,
      includeConstellations: true,
      includeDiagnostics: true,
    });
  });

  it('returns HIT header when diagnostics indicate cache hit', async () => {
    let calls = 0;
    const queryEngine = {
      query: vi.fn(async () => {
        calls += 1;
        return createResult(calls > 1);
      }),
      close: vi.fn(),
    };
    const app = await buildApp(queryEngine);

    const first = await app.inject({
      method: 'GET',
      url: `${RHYME_ASTROLOGY_QUERY_ROUTE}?text=flame&mode=word`,
    });
    const second = await app.inject({
      method: 'GET',
      url: `${RHYME_ASTROLOGY_QUERY_ROUTE}?text=flame&mode=word`,
    });

    await app.close();

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.headers['x-rhyme-astrology-cache']).toBe('MISS');
    expect(second.headers['x-rhyme-astrology-cache']).toBe('HIT');
  });

  it('returns 500 when query engine throws', async () => {
    const queryEngine = {
      query: vi.fn(async () => {
        throw new Error('boom');
      }),
      close: vi.fn(),
    };
    const app = await buildApp(queryEngine);

    const response = await app.inject({
      method: 'GET',
      url: `${RHYME_ASTROLOGY_QUERY_ROUTE}?text=flame`,
    });

    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'RhymeAstrology query failed',
    });
  });
});
