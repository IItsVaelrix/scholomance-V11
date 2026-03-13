/**
 * useCombatEngine.js
 * React orchestration hook for the Combat page.
 * Owns the live encounter loop while delegating pure state transitions to CODEx core helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProgression } from '../../../hooks/useProgression.jsx';
import { combatBridge } from '../combatBridge.js';
import { scoreCombatScroll } from '../../../lib/combatApi.js';
import { calculateCombatScore } from '../../../lib/combatScoring.js';
import {
  COMBAT_ARENA_SCHOOL,
  COMBAT_STATES,
  MP_COST_PER_CAST,
  OPPONENT_MAX_HP,
  PLAYER_MAX_HP,
  PLAYER_MAX_MP,
  applyPlayerCastPreview,
  applyResolvedPlayerCast,
  buildSpellHistoryEntry,
  completeOpponentTurn,
  computeCombatManaRegen,
  computeCombatXpAward,
  createCombatOpponent,
  createInitialCombatState,
  generateOpponentSpell,
  markCombatDefeat,
  markCombatVictory,
  restoreFailedPlayerCast,
  setCombatState,
  startOpponentCast,
} from '../../../lib/combatMechanics.js';

const OPPONENT_CAST_DELAY_MS = 1800;
const PLAYER_CAST_TIMEOUT_MS = 7000;
const OPPONENT_DEFEAT_FALLBACK_MS = 3200;

function createBattleLogEntry(type, text, id) {
  return { type, text, id };
}

export { scoreDataToDamage } from '../../../lib/combatScoring.js';

export function useCombatEngine() {
  const { addXP } = useProgression();
  const battleLogIdRef = useRef(0);
  const playerCastSequenceRef = useRef(0);
  const pendingPlayerCastRef = useRef(null);
  const opponentCastTimerRef = useRef(null);
  const defeatTimerRef = useRef(null);

  function nextBattleLogEntry(type, text) {
    battleLogIdRef.current += 1;
    return createBattleLogEntry(type, text, `combat-log-${battleLogIdRef.current}`);
  }

  const buildFreshCombatState = useCallback(() => {
    battleLogIdRef.current = 0;
    const opponent = createCombatOpponent();
    return createInitialCombatState({
      opponent,
      battleLog: [
        nextBattleLogEntry('system', `A ${opponent.schoolName} lexiconic sorcerer manifests.`),
        nextBattleLogEntry('system', `${opponent.name} enters the rite with INT ${opponent.int}.`),
      ],
    });
  }, []);

  const [state, setState] = useState(buildFreshCombatState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const clearOpponentCastTimer = useCallback(() => {
    if (opponentCastTimerRef.current) {
      clearTimeout(opponentCastTimerRef.current);
      opponentCastTimerRef.current = null;
    }
  }, []);

  const clearDefeatTimer = useCallback(() => {
    if (defeatTimerRef.current) {
      clearTimeout(defeatTimerRef.current);
      defeatTimerRef.current = null;
    }
  }, []);

  const clearScheduledCombatTimers = useCallback(() => {
    clearOpponentCastTimer();
    clearDefeatTimer();
  }, [clearDefeatTimer, clearOpponentCastTimer]);

  const clearPendingPlayerCast = useCallback(() => {
    const pendingCast = pendingPlayerCastRef.current;
    if (pendingCast?.timeoutId) {
      clearTimeout(pendingCast.timeoutId);
    }
    pendingPlayerCastRef.current = null;
  }, []);

  const appendLogEntries = useCallback((entries) => {
    const normalizedEntries = entries
      .map((entry) => {
        if (!entry?.text) return null;
        return nextBattleLogEntry(entry.type || 'system', entry.text);
      })
      .filter(Boolean);

    if (normalizedEntries.length === 0) {
      return;
    }

    updateState((prev) => ({
      ...prev,
      battleLog: [...prev.battleLog, ...normalizedEntries],
    }));
  }, [updateState]);

  const log = useCallback((type, text) => {
    appendLogEntries([{ type, text }]);
  }, [appendLogEntries]);

  const transition = useCallback((combatState, extraUpdates = {}) => {
    updateState((prev) => setCombatState(prev, combatState, extraUpdates));
  }, [updateState]);

  const emitStateUpdate = useCallback((combatState, values = {}) => {
    combatBridge.emit('state:update', {
      state: combatState,
      playerHP: values.playerHP ?? stateRef.current.playerHP,
      opponentHP: values.opponentHP ?? stateRef.current.opponentHP,
      playerMP: values.playerMP ?? stateRef.current.playerMP,
    });
  }, []);

  const resolveVictory = useCallback(() => {
    clearScheduledCombatTimers();
    const current = stateRef.current;
    if (current.combatState === COMBAT_STATES.VICTORY) {
      return;
    }

    const xpAward = current.combatStats.xpAwarded
      ? {
          amount: current.combatStats.xpAwarded,
          source: 'combat_victory',
          verseEfficiency: current.combatStats.verseEfficiency,
        }
      : computeCombatXpAward({
          victory: true,
          totalPlayerDamage: current.combatStats.totalPlayerDamage,
          totalPlayerHealing: current.combatStats.totalPlayerHealing,
          turnsTaken: current.turnNumber,
          opponentInt: current.opponent?.int,
          playerHP: current.playerHP,
          maxPlayerHP: PLAYER_MAX_HP,
        });

    if (!current.combatStats.xpAwarded && xpAward.amount > 0) {
      addXP(xpAward.amount, xpAward.source);
      log('system', `CODEx awards ${xpAward.amount} XP for the victory.`);
    }

    updateState((prev) => markCombatVictory(prev, { xpAward }));
    emitStateUpdate(COMBAT_STATES.VICTORY, {
      playerHP: current.playerHP,
      opponentHP: current.opponentHP,
      playerMP: current.playerMP,
    });
  }, [addXP, clearScheduledCombatTimers, emitStateUpdate, log, updateState]);

  const finalizePendingPlayerCast = useCallback(() => {
    const pendingCast = pendingPlayerCastRef.current;
    if (!pendingCast || pendingCast.finalized || !pendingCast.animDone || !pendingCast.resolution) {
      return;
    }

    pendingCast.finalized = true;
    clearTimeout(pendingCast.timeoutId);

    if (pendingCast.resolution.type === 'resolved') {
      const {
        serverScore,
        damage,
        healing,
        authoritativePlayerHP,
        authoritativeOpponentHP,
        spellHistoryEntry,
        failureDisposition,
      } = pendingCast.resolution;

      updateState((prev) => setCombatState(
        applyResolvedPlayerCast(prev, {
          scoreData: serverScore,
          damage,
          healing,
          playerHP: authoritativePlayerHP,
          opponentHP: authoritativeOpponentHP,
          spellHistoryEntry,
          failureDisposition,
        }),
        COMBAT_STATES.SCORE_REVEAL
      ));

      appendLogEntries([
        {
          type: 'player',
          text: `The verse deals ${damage} ${serverScore?.school || COMBAT_ARENA_SCHOOL} damage.`,
        },
        healing > 0
          ? {
              type: 'system',
              text: `Verbal Alchemy restores ${healing} HP to you.`,
            }
          : null,
        serverScore?.commentary
          ? {
              type: 'system',
              text: serverScore.commentary,
            }
          : null,
        serverScore?.failureCast && failureDisposition === 'DEBUFF'
          ? {
              type: 'system',
              text: 'The failed syntax frays the opponent\'s next counter-verse.',
            }
          : null,
        serverScore?.failureCast && failureDisposition === 'BUFF'
          ? {
              type: 'system',
              text: 'The failed syntax fortifies the opponent\'s next counter-verse.',
            }
          : null,
      ]);

      emitStateUpdate(COMBAT_STATES.SCORE_REVEAL, {
        playerHP: authoritativePlayerHP,
        opponentHP: authoritativeOpponentHP,
        playerMP: pendingCast.playerMPAfterCast,
      });
    } else {
      updateState((prev) => restoreFailedPlayerCast(prev, pendingCast));
      log('system', pendingCast.resolution.errorMessage);
      emitStateUpdate(COMBAT_STATES.PLAYER_TURN, {
        playerHP: pendingCast.playerHPBeforeCast,
        opponentHP: pendingCast.opponentHPBeforeCast,
        playerMP: pendingCast.playerMPBeforeCast,
      });
    }

    pendingPlayerCastRef.current = null;
  }, [appendLogEntries, emitStateUpdate, log, updateState]);

  useEffect(() => {
    const unsubSceneState = combatBridge.on('state:update', (payload = {}) => {
      if (stateRef.current.combatState !== COMBAT_STATES.INTRO) return;
      if (payload?.state !== COMBAT_STATES.PLAYER_TURN) return;

      transition(COMBAT_STATES.PLAYER_TURN, {
        playerHP: Number(payload?.playerHP) || stateRef.current.playerHP,
        opponentHP: Number(payload?.opponentHP) || stateRef.current.opponentHP,
        playerMP: Number(payload?.playerMP) || stateRef.current.playerMP,
      });
    });

    const unsubInscribe = combatBridge.on('action:inscribe', () => {
      const { combatState, playerMP } = stateRef.current;
      if (combatState !== COMBAT_STATES.PLAYER_TURN) return;
      if (playerMP < MP_COST_PER_CAST) {
        log('system', 'Your MP is exhausted. Wait for resonance to return.');
        return;
      }
      transition(COMBAT_STATES.CASTING);
    });

    const unsubFlee = combatBridge.on('action:flee', () => {
      if (stateRef.current.combatState !== COMBAT_STATES.PLAYER_TURN) return;
      clearScheduledCombatTimers();
      clearPendingPlayerCast();
      log('player', 'You flee from the arena. The rite is abandoned.');
      updateState((prev) => markCombatDefeat(prev));
      emitStateUpdate(COMBAT_STATES.DEFEAT);
    });

    const unsubPlayerAnimDone = combatBridge.on('anim:player:done', () => {
      if (stateRef.current.combatState !== COMBAT_STATES.SPELL_FLYING) return;
      const pendingCast = pendingPlayerCastRef.current;
      if (!pendingCast) {
        transition(COMBAT_STATES.SCORE_REVEAL);
        emitStateUpdate(COMBAT_STATES.SCORE_REVEAL);
        return;
      }

      pendingCast.animDone = true;
      finalizePendingPlayerCast();
    });

    const unsubOpponentAnimDone = combatBridge.on('anim:opponent:done', () => {
      const { combatState, playerHP, opponentHP, playerMP, lastScoreData } = stateRef.current;
      if (combatState !== COMBAT_STATES.OPPONENT_CASTING) return;

      if (playerHP <= 0) {
        clearScheduledCombatTimers();
        updateState((prev) => markCombatDefeat(prev));
        emitStateUpdate(COMBAT_STATES.DEFEAT, { playerHP, opponentHP, playerMP });
        return;
      }

      clearDefeatTimer();
      const manaRegen = computeCombatManaRegen(lastScoreData);
      const nextPlayerMP = Math.min(PLAYER_MAX_MP, playerMP + manaRegen);

      updateState((prev) => completeOpponentTurn(prev, { nextPlayerMP }));
      if (manaRegen > 0) {
        log('system', `Resonance restores ${manaRegen} MP to your reserves.`);
      }
      emitStateUpdate(COMBAT_STATES.PLAYER_TURN, {
        playerHP,
        opponentHP,
        playerMP: nextPlayerMP,
      });
    });

    return () => {
      unsubSceneState();
      unsubInscribe();
      unsubFlee();
      unsubPlayerAnimDone();
      unsubOpponentAnimDone();
    };
  }, [
    clearDefeatTimer,
    clearPendingPlayerCast,
    clearScheduledCombatTimers,
    emitStateUpdate,
    finalizePendingPlayerCast,
    log,
    transition,
    updateState,
  ]);

  const castPlayerSpell = useCallback((text, scoreData) => {
    const {
      combatState,
      playerHP,
      playerMP,
      opponentHP,
      opponent,
      turnNumber,
    } = stateRef.current;

    if (combatState !== COMBAT_STATES.CASTING || pendingPlayerCastRef.current) return;

    const previewScore = calculateCombatScore({
      text,
      scoreData,
      arenaSchool: COMBAT_ARENA_SCHOOL,
      defenderSchool: opponent?.school,
    });
    const previewDamage = previewScore.damage;
    const previewHealing = Number(previewScore.healing) || 0;
    const previewPlayerHP = Math.min(PLAYER_MAX_HP, playerHP + previewHealing);
    const previewOpponentHP = Math.max(0, opponentHP - previewDamage);
    const nextPlayerMP = Math.max(0, playerMP - MP_COST_PER_CAST);
    const castId = playerCastSequenceRef.current + 1;
    playerCastSequenceRef.current = castId;

    const pendingCast = {
      castId,
      text,
      turnNumberAtCast: turnNumber,
      animDone: false,
      finalized: false,
      resolution: null,
      playerHPBeforeCast: playerHP,
      playerMPBeforeCast: playerMP,
      playerMPAfterCast: nextPlayerMP,
      opponentHPBeforeCast: opponentHP,
      previewPlayerHP,
      previewOpponentHP,
      timeoutId: null,
    };
    pendingPlayerCastRef.current = pendingCast;
    pendingCast.timeoutId = setTimeout(() => {
      if (!pendingPlayerCastRef.current || pendingPlayerCastRef.current.castId !== castId) {
        return;
      }
      pendingPlayerCastRef.current.resolution = {
        type: 'failed',
        errorMessage: 'The rite could not be judged in time. State restored.',
      };
      finalizePendingPlayerCast();
    }, PLAYER_CAST_TIMEOUT_MS);

    appendLogEntries([
      {
        type: 'player',
        text: `You inscribe: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
      },
    ]);

    updateState((prev) => applyPlayerCastPreview(prev, {
      text,
      previewScore,
      previewDamage,
      previewHealing,
      nextPlayerMP,
      previewPlayerHP,
      previewOpponentHP,
    }));

    combatBridge.emit('player:cast', {
      damage: previewDamage,
      school: previewScore.school,
      text,
    });
    emitStateUpdate(COMBAT_STATES.SPELL_FLYING, {
      playerHP: previewPlayerHP,
      opponentHP: previewOpponentHP,
      playerMP: nextPlayerMP,
    });

    void scoreCombatScroll({
      scrollText: text,
      arenaSchool: COMBAT_ARENA_SCHOOL,
      opponentSchool: opponent?.school,
    })
      .then((serverScore) => {
        const activePendingCast = pendingPlayerCastRef.current;
        if (!activePendingCast || activePendingCast.castId !== castId || activePendingCast.finalized) {
          return;
        }

        clearTimeout(activePendingCast.timeoutId);

        const damage = Number.isFinite(Number(serverScore?.damage))
          ? Number(serverScore.damage)
          : previewDamage;
        const healing = Number.isFinite(Number(serverScore?.healing))
          ? Number(serverScore.healing)
          : previewHealing;
        const authoritativePlayerHP = Math.min(
          PLAYER_MAX_HP,
          activePendingCast.playerHPBeforeCast + healing
        );
        const authoritativeOpponentHP = Math.max(
          0,
          activePendingCast.opponentHPBeforeCast - damage
        );
        const spellHistoryEntry = buildSpellHistoryEntry({
          text: activePendingCast.text,
          scoreData: serverScore,
          damage,
          healing,
          turnNumber: activePendingCast.turnNumberAtCast,
        });

        activePendingCast.resolution = {
          type: 'resolved',
          serverScore,
          damage,
          healing,
          authoritativePlayerHP,
          authoritativeOpponentHP,
          spellHistoryEntry,
          failureDisposition: serverScore?.intent?.failureDisposition || 'NEUTRAL',
        };

        finalizePendingPlayerCast();
      })
      .catch((error) => {
        const activePendingCast = pendingPlayerCastRef.current;
        if (!activePendingCast || activePendingCast.castId !== castId || activePendingCast.finalized) {
          return;
        }

        clearTimeout(activePendingCast.timeoutId);
        activePendingCast.resolution = {
          type: 'failed',
          errorMessage: error?.message
            ? `The rite could not be judged by the server. State restored. (${error.message})`
            : 'The rite could not be judged by the server. State restored.',
        };

        finalizePendingPlayerCast();
      });
  }, [appendLogEntries, emitStateUpdate, finalizePendingPlayerCast, updateState]);

  const continueAfterReveal = useCallback(() => {
    const { combatState, opponentHP, opponent } = stateRef.current;
    if (combatState !== COMBAT_STATES.SCORE_REVEAL) return;

    if (opponentHP <= 0) {
      resolveVictory();
      return;
    }

    transition(COMBAT_STATES.OPPONENT_TURN);
    emitStateUpdate(COMBAT_STATES.OPPONENT_TURN);
    log('system', `${opponent.name} gathers their counter-verse...`);

    clearOpponentCastTimer();
    opponentCastTimerRef.current = setTimeout(() => {
      opponentCastTimerRef.current = null;

      const current = stateRef.current;
      if (current.combatState !== COMBAT_STATES.OPPONENT_TURN) {
        return;
      }

      const opponentSpell = generateOpponentSpell({
        opponent: current.opponent,
        playerHistory: current.playerSpellHistory,
        playerContext: {
          text: current.lastPlayerSpell,
          scoreData: current.lastScoreData,
          school: current.lastScoreData?.school,
        },
        turnNumber: current.turnNumber,
        arenaSchool: COMBAT_ARENA_SCHOOL,
      });
      const damageModifier = Number(current.opponentDamageModifier) || 1;
      const damage = Math.max(0, Math.round(opponentSpell.damage * damageModifier));
      const newPlayerHP = Math.max(0, current.playerHP - damage);

      appendLogEntries([
        current.opponentStatusLabel === 'DEBUFF'
          ? {
              type: 'system',
              text: 'Your failed syntax distorts the counter-verse before it lands.',
            }
          : null,
        current.opponentStatusLabel === 'BUFF'
          ? {
              type: 'system',
              text: 'Your failed syntax feeds the enemy a surge of force.',
            }
          : null,
        {
          type: 'opponent',
          text: `${current.opponent.name}: "${opponentSpell.spell}"`,
        },
        {
          type: 'opponent',
          text: `The ${opponentSpell.school} counter-verse deals ${damage} damage to you.`,
        },
      ]);

      updateState((prev) => startOpponentCast(prev, {
        spell: opponentSpell.spell,
        damage,
        newPlayerHP,
      }));

      combatBridge.emit('opponent:cast', {
        spell: opponentSpell.spell,
        damage,
        school: opponentSpell.school,
      });
      emitStateUpdate(COMBAT_STATES.OPPONENT_CASTING, {
        playerHP: newPlayerHP,
        opponentHP: current.opponentHP,
        playerMP: current.playerMP,
      });

      if (newPlayerHP <= 0) {
        clearDefeatTimer();
        defeatTimerRef.current = setTimeout(() => {
          const latest = stateRef.current;
          if (latest.combatState !== COMBAT_STATES.OPPONENT_CASTING || latest.playerHP > 0) {
            return;
          }

          updateState((prev) => markCombatDefeat(prev));
          emitStateUpdate(COMBAT_STATES.DEFEAT, {
            playerHP: latest.playerHP,
            opponentHP: latest.opponentHP,
            playerMP: latest.playerMP,
          });
        }, OPPONENT_DEFEAT_FALLBACK_MS);
      }
    }, OPPONENT_CAST_DELAY_MS);
  }, [
    appendLogEntries,
    clearDefeatTimer,
    clearOpponentCastTimer,
    emitStateUpdate,
    log,
    resolveVictory,
    transition,
    updateState,
  ]);

  const cancelCasting = useCallback(() => {
    if (stateRef.current.combatState !== COMBAT_STATES.CASTING) return;
    transition(COMBAT_STATES.PLAYER_TURN);
    emitStateUpdate(COMBAT_STATES.PLAYER_TURN);
  }, [emitStateUpdate, transition]);

  const restartCombat = useCallback(() => {
    clearScheduledCombatTimers();
    clearPendingPlayerCast();
    playerCastSequenceRef.current = 0;

    const newState = setCombatState(buildFreshCombatState(), COMBAT_STATES.PLAYER_TURN);
    updateState(newState);

    combatBridge.emit('combat:init', {
      playerName: 'Scholar',
      opponentName: newState.opponent.name,
      playerHP: PLAYER_MAX_HP,
      playerMP: PLAYER_MAX_MP,
      opponentHP: OPPONENT_MAX_HP,
    });
    emitStateUpdate(COMBAT_STATES.PLAYER_TURN, {
      playerHP: PLAYER_MAX_HP,
      opponentHP: OPPONENT_MAX_HP,
      playerMP: PLAYER_MAX_MP,
    });
  }, [buildFreshCombatState, clearPendingPlayerCast, clearScheduledCombatTimers, emitStateUpdate, updateState]);

  useEffect(() => () => {
    clearScheduledCombatTimers();
    clearPendingPlayerCast();
  }, [clearPendingPlayerCast, clearScheduledCombatTimers]);

  return {
    ...state,
    maxPlayerHP: PLAYER_MAX_HP,
    maxPlayerMP: PLAYER_MAX_MP,
    maxOpponentHP: OPPONENT_MAX_HP,
    castPlayerSpell,
    continueAfterReveal,
    cancelCasting,
    restartCombat,
  };
}
