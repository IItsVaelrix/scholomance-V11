/**
 * @file This file implements a Quality Assurance (QA) test for the phoneme analysis engine.
 * It calculates the Phoneme Error Rate (PER) to quantitatively measure the accuracy of
 * the grapheme-to-phoneme conversion.
 *
 * To run this, you would need a test runner like Jest or Vitest configured in your project.
 */

// Assume the core phoneme engine can be imported. The actual path may vary.
import { PhonemeEngine } from "../../../src/lib/phoneme.engine.js";
import { ScholomanceDictionaryAPI } from "../../../src/lib/scholomanceDictionary.api.js";
import { describe, test, expect, beforeAll, vi } from "vitest";

/**
 * The phoneme engine expects a `lookupBatch` method on the ScholomanceDictionaryAPI
 * which is planned but not yet implemented on the client. We will mock it here
 * to ensure the test can run and correctly exercises the engine's logic.
 */
ScholomanceDictionaryAPI.lookupBatch = vi.fn().mockImplementation(async (words) => {
  // For this test, we can provide mock "authoritative" vowel families.
  // This simulates the dictionary overriding the engine's G2P guess.
  const mockFamilies = {
    SCHOLOMANCE: "OW", // We authoritatively state 'scholomance' has an 'OW' vowel family.
  };
  const results = {};
  words.forEach((word) => {
    if (mockFamilies[word.toUpperCase()]) results[word.toUpperCase()] = mockFamilies[word.toUpperCase()];
  });
  return results;
});
/**
 * A "golden set" of words with known-correct ARPAbet transcriptions.
 * This set should be expanded significantly to cover various phonetic rules and edge cases.
 * It serves as the ground truth for our accuracy evaluation.
 */
const goldenSet = {
  phoneme: ["F", "OW1", "N", "IY2", "M"],
  error: ["EH1", "R", "ER0"],
  rate: ["R", "EY1", "T"],
  scholomance: ["S", "K", "OW1", "L", "AH0", "M", "AE2", "N", "S"], // A hypothetical transcription
  through: ["TH", "R", "UW1"],
  tough: ["T", "AH1", "F"],
  alliteration: ["AH0", "L", "IH2", "T", "ER0", "EY1", "SH", "AH0", "N"],
};

/**
 * Calculates the Levenshtein distance between two arrays of phonemes.
 * This distance is the number of substitutions, insertions, or deletions
 * required to change one sequence into the other.
 * @param {string[]} source The source phoneme array (from our engine).
 * @param {string[]} target The target phoneme array (from the golden set).
 * @returns {number} The Levenshtein distance.
 */
function calculatePhonemeDistance(source, target) {
  const matrix = Array(target.length + 1)
    .fill(null)
    .map(() => Array(source.length + 1).fill(null));
  for (let i = 0; i <= source.length; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= target.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= target.length; j++) {
    for (let i = 1; i <= source.length; i++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // Deletion
        matrix[j - 1][i] + 1, // Insertion
        matrix[j - 1][i - 1] + cost, // Substitution
      );
    }
  }
  return matrix[target.length][source.length];
}

describe("CODEx Phoneme Engine Accuracy (QA)", () => {
  beforeAll(async () => {
    // Initialize the engine and its dictionaries
    await PhonemeEngine.init();
    // Pre-load authoritative vowel families for the test words from our mock
    await PhonemeEngine.ensureAuthorityBatch(Object.keys(goldenSet));
  });

  test("Phoneme Error Rate (PER) should be below a target threshold", () => {
    let totalPhonemes = 0;
    let totalErrors = 0;

    for (const word in goldenSet) {
      const expectedPhonemes = goldenSet[word];
      // Use the synchronous analyzeWord method after pre-loading authority data
      const analysisResult = PhonemeEngine.analyzeWord(word);
      const actualPhonemes = analysisResult?.phonemes || [];

      totalPhonemes += expectedPhonemes.length;
      totalErrors += calculatePhonemeDistance(actualPhonemes, expectedPhonemes);
    }

    const phonemeErrorRate =
      totalPhonemes > 0 ? (totalErrors / totalPhonemes) * 100 : 0;

    console.log(`\n--- Phoneme Accuracy Report ---`);
    console.log(`Total Words Tested: ${Object.keys(goldenSet).length}`);
    console.log(`Total Phonemes in Golden Set: ${totalPhonemes}`);
    console.log(`Total Errors (Substitutions/Deletions/Insertions): ${totalErrors}`);
    console.log(`Phoneme Error Rate (PER): ${phonemeErrorRate.toFixed(2)}%`);

    // Set a realistic threshold. For a system relying on APIs, even 5-10% might be a good start.
    expect(phonemeErrorRate).toBeLessThan(10.0);
  });
});