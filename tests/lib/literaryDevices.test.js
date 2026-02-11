import { describe, it, expect } from 'vitest';
import { analyzeLiteraryDevices } from '../../src/lib/literaryDevices.detector.js';

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
