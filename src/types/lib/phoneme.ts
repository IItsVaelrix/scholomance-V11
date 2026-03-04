export interface PhonemeAnalysis {
  vowelFamily: string;
  phonemes: string[];
  coda: string | null;
  rhymeKey: string;
  syllableCount: number;
}

export interface SyllableAnalysis {
  index: number;
  vowel: string;
  vowelFamily: string;
  onset: string;
  coda: string;
  stress: number;
  onsetPhonemes: string[];
  codaPhonemes: string[];
}

export interface DeepWordAnalysis {
  word: string;
  vowelFamily: string;
  phonemes: string[];
  syllables: SyllableAnalysis[];
  syllableCount: number;
  rhymeKey: string;
  extendedRhymeKeys: string[];
  stressPattern: string;
}

export interface MultiSyllableMatch {
  syllablesMatched: number;
  score: number;
  type: 'masculine' | 'feminine' | 'dactylic' | 'none';
}
