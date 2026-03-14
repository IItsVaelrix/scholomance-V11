import {
  COMBAT_ARENA_SCHOOL,
  FAILURE_CAST_THRESHOLD,
  MIN_COMBAT_DAMAGE,
  clamp01,
  computeArenaResonanceMultiplier,
  getSchoolEffectiveness,
} from './combat.balance.js';
import { buildCombatProfile } from './combat.profile.js';

const SCORE_TO_DAMAGE_MULTIPLIER = 1.1;
const SCORE_TO_DAMAGE_OFFSET = 6;

export function getCombatTotalScore(scoreData) {
  const total = Number(scoreData?.totalScore ?? scoreData?.score ?? 0);
  return Number.isFinite(total) ? total : 0;
}

export function getCombatTraces(scoreData) {
  const traces = scoreData?.traces ?? scoreData?.explainTrace;
  return Array.isArray(traces) ? traces : [];
}

function getDominantDensity(profile) {
  return clamp01(profile?.schoolDensity?.[profile?.school] ?? profile?.dominantDensity ?? 0);
}

function computeBaseDamage(totalScore) {
  return Math.max(
    MIN_COMBAT_DAMAGE,
    Math.round((Math.max(0, totalScore) * SCORE_TO_DAMAGE_MULTIPLIER) + SCORE_TO_DAMAGE_OFFSET)
  );
}

function computeSyntaxControl(profile) {
  const cohesionScore = clamp01(profile?.cohesionScore ?? profile?.traceSignals?.cohesion ?? 0);
  const dominantDensity = getDominantDensity(profile);
  return 0.9 + (cohesionScore * 0.18) + (dominantDensity * 0.06);
}

function computeDamageFloor(profile) {
  const cohesionScore = clamp01(profile?.cohesionScore ?? profile?.traceSignals?.cohesion ?? 0);
  const statusTier = Math.max(0, Number(profile?.statusEffect?.tier) || 0);
  return MIN_COMBAT_DAMAGE + Math.round((cohesionScore * 4) + Math.min(3, statusTier * 0.5));
}

function computeHealingAmount(profile, damage) {
  if (!profile?.intent?.healing || profile.school !== 'ALCHEMY') {
    return 0;
  }

  const rarityBonus = Number(profile?.rarity?.ordinal) || 0;
  return Math.max(
    0,
    Math.round((damage * 0.75) + (profile.totalScore * 0.2) + (rarityBonus * 4))
  );
}

function isFailureCast(profile) {
  return (
    (Number(profile?.totalScore) || 0) < FAILURE_CAST_THRESHOLD
    || (Number(profile?.tokenCount) || 0) <= 2
    || getDominantDensity(profile) < 0.24
  );
}

export function calculateCombatScore({
  text = '',
  scoreData = null,
  arenaSchool = COMBAT_ARENA_SCHOOL,
  defenderSchool = null,
  analyzedDoc = null,
  corpusRanks = null,
  fallbackSchool = arenaSchool,
} = {}) {
  const totalScore = getCombatTotalScore(scoreData);
  const traces = getCombatTraces(scoreData);
  const profile = buildCombatProfile({
    text,
    scoreData: {
      ...scoreData,
      totalScore,
      traces,
    },
    analyzedDoc,
    arenaSchool,
    corpusRanks,
    fallbackSchool,
  });

  const baseDamage = computeBaseDamage(totalScore);
  const arenaResonanceMultiplier = computeArenaResonanceMultiplier({
    dominantSchool: profile.school,
    schoolDensity: profile.schoolDensity,
    arenaSchool,
  });
  const schoolAffinityMultiplier = getSchoolEffectiveness(profile.school, defenderSchool);
  const densityMultiplier = 1 + (getDominantDensity(profile) * 0.18);
  const terrainMultiplier = profile.intent.terrain ? 1.08 : 1;
  const supportPenalty = profile.intent.healing ? 0.72 : 1;
  const syntaxControlMultiplier = computeSyntaxControl(profile);

  const rawDamage = baseDamage
    * arenaResonanceMultiplier
    * schoolAffinityMultiplier
    * densityMultiplier
    * terrainMultiplier
    * syntaxControlMultiplier
    * (profile.rarity?.totalMultiplier ?? 1)
    * supportPenalty;

  const damage = Math.max(computeDamageFloor(profile), Math.round(rawDamage));
  const healing = computeHealingAmount(profile, damage);
  const failureCast = isFailureCast(profile);

  return {
    totalScore,
    traces,
    explainTrace: traces,
    damage,
    healing,
    school: profile.school,
    schoolDensity: profile.schoolDensity,
    arenaSchool,
    opponentSchool: defenderSchool || null,
    arenaResonanceMultiplier,
    schoolAffinityMultiplier,
    syntaxControlMultiplier,
    rarity: profile.rarity,
    intent: profile.intent,
    cohesionScore: profile.cohesionScore,
    statusEffect: profile.statusEffect,
    failureCast,
    commentary: profile.commentary || profile.rarity?.praise || '',
  };
}

export function scoreDataToDamage(scoreData, options = {}) {
  const damage = Number(scoreData?.damage);
  if (Number.isFinite(damage)) {
    return damage;
  }
  return calculateCombatScore({
    text: options.text || scoreData?.scrollText || '',
    scoreData,
    arenaSchool: options.arenaSchool,
    defenderSchool: options.defenderSchool,
    analyzedDoc: options.analyzedDoc,
    corpusRanks: options.corpusRanks,
    fallbackSchool: options.fallbackSchool,
  }).damage;
}

export function normalizeCombatScore(scoreData, options = {}) {
  return calculateCombatScore({
    text: options.scrollText || scoreData?.scrollText || '',
    scoreData,
    arenaSchool: options.arenaSchool,
    defenderSchool: options.opponentSchool,
    analyzedDoc: options.analyzedDoc,
    corpusRanks: options.corpusRanks,
    fallbackSchool: options.fallbackSchool,
  });
}

export { MIN_COMBAT_DAMAGE };
