/**
 * useCombatEngine.js
 * React state machine for the Combat page.
 * Owns: player/opponent HP, turn sequencing, battle log, rewards, and AI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProgression } from '../../../hooks/useProgression.jsx';
import { combatBridge } from '../combatBridge.js';
import { scoreCombatScroll } from '../../../lib/combatApi.js';
import { calculateCombatScore } from '../../../lib/combatScoring.js';
import {
  COMBAT_ARENA_SCHOOL,
  computeCombatManaRegen,
  computeCombatXpAward,
  createCombatOpponent,
  generateOpponentSpell,
  getFailureCastModifier,
} from '../../../lib/combatMechanics.js';

const PLAYER_MAX_HP = 1000;
const PLAYER_MAX_MP = 100;
const MP_COST_PER_CAST = 10;
const OPPONENT_MAX_HP = 1500;

function createBattleLogEntry(type, text) {
  return {
    type,
    text,
    id: `${Date.now()}-${Math.random()}`,
  };
}

function splitCombatLines(text) {
  return String(text || '')
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function createInitialCombatStats() {
  return {
    totalPlayerDamage: 0,
    totalPlayerHealing: 0,
    highestPlayerDamage: 0,
    bestSpellText: null,
    bestSpellSchool: null,
    xpAwarded: 0,
    verseEfficiency: 0,
  };
}

function buildSpellHistoryEntry({ text, scoreData, damage, healing, turnNumber }) {
  return {
    text,
    scoreData,
    school: scoreData?.school || COMBAT_ARENA_SCHOOL,
    damage,
    healing,
    turnNumber,
    lines: splitCombatLines(text),
  };
}

function updateCombatStats(prevStats, spellEntry) {
  const totalPlayerDamage = (Number(prevStats?.totalPlayerDamage) || 0) + (Number(spellEntry?.damage) || 0);
  const totalPlayerHealing = (Number(prevStats?.totalPlayerHealing) || 0) + (Number(spellEntry?.healing) || 0);
  const highestPlayerDamage = Math.max(Number(prevStats?.highestPlayerDamage) || 0, Number(spellEntry?.damage) || 0);
  const shouldReplaceBest = (Number(spellEntry?.damage) || 0) >= (Number(prevStats?.highestPlayerDamage) || 0);

  return {
    ...prevStats,
    totalPlayerDamage,
    totalPlayerHealing,
    highestPlayerDamage,
    bestSpellText: shouldReplaceBest ? spellEntry?.text || prevStats?.bestSpellText : prevStats?.bestSpellText,
    bestSpellSchool: shouldReplaceBest ? spellEntry?.school || prevStats?.bestSpellSchool : prevStats?.bestSpellSchool,
  };
}

function createInitialState() {
  const opponent = createCombatOpponent();
  return {
    combatState: 'INTRO',
    playerHP: PLAYER_MAX_HP,
    playerMP: PLAYER_MAX_MP,
    opponentHP: OPPONENT_MAX_HP,
    opponent,
    lastPlayerSpell: null,
    lastOpponentSpell: null,
    lastScoreData: null,
    lastPlayerDamage: 0,
    lastPlayerHealing: 0,
    lastOpponentDamage: 0,
    turnNumber: 1,
    playerSpellHistory: [],
    opponentDamageModifier: 1,
    opponentStatusLabel: 'NEUTRAL',
    combatStats: createInitialCombatStats(),
    battleLog: [
      createBattleLogEntry('system', `A ${opponent.schoolName} lexiconic sorcerer manifests.`),
      createBattleLogEntry('system', `${opponent.name} enters the rite with INT ${opponent.int}.`),
    ],
  };
}

export { scoreDataToDamage } from '../../../lib/combatScoring.js';

export function useCombatEngine() {
  const { addXP } = useProgression();
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const pendingPlayerCastRef = useRef(null);
  const playerCastSequenceRef = useRef(0);
  stateRef.current = state;

  const log = useCallback((type, text) => {
    setState((prev) => ({
      ...prev,
      battleLog: [...prev.battleLog, createBattleLogEntry(type, text)],
    }));
  }, []);

  const transition = useCallback((newCombatState, extraUpdates = {}) => {
    setState((prev) => ({ ...prev, combatState: newCombatState, ...extraUpdates }));
  }, []);

  const emitStateUpdate = useCallback((nextCombatState, values = {}) => {
    combatBridge.emit('state:update', {
      state: nextCombatState,
      playerHP: values.playerHP ?? stateRef.current.playerHP,
      opponentHP: values.opponentHP ?? stateRef.current.opponentHP,
      playerMP: values.playerMP ?? stateRef.current.playerMP,
    });
  }, []);

  const resolveVictory = useCallback(() => {
    const current = stateRef.current;
    if (current.combatState === 'VICTORY') {
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

    setState((prev) => ({
      ...prev,
      combatState: 'VICTORY',
      combatStats: {
        ...prev.combatStats,
        xpAwarded: prev.combatStats.xpAwarded || xpAward.amount || 0,
        verseEfficiency: xpAward.verseEfficiency || prev.combatStats.verseEfficiency || 0,
      },
    }));
  }, [addXP, log]);

  const finalizePendingPlayerCast = useCallback(() => {
    const pendingCast = pendingPlayerCastRef.current;
    if (!pendingCast || pendingCast.finalized || !pendingCast.animDone) {
      return;
    }

    pendingCast.finalized = true;
    pendingPlayerCastRef.current = null;

    if (pendingCast.status === 'resolved') {
      transition('SCORE_REVEAL');
      return;
    }

    setState((prev) => ({
      ...prev,
      combatState: 'PLAYER_TURN',
      playerHP: pendingCast.playerHPBeforeCast,
      playerMP: pendingCast.playerMPBeforeCast,
      opponentHP: pendingCast.opponentHPBeforeCast,
      lastScoreData: null,
      lastPlayerDamage: 0,
      lastPlayerHealing: 0,
    }));
    log('system', pendingCast.errorMessage);
    emitStateUpdate('PLAYER_TURN', {
      playerHP: pendingCast.playerHPBeforeCast,
      opponentHP: pendingCast.opponentHPBeforeCast,
      playerMP: pendingCast.playerMPBeforeCast,
    });
  }, [emitStateUpdate, log, transition]);

  useEffect(() => {
    const unsubSceneState = combatBridge.on('state:update', (payload = {}) => {
      if (stateRef.current.combatState !== 'INTRO') return;
      if (payload?.state !== 'PLAYER_TURN') return;

      transition('PLAYER_TURN', {
        playerHP: Number(payload?.playerHP) || stateRef.current.playerHP,
        opponentHP: Number(payload?.opponentHP) || stateRef.current.opponentHP,
        playerMP: Number(payload?.playerMP) || stateRef.current.playerMP,
      });
    });

    const unsubInscribe = combatBridge.on('action:inscribe', () => {
      const { combatState, playerMP } = stateRef.current;
      if (combatState !== 'PLAYER_TURN') return;
      if (playerMP < MP_COST_PER_CAST) {
        log('system', 'Your MP is exhausted. Wait for resonance to return.');
        return;
      }
      transition('CASTING');
    });

    const unsubFlee = combatBridge.on('action:flee', () => {
      if (stateRef.current.combatState !== 'PLAYER_TURN') return;
      log('player', 'You flee from the arena. The rite is abandoned.');
      transition('DEFEAT');
    });

    const unsubPlayerAnimDone = combatBridge.on('anim:player:done', () => {
      if (stateRef.current.combatState !== 'SPELL_FLYING') return;
      if (!pendingPlayerCastRef.current) {
        transition('SCORE_REVEAL');
        return;
      }
      pendingPlayerCastRef.current.animDone = true;
      finalizePendingPlayerCast();
    });

    const unsubOpponentAnimDone = combatBridge.on('anim:opponent:done', () => {
      const { combatState, playerHP, opponentHP, playerMP, lastScoreData } = stateRef.current;
      if (combatState !== 'OPPONENT_CASTING') return;

      if (playerHP <= 0) {
        transition('DEFEAT');
        emitStateUpdate('DEFEAT', { playerHP, opponentHP, playerMP });
        return;
      }

      const manaRegen = computeCombatManaRegen(lastScoreData);
      const nextPlayerMP = Math.min(PLAYER_MAX_MP, playerMP + manaRegen);
      transition('PLAYER_TURN', {
        turnNumber: stateRef.current.turnNumber + 1,
        playerMP: nextPlayerMP,
        opponentDamageModifier: 1,
        opponentStatusLabel: 'NEUTRAL',
      });
      if (manaRegen > 0) {
        log('system', `Resonance restores ${manaRegen} MP to your reserves.`);
      }
      emitStateUpdate('PLAYER_TURN', {
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
  }, [emitStateUpdate, finalizePendingPlayerCast, log, transition]);

  const castPlayerSpell = useCallback((text, scoreData) => {
    const {
      combatState,
      playerHP,
      playerMP,
      opponentHP,
      opponent,
    } = stateRef.current;
    if (combatState !== 'CASTING' || pendingPlayerCastRef.current) return;

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

    pendingPlayerCastRef.current = {
      castId,
      text,
      previewScore,
      status: 'pending',
      animDone: false,
      finalized: false,
      playerHPBeforeCast: playerHP,
      playerMPBeforeCast: playerMP,
      playerMPAfterCast: nextPlayerMP,
      opponentHPBeforeCast: opponentHP,
      previewPlayerHP,
      previewOpponentHP,
      errorMessage: 'The rite could not be judged by the server. State restored.',
    };

    log('player', `You inscribe: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);

    setState((prev) => ({
      ...prev,
      combatState: 'SPELL_FLYING',
      playerHP: previewPlayerHP,
      playerMP: nextPlayerMP,
      opponentHP: previewOpponentHP,
      lastPlayerSpell: text,
      lastScoreData: previewScore,
      lastPlayerDamage: previewDamage,
      lastPlayerHealing: previewHealing,
    }));

    combatBridge.emit('player:cast', {
      damage: previewDamage,
      school: previewScore.school,
      text,
    });
    emitStateUpdate('SPELL_FLYING', {
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
        const pendingCast = pendingPlayerCastRef.current;
        if (!pendingCast || pendingCast.castId !== castId || pendingCast.finalized) {
          return;
        }

        const authoritativeDamage = Number.isFinite(Number(serverScore?.damage))
          ? Number(serverScore.damage)
          : previewDamage;
        const authoritativeHealing = Number.isFinite(Number(serverScore?.healing))
          ? Number(serverScore.healing)
          : previewHealing;
        const authoritativePlayerHP = Math.min(
          PLAYER_MAX_HP,
          pendingCast.playerHPBeforeCast + authoritativeHealing
        );
        const authoritativeOpponentHP = Math.max(
          0,
          pendingCast.opponentHPBeforeCast - authoritativeDamage
        );
        const spellHistoryEntry = buildSpellHistoryEntry({
          text: pendingCast.text,
          scoreData: serverScore,
          damage: authoritativeDamage,
          healing: authoritativeHealing,
          turnNumber: stateRef.current.turnNumber,
        });
        const failureDisposition = serverScore?.intent?.failureDisposition || 'NEUTRAL';

        pendingCast.status = 'resolved';

        setState((prev) => ({
          ...prev,
          playerHP: authoritativePlayerHP,
          opponentHP: authoritativeOpponentHP,
          lastScoreData: serverScore,
          lastPlayerDamage: authoritativeDamage,
          lastPlayerHealing: authoritativeHealing,
          playerSpellHistory: [...prev.playerSpellHistory, spellHistoryEntry],
          combatStats: updateCombatStats(prev.combatStats, spellHistoryEntry),
          opponentDamageModifier: serverScore?.failureCast
            ? getFailureCastModifier(failureDisposition)
            : prev.opponentDamageModifier,
          opponentStatusLabel: serverScore?.failureCast
            ? failureDisposition
            : prev.opponentStatusLabel,
        }));

        log('player', `The verse deals ${authoritativeDamage} ${serverScore?.school || COMBAT_ARENA_SCHOOL} damage.`);
        if (authoritativeHealing > 0) {
          log('system', `Verbal Alchemy restores ${authoritativeHealing} HP to you.`);
        }
        if (serverScore?.commentary) {
          log('system', serverScore.commentary);
        }
        if (serverScore?.failureCast) {
          if (failureDisposition === 'DEBUFF') {
            log('system', 'The failed syntax frays the opponent\'s next counter-verse.');
          } else if (failureDisposition === 'BUFF') {
            log('system', 'The failed syntax fortifies the opponent\'s next counter-verse.');
          }
        }

        if (
          authoritativeOpponentHP !== pendingCast.previewOpponentHP
          || authoritativePlayerHP !== pendingCast.previewPlayerHP
        ) {
          emitStateUpdate('SPELL_FLYING', {
            playerHP: authoritativePlayerHP,
            opponentHP: authoritativeOpponentHP,
            playerMP: pendingCast.playerMPAfterCast,
          });
        }

        finalizePendingPlayerCast();
      })
      .catch((error) => {
        const pendingCast = pendingPlayerCastRef.current;
        if (!pendingCast || pendingCast.castId !== castId || pendingCast.finalized) {
          return;
        }

        pendingCast.status = 'failed';
        pendingCast.errorMessage = error?.message
          ? `The rite could not be judged by the server. State restored. (${error.message})`
          : 'The rite could not be judged by the server. State restored.';

        finalizePendingPlayerCast();
      });
  }, [emitStateUpdate, finalizePendingPlayerCast, log]);

  const continueAfterReveal = useCallback(() => {
    const { combatState, opponentHP } = stateRef.current;
    if (combatState !== 'SCORE_REVEAL') return;

    if (opponentHP <= 0) {
      resolveVictory();
      return;
    }

    transition('OPPONENT_TURN');
    log('system', `${stateRef.current.opponent.name} gathers their counter-verse...`);

    setTimeout(() => {
      const current = stateRef.current;
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

      if (current.opponentStatusLabel === 'DEBUFF') {
        log('system', 'Your failed syntax distorts the counter-verse before it lands.');
      } else if (current.opponentStatusLabel === 'BUFF') {
        log('system', 'Your failed syntax feeds the enemy a surge of force.');
      }

      log('opponent', `${current.opponent.name}: "${opponentSpell.spell}"`);
      log('opponent', `The ${opponentSpell.school} counter-verse deals ${damage} damage to you.`);

      setState((prev) => ({
        ...prev,
        combatState: 'OPPONENT_CASTING',
        playerHP: newPlayerHP,
        lastOpponentSpell: opponentSpell.spell,
        lastOpponentDamage: damage,
        opponentDamageModifier: 1,
        opponentStatusLabel: 'NEUTRAL',
      }));

      combatBridge.emit('opponent:cast', {
        spell: opponentSpell.spell,
        damage,
        school: opponentSpell.school,
      });
      emitStateUpdate('OPPONENT_CASTING', {
        playerHP: newPlayerHP,
        opponentHP: current.opponentHP,
        playerMP: current.playerMP,
      });

      if (newPlayerHP <= 0) {
        setTimeout(() => {
          transition('DEFEAT');
        }, 2500);
      }
    }, 1800);
  }, [emitStateUpdate, log, resolveVictory, transition]);

  const cancelCasting = useCallback(() => {
    if (stateRef.current.combatState !== 'CASTING') return;
    transition('PLAYER_TURN');
    emitStateUpdate('PLAYER_TURN');
  }, [emitStateUpdate, transition]);

  const restartCombat = useCallback(() => {
    const newState = createInitialState();
    pendingPlayerCastRef.current = null;
    playerCastSequenceRef.current = 0;
    setState(newState);
    combatBridge.emit('combat:init', {
      playerName: 'Scholar',
      opponentName: newState.opponent.name,
      playerHP: PLAYER_MAX_HP,
      playerMP: PLAYER_MAX_MP,
      opponentHP: OPPONENT_MAX_HP,
    });
  }, []);

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
