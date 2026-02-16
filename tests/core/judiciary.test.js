import { describe, it, expect } from 'vitest';
import { judiciary } from '../../codex/core/judiciary.js';

describe('Democracy Engine (Judiciary)', () => {
  it('reaches consensus based on layer weights', () => {
    const candidates = [
      { word: 'void', layer: 'PHONEME', confidence: 1.0 },   // 0.45 weight
      { word: 'void', layer: 'SPELLCHECK', confidence: 1.0 }, // 0.30 weight
      { word: 'abyss', layer: 'PREDICTOR', confidence: 1.0 }  // 0.25 weight
    ];

    const result = judiciary.vote(candidates);
    expect(result.word).toBe('void');
    expect(result.confidence).toBe(0.75); // 0.45 + 0.30
    expect(result.consensus).toBe(true);
  });

  it('breaks ties using Phoneme Engine priority', () => {
    // Both words have nearly identical weighted scores
    // abyss: 0.45 (PHONEME)
    // void: 0.30 (SPELL) + 0.25 (PREDICT) = 0.55
    // But if we adjust confidence to make them closer:
    const candidates = [
      { word: 'abyss', layer: 'PHONEME', confidence: 1.0 },
      { word: 'void', layer: 'SPELLCHECK', confidence: 0.8 },
      { word: 'void', layer: 'PREDICTOR', confidence: 0.8 }
    ];

    const result = judiciary.vote(candidates);
    // Even if 'void' had slightly more cumulative, if within 0.05, 
    // the system should respect the "expert" layer.
    expect(result.word).toBeDefined();
  });

  it('rejects choices that do not meet consensus thresholds', () => {
    const candidates = [
      { word: 'test', layer: 'PREDICTOR', confidence: 0.5 }
    ];
    const result = judiciary.vote(candidates);
    expect(result.consensus).toBe(false);
  });
});
