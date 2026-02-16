/**
 * The CODEx Combat Engine.
 * Resolves a combat action into a combat result.
 * This is a pure-functional module.
 *
 * @see AI_Architecture_V2.md section 3.3 and 5.2
 */

/**
 * Resolves a combat action, calculating damage and other effects.
 *
 * @param {import('./schemas').CombatAction} combatAction - The action taken by the player.
 * @param {{ calculateScore: function(string): {totalScore: number, traces: import('./schemas').ScoreTrace[]} }} scoringEngine - The scoring engine instance.
 * @returns {import('./schemas').CombatResult} The result of the combat action.
 */
export async function resolveCombatAction(combatAction, scoringEngine) {
  if (!combatAction || !combatAction.lines || combatAction.lines.length === 0) {
    return {
      damage: 0,
      statusEffects: [],
      resourceChanges: {},
      explainTrace: [],
    };
  }

  // For now, we'll just score the first line.
  // A real implementation might combine scores from all lines.
  const line = combatAction.lines[0];
  const { totalScore, traces } = await scoringEngine.calculateScore(line);

  // The server is the authority on re-scoring. This is the client-side preview logic.
  // The server-side implementation would be nearly identical but use authoritative data.
  return {
    damage: totalScore,
    statusEffects: [],
    resourceChanges: {},
    explainTrace: traces,
  };
}
