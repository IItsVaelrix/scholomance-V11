export interface PLSContext {
  prefix: string;
  prevWord: string;
  prevLineEndWord: string;
  currentLineWords: string[];
  targetSyllableCount: number;
  priorLineSyllableCounts: number[];
}

export interface CandidateArbiter {
  source: string;
  reason?: string;
  confidence: number;
  signals?: Record<string, number>;
  secondPass?: {
    applied: boolean;
    ambiguityFactor: number;
    delta: number;
  };
}

export interface ScoredCandidate {
  token: string;
  score: number;
  scores: Record<string, number>;
  badges: string[];
  ghostLine?: string;
  arbiter?: CandidateArbiter;
}
