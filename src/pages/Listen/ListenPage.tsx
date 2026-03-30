import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AlchemicalLabBackground } from "./AlchemicalLabBackground";
import { SignalChamberConsole } from "./SignalChamberConsole";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { SCHOOLS, generateSchoolColor } from "../../data/schools";
import { useMemo } from "react";
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
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
  } = useAmbientPlayer(allSchoolIds);

  const currentStation = useMemo(
    () => {
      const id = currentSchoolId || 'chrono';
      const school = SCHOOLS[id] || Object.values(SCHOOLS)[0];
      return { ...school, color: generateSchoolColor(id) };
    },
    [currentSchoolId]
  );

  return (
    <section className={`listen-chamber ${prefersReducedMotion ? "is-reduced-motion" : ""}`}>
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
            <div className="param-track" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setVolume((e.clientX - rect.left) / rect.width);
            }}>
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
        </div>

        <div className="analytics-block">
          <div className="vfa-header">VECTOR FIELD ANALYSIS</div>
          <div className="vfa-viz">
            {[...Array(16)].map((_, i) => (
              <motion.div 
                key={i}
                className="vfa-bar"
                animate={{ height: isPlaying ? [
                  `${20 + Math.random() * 80}%`, 
                  `${20 + Math.random() * 80}%`
                ] : '10%' }}
                transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.4 }}
              />
            ))}
          </div>
          <div className="phase-controls">
            <button className="phase-btn">PHASE_X</button>
            <button className="phase-btn">PHASE_Y</button>
          </div>
        </div>
      </aside>

      {/* Global Hud Noise/Grit Overlay */}
      <div className="hud-noise" />
    </section>
  );
}
