import { describe, expect, it } from 'vitest';
import {
  RHYME_ASTROLOGY_WEIGHTS,
  buildPlsPhoneticFeatures,
  calculateWeightedRhymeScore,
} from '../../codex/core/rhyme-astrology/scoring.js';
import { scoreNodeSimilarity } from '../../codex/core/rhyme-astrology/similarity.js';

describe('rhyme-astrology weighted scoring', () => {
  it('keeps v1 scoring weights centralized', () => {
    expect(RHYME_ASTROLOGY_WEIGHTS).toEqual({
      exact: 0.35,
      slant: 0.2,
      vowel: 0.2,
      consonant: 0.1,
      stress: 0.1,
      syllablePenalty: 0.05,
    });
  });

  it('computes weighted overall score from dimensions', () => {
    const overallScore = calculateWeightedRhymeScore({
      exactRhymeScore: 1,
      slantRhymeScore: 0.5,
      vowelMatchScore: 0.9,
      consonantMatchScore: 0.4,
      stressAlignmentScore: 1,
      syllableDeltaPenalty: 0.2,
    });

    expect(overallScore).toBeCloseTo(0.76, 6);
  });

  it('supports exact-only weighting for deterministic behavior checks', () => {
    const exactOnlyWeights = {
      exact: 1,
      slant: 0,
      vowel: 0,
      consonant: 0,
      stress: 0,
      syllablePenalty: 0,
    };

    const queryNode = { id: 'flame', phonemes: ['F', 'L', 'EY1', 'M'] };
    const exactNode = { id: 'claim', phonemes: ['K', 'L', 'EY1', 'M'] };
    const nonExactNode = { id: 'lane', phonemes: ['L', 'EY1', 'N'] };

    const exactResult = scoreNodeSimilarity(queryNode, exactNode, exactOnlyWeights);
    const nonExactResult = scoreNodeSimilarity(queryNode, nonExactNode, exactOnlyWeights);

    expect(exactResult.exactRhymeScore).toBe(1);
    expect(nonExactResult.exactRhymeScore).toBe(0);
    expect(exactResult.overallScore).toBe(1);
    expect(nonExactResult.overallScore).toBe(0);
  });

  it('builds zeroed PLS phonetic features for empty anchors', () => {
    expect(buildPlsPhoneticFeatures([])).toEqual({
      rhymeAffinityScore: 0,
      constellationDensity: 0,
      internalRecurrenceScore: 0,
      phoneticNoveltyScore: 0,
    });
  });

  it('derives PLS phonetic features from anchor results', () => {
    const features = buildPlsPhoneticFeatures([
      {
        lineIndex: 0,
        sign: 'EY1M',
        topMatches: [
          { nodeId: 'a', overallScore: 0.9 },
          { nodeId: 'b', overallScore: 0.8 },
          { nodeId: 'c', overallScore: 0.7 },
        ],
        constellations: [{ densityScore: 0.5 }],
      },
      {
        lineIndex: 0,
        sign: 'EY1M',
        topMatches: [
          { nodeId: 'd', overallScore: 0.6 },
          { nodeId: 'e', overallScore: 0.5 },
          { nodeId: 'f', overallScore: 0.4 },
        ],
        constellations: [{ densityScore: 0.75 }],
      },
    ], {
      frequencyResolver: (nodeId) => (nodeId === 'a' ? 0.2 : 0.9),
    });

    expect(features.rhymeAffinityScore).toBeCloseTo(0.65, 6);
    expect(features.constellationDensity).toBeCloseTo(0.625, 6);
    expect(features.internalRecurrenceScore).toBe(1);
    expect(features.phoneticNoveltyScore).toBeCloseTo(0.45, 6);
  });
});
