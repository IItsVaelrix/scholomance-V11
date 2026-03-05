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
    const syntaxContext = {
      role: 'function',
      lineRole: 'line_mid',
      stressRole: 'unstressed',
      rhymePolicy: 'suppress'
    };

    const result = engine.vote(candidates, syntaxContext);
    const scores = engine.calculateAllScores(candidates, syntaxContext);

    expect(result.word).toBe('the');
    expect(scores.get('night')?.total).toBeCloseTo(0.096, 4);
    expect(scores.get('night')?.total).toBeLessThan(scores.get('the')?.total);
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

  it('applies HHM token-stage weighting when present in syntax context', () => {
    const engine = new JudiciaryEngine();
    const candidates = [
      { word: 'ember', layer: 'PHONEME', confidence: 1.0, isRhyme: true },
      { word: 'stone', layer: 'SPELLCHECK', confidence: 1.0 },
    ];
    const baseContext = {
      role: 'content',
      lineRole: 'line_mid',
      stressRole: 'unknown',
      rhymePolicy: 'allow',
    };
    const hhmContext = {
      ...baseContext,
      hhm: {
        tokenWeight: 1.0,
        logicOrder: ['SYNTAX', 'PREDICTOR', 'SPELLCHECK', 'JUDICIARY', 'PHONEME', 'HEURISTICS', 'METER'],
        stageWeights: {
          SYNTAX: 0.05,
          PREDICTOR: 0.05,
          SPELLCHECK: 1.0,
          JUDICIARY: 0.05,
          PHONEME: 0.05,
          HEURISTICS: 0.05,
          METER: 0.05,
        },
      },
    };

    const baseline = engine.vote(candidates);
    expect(baseline.word).toBe('ember');
    const baselineScores = engine.calculateAllScores(candidates, baseContext);

    const hhmWeighted = engine.vote(candidates, hhmContext);
    const hhmScores = engine.calculateAllScores(candidates, hhmContext);

    expect(hhmWeighted.word).toBe('stone');
    expect(hhmWeighted.breakdown.stone[0].hhmStage).toBe('SPELLCHECK');
    expect(hhmScores.get('stone')?.total).toBeGreaterThan(baselineScores.get('stone')?.total);
    expect(hhmScores.get('ember')?.total).toBeLessThan(baselineScores.get('ember')?.total);
  });
});
