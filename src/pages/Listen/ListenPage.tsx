import { motion } from "framer-motion";
import { SignalChamberConsole } from "./SignalChamberConsole";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AlchemicalLabBackground } from "./AlchemicalLabBackground";
import { ArcaneShelfPanel } from "./ArcaneShelfPanel";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { SCHOOLS, generateSchoolColor } from "../../data/schools";
import { useMemo } from "react";
import "./ListenPage.css";

/**
 * ListenPage — The Scholomance Signal Chamber.
 * Immersive ritual cockpit based on Sonic Thaumaturgy console design.
 */
export default function ListenPage() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const allSchoolIds = useMemo(() => Object.keys(SCHOOLS), []);
  
  const {
    currentSchoolId,
    isPlaying,
    signalLevel,
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
    <section className={`section listen-page${prefersReducedMotion ? " is-reduced-motion" : ""}`}>
      {/* ── Background: Arcane Laboratory (3D Sync) ───────────────────── */}
      <AlchemicalLabBackground signalLevel={signalLevel} />
      
      <div className="listen-background-overlay" />

      {/* ── Side Shelves: Alchemical Props & Monitors ─────────────────── */}
      <ArcaneShelfPanel 
        side="left" 
        schoolName={currentStation?.name || 'STANDBY'} 
        schoolColor={currentStation?.color} 
        isPlaying={isPlaying} 
        prefersReducedMotion={prefersReducedMotion} 
      />
      
      <ArcaneShelfPanel 
        side="right" 
        schoolName={currentStation?.name || 'STANDBY'} 
        schoolColor={currentStation?.color} 
        isPlaying={isPlaying} 
        prefersReducedMotion={prefersReducedMotion} 
      />

      {/* ── Nebula Cloud FX ────────────────────────────────────────── */}
      <div className="nebula-cloud" style={{ top: '20%', left: '10%' }} />
      <div className="nebula-cloud" style={{ top: '50%', right: '10%', opacity: 0.12, animationDelay: '-10s' }} />

      {/* ── Center: Signal Chamber Console ──────────────────────────── */}
      <div className="container listen-shell">
        <header className="section-header listen-header">
          <div className="kicker">Sonic Thaumaturgy Interface</div>
          <h1 className="title">Scholomance Signal Chamber</h1>
          <p className="subtitle">
            Ritual transmission core for <strong>Sonic Thaumaturgy</strong>. 
            Sync your consciousness to the aetheric bands.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span 
              className={`badge badge--${currentStation?.id || 'void'}`}
              style={{ '--school-color': currentStation?.color } as React.CSSProperties}
            >
              {currentStation?.name || 'No Signal'}
            </span>
            <span className="badge glass">
              <span style={{ color: currentStation?.color }}>{signalLevel > 0 ? 'TRANSMITTING' : 'STANDBY'}</span>
            </span>
          </div>
        </header>

        <div className="listen-board">
          <motion.div
            className="listen-main-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Renaissance Halo Element — Responsive to signalLevel */}
            <div 
              className="listen-halo-ring" 
              style={{ 
                '--halo-color': currentStation?.color,
                '--halo-sig': signalLevel,
                transform: `translate(-50%, -50%) scale(${1 + signalLevel * 0.15})`,
                opacity: 0.2 + signalLevel * 0.8
              }} 
            />
            
            <SignalChamberConsole />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
