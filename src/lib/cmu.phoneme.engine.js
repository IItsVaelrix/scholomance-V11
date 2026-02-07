/**
 * @typedef {import('./phoneme.engine').PhonemeAnalysis} PhonemeAnalysis
 */

// CMU-based Phoneme Analysis Engine
// Note: cmudict is a Node.js library that reads from the filesystem
// It does NOT work in browser environments - we detect this and skip it

const isBrowser = typeof window !== 'undefined';

/**
 * Mapping from ARPAbet phonemes to the project's vowel families.
 * @type {Object<string, string>}
 */
const arpabetToVowelFamily = {
  'AO': 'AO', 'AA': 'A', 'IY': 'IY', 'UW': 'UW', 'EH': 'EH', 'IH': 'IH',
  'UH': 'UH', 'AH': 'A', 'AX': 'A', 'AE': 'AE', 'EY': 'EY', 'AY': 'AY',
  'OW': 'OW', 'AW': 'AW', 'OY': 'OY', 'ER': 'ER',
};

/**
 * A phoneme engine that uses the CMU Pronouncing Dictionary.
 * In browser environments, this gracefully returns null to use the fallback engine.
 * @namespace CmuPhonemeEngine
 */
export const CmuPhonemeEngine = {
  /**
   * Checks if CMU dictionary is available.
   * @returns {boolean}
   */
  isAvailable() {
    // CMU dictionary is not available in browser environments
    return false;
  },

  /**
   * Analyzes a word using the CMU dictionary.
   * @param {string} word - The word to analyze.
   * @returns {PhonemeAnalysis | null} The analysis result, or null if not available.
   */
  analyzeWord(word) {
    // In browser environments, return null to use fallback
    // The cmudict package requires Node.js filesystem access
    if (isBrowser) {
      return null;
    }

    // For Node.js environments (tests, SSR), we could load CMU here
    // But for now, return null and use the improved fallback
    return null;
  },
};
