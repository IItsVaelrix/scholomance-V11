import { existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { analyzeText } from '../../core/analysis.pipeline.js';
import { normalizeCombatScore } from '../../core/combat.scoring.js';
import { createCorpusRankMap } from '../../core/combat.profile.js';
import { createCombatScoringEngine } from '../../core/scoring.defaults.js';
import { attachVerseIRAmplifier } from '../../core/verseir-amplifier/index.js';
import { compileVerseToIR } from '../../../src/lib/truesight/compiler/compileVerseToIR.js';
import {
  loadSessionVoiceProfile,
  persistSessionVoiceProfile,
  resolveSessionSpeakerId,
} from './combatVoiceProfiles.service.js';
import { createLexiconAbyssService } from './lexiconAbyss.service.js';
import { enhanceVerseIRWithServerPolicy } from './verseirAmplifier.service.js';

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
  const lexiconAbyssService = options.lexiconAbyssService || createLexiconAbyssService({
    dbPath: options.abyssDbPath,
    log: options.log,
  });
  const ownsLexiconAbyssService = !options.lexiconAbyssService;
  const scoringEngine = options.scoringEngine || createCombatScoringEngine({
    abyssProvider: lexiconAbyssService.createHeuristicProvider(),
  });
  const corpusRanks = options.corpusRanks || loadCorpusRanks(options.corpusPath);

  async function scoreScroll(rawText, context = {}) {
    const scrollText = normalizeCombatText(rawText);
    const analyzedDoc = analyzeText(scrollText);
    const verseIR = await enhanceVerseIRWithServerPolicy(
      compileVerseToIR(scrollText, { mode: 'balanced' })
    );
    const amplifiedDoc = attachVerseIRAmplifier(analyzedDoc, verseIR?.verseIRAmplifier || null);
    const baseScoreData = await scoringEngine.calculateScore(amplifiedDoc);
    const scoreData = {
      ...baseScoreData,
      verseIRAmplifier: verseIR?.verseIRAmplifier || null,
    };
    const speakerId = resolveSessionSpeakerId(context.session, context.speakerId || context.playerId);
    const speakerProfile = loadSessionVoiceProfile(context.session, {
      speakerId,
      speakerType: 'PLAYER',
      school: context.arenaSchool,
    });
    const normalized = normalizeCombatScore(scoreData, {
      scrollText,
      weave: context.weave,
      arenaSchool: context.arenaSchool,
      opponentSchool: context.opponentSchool,
      corpusRanks,
      fallbackSchool: context.fallbackSchool,
      analyzedDoc: amplifiedDoc,
      speakerId: speakerId || 'speaker:unknown',
      speakerType: 'PLAYER',
      speakerProfile,
    });
    const { nextVoiceProfile, ...publicResponse } = normalized;

    if (nextVoiceProfile && context.session && speakerId) {
      await persistSessionVoiceProfile(context.session, {
        speakerId,
        profile: nextVoiceProfile,
      });
    }

    const traceId = await lexiconAbyssService.recordCombatResolved({
      text: scrollText,
      verseIR,
      scoreResponse: publicResponse,
      playerId: speakerId || context.playerId || null,
      opponentId: context.opponentId || null,
    });

    return {
      ...publicResponse,
      traceId,
    };
  }

  return {
    scoreScroll,
    close() {
      if (ownsLexiconAbyssService) {
        lexiconAbyssService.close?.();
      }
    },
  };
}
