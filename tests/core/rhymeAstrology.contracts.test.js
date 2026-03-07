import { describe, expect, it } from 'vitest';
import {
  RHYME_ASTROLOGY_QUERY_DEFAULTS,
  RHYME_ASTROLOGY_QUERY_ROUTE,
  normalizeRhymeAstrologyQuery,
  validateRhymeAstrologyResult,
} from '../../codex/core/rhyme-astrology/contracts.js';

describe('rhyme-astrology contracts', () => {
  it('exposes the fixed v1 query route', () => {
    expect(RHYME_ASTROLOGY_QUERY_ROUTE).toBe('/api/rhyme-astrology/query');
  });

  it('normalizes query params with defaults', () => {
    const normalized = normalizeRhymeAstrologyQuery({
      text: 'flame',
    });

    expect(normalized).toEqual({
      text: 'flame',
      mode: RHYME_ASTROLOGY_QUERY_DEFAULTS.mode,
      limit: RHYME_ASTROLOGY_QUERY_DEFAULTS.limit,
      minScore: RHYME_ASTROLOGY_QUERY_DEFAULTS.minScore,
      includeConstellations: RHYME_ASTROLOGY_QUERY_DEFAULTS.includeConstellations,
      includeDiagnostics: RHYME_ASTROLOGY_QUERY_DEFAULTS.includeDiagnostics,
    });
  });

  it('normalizes boolean query strings safely', () => {
    const normalized = normalizeRhymeAstrologyQuery({
      text: 'flame',
      includeConstellations: 'false',
      includeDiagnostics: '1',
    });

    expect(normalized.includeConstellations).toBe(false);
    expect(normalized.includeDiagnostics).toBe(true);
  });

  it('validates result payload structure', () => {
    const result = validateRhymeAstrologyResult({
      query: {
        rawText: 'flame',
        tokens: ['flame'],
        resolvedNodes: [],
      },
      topMatches: [
        {
          nodeId: 'w_1',
          token: 'frame',
          overallScore: 0.97,
          reasons: ['shared stressed vowel EY1'],
        },
      ],
      constellations: [
        {
          id: 'c_ey1_m',
          anchorId: 'w_1',
          label: 'EY1-M Cluster',
          dominantVowelFamily: ['EY1'],
          dominantStressPattern: '1',
          members: ['w_1', 'w_2'],
          densityScore: 0.88,
          cohesionScore: 0.91,
        },
      ],
      diagnostics: {
        queryTimeMs: 4,
        cacheHit: true,
        candidateCount: 42,
      },
    });

    expect(result.topMatches[0].token).toBe('frame');
    expect(result.diagnostics.cacheHit).toBe(true);
  });
});

