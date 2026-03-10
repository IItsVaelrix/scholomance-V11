import { VOWEL_FAMILY_TO_SCHOOL } from '../data/schools.js';
import { normalizeVowelFamily } from './phonology/vowelFamily.js';

function toAnalyzedWord(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const vowelFamily = normalizeVowelFamily(profile.vowelFamily) || null;
  const school = vowelFamily ? (VOWEL_FAMILY_TO_SCHOOL[vowelFamily] || null) : null;
  const lineIndex = Number(profile.lineIndex);
  const wordIndex = Number(profile.wordIndex);
  const charStart = Number(profile.charStart);
  const charEnd = Number(profile.charEnd);
  const normalizedWord = String(profile.normalizedWord || '').toUpperCase();

  return {
    word: String(profile.word || ''),
    normalizedWord,
    lineIndex: Number.isInteger(lineIndex) ? lineIndex : -1,
    wordIndex: Number.isInteger(wordIndex) ? wordIndex : -1,
    charStart: Number.isInteger(charStart) ? charStart : -1,
    charEnd: Number.isInteger(charEnd) ? charEnd : -1,
    vowelFamily,
    school,
    syllableCount: Number(profile.syllableCount) || 0,
    rhymeKey: profile.rhymeKey || null,
    stressPattern: String(profile.stressPattern || ''),
    role: String(profile.role || ''),
    lineRole: String(profile.lineRole || ''),
    stressRole: String(profile.stressRole || ''),
    rhymePolicy: String(profile.rhymePolicy || ''),
  };
}

export function buildAnalyzedWordCollections(wordProfiles = []) {
  const analyzedWordList = [];
  const analyzedWords = new Map();
  const analyzedWordsByIdentity = new Map();
  const analyzedWordsByCharStart = new Map();

  for (const profile of Array.isArray(wordProfiles) ? wordProfiles : []) {
    const analyzedWord = toAnalyzedWord(profile);
    if (!analyzedWord) continue;

    analyzedWordList.push(analyzedWord);

    if (analyzedWord.normalizedWord && !analyzedWords.has(analyzedWord.normalizedWord)) {
      analyzedWords.set(analyzedWord.normalizedWord, analyzedWord);
    }

    if (
      Number.isInteger(analyzedWord.lineIndex) &&
      analyzedWord.lineIndex >= 0 &&
      Number.isInteger(analyzedWord.wordIndex) &&
      analyzedWord.wordIndex >= 0 &&
      Number.isInteger(analyzedWord.charStart) &&
      analyzedWord.charStart >= 0
    ) {
      analyzedWordsByIdentity.set(
        `${analyzedWord.lineIndex}:${analyzedWord.wordIndex}:${analyzedWord.charStart}`,
        analyzedWord
      );
    }

    if (Number.isInteger(analyzedWord.charStart) && analyzedWord.charStart >= 0) {
      analyzedWordsByCharStart.set(analyzedWord.charStart, analyzedWord);
    }
  }

  return {
    analyzedWordList,
    analyzedWords,
    analyzedWordsByIdentity,
    analyzedWordsByCharStart,
  };
}
