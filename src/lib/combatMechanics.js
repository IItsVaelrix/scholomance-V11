export {
  BASE_MP_REGEN,
  COMBAT_ARENA_SCHOOL,
  COMBAT_RARITY_TIERS,
  COMBAT_SCHOOLS,
  FAILURE_CAST_THRESHOLD,
  MIN_COMBAT_DAMAGE,
  computeCombatManaRegen,
  computeCombatXpAward,
  computeVerseEfficiency,
  getCounterSchool,
  getFailureCastModifier,
  getOpponentMemoryWindow,
  getSchoolEffectiveness,
} from '../../codex/core/combat.balance.js';

export {
  buildCombatProfile,
  createCorpusRankMap,
  tokenizeCombatWords,
} from '../../codex/core/combat.profile.js';

export {
  createCombatOpponent,
  generateOpponentSpell,
} from '../../codex/core/opponent.engine.js';
