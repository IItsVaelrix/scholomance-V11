/**
 * CombatPage.jsx
 * Route: /combat
 *
 * 21st Century MUD Layout:
 *   LEFT  — Phaser "visionglass" (battle sprites, animations)
 *   RIGHT — Text terminal (chronicle, status bars, inline spell input, action bar)
 *
 * Layer order:
 *   1. Phaser canvas     — visual world
 *   2. Combat terminal   — primary interaction surface (MUD-style text)
 *   3. <ScoreReveal />   — post-cast breakdown panel
 *   4. Victory/Defeat    — end-state overlay
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCombatEngine } from './hooks/useCombatEngine.js';
import { combatBridge } from './combatBridge.js';
import { Spellbook } from './components/Spellbook.jsx';
import { ScoreReveal } from './components/ScoreReveal.jsx';
import { BattleLog } from './components/BattleLog.jsx';
import { OpponentDoctrinePanel } from './components/OpponentDoctrinePanel.jsx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.js';
import { SpellCastEffect } from './components/SpellCastEffect.jsx';
import './CombatPage.css';

const MP_COST = 10;

// ─── Status Bar subcomponent ───────────────────────────────────────────────

function StatusBar({ label, current, max, variant }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  let fillClass;
  if (variant === 'hp') {
    fillClass = pct > 50 ? 'stat-bar-fill--hp-high' : pct > 25 ? 'stat-bar-fill--hp-mid' : 'stat-bar-fill--hp-low';
  } else {
    fillClass = 'stat-bar-fill--mp';
  }

  return (
    <div className="stat-row">
      <span className="stat-label" aria-hidden="true">{label}</span>
      <div
        className="stat-bar-track"
        role="progressbar"
        aria-label={`${label}: ${current} of ${max}`}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`stat-bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="stat-value" aria-hidden="true">{current} / {max}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function CombatPage() {
  const canvasHostRef = useRef(null);
  const gameRef        = useRef(null);
  const [phaserReady, setPhaserReady]   = useState(false);
  const [phaserError, setPhaserError]   = useState(null);
  const prefersReduced = usePrefersReducedMotion();

  const {
    combatState,
    playerHP,   maxPlayerHP,
    playerMP,   maxPlayerMP,
    opponentHP, maxOpponentHP,
    opponent,
    lastScoreData,
    lastOpponentSpell,
    lastPlayerSpell,
    lastPlayerDamage,
    battleLog,
    turnNumber,
    profileType,
    doctrine,
    passiveLabel,
    phase,
    telegraph,
    telegraphKey,
    moveId,
    moveLabel,
    moveSchool,
    statusesApplied,
    stolenTokens,
    arenaCondition,
    castPlayerSpell,
    continueAfterReveal,
    cancelCasting,
    restartCombat,
    combatStats,
  } = useCombatEngine();

  // ─── Phaser Bootstrap ────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    let game    = null;

    const initPhaser = async () => {
      try {
        const [{ default: Phaser }, { BattleScene }] = await Promise.all([
          import('phaser'),
          import('./scenes/BattleScene.js'),
        ]);

        if (!mounted || !canvasHostRef.current) return;

        game = new Phaser.Game({
          type: Phaser.AUTO,
          width: 800,
          height: 480,
          parent: canvasHostRef.current,
          backgroundColor: '#080413',
          scene: [BattleScene],
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          render: { antialias: true, pixelArt: false },
        });

        gameRef.current = game;

        game.events.once('ready', () => {
          if (!mounted) return;
          setPhaserReady(true);
          setTimeout(() => {
            combatBridge.emit('combat:init', {
              playerName:   'Scholar',
              opponentName: opponent.name,
              playerHP:     maxPlayerHP,
              playerMP:     maxPlayerMP,
              opponentHP:   maxOpponentHP,
            });
          }, 200);
        });

      } catch (err) {
        if (!mounted) return;
        console.error('[CombatPage] Phaser init failed:', err);
        if (err.message?.includes('phaser') || err.code === 'MODULE_NOT_FOUND') {
          setPhaserError('Phaser not installed. Run: npm install phaser');
        } else {
          setPhaserError(`Failed to load battle engine: ${err.message}`);
        }
      }
    };

    initPhaser();

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      combatBridge.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Action handlers ─────────────────────────────────────────────────────

  const handleInscribe = useCallback(() => {
    combatBridge.emit('action:inscribe', {});
  }, []);

  const handleFlee = useCallback(() => {
    combatBridge.emit('action:flee', {});
  }, []);

  // Keyboard shortcut: I = inscribe when player turn
  useEffect(() => {
    const onKey = (e) => {
      if (combatState === 'PLAYER_TURN' && (e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleInscribe();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combatState, handleInscribe]);

  // ─── Derived state ────────────────────────────────────────────────────────

  const isSpellbookOpen  = combatState === 'CASTING';
  const isScoreRevealing = combatState === 'SCORE_REVEAL';
  const isVictory        = combatState === 'VICTORY';
  const isDefeat         = combatState === 'DEFEAT';
  const isEndState       = isVictory || isDefeat;
  const isPlayerTurn     = combatState === 'PLAYER_TURN';
  const opponentHPPct    = Math.max(0, Math.min(100, (opponentHP / maxOpponentHP) * 100));
  const opponentHPColor = opponentHPPct > 50 ? '#22aa44' : opponentHPPct > 25 ? '#ddaa00' : '#cc2222';
  const doctrineSurface = {
    profileType: profileType ?? opponent?.profileType ?? null,
    doctrine: doctrine ?? opponent?.doctrine ?? opponent?.subtitle ?? null,
    passiveLabel: passiveLabel ?? opponent?.passiveLabel ?? null,
    phase: phase ?? opponent?.phase ?? null,
    telegraph: telegraph ?? opponent?.telegraph ?? null,
    telegraphKey: telegraphKey ?? opponent?.telegraphKey ?? null,
    moveId: moveId ?? opponent?.moveId ?? lastOpponentSpell ?? null,
    moveLabel: moveLabel ?? opponent?.moveLabel ?? null,
    moveSchool: moveSchool ?? opponent?.moveSchool ?? null,
    statusesApplied: statusesApplied ?? opponent?.statusesApplied ?? [],
    stolenTokens: stolenTokens ?? opponent?.stolenTokens ?? [],
    arenaCondition: arenaCondition ?? opponent?.arenaCondition ?? null,
  };

  // State label shown in the terminal footer when not player turn
  const stateLabel = {
    OPPONENT_TURN:    'Counter-verse gathering...',
    OPPONENT_CASTING: 'The counter-verse strikes...',
    SPELL_FLYING:     'Verse in flight...',
    SCORE_REVEAL:     'The aftermath unfolds...',
    INTRO:            'The arena stirs...',
  }[combatState] ?? null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="combat-page" data-state={combatState}>

      {/* ── Turn Banner ── */}
      <div className="combat-turn-banner" aria-label={`Turn ${turnNumber}`}>
        <span className="combat-school-badge">SONIC THAUMATURGY</span>
        <span className="combat-turn-label">TURN {turnNumber}</span>
        <span className="combat-opponent-name">{opponent?.name}</span>
      </div>

      {/* ── Main Split ── */}
      <div className="combat-split">

        {/* LEFT — Phaser visionglass */}
        <div className="combat-visual-col">

          {/* Phaser canvas */}
          <div
            className="combat-canvas-host"
            ref={canvasHostRef}
            aria-label="Battle arena"
          >
            {!phaserReady && !phaserError && (
              <div className="combat-canvas-loading" role="status" aria-live="polite">
                <div className="loading-glyph" aria-hidden="true">♩</div>
                <p>The arena stirs...</p>
              </div>
            )}
            {phaserError && (
              <div className="combat-canvas-error" role="alert">
                <p className="error-title">Arena Unavailable</p>
                <p className="error-body">{phaserError}</p>
                <code className="error-code">npm install phaser</code>
              </div>
            )}
          </div>

          {/* Opponent HP — visual footer */}
          <div className="combat-visual-footer">
            <div className="vf-opponent-row">
              <span className="vf-opponent-name">{opponent?.name ?? 'The Cryptonym'}</span>
              <span className="vf-opponent-hp-text" aria-hidden="true">
                {opponentHP} / {maxOpponentHP}
              </span>
            </div>
            <div
              className="vf-hp-track"
              role="progressbar"
              aria-label={`Opponent HP: ${opponentHP} of ${maxOpponentHP}`}
              aria-valuenow={opponentHP}
              aria-valuemin={0}
              aria-valuemax={maxOpponentHP}
            >
              <motion.div
                className="vf-hp-fill"
                animate={{ width: `${opponentHPPct}%`, backgroundColor: opponentHPColor }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Text terminal */}
        <div className="combat-terminal-col">

          {/* Status bars — player HP/MP */}
          <div className="combat-status-header" aria-label="Scholar stats">
            <StatusBar label="HP" current={playerHP} max={maxPlayerHP} variant="hp" />
            <StatusBar label="MP" current={playerMP} max={maxPlayerMP} variant="mp" />
          </div>

          {/* The Chronicle — primary MUD text surface */}
          <OpponentDoctrinePanel
            opponent={opponent}
            profileType={doctrineSurface.profileType}
            doctrine={doctrineSurface.doctrine}
            passiveLabel={doctrineSurface.passiveLabel}
            phase={doctrineSurface.phase}
            telegraph={doctrineSurface.telegraph}
            telegraphKey={doctrineSurface.telegraphKey}
            moveId={doctrineSurface.moveId}
            moveLabel={doctrineSurface.moveLabel}
            moveSchool={doctrineSurface.moveSchool}
            statusesApplied={doctrineSurface.statusesApplied}
            stolenTokens={doctrineSurface.stolenTokens}
            arenaCondition={doctrineSurface.arenaCondition}
            prefersReduced={prefersReduced}
          />
          <BattleLog entries={battleLog} />

          {/* Score Reveal — inline in terminal after chronicle */}
          <ScoreReveal
            isVisible={isScoreRevealing}
            scoreData={lastScoreData}
            damage={lastPlayerDamage}
            spellText={lastPlayerSpell}
            opponentHP={opponentHP}
            onContinue={continueAfterReveal}
          />

          {/* Inline Spellbook — sits at terminal bottom when CASTING */}
          <Spellbook
            isVisible={isSpellbookOpen}
            mode="inline"
            onCast={castPlayerSpell}
            onCancel={cancelCasting}
            playerMP={playerMP}
            mpCost={MP_COST}
          />

          {/* Action bar — command prompt when PLAYER_TURN */}
          <AnimatePresence>
            {isPlayerTurn && (
              <motion.div
                className="combat-action-bar"
                role="toolbar"
                aria-label="Combat actions"
                initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
              >
                <span className="action-prompt" aria-hidden="true">▶</span>
                <button
                  className="action-btn action-btn--inscribe"
                  onClick={handleInscribe}
                  disabled={playerMP < MP_COST}
                  aria-label={`Inscribe a spell. Press I as keyboard shortcut. MP cost: ${MP_COST}.`}
                  title="Press I to inscribe"
                >
                  INSCRIBE SPELL
                  <span className="action-kbd" aria-hidden="true">[I]</span>
                </button>
                <button
                  className="action-btn action-btn--flee"
                  onClick={handleFlee}
                  aria-label="Flee from combat"
                >
                  FLEE
                </button>
              </motion.div>
            )}

            {/* State indicator — shown when not player turn and not end */}
            {!isPlayerTurn && !isSpellbookOpen && !isEndState && stateLabel && (
              <motion.div
                className="combat-state-indicator"
                key={combatState}
                role="status"
                aria-live="polite"
                initial={prefersReduced ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="state-indicator-glyph" aria-hidden="true">
                  {combatState === 'OPPONENT_TURN' || combatState === 'OPPONENT_CASTING' ? '◀' : '·'}
                </span>
                <span className="state-indicator-text">{stateLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ── Spell cast effect overlay ── */}
      <SpellCastEffect combatState={combatState} prefersReduced={prefersReduced} />

      {/* ── Victory / Defeat overlay ── */}
      <AnimatePresence>
        {isEndState && (
          <motion.div
            className={`combat-end-overlay combat-end-overlay--${combatState.toLowerCase()}`}
            role="dialog"
            aria-modal="true"
            aria-label={isVictory ? 'Victory' : 'Defeat'}
            aria-live="assertive"
            initial={prefersReduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="end-overlay-inner">
              <div className="end-overlay-glyph" aria-hidden="true">
                {isVictory ? '✦' : '∅'}
              </div>
              <h2 className="end-overlay-title">
                {isVictory ? 'THE RITE IS COMPLETE' : 'THE RITE IS BROKEN'}
              </h2>
              <p className="end-overlay-subtitle">
                {isVictory
                  ? `${opponent?.name} has been silenced. The resonance lattice holds.`
                  : 'Your verse was not enough. The anti-word consumed you.'}
              </p>

              {isVictory && (
                <div className="end-overlay-stats" aria-label="Combat statistics">
                  <div className="end-stat">
                    <span className="end-stat-label">Turns</span>
                    <span className="end-stat-value">{turnNumber}</span>
                  </div>
                  <div className="end-stat">
                    <span className="end-stat-label">HP Remaining</span>
                    <span className="end-stat-value">{playerHP}</span>
                  </div>
                  <div className="end-stat">
                    <span className="end-stat-label">MP Remaining</span>
                    <span className="end-stat-value">{playerMP}</span>
                  </div>
                  {combatStats?.xpAwarded > 0 && (
                    <div className="end-stat">
                      <span className="end-stat-label">XP Awarded</span>
                      <span className="end-stat-value end-stat-value--xp">{combatStats.xpAwarded}</span>
                    </div>
                  )}
                  {combatStats?.verseEfficiency > 0 && (
                    <div className="end-stat">
                      <span className="end-stat-label">Verse Efficiency</span>
                      <span className="end-stat-value">{Math.round(combatStats.verseEfficiency)}</span>
                    </div>
                  )}
                </div>
              )}

              {isVictory && combatStats?.bestSpellText && (
                <div className="end-overlay-best-spell">
                  <span className="end-overlay-best-label" aria-hidden="true">BEST VERSE</span>
                  <blockquote className="end-overlay-best-text">
                    &ldquo;{combatStats.bestSpellText.slice(0, 80)}{combatStats.bestSpellText.length > 80 ? '…' : ''}&rdquo;
                  </blockquote>
                </div>
              )}

              <button
                className="end-overlay-btn"
                onClick={restartCombat}
                aria-label="Begin a new combat rite"
              >
                ✦ INSCRIBE AGAIN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
