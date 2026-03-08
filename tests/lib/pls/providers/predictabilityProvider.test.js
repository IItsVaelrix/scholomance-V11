import { describe, it, expect } from 'vitest';
import { predictabilityProvider } from '../../../../src/lib/pls/providers/predictabilityProvider.js';
import { HHM_LOGIC_ORDER, HHM_STAGE_WEIGHTS } from '../../../../src/lib/models/harkov.model.js';

describe('predictabilityProvider', () => {
  it('prioritizes sequentially likely candidates with HHM context', () => {
    const context = {
      prefix: '',
      prevWord: 'dark',
      syntaxContext: {
        role: 'content',
        hhm: {
          tokenWeight: 1.2,
          logicOrder: [...HHM_LOGIC_ORDER],
          stageWeights: { ...HHM_STAGE_WEIGHTS },
          stageScores: {
            SYNTAX: { signal: 1.05 },
            PREDICTOR: { signal: 1.25 },
            JUDICIARY: { signal: 0.9 },
            PHONEME: { signal: 1.0 },
            HEURISTICS: { signal: 0.95 },
            METER: { signal: 0.9 },
          },
        },
      },
    };

    const engines = {
      trie: {
        predict: () => [],
        predictNext: () => ['ember', 'ash', 'the'],
      },
    };
    const candidates = [
      { token: 'ember', scores: {} },
      { token: 'ash', scores: {} },
      { token: 'the', scores: {} },
      { token: 'void', scores: {} },
    ];

    const results = predictabilityProvider(context, engines, candidates);
    const scoreByToken = new Map(results.map((candidate) => [candidate.token, candidate.scores.predictability]));

    expect(scoreByToken.get('ember')).toBeGreaterThan(scoreByToken.get('ash'));
    expect(scoreByToken.get('ash')).toBeGreaterThan(scoreByToken.get('the'));
    expect(scoreByToken.get('the')).toBeGreaterThan(scoreByToken.get('void'));

    const ember = results.find((candidate) => candidate.token === 'ember');
    expect(ember?.arbiter?.source).toBe('detect_first_predictability');
    expect(ember?.arbiter?.reason).toContain('sequential_evidence_dominant');
    expect(ember?.arbiter?.confidence).toBeGreaterThan(0.5);
    expect(ember?.arbiter?.signals?.sequentialEvidence).toBeGreaterThan(ember?.arbiter?.signals?.prefixEvidence || 0);
  });

  it('falls back to lexical-role scoring when trie evidence is missing', () => {
    const context = {
      prefix: 'th',
      prevWord: null,
      syntaxContext: {
        role: 'function',
      },
    };
    const candidates = [
      { token: 'the', scores: {} },
      { token: 'thunder', scores: {} },
    ];

    const results = predictabilityProvider(context, {}, candidates);
    const the = results.find((candidate) => candidate.token === 'the');
    const thunder = results.find((candidate) => candidate.token === 'thunder');
    const theScore = the?.scores.predictability;
    const thunderScore = thunder?.scores.predictability;

    expect(theScore).toBeGreaterThan(thunderScore);
    expect(typeof theScore).toBe('number');
    expect(typeof thunderScore).toBe('number');
    expect(the?.arbiter?.source).toBe('detect_first_predictability');
    expect(the?.arbiter?.reason).toContain('lexical_fit_dominant');
    expect(thunder?.arbiter?.source).toBe('detect_first_predictability');
  });
});
