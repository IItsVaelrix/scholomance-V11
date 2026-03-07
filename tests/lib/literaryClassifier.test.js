import { describe, it, expect } from 'vitest';
import { GENRES, LiteraryClassifier } from '../../src/lib/literaryClassifier.js';

function createAnalyzedDoc({
  wordCount = 100,
  lineCount = 10,
  totalSyllables = 80,
  uniqueWordCount = 90,
  longWordRatio = 0.05,
  stressCoherence = 0.7,
} = {}) {
  return {
    stats: {
      wordCount,
      lineCount,
      totalSyllables,
      uniqueWordCount,
      longWordRatio,
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
      totalSyllables: 80, // keeps cadence from adding Rap
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
      endRhymeCount: 3, // below minimum sample gate
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
        totalSyllables: 130, // 13 syllables/line -> rap-leaning cadence
        uniqueWordCount: 80,
        stressCoherence: 0.5,
      }),
      createRhymeAnalysis()
    );

    const songLike = LiteraryClassifier.classify(
      createAnalyzedDoc({
        wordCount: 90,
        lineCount: 10,
        totalSyllables: 60, // 6 syllables/line -> song-leaning cadence
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
      totalSyllables: 280, // ~8.5 syllables/line (not rap-fast cadence)
      uniqueWordCount: 220,
      longWordRatio: 0.08,
      stressCoherence: 0.52,
    });
    analyzedDoc.raw = 'i bleed in the dark, alone at night with broken scars and tears! '.repeat(30);

    const rhymeAnalysis = createRhymeAnalysis({
      internalCount: 90,       // dense internal links
      endRhymeCount: 30,
      multiSyllableCount: 4,   // not enough multi-syllable pressure for rap bonus
    });

    const result = LiteraryClassifier.classify(analyzedDoc, rhymeAnalysis);

    expect(result.genre).not.toBe(GENRES.RAP);
    expect(result.scores[GENRES.EMO]).toBeGreaterThan(result.scores[GENRES.RAP]);
  });
});
