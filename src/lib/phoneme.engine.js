/**
 * @typedef {object} PhonemeAnalysis
 * @property {string} vowelFamily - The vowel family of the word.
 * @property {string[]} phonemes - The phonemes of the word.
 * @property {string | null} coda - The coda of the word.
 * @property {string} rhymeKey - A key for rhyme matching.
 * @property {number} syllableCount - The number of syllables in the word.
 */

/**
 * @typedef {object} SyllableAnalysis
 * @property {number} index - Position in word (0-indexed from start).
 * @property {string} vowel - Primary vowel phoneme with stress (e.g., "IY1").
 * @property {string} vowelFamily - Mapped vowel family.
 * @property {string} onset - Consonants before vowel.
 * @property {string} coda - Consonants after vowel.
 * @property {number} stress - Stress level (0, 1, 2).
 */

/**
 * @typedef {object} DeepWordAnalysis
 * @property {string} word - Original word.
 * @property {string[]} phonemes - Full phoneme array.
 * @property {SyllableAnalysis[]} syllables - Per-syllable breakdown.
 * @property {number} syllableCount - Total syllables.
 * @property {string} rhymeKey - Primary rhyme key (final syllable).
 * @property {string[]} extendedRhymeKeys - Multi-syllable rhyme keys.
 * @property {string} stressPattern - Binary stress pattern (e.g., "0101").
 */

/** Vowels in ARPAbet that carry stress markers */
const ARPABET_VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AX', 'AY',
  'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'
]);

/** Maps ARPAbet vowels to vowel families */
const ARPABET_TO_FAMILY = {
  'AA': 'A', 'AE': 'AE', 'AH': 'A', 'AO': 'AO', 'AW': 'AW', 'AX': 'A',
  'AY': 'AY', 'EH': 'EH', 'ER': 'ER', 'EY': 'EY', 'IH': 'IH', 'IY': 'IY',
  'OW': 'OW', 'OY': 'OY', 'UH': 'UH', 'UW': 'UW'
};

import { z } from "zod";
import { CmuPhonemeEngine } from "./cmu.phoneme.engine";

const VOWEL_FAMILY_TO_SCHOOL = {
  AA: "SONIC", AE: "SONIC", AH: "SONIC",
  AO: "VOID", AW: "VOID", OW: "VOID", UW: "VOID",
  AY: "ALCHEMY", EY: "ALCHEMY", OY: "ALCHEMY",
  EH: "WILL", ER: "WILL", UH: "WILL",
  IH: "PSYCHIC", IY: "PSYCHIC",
};

const PhonemeDictSchema = z.object({
  vowel_families: z.array(z.unknown())
}).passthrough();
const PhonemeRulesSchema = z.record(z.unknown());

/**
 * Phoneme Analysis Engine for ST-XPD Vowel Family System.
 * This engine analyzes a word and returns its phoneme structure.
 * It uses a CMU-based engine first and falls back to a simpler regex-based analysis.
 * @namespace PhonemeEngine
 */
export const PhonemeEngine = {
  /** @type {object | null} */
  DICT_V2: null,
  /** @type {object | null} */
  RULES_V2: null,
  /** @type {Map<string, PhonemeAnalysis>} */
  WORD_CACHE: new Map(),

  /**
   * Clears the word analysis cache.
   * Call this when patterns or exceptions change.
   */
  clearCache() {
    this.WORD_CACHE.clear();
  },

  /**
   * Initializes the engine by fetching dictionary and rules files.
   * @returns {Promise<number>} The number of vowel families loaded.
   */
  async init() {
    // Clear cache on init to ensure fresh analysis with latest patterns
    this.clearCache();

    try {
      const [dictRaw, rulesRaw] = await Promise.all([
        fetch("/phoneme_dictionary_v2.json").then((r) => r.json()),
        fetch("/rhyme_matching_rules_v2.json").then((r) => r.json()),
      ]);

      const dictParsed = PhonemeDictSchema.safeParse(dictRaw);
      const rulesParsed = PhonemeRulesSchema.safeParse(rulesRaw);
      if (!dictParsed.success || !rulesParsed.success) {
        throw new Error("Invalid phoneme dictionary payload");
      }

      this.DICT_V2 = dictParsed.data;
      this.RULES_V2 = rulesParsed.data;

      console.log(`ST-XPD v2 Active: ${dictParsed.data.vowel_families.length} Families.`);
      return dictParsed.data.vowel_families.length;
    } catch (err) {
      console.warn("PhonemeEngine: Using demo mode (dictionary files not found)");
      // Return a fallback for demo mode
      return 14;
    }
  },

  /**
   * Analyzes a word to determine its phoneme structure.
   * @param {string} word - The word to analyze.
   * @returns {PhonemeAnalysis | null} The analysis result, or null if the word is empty.
   */
  analyzeWord(word) {
    const upper = String(word || "").toUpperCase();
    if (!upper) return null;

    // Check cache first
    if (this.WORD_CACHE.has(upper)) {
      return this.WORD_CACHE.get(upper);
    }

    // Use CMU Engine first
    const cmuResult = CmuPhonemeEngine.analyzeWord(upper);
    if (cmuResult) {
        this.WORD_CACHE.set(upper, cmuResult);
        return cmuResult;
    }

    // Fallback: pattern-based analysis using English spelling rules
    const vowelMatch = upper.match(/[AEIOU]+/g);
    if (!vowelMatch) {
      /** @type {PhonemeAnalysis} */
      const result = {
        vowelFamily: "UH",
        phonemes: upper.split(""),
        coda: null,
        rhymeKey: "UH-open",
        syllableCount: 1,
      };
      this.WORD_CACHE.set(upper, result);
      return result;
    }

    // Pass the full word to guessVowelFamily for pattern matching
    const vowelFamily = this.guessVowelFamily(upper);
    const coda = this.extractCoda(upper);
    const phonemes = this.splitToPhonemes(upper);

    // Count syllables by counting vowel phonemes
    const syllableCount = phonemes.filter(p =>
      ARPABET_VOWELS.has(p.replace(/[0-9]/g, ''))
    ).length || 1;

    /** @type {PhonemeAnalysis} */
    const result = {
      vowelFamily,
      phonemes,
      coda,
      rhymeKey: `${vowelFamily}-${coda || "open"}`,
      syllableCount,
    };

    this.WORD_CACHE.set(upper, result);
    return result;
  },

  /**
   * Guesses the vowel family from the full word using English spelling patterns.
   * @param {string} word - The full word (uppercase).
   * @returns {string} The guessed vowel family.
   */
  guessVowelFamily(word) {
    // Exceptions: common words where spelling doesn't match pronunciation
    // These override the pattern-based rules below
    const EXCEPTIONS = {
      // -ome/-one/-ove words pronounced with /ʌ/ not /oʊ/
      'SOME': 'A', 'COME': 'A', 'DONE': 'A', 'NONE': 'A', 'GONE': 'AO',
      'LOVE': 'A', 'DOVE': 'A', 'SHOVE': 'A', 'GLOVE': 'A', 'ABOVE': 'A',
      'COVER': 'A', 'HOVER': 'A', 'OVEN': 'A', 'DOZEN': 'A',
      // -other/-oney/-onth words
      'MOTHER': 'A', 'OTHER': 'A', 'BROTHER': 'A', 'SMOTHER': 'A',
      'MONEY': 'A', 'HONEY': 'A', 'MONTH': 'A', 'FRONT': 'A',
      'WONDER': 'A', 'MONKEY': 'A', 'TONGUE': 'A', 'YOUNG': 'A',
      // Other irregular words
      'BLOOD': 'A', 'FLOOD': 'A',  // not /uː/ like "food"
      'DOES': 'A',                  // not /oʊ/ like "goes"
      'WORD': 'ER', 'WORK': 'ER', 'WORLD': 'ER', 'WORM': 'ER', 'WORTH': 'ER', 'WORST': 'ER',
      'COULD': 'UH', 'WOULD': 'UH', 'SHOULD': 'UH',  // silent L, /ʊ/ sound
      'SAID': 'EH', 'SAYS': 'EH',  // not /eɪ/ like "paid"
      'HAVE': 'AE', 'GIVE': 'IH', 'LIVE': 'IH',  // short vowels despite -ve ending

      // -ite words with long E sound (IY), not AY diphthong
      'ELITE': 'IY', 'PETITE': 'IY', 'SUITE': 'IY', 'ANTIQUE': 'IY',
      // /uːt/ words that often rhyme with BOOT
      'SUIT': 'UW', 'FRUIT': 'UW', 'RECRUIT': 'UW',

      // -ical/-acle words have IH sound
      'LYRICAL': 'IH', 'MIRACLE': 'IH', 'TYPICAL': 'IH', 'MAGICAL': 'IH',
      'MYSTICAL': 'IH', 'RICAL': 'IH', 'ETICAL': 'IH',
      'CRITICAL': 'IH', 'COMICAL': 'IH', 'BIBLICAL': 'IH', 'EMPIRICAL': 'IH',
      'SPHERICAL': 'IH', 'CLERICAL': 'IH', 'SATIRICAL': 'IH', 'NUMERICAL': 'IH',

      // Guardian/AR sound words
      'GUARDIAN': 'A', 'GUARD': 'A',

      // Gaia/Mayan have AY diphthong, not EY
      'GAIA': 'AY', 'MAYAN': 'AY', 'MAYA': 'AY', 'PAPAYA': 'AY',

      // -osed words have OW sound (same as "show")
      'CLOSED': 'OW', 'POSED': 'OW', 'COMPOSED': 'OW', 'DISPOSED': 'OW',
      'EXPOSED': 'OW', 'IMPOSED': 'OW', 'PROPOSED': 'OW', 'SUPPOSED': 'OW',

      // -orm/-ore words have AO sound (like "core")
      'WAVEFORM': 'AO', 'FORM': 'AO', 'STORM': 'AO', 'NORM': 'AO',
      'TRANSFORM': 'AO', 'PERFORM': 'AO', 'INFORM': 'AO', 'REFORM': 'AO',
      'UNIFORM': 'AO', 'PLATFORM': 'AO',
      "YOU'RE": 'AO', 'YOUR': 'AO', 'CORE': 'AO', 'FORE': 'AO',

      // Nautical/impossible have AO sound
      'NAUTICAL': 'AO', 'IMPOSSIBLE': 'AO', 'AUDIBLE': 'AO', 'AWFUL': 'AO',
      'AUTUMN': 'AO', 'AUTHOR': 'AO', 'CAUTION': 'AO', 'CAUGHT': 'AO',

      // -one/-own words have OW sound (own pattern)
      'BONE': 'OW', 'TONE': 'OW', 'PHONE': 'OW', 'ALONE': 'OW',
      'PRONE': 'OW', 'OWN': 'OW', 'DISOWN': 'OW', 'ZONE': 'OW',
      'STONE': 'OW', 'THRONE': 'OW', 'CLONE': 'OW', 'CONE': 'OW',
      'KNOWN': 'OW', 'SHOWN': 'OW', 'GROWN': 'OW', 'BLOWN': 'OW',
      'FLOWN': 'OW', 'THROWN': 'OW', 'SOWN': 'OW', 'MOWN': 'OW',

      // water/slaughter have AO sound
      'WATER': 'AO', 'SLAUGHTER': 'AO', 'DAUGHTER': 'AO', 'LAUGHTER': 'AE',
      'QUARTER': 'AO', 'ALTAR': 'AO', 'FALTER': 'AO', 'HALTER': 'AO',

      // motto/model/bottle have short O (A family)
      'MOTTO': 'A', 'MODEL': 'A', 'BOTTLE': 'A', 'THROTTLE': 'A',
      'WADDLE': 'A', 'TOGGLE': 'A', 'COBBLE': 'A', 'GOBBLE': 'A',
      'HOSTILE': 'A', 'FOSSIL': 'A', 'COPPER': 'A', 'DOLLAR': 'A',

      // magnum/atoms have AE sound
      'MAGNUM': 'AE', 'ATOMS': 'AE', 'ATOM': 'AE', 'MAXIMUM': 'AE',
      'PLATINUM': 'AE', 'STADIUM': 'AE', 'DRAGON': 'AE', 'WAGON': 'AE',

      // now/sound/round/wow/pow have AW diphthong
      'NOW': 'AW', 'SOUND': 'AW', 'ROUND': 'AW', 'WOW': 'AW', 'POW': 'AW',
      'FOUND': 'AW', 'GROUND': 'AW', 'BOUND': 'AW', 'POUND': 'AW',
      'MOUND': 'AW', 'WOUND': 'AW', 'HOUND': 'AW', 'LOUD': 'AW',
      'PROUD': 'AW', 'CLOUD': 'AW', 'CROWD': 'AW', 'BROWN': 'AW',
      'DOWN': 'AW', 'TOWN': 'AW', 'GOWN': 'AW', 'CROWN': 'AW', 'FROWN': 'AW',
      'DROWN': 'AW', 'CLOWN': 'AW', 'HOW': 'AW', 'COW': 'AW', 'BOW': 'AW',
      'ALLOW': 'AW', 'ENDOW': 'AW', 'AVOW': 'AW', 'MEOW': 'AW',
    };

    if (EXCEPTIONS[word]) {
      return EXCEPTIONS[word];
    }

    // Common English spelling patterns mapped to vowel families
    // Order matters - check more specific patterns first
    const SPELLING_PATTERNS = [
      // R-controlled vowels
      [/ORE$/, 'AO'],      // core, more, store, shore
      [/OOR$/, 'AO'],      // door, floor, poor
      [/OAR$/, 'AO'],      // roar, soar, board
      [/OUR$/, 'AO'],      // four, pour, court
      [/AR$/, 'A'],        // car, star, far
      [/AIR$/, 'EH'],      // fair, hair, air
      [/ARE$/, 'EH'],      // care, share, bare
      [/EAR$/, 'IY'],      // hear, fear, near (but not "bear")
      [/EER$/, 'IY'],      // beer, steer, deer
      [/IRE$/, 'AY'],      // fire, wire, hire
      [/ERE$/, 'IY'],      // here, mere
      [/URE$/, 'UW'],      // pure, cure, sure

      // Magic-e / Silent-e patterns (VCe)
      [/[^AEIOU]I[^AEIOU]E$/, 'AY'],   // like, time, mine, fire, hide
      [/[^AEIOU]A[^AEIOU]E$/, 'EY'],   // make, name, fate, cake, late
      [/[^AEIOU]O[^AEIOU]E$/, 'OW'],   // bone, home, tone, note (but not -ore)
      [/[^AEIOU]U[^AEIOU]E$/, 'UW'],   // cute, mute, tune, dune
      [/[^AEIOU]E[^AEIOU]E$/, 'IY'],   // these, Pete

      // Common vowel digraphs
      [/AI/, 'EY'],        // rain, pain, main
      [/AY$/, 'EY'],       // day, say, play
      [/AY/, 'EY'],        // maybe, player
      [/EE/, 'IY'],        // see, tree, bleed
      [/EA/, 'IY'],        // beat, meat, read (present)
      [/OA/, 'OW'],        // boat, coat, road
      [/OO/, 'UW'],        // moon, food, cool
      [/OUL/, 'OW'],       // soul, shoulder, boulder, mould (before general OU)
      [/OU/, 'AW'],        // out, house, cloud
      [/OW$/, 'OW'],       // know, show, flow
      [/OW/, 'AW'],        // how, now, cow (medial)
      [/OI/, 'OY'],        // oil, coin, voice
      [/OY/, 'OY'],        // boy, joy, toy
      [/AU/, 'AO'],        // caught, taught, haul
      [/AW/, 'AO'],        // law, saw, draw
      [/EW/, 'UW'],        // new, few, grew
      [/UE$/, 'UW'],       // true, blue, clue
      [/IE$/, 'AY'],       // lie, die, tie
      [/Y$/, 'IY'],        // happy, baby, lucky (final y as vowel)

      // Word-final open O is long-O (dojo, mojo, popo, solo, memo)
      [/O$/, 'OW'],

      // Single vowel fallbacks (checked last)
      [/I(?=[^AEIOU]*$)/, 'IH'],  // final syllable with I: hit, sit
      [/E(?=[^AEIOU]*$)/, 'EH'],  // final syllable with E: bed, red
      [/A(?=[^AEIOU]*$)/, 'AE'],  // final syllable with A: cat, bat
      [/O(?=[^AEIOU]*$)/, 'A'],   // final syllable with O + consonants: hot, got
      [/U(?=[^AEIOU]*$)/, 'AH'],  // final syllable with U: but, cut
    ];

    for (const [pattern, family] of SPELLING_PATTERNS) {
      if (pattern.test(word)) {
        return family;
      }
    }

    // Ultimate fallback: find any vowel
    const vowelMatch = word.match(/[AEIOU]/);
    if (vowelMatch) {
      const fallbackMap = { A: "A", E: "EH", I: "IH", O: "AO", U: "UH" };
      return fallbackMap[vowelMatch[0]] || "A";
    }

    return "A";
  },

  /**
   * Maps a vowel family to a School of Magic.
   * @param {string} vowelFamily - The vowel family string.
   * @returns {string | null} The corresponding school or null.
   */
  getSchoolFromVowelFamily(vowelFamily) {
    if (!vowelFamily) return null;
    return VOWEL_FAMILY_TO_SCHOOL[String(vowelFamily).toUpperCase()] || null;
  },

  /**
   * Extracts the coda from a word.
   * @param {string} word - The word.
   * @returns {string | null} The coda, or null if not found.
   */
  extractCoda(word) {
    const match = word.match(/[^AEIOU]+$/);
    return match ? match[0] : null;
  },

  /**
   * Splits a word into simplified ARPAbet-compatible phonemes (fallback).
   * @param {string} word - The word.
   * @returns {string[]} An array of phonemes.
   */
  splitToPhonemes(word) {
    // Maps single vowels to ARPAbet equivalents
    const VOWEL_TO_ARPABET = {
      'A': 'AA', 'E': 'EH', 'I': 'IH', 'O': 'AO', 'U': 'AH',
    };
    // Maps common digraphs to ARPAbet
    const DIGRAPH_TO_ARPABET = {
      'AI': 'AY', 'AY': 'AY', 'EE': 'IY', 'EA': 'IY', 'OO': 'UW',
      'OU': 'AW', 'OW': 'OW', 'OI': 'OY', 'OY': 'OY', 'AU': 'AO',
      'IE': 'IY', 'EI': 'EY', 'UE': 'UW', 'EW': 'UW',
    };

    const phonemes = [];
    let i = 0;
    let syllableIndex = 0;

    while (i < word.length) {
      const char = word[i];
      const next = word[i + 1] || '';
      const digraph = char + next;

      if (/[AEIOU]/.test(char)) {
        // Handle final -UIT words (SUIT, FRUIT) as /UW/.
        if (digraph === 'UI' && /UIT$/.test(word.slice(i))) {
          const stress = syllableIndex % 2 === 0 ? '1' : '0';
          phonemes.push('UW' + stress);
          syllableIndex++;
          i += 2;
          continue;
        }

        // Check for vowel digraph first
        if (DIGRAPH_TO_ARPABET[digraph]) {
          // Alternate stress: 1 for odd syllables, 0 for even
          const stress = syllableIndex % 2 === 0 ? '1' : '0';
          phonemes.push(DIGRAPH_TO_ARPABET[digraph] + stress);
          syllableIndex++;
          i += 2;
        } else {
          // Single vowel
          const stress = syllableIndex % 2 === 0 ? '1' : '0';
          phonemes.push((VOWEL_TO_ARPABET[char] || 'AH') + stress);
          syllableIndex++;
          i++;
        }
      } else if (/[A-Z]/.test(char)) {
        phonemes.push(char);
        i++;
      } else {
        i++;
      }
    }
    return phonemes;
  },

  /**
   * Checks if two codas are in the same mutation group.
   * @param {string} codaA - The first coda.
   * @param {string} codaB - The second coda.
   * @returns {boolean} True if they are in the same group.
   */
  checkCodaMutation(codaA, codaB) {
    if (!this.DICT_V2?.consonant_groups?.coda_groups) return false;
    const groups = this.DICT_V2.consonant_groups.coda_groups;
    for (const group in groups) {
      if (groups[group].includes(codaA) && groups[group].includes(codaB)) {
        return true;
      }
    }
    return false;
  },

  /**
   * Analyzes a word and returns detailed syllable breakdown.
   * @param {string} word - The word to analyze.
   * @returns {DeepWordAnalysis | null} Deep analysis with syllables.
   */
  analyzeDeep(word) {
    const basic = this.analyzeWord(word);
    if (!basic) return null;

    const syllables = this.analyzeSyllables(basic.phonemes);
    const extendedRhymeKeys = this.getExtendedRhymeKeys(syllables);
    const stressPattern = this.getStressPattern(syllables);

    return {
      word: String(word).toUpperCase(),
      phonemes: basic.phonemes,
      syllables,
      syllableCount: syllables.length,
      rhymeKey: basic.rhymeKey,
      extendedRhymeKeys,
      stressPattern,
    };
  },

  /**
   * Breaks phoneme array into syllable objects.
   * @param {string[]} phonemes - ARPAbet phoneme array.
   * @returns {SyllableAnalysis[]} Array of syllable analyses.
   */
  analyzeSyllables(phonemes) {
    if (!phonemes || !Array.isArray(phonemes)) return [];

    const syllables = [];
    let currentOnset = [];
    let syllableIndex = 0;

    for (let i = 0; i < phonemes.length; i++) {
      const phoneme = phonemes[i];
      const basePhoneme = phoneme.replace(/[0-9]/g, '');
      const stressMatch = phoneme.match(/[0-9]/);
      const stress = stressMatch ? parseInt(stressMatch[0], 10) : -1;

      if (ARPABET_VOWELS.has(basePhoneme)) {
        // This is a vowel - it's the nucleus of a syllable
        const coda = [];

        // Look ahead for coda consonants
        let j = i + 1;
        while (j < phonemes.length) {
          const nextPhoneme = phonemes[j].replace(/[0-9]/g, '');
          if (ARPABET_VOWELS.has(nextPhoneme)) {
            // Next vowel found - split consonants between coda and next onset
            // Use maximal onset principle: give consonants to next syllable when possible
            break;
          }
          coda.push(phonemes[j]);
          j++;
        }

        // If there are consonants between this vowel and the next,
        // the last consonant(s) may belong to the next syllable's onset
        let actualCoda = [...coda];
        if (j < phonemes.length && coda.length > 0) {
          // Leave at least one consonant for next syllable's onset if there are multiple
          if (coda.length > 1) {
            actualCoda = coda.slice(0, -1);
          } else {
            actualCoda = [];
          }
        }

        syllables.push({
          index: syllableIndex,
          vowel: phoneme,
          vowelFamily: ARPABET_TO_FAMILY[basePhoneme] || basePhoneme,
          onset: currentOnset.join(''),
          coda: actualCoda.join(''),
          stress: stress >= 0 ? stress : 0,
        });

        syllableIndex++;
        currentOnset = coda.slice(actualCoda.length);
        i = j - 1; // Skip processed consonants
      } else {
        // Consonant - add to current onset
        currentOnset.push(phoneme);
      }
    }

    return syllables;
  },

  /**
   * Generates extended rhyme keys for multi-syllable matching.
   * @param {SyllableAnalysis[]} syllables - Syllable breakdown.
   * @param {number} maxSyllables - Maximum syllables to include.
   * @returns {string[]} Array of rhyme keys from 1 to maxSyllables.
   */
  getExtendedRhymeKeys(syllables, maxSyllables = 4) {
    if (!syllables || syllables.length === 0) return [];

    const keys = [];
    const reversed = [...syllables].reverse(); // End-first

    for (let count = 1; count <= Math.min(maxSyllables, reversed.length); count++) {
      const parts = [];
      for (let i = 0; i < count; i++) {
        const syl = reversed[i];
        parts.unshift(`${syl.vowelFamily}-${syl.coda || 'open'}`);
      }
      keys.push(parts.join('/'));
    }

    return keys;
  },

  /**
   * Extracts binary stress pattern from syllables.
   * @param {SyllableAnalysis[]} syllables - Syllable breakdown.
   * @returns {string} Binary pattern (e.g., "0101" for iambic).
   */
  getStressPattern(syllables) {
    if (!syllables || syllables.length === 0) return '';
    return syllables.map(s => s.stress > 0 ? '1' : '0').join('');
  },

  /**
   * Scores multi-syllable rhyme match between two words.
   * @param {DeepWordAnalysis} wordA - First word analysis.
   * @param {DeepWordAnalysis} wordB - Second word analysis.
   * @returns {{ syllablesMatched: number, score: number, type: string }}
   */
  scoreMultiSyllableMatch(wordA, wordB) {
    if (!wordA?.syllables || !wordB?.syllables) {
      return { syllablesMatched: 0, score: 0, type: 'none' };
    }

    const syllablesA = [...wordA.syllables].reverse();
    const syllablesB = [...wordB.syllables].reverse();

    let matchedSyllables = 0;
    let totalScore = 0;

    const minLen = Math.min(syllablesA.length, syllablesB.length);

    for (let i = 0; i < minLen; i++) {
      const sylA = syllablesA[i];
      const sylB = syllablesB[i];

      // Score this syllable pair
      let sylScore = 0;

      // Vowel family match (most important)
      if (sylA.vowelFamily === sylB.vowelFamily) {
        sylScore += 0.5;
      }

      // Coda match
      if (sylA.coda === sylB.coda) {
        sylScore += 0.35;
      } else if (this.checkCodaMutation(sylA.coda, sylB.coda)) {
        sylScore += 0.2;
      }

      // Onset match (less important for rhyme)
      if (sylA.onset === sylB.onset) {
        sylScore += 0.15;
      }

      // Stop if score drops below threshold
      if (sylScore < 0.4) break;

      matchedSyllables++;
      totalScore += sylScore;
    }

    const avgScore = matchedSyllables > 0 ? totalScore / matchedSyllables : 0;

    // Classify rhyme type
    let type = 'none';
    if (matchedSyllables >= 3) type = 'dactylic';
    else if (matchedSyllables === 2) type = 'feminine';
    else if (matchedSyllables === 1) type = 'masculine';

    return {
      syllablesMatched: matchedSyllables,
      score: avgScore,
      type,
    };
  },
};
