import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface AnalogueGaugeProps {
  value: number; // 0–1
  label: string;
  color?: string;
  size?: number;
}

export const AnalogueGauge: React.FC<AnalogueGaugeProps> = ({
  value,
  label,
  color = 'var(--accent-color, #c9a227)',
  size = 120,
}) => {
  // Needle rotation: -135° to 135°
  const rotation = -135 + value * 270;

  const ticks = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => {
      const angle = -135 + (i / 20) * 270;
      const isMajor = i % 5 === 0;
      const length = isMajor ? 10 : 5;
      return { angle, length, isMajor };
    });
  }, []);

  return (
    <div className="analogue-gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* Face */}
        <circle cx="50" cy="50" r="48" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="2" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />

        {/* Ticks */}
        {ticks.map((tick, i) => {
          const rad = (tick.angle - 90) * (Math.PI / 180);
          const x1 = 50 + Math.cos(rad) * 44;
          const y1 = 50 + Math.sin(rad) * 44;
          const x2 = 50 + Math.cos(rad) * (44 - tick.length);
          const y2 = 50 + Math.sin(rad) * (44 - tick.length);
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={tick.isMajor ? color : 'rgba(255,255,255,0.2)'}
              strokeWidth={tick.isMajor ? 1.5 : 0.5}
              strokeOpacity={tick.isMajor ? 0.6 : 0.3}
            />
          );
        })}

        {/* Scale labels */}
        <text x="25" y="85" fontSize="6" fill="rgba(255,255,255,0.3)" textAnchor="middle">0</text>
        <text x="75" y="85" fontSize="6" fill="rgba(255,255,255,0.3)" textAnchor="middle">100</text>
        <text x="50" y="70" fontSize="8" fill={color} textAnchor="middle" style={{ fontFamily: 'Cinzel', fontWeight: 'bold' }}>{label}</text>

        {/* Needle */}
        <motion.g
          animate={{ rotate: rotation }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
          style={{ originX: '50px', originY: '50px' }}
        >
          <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="4" fill={color} />
        </motion.g>

        {/* Reflection/Glare */}
        <defs>
          <linearGradient id="gaugeGlare" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.05" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#gaugeGlare)" pointerEvents="none" />
      </svg>
    </div>
  );
};
