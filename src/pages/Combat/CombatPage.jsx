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

import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCombatEngine } from './hooks/useCombatEngine.js';
import { useUserSettings } from '../../hooks/useUserSettings.js';
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
  const { settings } = useUserSettings();

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
    telegraph,
    moveLabel,
    moveSchool,
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

    // Defer Phaser init to idle time — page content renders first, arena loads after
    const useRIC = typeof requestIdleCallback !== 'undefined';
    const idleHandle = useRIC
      ? requestIdleCallback(initPhaser, { timeout: 3000 })
      : setTimeout(initPhaser, 0);

    return () => {
      mounted = false;
      if (useRIC) cancelIdleCallback(idleHandle);
      else clearTimeout(idleHandle);
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

  const isScoreRevealing = combatState === 'SCORE_REVEAL';
  const isVictory        = combatState === 'VICTORY';
  const isDefeat         = combatState === 'DEFEAT';
  const isEndState       = isVictory || isDefeat;
  const isPlayerTurn     = combatState === 'PLAYER_TURN';
  const opponentHPPct    = Math.max(0, Math.min(100, (opponentHP / maxOpponentHP) * 100));
  const opponentHPColor = opponentHPPct > 50 ? '#22aa44' : opponentHPPct > 25 ? '#ddaa00' : '#cc2222';
  const doctrineSurface = {
    profileType: opponent?.doctrine?.id || opponent?.profileType || null,
    doctrine: opponent?.doctrine?.description || opponent?.subtitle || null,
    passiveLabel: opponent?.doctrine?.traits?.join(', ') || null,
    phase: opponent?.phase || null,
    telegraph: telegraph || null,
    telegraphKey: telegraph || null,
    moveId: moveLabel || lastOpponentSpell || null,
    moveLabel: moveLabel || null,
    moveSchool: moveSchool || null,
    statusesApplied: opponent?.statusEffects || [],
    stolenTokens: opponent?.stolenTokens || [],
    arenaCondition: opponent?.arenaCondition || null,
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="combat-page" data-state={combatState}>

      {/* ── Turn Banner ── */}
      <div className="combat-turn-banner" aria-label={`Turn ${turnNumber}`}>
        <span className="combat-school-badge">{(opponent?.schoolName || 'THE RITE').toUpperCase()}</span>
        <span className="combat-turn-label">TURN {turnNumber}</span>
        <span className="combat-opponent-name">{opponent?.name}</span>
      </div>

      {/* ── Main Dashboard ── */}
      <main className="combat-dashboard vellum-surface">
        <PanelGroup 
          direction="horizontal" 
        >
          {/* COLUMN 1: THE SPELLBOOK (Input) */}
          <Panel 
            defaultSize={settings?.combatLayout?.[0] ?? 25} 
            minSize={20}
            className="combat-panel combat-panel--left"
          >
            <div className="panel-inner">
              <header className="panel-header">
                <span className="panel-title">✦ SPELLBOOK</span>
              </header>
              <div className="panel-content">
                <div className="combat-status-header" aria-label="Scholar stats">
                  <StatusBar label="HP" current={playerHP} max={maxPlayerHP} variant="hp" />
                  <StatusBar label="MP" current={playerMP} max={maxPlayerMP} variant="mp" />
                </div>
                
                <Spellbook
                  isVisible={true} // Persistent in dashboard
                  mode="inline"
                  onCast={castPlayerSpell}
                  onCancel={cancelCasting}
                  playerMP={playerMP}
                  mpCost={MP_COST}
                />

                {isPlayerTurn && (
                  <div className="combat-prompt-area">
                    <span className="action-prompt">READY TO INSCRIBE</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="combat-resize-handle" />

          {/* COLUMN 2: THE ARENA (Visuals) */}
          <Panel 
            defaultSize={settings?.combatLayout?.[1] ?? 45} 
            minSize={30}
            className="combat-panel combat-panel--center"
          >
            <div className="panel-inner">
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
                    <div className="error-glyph" aria-hidden="true">⚔</div>
                    <p className="error-title">Text-Only Mode</p>
                  </div>
                )}
              </div>

              {/* Opponent HP — floating overlay in arena */}
              <div className="combat-opponent-overlay">
                <div className="vf-opponent-row">
                  <span className="vf-opponent-name">{opponent?.name ?? 'The Cryptonym'}</span>
                  <span className="vf-opponent-hp-text">
                    {opponentHP} / {maxOpponentHP}
                  </span>
                </div>
                <div className="vf-hp-track">
                  <motion.div
                    className="vf-hp-fill"
                    animate={{ width: `${opponentHPPct}%`, backgroundColor: opponentHPColor }}
                    transition={{ duration: 0.45 }}
                  />
                </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="combat-resize-handle" />

          {/* COLUMN 3: THE CHRONOS TERMINAL (Log) */}
          <Panel 
            defaultSize={settings?.combatLayout?.[2] ?? 30} 
            minSize={20}
            className="combat-panel combat-panel--right"
          >
            <div className="panel-inner">
              <header className="panel-header">
                <span className="panel-title">✦ CHRONICLE</span>
              </header>
              <div className="panel-content">
                <OpponentDoctrinePanel
                  opponent={opponent}
                  {...doctrineSurface}
                  prefersReduced={prefersReduced}
                />
                <BattleLog entries={battleLog} />
                
                {/* Score Reveal floats over log */}
                <AnimatePresence>
                  {isScoreRevealing && (
                    <motion.div 
                      className="inline-score-overlay"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <ScoreReveal
                        isVisible={true}
                        scoreData={lastScoreData}
                        damage={lastPlayerDamage}
                        spellText={lastPlayerSpell}
                        opponentHP={opponentHP}
                        onContinue={continueAfterReveal}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </main>

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
