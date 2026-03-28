import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface ArcaneKnobProps {
  value: number; // 0 to 1
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  size?: number;
  color?: string;
}

/**
 * ArcaneKnob — A custom rotating knob component for Scholomance.
 * Snaps to step (default 0.05).
 */
export const ArcaneKnob: React.FC<ArcaneKnobProps> = ({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  label,
  size = 64,
  color = "var(--active-school-color)",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  
  // Map value (0-1) to rotation (-135deg to 135deg)
  const rotation = (value / (max - min)) * 270 - 135;

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !knobRef.current) return;

      const rect = knobRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      // Normalize angle to start from the bottom (90deg) and go clockwise
      let normalizedAngle = angle + 90;
      if (normalizedAngle < 0) normalizedAngle += 360;
      
      // Clamp to -135 to 135 range (approx 270 deg total)
      // Bottom gap is ~90 deg
      let newValue = (normalizedAngle - 45) / 270;
      if (normalizedAngle < 45) newValue = 0;
      if (normalizedAngle > 315) newValue = 1;
      
      newValue = Math.max(0, Math.min(1, newValue));
      
      // Snap to step
      const snappedValue = Math.round(newValue / step) * step;
      onChange(Number(snappedValue.toFixed(2)));
    },
    [isDragging, onChange, step]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="arcane-knob-wrapper" style={{ width: size }}>
      {label && <span className="arcane-knob-label">{label}</span>}
      <div 
        ref={knobRef}
        className="arcane-knob"
        style={{ 
          width: size, 
          height: size,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={() => setIsDragging(true)}
      >
        <motion.div 
          className="arcane-knob-dial"
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="arcane-knob-indicator" style={{ backgroundColor: color }} />
        </motion.div>
        <div className="arcane-knob-ticks">
           {/* Tick marks can be added here */}
        </div>
      </div>
      <span className="arcane-knob-value">{Math.round(value * 100)}%</span>
    </div>
  );
};
