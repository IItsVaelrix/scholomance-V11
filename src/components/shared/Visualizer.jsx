import { motion } from "framer-motion";

export default function Visualizer({ color, active }) {
  if (!active) return null;

  return (
    <div className="visualizer" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="visualizer-bar"
          style={{
            backgroundColor: color,
            filter: `drop-shadow(0 0 10px ${color}55)`,
          }}
          animate={{ height: [10, 60, 24, 70, 18] }}
          transition={{
            duration: 0.55,
            repeat: Infinity,
            repeatType: "mirror",
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
