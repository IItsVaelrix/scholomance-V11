import { describe, expect, it } from 'vitest';
import {
  attachHeuristicCommentary,
  buildHeuristicCommentary,
} from '../../codex/core/commentary/commentary.builder.js';

describe('commentary.builder', () => {
  const doc = {
    raw: 'Thunder folds into velvet noise',
    stats: { wordCount: 5 },
    parsed: {
      contentWordFrequency: {
        thunder: 3,
        velvet: 2,
        noise: 1,
      },
    },
    allWords: [
      { text: 'Thunder', normalized: 'thunder' },
      { text: 'velvet', normalized: 'velvet' },
      { text: 'noise', normalized: 'noise' },
    ],
  };

  it('builds deterministic commentary with song evidence tokens', () => {
    const trace = {
      heuristic: 'alliteration_density',
      rawScore: 0.72,
      weight: 0.15,
      contribution: 10.8,
      diagnostics: [
        {
          metadata: {
            words: ['thunder', 'thread', 'thrum'],
          },
        },
      ],
    };

    const first = buildHeuristicCommentary(trace, doc);
    const second = buildHeuristicCommentary(trace, doc);

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(50);
    expect(first).toContain('In this song');
    expect(first).toMatch(/"thunder"|"thread"|"thrum"/);
  });

  it('attaches commentary for every trace', () => {
    const traces = [
      {
        heuristic: 'phoneme_density',
        rawScore: 0.63,
        weight: 0.2,
        contribution: 12.6,
      },
      {
        heuristic: 'vocabulary_richness',
        rawScore: 0.41,
        weight: 0.15,
        contribution: 6.15,
      },
    ];

    const withCommentary = attachHeuristicCommentary(traces, doc);

    expect(withCommentary).toHaveLength(2);
    withCommentary.forEach((trace) => {
      expect(typeof trace.commentary).toBe('string');
      expect(trace.commentary.length).toBeGreaterThan(0);
    });
  });
});

