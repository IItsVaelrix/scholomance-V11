/**
 * The CODEx Tokenizer Engine.
 * Responsible for the pipeline: Text -> Tokens -> Phonemes.
 *
 * The word analysis function is injected via `createTokenizer()`,
 * keeping this module decoupled from any specific phoneme engine. Also provides
 * utility functions related to phoneme analysis, like mapping vowel families
 * to magic schools.
 *
 * @see AI_Architecture_V2.md section 5.2
 */

// This mapping is based on the thematic associations of vowel sounds.
// It should be considered part of the core game logic.
const VOWEL_FAMILY_TO_SCHOOL = {
    'AA': 'SONIC', 'AE': 'SONIC', 'AH': 'SONIC', // Open, frontal sounds
    'AO': 'VOID',  'AW': 'VOID',  'OW': 'VOID',  'UW': 'VOID', // Deep, back sounds
    'AY': 'ALCHEMY','EY': 'ALCHEMY','OY': 'ALCHEMY', // Diphthongs, transformative sounds
    'EH': 'WILL',  'ER': 'WILL',  'UH': 'WILL', // Guttural, forceful sounds
    'IH': 'PSYCHIC','IY': 'PSYCHIC', // High, sharp, piercing sounds
};

/**
 * Maps a vowel family from a phoneme analysis to a School of Magic.
 * @param {string} vowelFamily The vowel family string (e.g., "AY", "IY").
 * @returns {string|null} The corresponding school name or null if not found.
 */
function getSchoolFromVowelFamily(vowelFamily) {
    if (!vowelFamily) return null;
    return VOWEL_FAMILY_TO_SCHOOL[vowelFamily.toUpperCase()] || null;
}

/**
 * Tokenizes a line of text into words.
 * @param {string} text - The input text.
 * @returns {string[]} An array of words.
 */
export function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().match(/\b(\w+)\b/g) || [];
}

/**
 * Creates a tokenizer instance bound to a word analysis function.
 * @param {function(string): import('./schemas').PhonemeAnalysis|null} analyzeWordFn - The function that analyzes a single word.
 * @returns {{ tokenize: function(string): string[], analyzeWord: function(string): import('./schemas').PhonemeAnalysis|null, processLine: function(string): import('./schemas').PhonemeAnalysis[], getSchoolFromVowelFamily: function(string): string|null }}
 */
export function createTokenizer(analyzeWordFn) {
  function analyzeWord(word) {
    if (!word) return null;
    return analyzeWordFn(word);
  }

  function processLine(text) {
    const tokens = tokenize(text);
    return tokens.map(analyzeWord).filter(Boolean);
  }

  return { tokenize, analyzeWord, processLine, getSchoolFromVowelFamily };
}
