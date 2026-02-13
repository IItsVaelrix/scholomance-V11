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
 * @property {string[]} onsetPhonemes - Unjoined onset array.
 * @property {string[]} codaPhonemes - Unjoined coda array.
 */

/**
 * @typedef {object} DeepWordAnalysis
 * @property {string} word - Original word.
 * @property {string} vowelFamily - The primary vowel family of the word.
 * @property {string[]} phonemes - Full phoneme array.
 * @property {SyllableAnalysis[]} syllables - Per-syllable breakdown.
 * @property {number} syllableCount - Total syllables.
 * @property {string} rhymeKey - Primary rhyme key (final syllable).
 * @property {string[]} extendedRhymeKeys - Multi-syllable rhyme keys.
 * @property {string} stressPattern - Binary stress pattern (e.g., "0101").
 */

import { z } from "zod";
import { CmuPhonemeEngine } from "./cmu.phoneme.engine.js";
import { normalizeVowelFamily } from "./vowelFamily.js";
import { 
  ARPABET_VOWELS, 
  VOWEL_TO_BASE_FAMILY, 
  ALPHABET_PHONETIC_MAP, 
  DIGRAPH_MAP 
} from "./phoneme.constants.js";
import { Syllabifier } from "./syllabifier.js";
import { Phonotactics } from "./phonotactics.js";
import { PhoneticSimilarity } from "./phoneticSimilarity.js";
import { ScholomanceDictionaryAPI } from "./scholomanceDictionary.api.js";

const VOWEL_FAMILY_TO_SCHOOL = {
  A: "SONIC",
  AE: "SONIC",
  UH: "SONIC",
  AO: "VOID",
  OW: "VOID",
  OY: "VOID",
  UR: "VOID",
  UW: "VOID",
  EY: "ALCHEMY",
  AY: "PSYCHIC",
  IH: "PSYCHIC",
  IY: "PSYCHIC",
};

/**
 * Targeted pronunciation overrides for high-impact words.
 */
const WORD_PHONEME_OVERRIDES = Object.freeze({
  SOUL: ["S", "IY1", "L"],
  COMPOSED: ["K", "AH0", "M", "P", "IY1", "Z", "D"],
  HOLD: ["HH", "IY1", "L", "D"],
  RHYTHM: ["R", "IH1", "DH", "AH0", "M"],
  VICTIM: ["V", "IH1", "K", "T", "IH0", "M"],
  OBSIDIAN: ["AH0", "B", "S", "IH1", "D", "IY0", "AH0", "N"],
  OLYMPIAN: ["AH0", "L", "IH1", "M", "P", "IY0", "AH0", "N"],
  MEDIAN: ["M", "IH1", "D", "IY0", "AH0", "N"],
  TONGUE: ["T", "AH1", "NG"],
  YOUNG: ["Y", "AH1", "NG"],
  DUMB: ["D", "AH1", "M"],
  THUMB: ["TH", "AH1", "M"],
  NUMB: ["N", "AH1", "M"],
  EIGHT: ["EY1", "T"],
  DOPE: ["D", "OW1", "P"],
});

const PhonemeDictSchema = z.object({
  vowel_families: z.array(z.unknown())
}).passthrough();
const PhonemeRulesSchema = z.record(z.unknown());

/**
 * Phoneme Analysis Engine for Scholomance CODEx.
 */
export const PhonemeEngine = {
  DICT_V2: null,
  RULES_V2: null,
  WORD_CACHE: new Map(),
  AUTHORITY_CACHE: new Map(),

  clearCache() { this.WORD_CACHE.clear(); this.AUTHORITY_CACHE.clear(); },

  async init() {
    this.clearCache();
    try {
      const [dictRaw, rulesRaw] = await Promise.all([
        fetch("/phoneme_dictionary_v2.json").then((r) => r.json()),
        fetch("/rhyme_matching_rules_v2.json").then((r) => r.json()),
      ]);
      const dictParsed = PhonemeDictSchema.safeParse(dictRaw);
      const rulesParsed = PhonemeRulesSchema.safeParse(rulesRaw);
      if (dictParsed.success && rulesParsed.success) {
        this.DICT_V2 = dictParsed.data;
        this.RULES_V2 = rulesParsed.data;
        return dictParsed.data.vowel_families.length;
      }
      return 14;
    } catch (err) { return 14; }
  },

  /**
   * Pre-fetches authoritative rhyme families for a document in bulk.
   */
  async ensureAuthorityBatch(words) {
    if (!ScholomanceDictionaryAPI.isEnabled() || !words?.length) return;
    const missing = words.filter(w => !this.AUTHORITY_CACHE.has(w.toUpperCase()));
    if (!missing.length) return;
    try {
        const families = await ScholomanceDictionaryAPI.lookupBatch(missing);
        for (const [word, family] of Object.entries(families)) {
            this.AUTHORITY_CACHE.set(word.toUpperCase(), family);
        }
    } catch (e) {}
  },

  analyzeWord(word) {
    const start = performance.now();
    const upper = String(word || "").toUpperCase();
    if (!upper) return null;
    if (this.WORD_CACHE.has(upper)) return this.WORD_CACHE.get(upper);

    if (upper.length === 1 && ALPHABET_PHONETIC_MAP[upper]) {
      const phonemes = ALPHABET_PHONETIC_MAP[upper];
      const syllables = Syllabifier.syllabify(phonemes);
      const stressedSyl = syllables.find(s => s.some(p => p.endsWith('1'))) || syllables[0] || [];
      const vowelP = stressedSyl.find(p => ARPABET_VOWELS.has(p.replace(/[0-9]/g, '')));
      const baseV = vowelP ? vowelP.replace(/[0-9]/g, '') : 'AH';
      const vowelFamily = normalizeVowelFamily(VOWEL_TO_BASE_FAMILY[baseV] || 'A');
      const result = { vowelFamily, phonemes, coda: null, rhymeKey: `${vowelFamily}-open`, syllableCount: syllables.length };
      this.WORD_CACHE.set(upper, result);
      return result;
    }

    const cmuResult = CmuPhonemeEngine.analyzeWord(upper);
    let result;
    if (cmuResult) {
      const cmuFamily = normalizeVowelFamily(cmuResult.vowelFamily) || "A";
      result = { ...cmuResult, vowelFamily: cmuFamily, rhymeKey: `${cmuFamily}-${cmuResult.coda || "open"}` };
    } else {
      const phonemes = this.splitToPhonemes(upper);
      const processed = this.applyPhonologicalProcesses(phonemes);
      const syllables = Syllabifier.syllabify(processed);
      const stressedSyl = [...syllables].reverse().find(seg => seg.some(p => p.endsWith('1'))) || syllables[syllables.length - 1] || [];
      const vowelP = stressedSyl.find(p => ARPABET_VOWELS.has(p.replace(/[0-9]/g, '')));
      const baseV = vowelP ? vowelP.replace(/[0-9]/g, '') : 'AH';
      let vowelFamily = this.AUTHORITY_CACHE.get(upper);
      if (!vowelFamily) vowelFamily = normalizeVowelFamily(VOWEL_TO_BASE_FAMILY[baseV] || 'A');
      const lastSyl = syllables[syllables.length - 1] || [];
      const lastVowelP = lastSyl.find(p => ARPABET_VOWELS.has(p.replace(/[0-9]/g, '')));
      const vIdx = lastVowelP ? lastSyl.indexOf(lastVowelP) : -1;
      const codaParts = vIdx >= 0 ? lastSyl.slice(vIdx + 1).map(p => p.replace(/[0-9]/g, '')) : [];
      const coda = codaParts.length > 0 ? codaParts.join('') : null;
      result = { vowelFamily, phonemes: processed, coda, rhymeKey: `${vowelFamily}-${coda || "open"}`, syllableCount: syllables.length };
    }
    const end = performance.now();
    this.WORD_CACHE.set(upper, result);
    return result;
  },

  guessVowelFamily(word) { return this.analyzeWord(word)?.vowelFamily || 'A'; },
  extractCoda(word) { return this.analyzeWord(word)?.coda || null; },

  applyPhonologicalProcesses(phonemes) {
    const processed = [...phonemes];
    for (let i = 0; i < processed.length; i++) {
      const p = processed[i];
      const next = processed[i + 1];
      if (p === 'N' && next) {
        const baseNext = next.replace(/[0-9]/g, '');
        if (['P', 'B', 'M'].includes(baseNext)) processed[i] = 'M';
      }
      if (processed[i] === 'M' && processed[i+1] === 'B' && !processed[i+2]) processed.splice(i+1, 1);
    }
    return processed;
  },

  splitToPhonemes(word) {
    const upper = String(word || "").toUpperCase();
    if (WORD_PHONEME_OVERRIDES[upper]) return [...WORD_PHONEME_OVERRIDES[upper]];

    const EXCEPTIONS = {
      'SOME': 'AH', 'COME': 'AH', 'DONE': 'AH', 'NONE': 'AH', 'LOVE': 'AH', 'BLOOD': 'AH', 'FLOOD': 'AH',
      'SAID': 'EH', 'SAYS': 'EH', 'HAVE': 'AE', 'GIVE': 'IH', 'LIVE': 'IH',
      'POLISH': 'AA', 'DEMOLISH': 'AA', 'ABOLISH': 'AA', 'SOLID': 'AA', 'COTTAGE': 'AA', 'WATTAGE': 'AA',
      'BOXES': 'AA', 'DROPLETS': 'AA', 'PROFIT': 'AA', 'LOGIC': 'AA', 'PROPHET': 'AA', 'LOCKSMITH': 'AA',
      'OPTIC': 'AA', 'TONGUE': 'AH', 'YOUNG': 'AH', 'GREAT': 'EY', 'BREAK': 'EY',
      'SOUL': 'IY', 'COMPOSED': 'IY', 'HOLD': 'IY', 'EIGHT': 'EY', 'DELAY': 'EY'
    };
    if (EXCEPTIONS[upper]) {
      const p = EXCEPTIONS[upper];
      const firstChar = upper.match(/^[A-Z]/)?.[0] || '';
      return [firstChar, p + '1', ...upper.slice(firstChar.length).split('').filter(c => !/[AEIOU]/.test(c))];
    }

    const phonemes = [];
    let i = 0;
    while (i < upper.length) {
      const slice = upper.slice(i);
      if (slice.startsWith('ATION')) { phonemes.push('EY1', 'SH', 'AH0', 'N'); i += 5; continue; }
      if (slice.startsWith('TION') || slice.startsWith('SION')) { phonemes.push('SH', 'AH0', 'N'); i += 4; continue; }
      if (slice.startsWith('OUS')) { phonemes.push('AH0', 'S'); i += 3; continue; }
      const char = upper[i];
      const nextChar = upper[i+1];
      if (nextChar) {
          const possibleDigraph = char + nextChar;
          if (possibleDigraph === 'IO') { phonemes.push('IY0', 'AH0'); i += 2; continue; }
          if (possibleDigraph === 'EA' && upper.includes('TION', i)) { phonemes.push('IY0', 'EY1'); i += 2; continue; }
          if (DIGRAPH_MAP[possibleDigraph]) { phonemes.push(...DIGRAPH_MAP[possibleDigraph]); i += 2; continue; }
      }
      if (/[AEIOU]/.test(char)) {
        let p = null;
        let skip = 1;
        if (slice.startsWith('OUL')) { p = 'OW'; skip = 3; }
        else if (slice.startsWith('URE')) { p = 'UR'; skip = 3; }
        else if (slice.startsWith('EE') || slice.startsWith('EA')) { p = 'IY'; skip = 2; }
        else if (slice.startsWith('AI') || slice.startsWith('AY')) { p = 'EY'; skip = 2; }
        else if (slice.startsWith('OO')) { p = 'UW'; skip = 2; }
        else if (slice.startsWith('OU') || slice.startsWith('OW')) { p = 'AW'; skip = 2; }
        else if (slice.startsWith('OI') || slice.startsWith('OY')) { p = 'OY'; skip = 2; }
        else if (slice.startsWith('AU') || slice.startsWith('AW')) { p = 'AO'; skip = 2; }
        else if (slice.startsWith('IE')) { p = 'AY'; skip = 2; }
        else if (slice.startsWith('UI') && slice.includes('UIT')) { p = 'UW'; skip = 2; }
        else if (i + 1 < upper.length && upper.endsWith('E')) {
           const rest = upper.slice(i + 1);
           if (rest.endsWith('E') && !/[AEIOU]/.test(rest.slice(0, -1))) {
                const MAGIC_MAP = { 'A': 'EY', 'E': 'IY', 'I': 'AY', 'O': 'OW', 'U': 'UW' };
                p = MAGIC_MAP[char] || 'AH';
           }
        }
        if (!p) {
          const V_MAP = { 'A': 'AE', 'E': 'EH', 'I': 'IH', 'O': 'AA', 'U': 'AH' };
          p = V_MAP[char] || 'AH';
        }
        phonemes.push(p + '1');
        i += skip;
      } else if (/[A-Z]/.test(char)) {
        if (char === 'E' && i === upper.length - 1 && phonemes.length > 0) { i++; continue; }
        const C_MAP = { 'C': 'K', 'J': 'JH', 'Q': 'K', 'X': ['K', 'S'], 'Y': 'Y' };
        if (char === 'Y' && i === upper.length - 1 && i > 0 && !/[AEIOU]/.test(upper[i-1])) phonemes.push('IY0');
        else { const mapped = C_MAP[char] || char; if (Array.isArray(mapped)) phonemes.push(...mapped); else phonemes.push(mapped); }
        i++;
      } else { i++; }
    }
    const vowelIndices = [];
    for(let j=0; j<phonemes.length; j++) if(ARPABET_VOWELS.has(phonemes[j].replace(/[0-9]/g, ''))) vowelIndices.push(j);
    if (vowelIndices.length > 1) {
        const hasSilentE = upper.endsWith('E');
        const isIng = upper.endsWith('ING');
        const isEd = upper.endsWith('ED');
        const stressedIdx = (isIng || isEd) ? vowelIndices[0] : (hasSilentE ? vowelIndices[0] : (upper.endsWith('TION') || upper.endsWith('SION') ? vowelIndices[vowelIndices.length - 2] : vowelIndices[vowelIndices.length - 1]));
        for (let idx of vowelIndices) phonemes[idx] = phonemes[idx].replace('1', idx === stressedIdx ? '1' : '0');
    }
    return phonemes;
  },

  checkCodaMutation(codaA, codaB) {
    if (!codaA || !codaB) return false;
    const groups = [ ['M', 'NG', 'N'], ['S', 'Z', 'SH', 'ZH'], ['T', 'D'], ['P', 'B'], ['K', 'G'] ];
    for (const group of groups) { if (group.includes(codaA) && group.includes(codaB)) return true; }
    return false;
  },

  analyzeDeep(word) {
    const basic = this.analyzeWord(word);
    if (!basic) return null;
    const syllables = this.analyzeSyllables(basic.phonemes);
    return { word: String(word).toUpperCase(), vowelFamily: basic.vowelFamily, phonemes: basic.phonemes, syllables, syllableCount: syllables.length, rhymeKey: basic.rhymeKey, extendedRhymeKeys: this.getExtendedRhymeKeys(syllables), stressPattern: this.getStressPattern(syllables) };
  },

  analyzeSyllables(phonemes) {
    const segmented = Syllabifier.syllabify(phonemes);
    return segmented.map((seg, idx) => {
      const vIdx = seg.findIndex(p => ARPABET_VOWELS.has(p.replace(/[0-9]/g, '')));
      const vowel = seg[vIdx] || 'AH0';
      const baseV = vowel.replace(/[0-9]/g, '');
      const onsetPhonemes = seg.slice(0, vIdx);
      const codaPhonemes = seg.slice(vIdx + 1);
      return { index: idx, vowel, vowelFamily: normalizeVowelFamily(VOWEL_TO_BASE_FAMILY[baseV] || baseV), onset: onsetPhonemes.join(''), coda: codaPhonemes.join(''), onsetPhonemes, codaPhonemes, stress: parseInt(vowel.match(/[0-9]/)?.[0] || '0', 10) };
    });
  },

  getExtendedRhymeKeys(syllables, maxSyllables = 4) {
    if (!syllables || syllables.length === 0) return [];
    const keys = [];
    const reversed = [...syllables].reverse();
    for (let count = 1; count <= Math.min(maxSyllables, reversed.length); count++) {
      const parts = [];
      for (let i = 0; i < count; i++) { parts.unshift(`${reversed[i].vowelFamily}-${reversed[i].coda || 'open'}`); }
      keys.push(parts.join('/'));
    }
    return keys;
  },

  getStressPattern(syllables) { return syllables.map(s => s.stress > 0 ? '1' : '0').join(''); },

  scoreMultiSyllableMatch(wordA, wordB) {
    if (!wordA?.syllables || !wordB?.syllables) return { syllablesMatched: 0, score: 0, type: 'none' };
    const revA = [...wordA.syllables].reverse(), revB = [...wordB.syllables].reverse();
    let matched = 0, totalScore = 0;
    for (let i = 0; i < Math.min(revA.length, revB.length); i++) {
      const sA = revA[i], sB = revB[i];
      const vowelScore = PhoneticSimilarity.getVowelSimilarity(sA.vowel, sB.vowel);
      const codaScore = PhoneticSimilarity.getArraySimilarity(sA.codaPhonemes, sB.codaPhonemes);
      const s = (vowelScore * 0.60) + (codaScore * 0.40);
      if (s < 0.60) break;
      matched++; totalScore += s;
    }
    const score = matched > 0 ? totalScore / matched : 0;
    if (score < 0.60) return { syllablesMatched: 0, score: 0, type: 'none' };
    let type = 'none';
    if (matched >= 3) type = 'dactylic'; else if (matched === 2) type = 'feminine'; else if (matched === 1) type = 'masculine';
    return { syllablesMatched: matched, score, type };
  },

  getSchoolFromVowelFamily(family) { return VOWEL_FAMILY_TO_SCHOOL[normalizeVowelFamily(family)] || null; }
};
