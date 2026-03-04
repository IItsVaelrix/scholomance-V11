import { describe, it, expect } from 'vitest';
import { JudiciaryEngine } from '../../codex/core/judiciary.js';

function totalScore(entries = []) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

describe('Democracy Engine (Judiciary)', () => {
  it('suppresses rhyme votes for function words in non-terminal positions', () => {
    const engine = new JudiciaryEngine();
    const candidates = [
      { word: 'night', layer: 'PHONEME', confidence: 1.0, isRhyme: true },
      { word: 'the', layer: 'SPELLCHECK', confidence: 1.0 }
    ];

    const result = engine.vote(candidates, {
      role: 'function',
      lineRole: 'line_mid',
      stressRole: 'unstressed',
      rhymePolicy: 'suppress'
    });

    expect(result.word).toBe('the');
    expect(result.breakdown.night[0].score).toBeCloseTo(0.096, 4);
    expect(result.breakdown.night[0].score).toBeLessThan(result.breakdown.the[0].score);
  });

  it('boosts rhyme votes in terminal content slots and accepts SYNTAX endorsement', () => {
    const engine = new JudiciaryEngine();
    const candidates = [
      { word: 'fire', layer: 'PHONEME', confidence: 0.9, isRhyme: true },
      { word: 'stone', layer: 'SPELLCHECK', confidence: 1.0 },
      { word: 'stone', layer: 'PREDICTOR', confidence: 0.4 }
    ];

    const baseline = engine.vote(candidates);
    const syntaxAware = engine.vote(candidates, {
      role: 'content',
      lineRole: 'line_end',
      stressRole: 'primary',
      rhymePolicy: 'allow'
    });

    expect(syntaxAware.word).toBe('fire');
    expect(totalScore(syntaxAware.breakdown.fire)).toBeGreaterThan(totalScore(baseline.breakdown.fire));
    expect(syntaxAware.breakdown.fire.some((entry) => entry.layer === 'SYNTAX')).toBe(true);
  });

  it('is backward compatible when syntax context is omitted', () => {
    const engine = new JudiciaryEngine();
    const candidates = [
      { word: 'void', layer: 'PHONEME', confidence: 0.8 },
      { word: 'void', layer: 'SPELLCHECK', confidence: 1.0 },
      { word: 'abyss', layer: 'PREDICTOR', confidence: 1.0 }
    ];

    const implicit = engine.vote(candidates);
    const explicitNull = engine.vote(candidates, null);

    expect(explicitNull).toEqual(implicit);
  });

  it('applies syntax modifiers before phoneme tie-breaking', () => {
    const engine = new JudiciaryEngine();
    const candidates = [
      { word: 'abyss', layer: 'PHONEME', confidence: 0.9130434782608695, isRhyme: true },
      { word: 'void', layer: 'SPELLCHECK', confidence: 1.0 },
      { word: 'void', layer: 'PREDICTOR', confidence: 0.95 }
    ];

    const noSyntax = engine.vote(candidates);
    expect(noSyntax.word).toBe('void');

    const syntaxAware = engine.vote(candidates, {
      role: 'content',
      lineRole: 'line_mid',
      stressRole: 'primary',
      rhymePolicy: 'allow'
    });

    expect(syntaxAware.word).toBe('abyss');
    const phonemeEntry = syntaxAware.breakdown.abyss.find((entry) => entry.layer === 'PHONEME');
    expect(phonemeEntry.score).toBeCloseTo(0.42, 2);
  });
});
