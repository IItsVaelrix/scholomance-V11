import { motion, AnimatePresence } from "framer-motion";

export default function NixieTube({ value, index = 0 }) {
  const isDecimal = value === ".";

  return (
    <div className={`nixie-tube ${isDecimal ? "nixie-tube--decimal" : ""}`} aria-hidden="true">
      <div className="nixie-glass" />
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          className="nixie-digit"
          initial={{ opacity: 0, y: -15, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.8 }}
          transition={{ duration: 0.15, delay: index * 0.03 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <div className="nixie-reflection" />
    </div>
  );
}
