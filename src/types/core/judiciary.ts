export type JudiciaryLayer = 'PHONEME' | 'SPELLCHECK' | 'PREDICTOR' | 'SYNTAX';

export interface JudiciaryHhmContext {
  tokenWeight?: number;
  logicOrder?: string[];
  stageWeights?: Record<string, number>;
  stageScores?: Record<string, { signal?: number; weight?: number; weighted?: number; order?: number }>;
}

export interface JudiciarySyntaxContext {
  role?: 'content' | 'function';
  lineRole?: 'line_start' | 'line_mid' | 'line_end';
  stressRole?: 'primary' | 'secondary' | 'unstressed' | 'unknown';
  rhymePolicy?: 'allow' | 'allow_weak' | 'suppress';
  hhm?: JudiciaryHhmContext;
}

export interface JudiciaryCandidate {
  word: string;
  layer: JudiciaryLayer;
  confidence: number;
  isRhyme?: boolean;
  reason?: string;
  type?: string;
  category?: string;
  strategy?: string;
  source?: string;
}

export interface JudiciaryResult {
  word: string;
  confidence: number;
  consensus: boolean;
  breakdown: Record<string, Array<{ layer: JudiciaryLayer; score: number }>>;
}
