import { describe, expect, it } from 'vitest';
import { buildPhoneticSignature } from '../../codex/core/rhyme-astrology/signatures.js';

describe('rhyme-astrology signatures', () => {
  it('extracts deterministic fields for single-syllable words', () => {
    const signature = buildPhoneticSignature(['F', 'L', 'EY1', 'M']);

    expect(signature).toEqual({
      phonemes: ['F', 'L', 'EY1', 'M'],
      vowelSkeleton: ['EY1'],
      consonantSkeleton: ['F', 'L', 'M'],
      endingSignature: 'EY1-M',
      onsetSignature: 'F-L',
      stressPattern: '1',
      syllableCount: 1,
    });
  });

  it('normalizes string phoneme input and open endings', () => {
    const signature = buildPhoneticSignature(' k  ae1 ');

    expect(signature.phonemes).toEqual(['K', 'AE1']);
    expect(signature.vowelSkeleton).toEqual(['AE1']);
    expect(signature.consonantSkeleton).toEqual(['K']);
    expect(signature.endingSignature).toBe('AE1-open');
    expect(signature.onsetSignature).toBe('K');
    expect(signature.stressPattern).toBe('1');
    expect(signature.syllableCount).toBe(1);
  });

  it('keeps consonant-only inputs deterministic', () => {
    const signature = buildPhoneticSignature(['S', 'T']);

    expect(signature.vowelSkeleton).toEqual([]);
    expect(signature.consonantSkeleton).toEqual(['S', 'T']);
    expect(signature.endingSignature).toBe('S-T');
    expect(signature.onsetSignature).toBe('S-T');
    expect(signature.stressPattern).toBe('');
    expect(signature.syllableCount).toBe(0);
  });
});
