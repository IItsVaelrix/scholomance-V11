import React from 'react';
import { motion } from 'framer-motion';
import { CrystalBallVisualizer } from './CrystalBallVisualizer';
import { SCHOOLS } from '../../data/schools';
import { getSonicStationBuckets } from '../../data/sonicStationBuckets';
import { triggerHapticPulse, UI_HAPTICS } from '../../lib/platform/haptics';

interface ScholomanceStationProps {
  activeStation: any;
  signalLevel: number;
  isPlaying: boolean;
  isTuning: boolean;
  onClose: () => void;
  onSelectTrack: (url: string, schoolId: string) => void;
}

export const ScholomanceStation: React.FC<ScholomanceStationProps> = ({
  activeStation,
  signalLevel,
  isPlaying,
  isTuning,
  onClose,
  onSelectTrack,
}) => {
  const buckets = getSonicStationBuckets();
  
  const handleTrackSelect = (url: string, schoolId: string) => {
    triggerHapticPulse(UI_HAPTICS.LIGHT);
    onSelectTrack(url, schoolId);
  };

  const handleBack = () => {
    triggerHapticPulse(UI_HAPTICS.MEDIUM);
    onClose();
  };

  const overlayVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] } 
    },
    exit: { 
      opacity: 0, 
      scale: 0.5, 
      filter: "blur(10px)",
      transition: { duration: 0.6, ease: "easeIn" } 
    }
  };

  return (
    <motion.div 
      className="scholomance-station-overlay"
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={overlayVariants}
    >
      <div className="station-content">
        <header className="station-header">
          <motion.button 
            className="back-btn"
            onClick={handleBack}
            whileHover={{ x: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            EXIT_VOID
          </motion.button>
          <div className="station-info">
            <h1>SCHOLOMANCE_STATION</h1>
            <p>AURAL_SELECTION_MATRIX_V11</p>
          </div>
        </header>

        <main className="station-focus">
          <motion.div 
            className="orb-centerpiece"
            layoutId="central-orb"
            transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
          >
             <CrystalBallVisualizer 
                size={420}
                schoolId={activeStation.id}
                schoolColor={activeStation.color}
                signalLevel={signalLevel}
                isPlaying={isPlaying}
                glyph={activeStation.glyph || '✦'}
                isTuning={isTuning}
             />
             <div className="orb-ring-decoration" style={{ '--accent': activeStation.color } as any} />
          </motion.div>

          <div className="track-matrix">
            {Object.entries(buckets).map(([schoolId, tracks]) => (
              <div key={schoolId} className="school-track-group">
                <h3 style={{ color: SCHOOLS[schoolId]?.colorHsl ? `hsl(${SCHOOLS[schoolId].colorHsl.h}, ${SCHOOLS[schoolId].colorHsl.s}%, ${SCHOOLS[schoolId].colorHsl.l}%)` : 'var(--text-secondary)' }}>
                  {schoolId}
                </h3>
                <div className="track-list">
                  {(tracks as string[]).map((url, idx) => (
                    <motion.button
                      key={url}
                      className="track-card"
                      onClick={() => handleTrackSelect(url, schoolId)}
                      whileHover={{ scale: 1.02, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="track-idx">0{idx + 1}</span>
                      <span className="track-label">RESONANCE_PATH</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      
      {/* Background Decorative Gears */}
      <div className="station-gears-bg">
        <div className="gear gear--lg" />
        <div className="gear gear--md" />
        <div className="gear gear--sm" />
      </div>
    </motion.div>
  );
};
