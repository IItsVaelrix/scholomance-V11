import { describe, it, expect } from 'vitest';
import { predictabilityProvider } from '../../../../src/lib/pls/providers/predictabilityProvider.js';
import { HHM_LOGIC_ORDER, HHM_STAGE_WEIGHTS } from '../../../../src/lib/harkov.model.js';

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
    const theScore = results.find((candidate) => candidate.token === 'the')?.scores.predictability;
    const thunderScore = results.find((candidate) => candidate.token === 'thunder')?.scores.predictability;

    expect(theScore).toBeGreaterThan(thunderScore);
    expect(typeof theScore).toBe('number');
    expect(typeof thunderScore).toBe('number');
  });
});
