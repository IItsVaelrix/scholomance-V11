import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AlchemicalLabBackground } from "./AlchemicalLabBackground";
import { SignalChamberConsole } from "./SignalChamberConsole";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { SCHOOLS, generateSchoolColor } from "../../data/schools";
import { useMemo, useState, useRef, useEffect } from "react";
import "./ListenPage.css";

/**
 * ListenPage — The Scholomance Resonance Chamber.
 * An immersive 3D/HUD hybrid cockpit.
 */
export default function ListenPage() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const allSchoolIds = useMemo(() => Object.keys(SCHOOLS), []);

  const {
    currentSchoolId,
    isPlaying,
    isTuning,
    signalLevel,
    volume,
    setVolume,
    togglePlayPause,
  } = useAmbientPlayer(allSchoolIds);

  // ── Entropy tracking — UI-only: punishes looping the same school ──────────
  const [entropyLevel, setEntropyLevel] = useState(0);
  const playCountRef = useRef<Record<string, number>>({});
  const prevIsPlayingRef = useRef(false);

  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;
    if (isPlaying && !wasPlaying && currentSchoolId) {
      playCountRef.current[currentSchoolId] =
        (playCountRef.current[currentSchoolId] ?? 0) + 1;
      const count = playCountRef.current[currentSchoolId];
      // Grace: 2 free plays. Entropy accumulates over the next 8 loops.
      const raw = Math.max(0, (count - 2) / 8);
      setEntropyLevel(Math.min(100, Math.round(raw * 100)));
    }
  }, [isPlaying, currentSchoolId]);

  // Recalculate entropy when switching stations
  useEffect(() => {
    if (currentSchoolId) {
      const count = playCountRef.current[currentSchoolId] ?? 0;
      const raw = Math.max(0, (count - 2) / 8);
      setEntropyLevel(Math.min(100, Math.round(raw * 100)));
    }
  }, [currentSchoolId]);

  const entropyClass = entropyLevel >= 80
    ? 'entropy-critical'
    : entropyLevel >= 40
    ? 'entropy-high'
    : '';

  // Phoneme density warning — fires when signal is saturated (anti-exploit threshold)
  const phonemeWarning = signalLevel > 0.72;

  const currentStation = useMemo(
    () => {
      const id = currentSchoolId || 'chrono';
      const school = SCHOOLS[id] || Object.values(SCHOOLS)[0];
      return { ...school, color: generateSchoolColor(id) };
    },
    [currentSchoolId]
  );

  return (
    <section
      className={`listen-chamber ${prefersReducedMotion ? "is-reduced-motion" : ""} ${entropyClass}`}
      style={{ '--entropy': entropyLevel / 100 } as React.CSSProperties}
    >
      {/* ── Layer 0: 3D Environment (Phaser + Three.js) ────────────────── */}
      <AlchemicalLabBackground signalLevel={signalLevel} />
      <div className="chamber-scanlines" />
      
      {/* ── Layer 1: Holographic HUD (Sonic Thaumaturgy) ──────────────── */}
      
      {/* Top Header */}
      <header className="hud-header">
        <div className="hud-logo">
          <span className="logo-text arcade-glow">SONIC THAUMATURGY</span>
          <span className="logo-ver">V11.2 // RESONANCE</span>
        </div>
        
        <nav className="hud-nav">
          <button className="nav-item">Laboratory</button>
          <button className="nav-item">Archives</button>
          <button className="nav-item active">Frequencies</button>
        </nav>

        <div className="hud-meta">
          <span className="material-symbols-outlined">settings</span>
          <div className="user-node" />
        </div>
      </header>

      {/* Left Sidebar: Aperture Control */}
      <aside className="hud-sidebar hud-sidebar--left">
        <div className="sidebar-header">
          <h3>APERTURE</h3>
          <p>SIGNAL_PATH_04</p>
        </div>
        
        <nav className="sidebar-menu">
          <button className="menu-item active">
            <span className="material-symbols-outlined">waves</span>
            <span>OSCILLOSCOPE</span>
          </button>
          <button className="menu-item">
            <span className="material-symbols-outlined">science</span>
            <span>ALCHEMICAL</span>
          </button>
          <button className="menu-item">
            <span className="material-symbols-outlined">auto_graph</span>
            <span>RESONANCE</span>
          </button>
          <button className="menu-item">
            <span className="material-symbols-outlined">cyclone</span>
            <span>VORTEX</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="initiate-btn" onClick={() => togglePlayPause()}>
            {isPlaying ? "HALT_SYNC" : "INIT_SYNC"}
          </button>
        </div>
      </aside>

      {/* Center: The Core 3D Console */}
      <main className="hud-center">
        <motion.div 
          className="core-mount"
          animate={{ scale: isPlaying ? [1, 1.01, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 4 }}
        >
          <SignalChamberConsole />
          
          {/* Floating Status Plate */}
          <div className="core-status-plate" style={{ '--accent': currentStation.color } as any}>
            <div className="status-indicator">
              <span className={`pulse-dot ${isPlaying ? 'is-active' : ''}`} />
              {isTuning ? "SYNCHRONIZING..." : "RESONANCE_LOCKED"}
            </div>
            <h2>{currentStation.name.toUpperCase()}</h2>
            <div className="frequency-readout">
              {(432 + signalLevel * 8).toFixed(2)} Hz
            </div>
          </div>
        </motion.div>
      </main>

      {/* Right Sidebar: Parameters */}
      <aside className="hud-sidebar hud-sidebar--right">
        <div className="sidebar-header">
          <h3>PARAMETERS</h3>
          <p>AURAL_INTEGRITY</p>
        </div>

        <div className="parameter-grid">
          <div className="param-node">
            <div className="param-label">
              <span>FREQUENCY</span>
              <span className="val">{Math.round(signalLevel * 100)}%</span>
            </div>
            <div className="param-track">
              <motion.div className="param-fill" animate={{ width: `${60 + signalLevel * 40}%` }} />
            </div>
          </div>

          <div className="param-node">
            <div className="param-label">
              <span>VIBRATION</span>
              <span className="val">{Math.round(volume * 100)}%</span>
            </div>
            <div 
              className="param-track" 
              role="slider"
              aria-label="Volume control"
              aria-valuenow={Math.round(volume * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setVolume((e.clientX - rect.left) / rect.width);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  setVolume(Math.min(1, volume + 0.05));
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  setVolume(Math.max(0, volume - 0.05));
                }
              }}
            >
              <div className="param-fill" style={{ width: `${volume * 100}%`, backgroundColor: 'var(--text-secondary)' }} />
              <div className="param-handle" style={{ left: `${volume * 100}%` }} />
            </div>
          </div>

          <div className="param-node">
            <div className="param-label">
              <span>AURA_NODE</span>
              <span className="val">{currentStation.id.toUpperCase()}</span>
            </div>
            <div className="param-track">
              <div className="param-fill" style={{ width: '100%', opacity: 0.3 }} />
            </div>
          </div>

          {/* Entropy meter — fills as the player loops the same school */}
          <div className="param-node">
            <div className="param-label">
              <span>ENTROPY</span>
              <span className={`val ${entropyLevel >= 80 ? 'val--critical' : entropyLevel >= 40 ? 'val--warn' : ''}`}>
                {entropyLevel}%
              </span>
            </div>
            <div className="param-track param-track--entropy">
              <motion.div
                className={`param-fill param-fill--entropy ${entropyLevel >= 80 ? 'is-critical' : entropyLevel >= 40 ? 'is-warn' : ''}`}
                animate={{ width: `${entropyLevel}%` }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
              />
            </div>
            {entropyLevel >= 40 && (
              <div className="entropy-warning-label" aria-live="polite">
                {entropyLevel >= 80 ? '⚠ DIMINISHING RETURNS' : '↑ PATTERN DETECTED'}
              </div>
            )}
          </div>
        </div>

        <div className="analytics-block">
          <div className={`vfa-header ${phonemeWarning ? 'vfa-header--warn' : ''}`}>
            PHONEME_DENSITY
            {phonemeWarning && (
              <span className="vfa-warn-badge" aria-label="Anti-exploit threshold reached">⚠</span>
            )}
          </div>
          <div className={`vfa-viz ${phonemeWarning ? 'vfa-viz--warn' : ''}`}>
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                className={`vfa-bar ${phonemeWarning && i >= 11 ? 'vfa-bar--warn' : ''}`}
                animate={{ height: isPlaying ? [
                  `${15 + signalLevel * 55 + Math.sin(i * 0.9) * 20}%`,
                  `${10 + signalLevel * 65 + Math.cos(i * 0.7) * 22}%`,
                ] : '8%' }}
                transition={{ repeat: Infinity, duration: 0.38 + i * 0.025 }}
              />
            ))}
            {phonemeWarning && (
              <div className="phoneme-threshold-line" aria-hidden="true" />
            )}
          </div>
          {phonemeWarning && (
            <div className="phoneme-exploit-label" aria-live="assertive">
              HEURISTIC LIMIT — RETURNS DECAY
            </div>
          )}
          <div className="phase-controls">
            <button className="phase-btn">CONSONANT</button>
            <button className="phase-btn">VOWEL</button>
          </div>
        </div>
      </aside>

      {/* Global Hud Noise/Grit Overlay */}
      <div className="hud-noise" />
    </section>
  );
}
