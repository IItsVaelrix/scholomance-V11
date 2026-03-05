import type { PhonemeAnalysis, DeepWordAnalysis } from '../lib/phoneme.js';

export interface AnalyzedWord {
  text: string;
  normalized?: string;
  start: number;
  end: number;
  lineNumber?: number;
  phonetics: PhonemeAnalysis | null;
  deepPhonetics: DeepWordAnalysis | null;
  syllableCount?: number;
  stressPattern?: string;
  leadingSound?: string;
  isStopWord?: boolean;
  isContentWord?: boolean;
}

export interface AnalyzedLine {
  text: string;
  number: number;
  start: number;
  end: number;
  words: AnalyzedWord[];
  syllableCount: number;
  stressPattern?: string;
  wordCount?: number;
  contentWordCount?: number;
  avgWordLength?: number;
  hasTerminalPunctuation?: boolean;
  terminalPunctuation?: string | null;
}

export interface DocumentStats {
  wordCount: number;
  lineCount: number;
  totalSyllables: number;
  uniqueWordCount: number;
  uniqueStemCount: number;
  contentWordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  avgSyllablesPerWord: number;
  lexicalDiversity: number;
  contentWordRatio: number;
  longWordRatio: number;
}

export interface DocumentParsed {
  wordFrequency: Record<string, number>;
  contentWordFrequency: Record<string, number>;
  stemFrequency: Record<string, number>;
  repeatedWords: Array<{
    token: string;
    count: number;
    spans: Array<{ start: number; end: number; lineNumber: number }>;
  }>;
  repeatedBigrams: Array<{ bigram: string; count: number }>;
  lineStarters: Array<{ token: string; count: number; lineNumbers: number[] }>;
  lineEnders: Array<{ token: string; count: number; lineNumbers: number[] }>;
  sentenceLengths: number[];
  enjambment: { count: number; ratio: number };
  stressProfile: { dominantFoot: string; coherence: number; error: number };
  scrollPower: {
    rhymeDensity: number;
    coherence: number;
    product: number;
    cappedProduct: number;
    normalized: number;
  };
}

export interface AnalyzedDocument {
  raw: string;
  lines: AnalyzedLine[];
  allWords: AnalyzedWord[];
  stats: DocumentStats;
  parsed?: DocumentParsed;
}
