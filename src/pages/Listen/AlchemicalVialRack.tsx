import React from 'react';
import { motion } from 'framer-motion';

interface VialProps {
  id: string;
  name: string;
  color: string;
  glyph: string;
  isActive: boolean;
  onSelect: () => void;
  signalLevel: number;
}

const Vial: React.FC<VialProps> = ({ id, color, glyph, isActive, onSelect, signalLevel }) => {
  const fillHeight = isActive ? 20 + signalLevel * 70 : 15;

  return (
    <div className={`alchemical-vial ${isActive ? 'is-active' : ''}`} onClick={onSelect}>
      <div className="vial-label">{id}</div>
      <div className="vial-glass">
        <motion.div 
          className="vial-fluid"
          style={{ 
            backgroundColor: color,
            boxShadow: `0 0 15px ${color}88`,
          }}
          animate={{ height: `${fillHeight}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        >
          <div className="vial-bubbles" />
        </motion.div>
        <div className="vial-reflection" />
        <div className="vial-glyph" style={{ color }}>{glyph}</div>
      </div>
      <div className="vial-base" />
    </div>
  );
};

interface AlchemicalVialRackProps {
  stations: any[];
  currentSchoolId: string;
  tuneToSchool: (id: string) => void;
  signalLevel: number;
}

export const AlchemicalVialRack: React.FC<AlchemicalVialRackProps> = ({
  stations,
  currentSchoolId,
  tuneToSchool,
  signalLevel,
}) => {
  return (
    <div className="alchemical-vial-rack">
      <div className="rack-header">ALCHEMICAL RESONATORS</div>
      <div className="vials-container">
        {stations.map((station) => (
          <Vial
            key={station.id}
            id={station.id}
            name={station.name}
            color={station.color}
            glyph={station.glyph}
            isActive={station.id === currentSchoolId}
            onSelect={() => tuneToSchool(station.id)}
            signalLevel={signalLevel}
          />
        ))}
      </div>
    </div>
  );
};
