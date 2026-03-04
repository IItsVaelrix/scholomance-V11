import type { ScoreTrace } from './scoring.js';

export interface CombatAction {
  scrollId: string;
  lines: string[];
  timestamp: number;
  playerId: string;
}

export interface CombatResult {
  damage: number;
  statusEffects: string[];
  resourceChanges: Record<string, number>;
  explainTrace: ScoreTrace[];
}
