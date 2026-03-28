import { motion } from "framer-motion";
import { ArcaneRadio } from "./ArcaneRadio";
import "./ListenPage.css";

/**
 * ListenPage — The Scholomance Signal Chamber.
 * Redesigned to feature the Arcane Radio and Crystal Ball.
 */
export default function ListenPage() {
  return (
    <section className="section listen-page">
      <div className="container listen-shell">
        <header className="listen-header">
          <div className="kicker">Aetheric Radio</div>
          <h1 className="title">Scholomance Signal Chamber</h1>
          <p className="subtitle">
            A dedicated ritual console for station control. The active ambience persists through every page except{" "}
            <strong>Watch</strong>.
          </p>
        </header>

        <motion.div 
          className="listen-main-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <ArcaneRadio />
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
