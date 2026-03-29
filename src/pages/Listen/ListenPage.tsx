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
        <motion.div
          className="listen-main-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <SignalChamberConsole />
        </motion.div>
      </div>
    </section>
  );
}
