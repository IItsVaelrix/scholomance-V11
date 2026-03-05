/**
 * CODEx Phoneme Constants
 * Based on ARPAbet and Sonority Sequencing Principle.
 */

/**
 * ARPAbet Vowel set.
 * These are the phonemes that carry stress markers (0, 1, 2).
 */
export const ARPABET_VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'UR'
]);

/**
 * ARPAbet Consonant set.
 */
export const ARPABET_CONSONANTS = new Set([
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'
]);

/**
 * Sonority levels for the Sonority Sequencing Principle (SSP).
 * Higher value = More sonorous.
 */
export const SONORITY_HIERARCHY = {
  // Vowels (Highest)
  'AA': 10, 'AE': 10, 'AH': 10, 'AO': 10, 'AW': 10, 'AY': 10,
  'EH': 10, 'ER': 10, 'EY': 10, 'IH': 10, 'IY': 10, 'OW': 10,
  'OY': 10, 'UH': 10, 'UW': 10, 'UR': 10,

  // Glides
  'W': 9, 'Y': 9,

  // Liquids
  'L': 8, 'R': 8,

  // Nasals
  'M': 7, 'N': 7, 'NG': 7,

  // Fricatives
  'V': 6, 'Z': 6, 'ZH': 6, 'DH': 6,
  'F': 5, 'S': 5, 'SH': 5, 'TH': 5, 'HH': 5,

  // Affricates
  'JH': 4, 'CH': 4,

  // Stops (Lowest)
  'B': 3, 'D': 3, 'G': 3,
  'P': 2, 'T': 2, 'K': 2
};

/**
 * Maps ARPAbet vowels to their base vowel families before normalization.
 * Aligned with src/lib/phonology/vowelFamily.js normalization.
 */
export const VOWEL_TO_BASE_FAMILY = {
  'AA': 'AA',
  'AH': 'AH',
  'AX': 'AX',
  'AW': 'AW',
  'AE': 'AE',
  'EH': 'EH',
  'AO': 'AO',
  'OW': 'OW',
  'OY': 'OY',
  'UW': 'UW',
  'UH': 'UH',
  'UR': 'UR',
  'IY': 'IY',
  'IH': 'IH',
  'ER': 'ER',
  'EY': 'EY',
  'AY': 'AY',
};

/**
 * Phonetic pronunciation names for all alphabet characters.
 * Used when letters are parsed as individual tokens.
 */
export const ALPHABET_PHONETIC_MAP = {
  'A': ['EY1'],
  'B': ['B', 'IY1'],
  'C': ['S', 'IY1'],
  'D': ['D', 'IY1'],
  'E': ['IY1'],
  'F': ['EH1', 'F'],
  'G': ['JH', 'IY1'],
  'H': ['EY1', 'CH'],
  'I': ['AY1'],
  'J': ['JH', 'EY1'],
  'K': ['K', 'EY1'],
  'L': ['EH1', 'L'],
  'M': ['EH1', 'M'],
  'N': ['EH1', 'N'],
  'O': ['OW1'],
  'P': ['P', 'IY1'],
  'Q': ['K', 'Y', 'UW1'],
  'R': ['AA1', 'R'],
  'S': ['EH1', 'S'],
  'T': ['T', 'IY1'],
  'U': ['Y', 'UW1'],
  'V': ['V', 'IY1'],
  'W': ['D', 'AH1', 'B', 'AH0', 'L', 'Y', 'UW0'],
  'X': ['EH1', 'K', 'S'],
  'Y': ['W', 'AY1'],
  'Z': ['Z', 'IY1']
};

/**
 * Phoneme mappings for common English digraphs.
 */
export const DIGRAPH_MAP = {
  'TH': ['TH'],
  'PH': ['F'],
  'SH': ['SH'],
  'CH': ['CH'],
  'GH': ['G'],
  'WH': ['W'],
  'QU': ['K', 'W'],
  'NG': ['NG'],
  'CK': ['K'],
  'OY': ['OY'],
};
