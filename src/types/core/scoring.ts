import type { AnalyzedDocument } from './analysis.js';

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'success';

export interface Diagnostic {
  start: number;
  end: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ScoreTrace {
  heuristic: string;
  rawScore: number;
  weight: number;
  contribution: number;
  explanation: string;
  diagnostics?: Diagnostic[];
}

export interface ScoringResult {
  totalScore: number;
  traces: ScoreTrace[];
}

export interface Heuristic {
  name: string;
  scorer: (doc: AnalyzedDocument) => ScoreTrace | Promise<ScoreTrace>;
  weight: number;
}

export interface ScoringEngine {
  calculateScore: (input: string | AnalyzedDocument) => Promise<ScoringResult>;
  registerHeuristic: (heuristic: Heuristic) => void;
  reset: () => void;
  getHeuristics: () => Heuristic[];
}
