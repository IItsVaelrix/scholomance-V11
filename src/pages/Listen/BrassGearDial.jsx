import { motion, useAnimation } from "framer-motion";
import { useEffect, useCallback } from "react";

export default function BrassGearDial({ school, onTune, disabled, angle }) {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      rotate: angle,
      transition: { type: "spring", stiffness: 42, damping: 14, mass: 1.2 },
    });
  }, [angle, controls]);

  const handleClick = () => {
    if (disabled) return;
    onTune?.();
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onTune?.();
      }
    }
  }, [disabled, onTune]);

  return (
    <div 
      className="brass-dial-container"
      role="slider"
      aria-label={`Frequency dial: ${school} school`}
      aria-valuenow={angle}
      aria-valuemin={0}
      aria-valuemax={360}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      {/* Outer gear ring */}
      <div className="gear-ring">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="gear-tooth"
            style={{ transform: `rotate(${i * 15}deg) translateY(-108px)` }}
          />
        ))}
      </div>

      {/* Main dial */}
      <motion.div
        className="brass-dial"
        animate={controls}
        onClick={handleClick}
      >
        {/* Dial face engravings */}
        <div className="dial-engravings">
          {["VOID", "PSYCH", "ALCH", "WILL", "SONIC"].map((label, i) => (
            <span
              key={label}
              className="dial-marking"
              style={{ transform: `rotate(${i * 72}deg) translateY(-65px)` }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Center knob */}
        <div className="dial-center">
          <div className="dial-knob">
            <div className="knob-grip" />
            <div className="knob-grip" style={{ transform: "rotate(60deg)" }} />
            <div className="knob-grip" style={{ transform: "rotate(120deg)" }} />
          </div>
        </div>

        {/* Needle indicator */}
        <div className="dial-needle" />
      </motion.div>

      {/* Decorative rivets */}
      {[0, 90, 180, 270].map((rot) => (
        <div
          key={rot}
          className="rivet rivet--dial"
          style={{ transform: `rotate(${rot}deg) translateY(-95px)` }}
        />
      ))}
    </div>
  );
}
