import { describe, it, expect } from 'vitest';
import { rankCandidates, DEFAULT_WEIGHTS } from '../../../src/lib/pls/ranker.js';

describe('Ranker', () => {
  it('ranks by weighted final score', () => {
    const generators = {
      rhyme: [
        { token: 'light', score: 1.0, badge: 'RHYME' },
        { token: 'dream', score: 0.5, badge: null },
      ],
      prefix: [
        { token: 'like', score: 0.9, badge: null },
        { token: 'light', score: 0.7, badge: null },
      ],
    };
    const scorers = {
      meter: [
        { token: 'light', scores: { meter: 0.9 } },
        { token: 'dream', scores: { meter: 0.6 } },
        { token: 'like', scores: { meter: 0.8 } },
      ],
      color: [
        { token: 'light', scores: { color: 1.0 } },
        { token: 'dream', scores: { color: 0.0 } },
        { token: 'like', scores: { color: 0.5 } },
      ],
    };

    const results = rankCandidates(generators, scorers, DEFAULT_WEIGHTS, { currentLineWords: ['the'] });

    // "light" should rank highest: rhyme=1.0, prefix=0.7, meter=0.9, color=1.0
    expect(results[0].token).toBe('light');
    expect(results[0].score).toBeGreaterThan(0.5);
    expect(results[0].badges).toContain('RHYME');
    expect(results[0].badges).toContain('COLOR');
  });

  it('generates ghost lines from context', () => {
    const generators = {
      rhyme: [{ token: 'night', score: 1.0, badge: 'RHYME' }],
      prefix: [],
    };
    const scorers = { meter: [], color: [] };
    const context = { currentLineWords: ['into', 'the'] };

    const results = rankCandidates(generators, scorers, DEFAULT_WEIGHTS, context);
    expect(results[0].ghostLine).toBe('into the night');
  });

  it('respects limit parameter', () => {
    const generators = {
      rhyme: Array.from({ length: 20 }, (_, i) => ({ token: `word${i}`, score: 0.5, badge: null })),
      prefix: [],
    };
    const scorers = { meter: [], color: [] };

    const results = rankCandidates(generators, scorers, DEFAULT_WEIGHTS, {}, 5);
    expect(results).toHaveLength(5);
  });

  it('tie-breaks by badge count then alphabetical', () => {
    const generators = {
      rhyme: [
        { token: 'beta', score: 0.5, badge: 'RHYME' },
        { token: 'alpha', score: 0.5, badge: null },
      ],
      prefix: [
        { token: 'beta', score: 0.5, badge: null },
        { token: 'alpha', score: 0.5, badge: null },
      ],
    };
    const scorers = { meter: [], color: [] };

    const results = rankCandidates(generators, scorers, DEFAULT_WEIGHTS, {});
    // beta has RHYME badge, alpha doesn't — beta should come first
    expect(results[0].token).toBe('beta');
  });

  it('includes per-provider score breakdown', () => {
    const generators = {
      rhyme: [{ token: 'test', score: 0.8, badge: null }],
      prefix: [{ token: 'test', score: 0.6, badge: null }],
    };
    const scorers = {
      meter: [{ token: 'test', scores: { meter: 0.7 } }],
      color: [{ token: 'test', scores: { color: 0.3 } }],
    };

    const results = rankCandidates(generators, scorers, DEFAULT_WEIGHTS, {});
    expect(results[0].scores.rhyme).toBe(0.8);
    expect(results[0].scores.prefix).toBe(0.6);
    expect(results[0].scores.meter).toBe(0.7);
    expect(results[0].scores.color).toBe(0.3);
  });
});
