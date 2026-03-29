import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface RitualTerminalProps {
  stationName: string;
  status: string;
  signalLevel: number;
}

export const RitualTerminal: React.FC<RitualTerminalProps> = ({
  stationName,
  status,
  signalLevel,
}) => {
  const [logs, setLogs] = useState<string[]>([]);

  // Simulated ritual logs
  useEffect(() => {
    const INCANTATIONS = [
      "Stabilizing aetheric resonance...",
      "Binding phonemic anchors...",
      "Calibrating tonal symmetry...",
      "Drawing mana from the lexicon...",
      "Vowel families aligned.",
      "Awaiting syntactic bridge...",
      "Signal locked at 44.1kHz...",
      "Ritual circle completed.",
    ];

    const interval = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev, INCANTATIONS[Math.floor(Math.random() * INCANTATIONS.length)]];
        return next.slice(-6); // Keep last 6 lines
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ritual-terminal">
      <div className="terminal-header">
        <span className="terminal-title">SONIC THAUMATURGY</span>
        <span className="terminal-cursor">█</span>
      </div>
      
      <div className="terminal-display">
        <div className="terminal-main-readout">
          <div className="terminal-label">ACTIVE STATION</div>
          <div className="terminal-value">{stationName || "NO SIGNAL"}</div>
        </div>

        <div className="terminal-status-row">
          <div className="terminal-status-item">
            <span className="terminal-label">STATUS:</span>
            <span className={`terminal-value status--${status.toLowerCase()}`}>{status}</span>
          </div>
          <div className="terminal-status-item">
            <span className="terminal-label">SIG:</span>
            <span className="terminal-value">{Math.round(signalLevel * 100)}%</span>
          </div>
        </div>

        <div className="terminal-logs">
          {logs.map((log, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -5 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="terminal-log-line"
            >
              <span className="log-prefix">&gt;</span> {log}
            </motion.div>
          ))}
        </div>
      </div>

      {/* CRT Scanline Overlay */}
      <div className="terminal-scanlines" />
      <div className="terminal-glow" />
    </div>
  );
};
