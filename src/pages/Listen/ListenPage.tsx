import { motion } from "framer-motion";
import { SignalChamberConsole } from "./SignalChamberConsole";
import { AlchemicalLabBackground } from "./AlchemicalLabBackground";
import "./ListenPage.css";

/**
 * ListenPage — The Scholomance Signal Chamber.
 * Immersive ritual cockpit based on Sonic Thaumaturgy console design.
 */
export default function ListenPage() {
  return (
    <section className="section listen-page">
      <AlchemicalLabBackground />
      <div className="listen-background-fx" />
      <div className="container listen-shell">
        <header className="listen-header">
          <div className="kicker">Signal Chamber</div>
          <h1 className="title">Sonic Thaumaturgy</h1>
          <p className="subtitle">
            Aetheric ritual console. Tuning to specific phonemic anchors stabilizes the reality-grid.
          </p>
        </header>

        <motion.div 
          className="listen-main-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <SignalChamberConsole />
        </motion.div>

        <footer className="listen-footer">
          <p>
            Current Signal: <strong>Stabilized</strong> | 
            Protocol: <strong>Scholomance v11.3</strong>
          </p>
        </footer>
      </div>
    </section>
  );
}
