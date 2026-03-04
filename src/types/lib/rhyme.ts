import type { DeepWordAnalysis } from './phoneme.js';

export type RhymeType = 'perfect' | 'near' | 'slant' | 'assonance' | 'consonance' | 'identity';
export type RhymeSubtype = 'masculine' | 'feminine' | 'dactylic' | 'none';

export interface WordPosition {
  lineIndex: number;
  wordIndex: number;
  charStart: number;
  charEnd: number;
  word: string;
}

export interface SyntaxGate {
  gate: string;
  multiplier: number;
  reasons: string[];
}

export interface RhymeConnection {
  type: RhymeType;
  subtype: RhymeSubtype;
  score: number;
  syllablesMatched: number;
  phoneticWeight: number;
  wordA: WordPosition;
  wordB: WordPosition;
  groupLabel: string | null;
  syntax?: SyntaxGate;
}

export interface LineAnalysis {
  lineIndex: number;
  text: string;
  words: Array<{
    word: string;
    lineIndex: number;
    wordIndex: number;
    charStart: number;
    charEnd: number;
    analysis: DeepWordAnalysis | null;
    syntaxToken?: unknown;
  }>;
  syllableTotal: number;
  stressPattern: string;
  internalRhymes: RhymeConnection[];
  endRhymeKey: string | null;
  endWord: DeepWordAnalysis | null;
}

export interface SyntaxGatingStats {
  enabled: boolean;
  totalCandidates: number;
  suppressedPairs: number;
  weakenedPairs: number;
  keptPairs: number;
}

export interface DocumentAnalysis {
  lines: LineAnalysis[];
  endRhymeConnections: RhymeConnection[];
  internalRhymeConnections: RhymeConnection[];
  allConnections: RhymeConnection[];
  rhymeGroups: Map<string, number[]>;
  schemePattern: string;
  syntaxSummary: unknown;
  statistics: {
    totalLines: number;
    totalWords: number;
    totalSyllables: number;
    perfectCount: number;
    nearCount: number;
    slantCount: number;
    internalCount: number;
    multiSyllableCount: number;
    endRhymeCount: number;
    syntaxGating: SyntaxGatingStats;
  };
}

export interface SchemeDetection {
  id: string;
  name: string;
  pattern: string;
  description: string;
  lore?: string;
  confidence: number;
  groups: Map<string, number[]>;
}

export interface MeterDetection {
  footType: string;
  footName: string;
  feetPerLine: number;
  meterName: string;
  consistency: number;
  stressPattern: string;
}
