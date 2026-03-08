import { describe, it, expect } from 'vitest';
import { GENRES, LiteraryClassifier } from '../../src/lib/literaryClassifier.js';

function createAnalyzedDoc({
  wordCount = 100,
  lineCount = 10,
  totalSyllables = 80,
  uniqueWordCount = 90,
  longWordRatio = 0.05,
  stressCoherence = 0.7,
  avgSentenceLength,
} = {}) {
  const computedAvgSentenceLength = Number.isFinite(avgSentenceLength)
    ? avgSentenceLength
    : (lineCount > 0 ? (wordCount / Math.max(1, Math.floor(lineCount / 2))) : 0);

  return {
    stats: {
      wordCount,
      lineCount,
      totalSyllables,
      uniqueWordCount,
      longWordRatio,
      avgSentenceLength: computedAvgSentenceLength,
    },
    parsed: {
      stressProfile: {
        coherence: stressCoherence,
      },
    },
  };
}

function createRhymeAnalysis({
  internalCount = 0,
  multiSyllableCount = 0,
  endRhymeCount = 0,
} = {}) {
  return {
    statistics: {
      internalCount,
      multiSyllableCount,
      endRhymeCount,
    },
  };
}

describe('LiteraryClassifier', () => {
  it('exposes the expanded genre palette', () => {
    expect(GENRES.POP).toBe('Pop');
    expect(GENRES.EMO).toBe('Emo');
    expect(GENRES.ROCK).toBe('Rock');
    expect(GENRES.PUNK).toBe('Punk');
    expect(GENRES.FOLK).toBe('Folk');
    expect(GENRES.SINGER_SONGWRITER).toBe('Singer/Songwriter');
    expect(GENRES.METAL).toBe('Metal');
    expect(GENRES.LYRIC).toBe('Lyric');
  });

  it('uses analyzedDoc.parsed.stressProfile when rhyme analysis has no stress profile', () => {
    const analyzedDoc = createAnalyzedDoc({
      stressCoherence: 0.9,
      totalSyllables: 80,
    });
    const rhymeAnalysis = createRhymeAnalysis();

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.genre).toBe(GENRES.POETRY);
    expect(result.scores[GENRES.POETRY]).toBeGreaterThanOrEqual(26);
    expect(result.scores[GENRES.RAP]).toBe(0);
  });

  it('does not apply multi-syllable ratio bonus on tiny end-rhyme samples', () => {
    const analyzedDoc = createAnalyzedDoc({
      stressCoherence: 0.7,
      totalSyllables: 80,
    });
    const rhymeAnalysis = createRhymeAnalysis({
      multiSyllableCount: 1,
      endRhymeCount: 3,
    });

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.scores[GENRES.RAP]).toBe(0);
    expect(result.genre).toBe(GENRES.SONG);
  });

  it('uses syllables-per-line to separate rap-like vs song-like cadence', () => {
    const rapLike = LiteraryClassifier.classify(
      createAnalyzedDoc({
        wordCount: 90,
        lineCount: 10,
        totalSyllables: 130,
        uniqueWordCount: 80,
        stressCoherence: 0.5,
      }),
      createRhymeAnalysis()
    );

    const songLike = LiteraryClassifier.classify(
      createAnalyzedDoc({
        wordCount: 90,
        lineCount: 10,
        totalSyllables: 60,
        uniqueWordCount: 80,
        stressCoherence: 0.7,
      }),
      createRhymeAnalysis()
    );

    expect(rapLike.genre).toBe(GENRES.RAP);
    expect(songLike.genre).toBe(GENRES.SONG);
    expect(rapLike.scores[GENRES.RAP]).toBeGreaterThan(rapLike.scores[GENRES.SONG]);
    expect(songLike.scores[GENRES.SONG]).toBeGreaterThan(songLike.scores[GENRES.RAP]);
  });

  it('does not collapse emo-like dark lyric into rap on internal rhyme alone', () => {
    const analyzedDoc = createAnalyzedDoc({
      wordCount: 330,
      lineCount: 33,
      totalSyllables: 280,
      uniqueWordCount: 220,
      longWordRatio: 0.08,
      stressCoherence: 0.52,
    });
    analyzedDoc.raw = 'i bleed in the dark, alone at night with broken scars and tears! '.repeat(30);

    const rhymeAnalysis = createRhymeAnalysis({
      internalCount: 90,
      endRhymeCount: 30,
      multiSyllableCount: 4,
    });

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.genre).not.toBe(GENRES.RAP);
    expect(result.scores[GENRES.EMO]).toBeGreaterThan(result.scores[GENRES.RAP]);
  });

  it('prefers Pop over Prose when pop song signals are present in longer lines', () => {
    const analyzedDoc = createAnalyzedDoc({
      wordCount: 96,
      lineCount: 6,
      totalSyllables: 56,
      uniqueWordCount: 36,
      longWordRatio: 0.04,
      stressCoherence: 0.72,
      avgSentenceLength: 13,
    });
    analyzedDoc.raw = 'baby tonight we dance in the light and feel love forever with every heartbeat'.repeat(4);

    const rhymeAnalysis = createRhymeAnalysis({
      internalCount: 4,
      endRhymeCount: 2,
      multiSyllableCount: 0,
    });

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.scores[GENRES.POP]).toBeGreaterThan(result.scores[GENRES.PROSE]);
    expect([GENRES.POP, GENRES.SONG]).toContain(result.genre);
  });

  it('prefers Metal over Prose when dark/high-intensity lyric signals are present', () => {
    const analyzedDoc = createAnalyzedDoc({
      wordCount: 104,
      lineCount: 8,
      totalSyllables: 90,
      uniqueWordCount: 64,
      longWordRatio: 0.18,
      stressCoherence: 0.58,
      avgSentenceLength: 12,
    });
    analyzedDoc.raw = 'fire and steel rage in the storm we burn through blood and thunder with wrath! '.repeat(8);

    const rhymeAnalysis = createRhymeAnalysis({
      internalCount: 8,
      endRhymeCount: 4,
      multiSyllableCount: 1,
    });

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.scores[GENRES.METAL]).toBeGreaterThan(result.scores[GENRES.PROSE]);
    expect([GENRES.METAL, GENRES.EMO, GENRES.ROCK]).toContain(result.genre);
  });
});
