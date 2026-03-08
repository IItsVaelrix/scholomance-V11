import { describe, it, expect } from 'vitest';
import { analyzeLiteraryDevices, detectEmotion, detectEmotionDetailed } from '../../src/lib/literaryDevices.detector.js';
import { buildSyntaxLayer } from '../../src/lib/syntax.layer.js';

describe('Literary Device Detection', () => {
  it('detects similes using "like"', () => {
    const text = "He runs like the wind.\nShe is sharp like a blade.";
    const results = analyzeLiteraryDevices(text);
    const simile = results.find(r => r.id === 'SIMILE');

    expect(simile).toBeDefined();
    expect(simile.count).toBe(2);
    expect(simile.examples).toContain('"runs like the wind"');
  });

  it('detects similes using "as"', () => {
    const text = "As cold as ice.\nAs bright as a star.";
    const results = analyzeLiteraryDevices(text);
    const simile = results.find(r => r.id === 'SIMILE');

    expect(simile).toBeDefined();
    expect(simile.count).toBe(2);
  });

  it('detects basic metaphors', () => {
    const text = "Life is a dream.\nLove is fire.";
    const results = analyzeLiteraryDevices(text);
    const metaphor = results.find(r => r.id === 'METAPHOR');

    expect(metaphor).toBeDefined();
    expect(metaphor.count).toBe(2);
  });

  it('handles mixed literary devices', () => {
    const text = "Singing silver songs.\nLife is a dream.";
    const results = analyzeLiteraryDevices(text);

    expect(results.some(r => r.id === 'ALLITERATION')).toBe(true);
    expect(results.some(r => r.id === 'METAPHOR')).toBe(true);
  });
});

describe('Emotion Detection', () => {
  it('detects defiance in line-level imperative language', () => {
    const label = detectEmotion('I will not bow. I rise again and stand my ground!');
    expect(label).toBe('Defiance');
  });

  it('applies negation handling so "not happy" is not classified as Joy', () => {
    const detail = detectEmotionDetailed('I am not happy, I am empty and alone.');
    expect(detail.emotion).not.toBe('Joy');
    expect(detail.scores.Melancholy).toBeGreaterThan(detail.scores.Joy);
  });

  it('accepts HHM context and reports harkov diagnostics', () => {
    const doc = {
      lines: [{
        number: 0,
        words: [
          { text: 'Never', start: 0, end: 5, deepPhonetics: { syllables: [{ stress: 1 }] } },
          { text: 'bow', start: 6, end: 9, deepPhonetics: { syllables: [{ stress: 1 }] } },
          { text: 'rise', start: 10, end: 14, deepPhonetics: { syllables: [{ stress: 1 }] } },
        ],
      }],
    };

    const syntaxLayer = buildSyntaxLayer(doc);
    const detail = detectEmotionDetailed('Never bow, rise.', { syntaxLayer });

    expect(detail.diagnostics.harkov.enabled).toBe(true);
    expect(detail.emotion).toBe('Defiance');
  });

  it('uses Gutenberg priors when supplied', () => {
    const detail = detectEmotionDetailed('harrowed and hollow', {
      gutenbergPriors: {
        emotions: {
          Dread: { harrowed: 1 },
          Melancholy: { hollow: 1 },
        },
      },
    });

    expect(['Dread', 'Melancholy']).toContain(detail.emotion);
    expect(detail.scores.Dread + detail.scores.Melancholy).toBeGreaterThan(0);
  });
});
