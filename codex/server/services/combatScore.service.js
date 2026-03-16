import { existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { normalizeCombatScore } from '../../core/combat.scoring.js';
import { createCorpusRankMap } from '../../core/combat.profile.js';
import { createCombatScoringEngine } from '../../core/scoring.defaults.js';

function normalizeCombatText(rawText) {
  if (typeof rawText === 'string') return rawText;
  if (rawText === null || rawText === undefined) return '';
  return String(rawText);
}

const DEFAULT_CORPUS_PATH = path.resolve(process.cwd(), 'public', 'corpus.json');

function loadCorpusRanks(corpusPath = DEFAULT_CORPUS_PATH) {
  if (!existsSync(corpusPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(corpusPath, 'utf8'));
    return createCorpusRankMap(parsed?.dictionary);
  } catch {
    return null;
  }
}

export function createCombatScoreService(options = {}) {
  const scoringEngine = options.scoringEngine || createCombatScoringEngine();
  const corpusRanks = options.corpusRanks || loadCorpusRanks(options.corpusPath);

  async function scoreScroll(rawText, context = {}) {
    const scrollText = normalizeCombatText(rawText);
    const scoreData = await scoringEngine.calculateScore(scrollText);
    return normalizeCombatScore(scoreData, {
      scrollText,
      weave: context.weave,
      arenaSchool: context.arenaSchool,
      opponentSchool: context.opponentSchool,
      corpusRanks,
      fallbackSchool: context.fallbackSchool,
    });
  }

  return {
    scoreScroll,
  };
}
