import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface ArcaneKnobProps {
  value: number; // 0–1
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  size?: number;
  color?: string;
}

// Knob sweep: -135° (min) → +135° (max), 270° total
const MIN_DEG = -135;
const SWEEP = 270;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (Math.abs(endDeg - startDeg) < 0.5) return '';
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function angleFromEvent(e: MouseEvent | React.MouseEvent, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const raw = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  // Normalize: 0° at top, clockwise
  let norm = raw + 90;
  if (norm < 0) norm += 360;
  return norm;
}

function normalizedFromAngle(normAngle: number): number {
  // usable arc: 45° → 315° (within the full 360°)
  if (normAngle < 45) return 0;
  if (normAngle > 315) return 1;
  return (normAngle - 45) / SWEEP;
}

export const ArcaneKnob: React.FC<ArcaneKnobProps> = ({
  value,
  onChange,
  step = 0.01,
  label,
  size = 80,
  color = 'var(--active-school-color)',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);

  // value → rotation angle (MIN_DEG to MIN_DEG+SWEEP)
  const rotation = MIN_DEG + value * SWEEP;

  const applyEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!knobRef.current) return;
      const rect = knobRef.current.getBoundingClientRect();
      const normAngle = angleFromEvent(e, rect);
      const raw = normalizedFromAngle(normAngle);
      const snapped = Math.round(Math.max(0, Math.min(1, raw)) / step) * step;
      onChange(Number(snapped.toFixed(4)));
    },
    [onChange, step]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      applyEvent(e); // immediate snap on click
    },
    [applyEvent]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      applyEvent(e);
    },
    [isDragging, applyEvent]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // SVG dimensions (knob fills svg viewBox 0 0 100 100)
  const SVG = 100;
  const CX = 50;
  const CY = 50;
  const tickR = 47; // tick outer radius
  const arcR  = 42; // active arc radius
  const bodyR = 34; // knob body circle

  // Active arc: from MIN_DEG to current rotation
  const arcD = arcPath(CX, CY, arcR, MIN_DEG, rotation);

  // Indicator tip position (on the inner body circle face)
  const indAngleRad = ((rotation - 90) * Math.PI) / 180;
  const indX = CX + Math.cos(indAngleRad) * (bodyR - 7);
  const indY = CY + Math.sin(indAngleRad) * (bodyR - 7);

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const deg = MIN_DEG + t * SWEEP;
    const s = polarToCartesian(CX, CY, tickR - (i % 5 === 0 ? 6 : 3), deg);
    const e = polarToCartesian(CX, CY, tickR, deg);
    return { s, e, major: i % 5 === 0, deg };
  });

  return (
    <div
      className="arcane-knob-wrapper"
      style={{ width: size, userSelect: 'none' }}
      aria-label={label ? `${label} knob` : 'Volume knob'}
    >
      {label && <span className="arcane-knob-label">{label}</span>}

      <div
        ref={knobRef}
        className={`arcane-knob-mount ${isDragging ? 'is-dragging' : ''}`}
        style={{ width: size, height: size, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
      >
        <svg
          className="arcane-knob-svg"
          viewBox={`0 0 ${SVG} ${SVG}`}
          width={size}
          height={size}
          style={{ display: 'block' }}
        >
          {/* Track arc (full sweep, dim) */}
          <path
            d={arcPath(CX, CY, arcR, MIN_DEG, MIN_DEG + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Active arc */}
          {arcD && (
            <motion.path
              d={arcD}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
              initial={false}
              animate={{ pathLength: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          )}

          {/* Tick marks */}
          {ticks.map(({ s, e, major, deg }) => (
            <line
              key={deg}
              x1={s.x} y1={s.y}
              x2={e.x} y2={e.y}
              stroke={color}
              strokeWidth={major ? 1.8 : 1}
              strokeOpacity={major ? 0.65 : 0.3}
            />
          ))}

          {/* Knob body */}
          <circle
            cx={CX} cy={CY} r={bodyR}
            fill="url(#knobGrad)"
            stroke="rgba(201,162,39,0.25)"
            strokeWidth="1.5"
          />

          {/* Inner ring */}
          <circle
            cx={CX} cy={CY} r={bodyR - 5}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />

          {/* Indicator dot */}
          <motion.circle
            cx={indX}
            cy={indY}
            r={3.5}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            animate={{ cx: indX, cy: indY }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />

          {/* Gradient defs */}
          <defs>
            <radialGradient id="knobGrad" cx="38%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#2a2118" />
              <stop offset="60%" stopColor="#141008" />
              <stop offset="100%" stopColor="#0a0806" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <span className="arcane-knob-value">
        {Math.round(value * 100)}<span className="arcane-knob-unit">%</span>
      </span>
    </div>
  );
};
