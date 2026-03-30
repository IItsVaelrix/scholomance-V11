import { motion } from "framer-motion";
import { SignalChamberConsole } from "./SignalChamberConsole";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AlchemicalLabBackground } from "./AlchemicalLabBackground";
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

      {/* ── Nebula Cloud FX (symmetric placement) ────────────────────── */}
      <div className="nebula-cloud" style={{ top: '25%', left: '15%', opacity: 0.06 }} />
      <div className="nebula-cloud" style={{ top: '25%', right: '15%', opacity: 0.06 }} />
      <div className="nebula-cloud" style={{ top: '60%', left: '20%', opacity: 0.04, animationDelay: '-8s' }} />
      <div className="nebula-cloud" style={{ top: '60%', right: '20%', opacity: 0.04, animationDelay: '-12s' }} />

      {/* ── Center: Signal Chamber Console ──────────────────────────── */}
      <div className="listen-shell">
        <header className="listen-header">
          <span
            className={`badge badge--${currentStation?.id || 'void'}`}
            style={{ '--school-color': currentStation?.color } as React.CSSProperties}
          >
            {currentStation?.name || 'No Signal'}
          </span>
          <span className="badge glass">
            <span style={{ color: currentStation?.color }}>{signalLevel > 0 ? 'TRANSMITTING' : 'STANDBY'}</span>
          </span>
        </header>

        <div className="listen-board">
          <motion.div
            className="listen-main-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="listen-halo-ring"
              style={{
                '--halo-color': currentStation?.color,
                '--halo-sig': signalLevel,
                transform: `translate(-50%, -50%) scale(${1 + signalLevel * 0.08})`,
                opacity: 0.15 + signalLevel * 0.6
              } as React.CSSProperties}
            />
            <SignalChamberConsole />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
