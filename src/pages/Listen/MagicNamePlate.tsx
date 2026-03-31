import React, { useState, useEffect, useRef } from 'react';

interface MagicNamePlateProps {
  name: string;
  color: string;
}

const GLYPHS = "01010101010101010101010101010101"; // Or use phonetic characters

/**
 * MagicNamePlate — Digitally/Magically morphs text and color.
 * Implementation for Spec v1.6
 */
export const MagicNamePlate: React.FC<MagicNamePlateProps> = ({ name, color }) => {
  const [displayText, setDisplayText] = useState(name);
  const [isGlitching, setIsGlitching] = useState(false);
  const prevNameRef = useRef(name);

  useEffect(() => {
    if (name !== prevNameRef.current) {
      setIsGlitching(true);
      prevNameRef.current = name;

      let iteration = 0;
      const interval = setInterval(() => {
        setDisplayText(prev => 
          name.split("").map((char, index) => {
            if (index < iteration) return name[index];
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }).join("")
        );

        if (iteration >= name.length) {
          clearInterval(interval);
          setIsGlitching(false);
        }
        iteration += 1/3;
      }, 30);

      return () => clearInterval(interval);
    }
  }, [name]);

  return (
    <h2 
      className={`magic-name-plate ${isGlitching ? 'is-glitching' : ''}`}
      style={{ 
        '--accent': color,
        transition: 'color 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
        color: 'var(--accent)',
        textShadow: `0 0 10px ${color}66`
      } as React.CSSProperties}
    >
      {displayText.toUpperCase()}
    </h2>
  );
};
