import React, { useMemo, type CSSProperties, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SCHOOLS, generateSchoolColor } from '../../data/schools';
import { useAmbientPlayer } from '../../hooks/useAmbientPlayer';
import { getSchoolAudioConfig } from '../../lib/ambient/schoolAudio.config';

import { RitualTerminal } from './RitualTerminal';
import { ThaumaturgyRadar } from './ThaumaturgyRadar';
import { AlchemicalVialRack } from './AlchemicalVialRack';
import { AnalogueGauge } from './AnalogueGauge';

import './ThaumaturgyConsole.css';

// ── Icons ────────────────────────────────────────────────────────────────────
const PlayIcon  = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><polygon points="6,3 20,12 6,21"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="3" width="5" height="18"/><rect x="14" y="3" width="5" height="18"/></svg>;

/**
 * ThaumaturgyConsole — The immersive ritual cockpit for Scholomance signal control.
 */
export const ThaumaturgyConsole: React.FC = () => {
  const allSchoolIds = useMemo(() => Object.keys(SCHOOLS), []);
  const {
    status,
    currentSchoolId,
    isPlaying,
    isTuning,
    signalLevel,
    volume,
    setVolume,
    tuneToSchool,
    togglePlayPause,
  } = useAmbientPlayer(allSchoolIds);

  const stations = useMemo(
    () =>
      Object.values(SCHOOLS)
        .map((school: any) => {
          const config = getSchoolAudioConfig(school.id);
          if (!config?.trackUrl) return null;
          return { ...school, color: generateSchoolColor(school.id) };
        })
        .filter(Boolean) as any[],
    []
  );

  const currentStation = useMemo(
    () => stations.find((s) => s.id === currentSchoolId) ?? stations[0],
    [stations, currentSchoolId]
  );

  const statusLabel = isTuning ? 'SYNCING' : isPlaying ? 'TRANSMITTING' : status === 'ERROR' ? 'ERROR' : 'STANDBY';

  const consoleStyle = {
    '--active-school-color': currentStation?.color || '#c9a227',
    '--school-glow': `${currentStation?.color || '#c9a227'}33`,
  } as CSSProperties;

  return (
    <div className="thaumaturgy-console" style={consoleStyle}>
      <div className="console-ambient-glow" />
      
      <div className="console-grid">
        {/* Left Wing */}
        <div className="console-wing--left">
          <RitualTerminal 
            stationName={currentStation?.name?.toUpperCase() || "NO SIGNAL"}
            status={statusLabel}
            signalLevel={signalLevel}
          />
          <AnalogueGauge value={signalLevel} label="SIGNAL" />
        </div>

        {/* Centerpiece */}
        <div className="console-center">
          <ThaumaturgyRadar 
            signalLevel={signalLevel}
            schoolColor={currentStation?.color || '#c9a227'}
            glyph={currentStation?.glyph || '✦'}
            isTuning={isTuning}
            schoolId={currentStation?.id}
            size={420}
          />
        </div>

        {/* Right Wing */}
        <div className="console-wing--right">
          <AlchemicalVialRack 
            stations={stations}
            currentSchoolId={currentSchoolId}
            tuneToSchool={tuneToSchool}
            signalLevel={signalLevel}
          />
          <AnalogueGauge value={volume} label="VOLUME" />
        </div>

        {/* Bottom Controls */}
        <div className="console-controls">
          <div className="transport-group">
            <button 
              className={`arcane-t-btn arcane-t-btn--lg ${isPlaying ? 'is-playing' : ''}`}
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>

          <div className="volume-slider-container">
             {/* Volume control could be a large slider or another knob here */}
             <input 
               type="range" 
               min="0" max="1" step="0.01" 
               value={volume} 
               onChange={(e) => setVolume(parseFloat(e.target.value))}
               className="console-volume-slider"
             />
          </div>
        </div>
      </div>
    </div>
  );
};
