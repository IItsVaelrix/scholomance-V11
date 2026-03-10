/**
 * Spellbook.jsx
 * Text-input surface for casting spells.
 *
 * Two modes:
 *   mode="inline"  — Sits at the bottom of the MUD terminal column (default for CombatPage)
 *   mode="modal"   — Fixed-position dialog overlay (legacy/backward-compat)
 *
 * Reuses the textarea-overlay pattern (CLAUDE.md § Textarea Overlay Sync).
 * Textarea z-index:1 (input), overlay div z-index:2 (analysis shimmer).
 *
 * Props:
 *   onCast(text, scoreData) — called when player clicks CAST
 *   onCancel()              — called when player cancels
 *   isVisible               — controls mount animation
 *   playerMP                — current MP (gates casting)
 *   mpCost                  — MP cost per cast (displayed)
 *   mode                    — "inline" | "modal"  (default "modal")
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScoring } from '../../../hooks/useScoring.js';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.js';

const MAX_CHARS    = 100;
const SCHOOL_COLOR = '#651fff';   // SONIC
const GOLD         = '#c9a227';

// ─── Placeholder sonic affinity estimator ─────────────────────────────────
// (STUB — Phase 3 replaces with real usePanelAnalysis vowelSummary signal)
function estimateSonicAffinity(text) {
  if (!text) return 0;
  const matches = (text.match(/[eing]/gi) || []).length;
  return Math.min(1, matches / (text.length * 0.15 + 1));
}

// ─── Power Meter — shared between inline and modal ─────────────────────────

function PowerMeterInline({ scoreData, isScoring }) {
  const score    = scoreData?.totalScore ?? scoreData?.score ?? 0;
  const pct      = Math.min(100, Math.max(0, score));
  const barColor = pct > 70 ? '#22aa44' : pct > 40 ? '#ddaa00' : SCHOOL_COLOR;

  return (
    <div className="spellbook-inline-power-row">
      <span className="spellbook-inline-power-label">RESONANCE</span>
      <div className="spellbook-inline-bar-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="spellbook-inline-bar-fill"
          style={{ backgroundColor: barColor }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </div>
      <span className="spellbook-inline-power-value" style={{ color: barColor }}>
        {isScoring ? '…' : Math.round(pct)}
      </span>
    </div>
  );
}

function PowerMeterModal({ scoreData, isScoring }) {
  const score    = scoreData?.totalScore ?? scoreData?.score ?? 0;
  const pct      = Math.min(100, Math.max(0, score));
  const barColor = pct > 70 ? '#22aa44' : pct > 40 ? '#ddaa00' : SCHOOL_COLOR;

  return (
    <div className="spellbook-power-meter" aria-label={`Spell power: ${Math.round(pct)}%`}>
      <div className="power-meter-label">
        <span className="power-meter-title">RESONANCE</span>
        <span className="power-meter-value" style={{ color: barColor }}>
          {isScoring ? '...' : `${Math.round(pct)}`}
        </span>
      </div>
      <div className="power-meter-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="power-meter-fill"
          style={{ backgroundColor: barColor }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      {scoreData && (
        <div className="power-meter-traces">
          {(scoreData.traces ?? scoreData.explainTrace ?? []).slice(0, 4).map((t, i) => (
            <div key={i} className="power-meter-trace-chip">
              <span className="trace-name">{(t.heuristic ?? '').replace(/_/g, ' ')}</span>
              <span className="trace-val">{Math.round(t.contribution ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function Spellbook({ onCast, onCancel, isVisible, playerMP, mpCost = 10, mode = 'modal' }) {
  const [text, setText]     = useState('');
  const textareaRef         = useRef(null);
  const prefersReduced      = usePrefersReducedMotion();
  const { scoreData, isScoring } = useScoring(text);

  const charsLeft  = MAX_CHARS - text.length;
  const canCast    = text.trim().length > 0 && playerMP >= mpCost;
  const isNearLimit = charsLeft <= 15;
  const isAtLimit   = charsLeft <= 0;

  // Focus textarea and clear text on visibility change
  useEffect(() => {
    if (isVisible) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      setText('');
    }
  }, [isVisible]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) setText(val);
  }, []);

  const handleCast = useCallback(() => {
    if (!canCast) return;
    onCast(text, scoreData);
    setText('');
  }, [canCast, text, scoreData, onCast]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCast();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleCast, onCancel]);

  const sonicOpacity = estimateSonicAffinity(text) * (mode === 'inline' ? 0.1 : 0.12);
  const mpColor      = playerMP >= mpCost ? '#4488ff' : '#cc2222';

  // ─── Inline mode ────────────────────────────────────────────────────────

  if (mode === 'inline') {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="spellbook-inline"
            role="group"
            aria-label="Spellbook — inscribe your verse"
            initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? {} : { opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* Header row */}
            <div className="spellbook-inline-header">
              <span className="spellbook-inline-title">✦ INSCRIBE YOUR VERSE</span>
              <span
                className="spellbook-inline-mp"
                style={{ color: mpColor }}
                aria-live="polite"
                aria-label={`MP cost: ${mpCost} of ${playerMP} remaining`}
              >
                MP {mpCost} / {playerMP}
              </span>
            </div>

            {/* Editor — textarea + shimmer overlay */}
            <div className="spellbook-inline-editor">
              {/* Shimmer overlay (z:2, aria-hidden) */}
              {text && (
                <div
                  className="spellbook-inline-shimmer"
                  aria-hidden="true"
                  style={{ opacity: sonicOpacity }}
                />
              )}

              {/* Textarea (z:1 — actual input) */}
              <textarea
                ref={textareaRef}
                className="spellbook-inline-textarea"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Write your scroll… (100 chars)"
                maxLength={MAX_CHARS}
                rows={3}
                aria-label="Spell input — 100 character limit"
                aria-describedby="inline-spellbook-meta"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {/* Compact power / trace row */}
            <PowerMeterInline scoreData={scoreData} isScoring={isScoring} />

            {/* Trace chips */}
            {scoreData && (
              <div className="spellbook-inline-traces">
                {(scoreData.traces ?? scoreData.explainTrace ?? []).slice(0, 5).map((t, i) => (
                  <div key={i} className="power-meter-trace-chip">
                    <span className="trace-name">{(t.heuristic ?? '').replace(/_/g, ' ')}</span>
                    <span className="trace-val">{Math.round(t.contribution ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions row */}
            <div className="spellbook-inline-actions">
              <span
                id="inline-spellbook-meta"
                className="spellbook-inline-meta"
                aria-live="polite"
              >
                {isAtLimit
                  ? '■ SCROLL FULL'
                  : isNearLimit
                  ? `${charsLeft} chars remain`
                  : `${charsLeft} chars · Ctrl+Enter to cast · Esc to cancel`}
              </span>
              <div className="spellbook-inline-btns">
                <button
                  className="spellbook-btn spellbook-btn--cancel"
                  onClick={onCancel}
                  aria-label="Cancel casting"
                >
                  CANCEL
                </button>
                <button
                  className="spellbook-btn spellbook-btn--cast"
                  onClick={handleCast}
                  disabled={!canCast}
                  aria-label={canCast ? 'Cast this spell' : 'Cannot cast — write something first'}
                  title="Ctrl+Enter to cast"
                >
                  {isScoring ? 'ANALYZING…' : 'CAST SPELL'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ─── Modal mode (legacy) ─────────────────────────────────────────────────

  const motionProps = prefersReduced
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, scale: 0.96, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit:    { opacity: 0, scale: 0.96, y: 10 },
      };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="spellbook-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Spellbook panel */}
          <motion.div
            className="spellbook-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Spellbook — inscribe your verse"
            {...motionProps}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="spellbook-header">
              <span className="spellbook-glyph" aria-hidden="true">✦</span>
              <h2 className="spellbook-title">INSCRIBE YOUR VERSE</h2>
              <span className="spellbook-glyph" aria-hidden="true">✦</span>
            </div>
            <p className="spellbook-subtitle">
              Words are weapons. Syntax is force. Make it resonate.
            </p>

            <div className="spellbook-mp-cost" aria-live="polite">
              <span>MP Cost:</span>
              <span style={{ color: playerMP >= mpCost ? '#4488ff' : '#cc2222' }}>
                {mpCost} / {playerMP} remaining
              </span>
            </div>

            {/* Editor area — textarea overlay pattern */}
            <div className="spellbook-editor-host">
              <div className="spellbook-overlay" aria-hidden="true">
                {text && (
                  <div
                    className="spellbook-affinity-shimmer"
                    style={{ opacity: sonicOpacity }}
                  />
                )}
              </div>
              <textarea
                ref={textareaRef}
                className="spellbook-textarea"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Write your scroll here... (100 characters)"
                maxLength={MAX_CHARS}
                rows={4}
                aria-label="Spell input — 100 character limit"
                aria-describedby="modal-spellbook-char-count"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <div
              id="modal-spellbook-char-count"
              className="spellbook-char-count"
              aria-live="polite"
              style={{ color: isAtLimit ? '#cc2222' : isNearLimit ? '#ddaa00' : '#6b5a2a' }}
            >
              {isAtLimit ? '■ SCROLL FULL' : `${charsLeft} chars remain`}
            </div>

            <PowerMeterModal scoreData={scoreData} isScoring={isScoring} />

            <div className="spellbook-actions">
              <button
                className="spellbook-btn spellbook-btn--cancel"
                onClick={onCancel}
                aria-label="Cancel casting"
              >
                CANCEL
              </button>
              <button
                className="spellbook-btn spellbook-btn--cast"
                onClick={handleCast}
                disabled={!canCast}
                aria-label={canCast ? 'Cast this spell' : 'Cannot cast — write something first'}
                title="Ctrl+Enter to cast"
              >
                {isScoring ? 'ANALYZING...' : 'CAST SPELL'}
              </button>
            </div>

            <p className="spellbook-hint" aria-hidden="true">
              Ctrl+Enter to cast &nbsp;·&nbsp; Esc to cancel
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
