export interface PLSContext {
  prefix: string;
  prevWord: string;
  prevLineEndWord: string;
  currentLineWords: string[];
  targetSyllableCount: number;
  priorLineSyllableCounts: number[];
}

export interface ScoredCandidate {
  token: string;
  score: number;
  scores: Record<string, number>;
  badges: string[];
  ghostLine?: string;
}
