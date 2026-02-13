/**
 * CODEx Literary Classifier
 * Distinguishes between Rap, Poetry, and Song styles to tune heuristics.
 */

export const GENRES = {
  RAP: "Rap",
  POETRY: "Poetry",
  SONG: "Song",
  PROSE: "Prose"
};

export class LiteraryClassifier {
  /**
   * Classifies a document based on its linguistic and structural signatures.
   * @param {object} analyzedDoc - From analysis.pipeline
   * @param {object} rhymeAnalysis - From deepRhyme.engine
   * @returns {{ genre: string, confidence: number, scores: Record<string, number> }}
   */
  static classify(analyzedDoc, rhymeAnalysis) {
    const stats = analyzedDoc.stats;
    const rhymeStats = rhymeAnalysis.statistics;
    
    const scores = {
      [GENRES.RAP]: 0,
      [GENRES.POETRY]: 0,
      [GENRES.SONG]: 0,
      [GENRES.PROSE]: 0
    };

    // 1. Rhyme Density Signature
    const internalRhymeRatio = rhymeStats.internalCount / (stats.wordCount || 1);
    const multiSyllableRatio = rhymeStats.multiSyllableCount / (rhymeStats.endRhymeCount || 1);
    
    if (internalRhymeRatio > 0.08) scores[GENRES.RAP] += 25;
    if (multiSyllableRatio > 0.3) scores[GENRES.RAP] += 20;
    
    // 2. Meter & Rhythm Signature
    const meter = rhymeAnalysis.stressProfile || { coherence: 0 };
    if (meter.coherence > 0.85) scores[GENRES.POETRY] += 30;
    else if (meter.coherence > 0.6) scores[GENRES.SONG] += 20;
    else scores[GENRES.RAP] += 15; // Rap has rhythmic but often "broken" metrical coherence

    // 3. Repetition & Structure
    const repetitionRatio = stats.uniqueWordCount / (stats.wordCount || 1);
    if (repetitionRatio < 0.5) scores[GENRES.SONG] += 25; // High repetition in songs (choruses)
    
    const avgLineLen = stats.wordCount / (stats.lineCount || 1);
    if (avgLineLen > 12) scores[GENRES.PROSE] += 40;
    
    // 4. Vocabulary Density
    if (stats.longWordRatio > 0.15) scores[GENRES.POETRY] += 20;

    // Normalize and pick top
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topGenre = sorted[0][0];
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? scores[topGenre] / totalScore : 0;

    return {
      genre: topGenre,
      confidence,
      scores
    };
  }
}
