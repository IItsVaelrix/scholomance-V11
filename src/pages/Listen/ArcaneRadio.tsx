import React, { useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { SCHOOLS, generateSchoolColor } from "../../data/schools";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { getSchoolAudioConfig } from "../../lib/ambient/schoolAudio.config";
import { CrystalBallVisualizer } from "./CrystalBallVisualizer";
import { ArcaneKnob } from "./ArcaneKnob";
import "./ArcaneRadio.css";

/**
 * ArcaneRadio — The main Scholomance music player component.
 * Features a circular Phaser-based Crystal Ball and arcane controls.
 */
export const ArcaneRadio: React.FC = () => {
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
    seek,
  } = useAmbientPlayer(allSchoolIds);

  const stations = useMemo(
    () =>
      Object.values(SCHOOLS)
        .map((school: any) => {
          const config = getSchoolAudioConfig(school.id);
          if (!config?.trackUrl) return null;
          return {
            ...school,
            color: generateSchoolColor(school.id),
            trackUrl: config.trackUrl,
          };
        })
        .filter(Boolean),
    []
  );

  const currentStation = useMemo(() => {
    return (
      stations.find((station: any) => station.id === currentSchoolId) || stations[0]
    );
  }, [stations, currentSchoolId]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  const handleReplay = () => {
    if (currentSchoolId) {
      void tuneToSchool(currentSchoolId);
    }
  };

  const handleSeek = (offset: number) => {
    seek(offset);
  };

  const radioStyle = {
    "--active-school-color": currentStation?.color || "#c9a227",
  } as CSSProperties;

  return (
    <div className="arcane-radio" style={radioStyle}>
      <header className="arcane-radio-header">
        <h1 className="arcane-radio-title">Aetheric Signal Console</h1>
      </header>

      <div className="arcane-radio-body">
        {/* Left Controls */}
        <div className="arcane-controls-left">
          <ArcaneKnob 
            label="Volume"
            value={volume}
            onChange={handleVolumeChange}
            color={currentStation?.color}
          />
          <button 
            className={`arcane-btn ${volume === 0 ? 'is-active' : ''}`}
            onClick={() => handleVolumeChange(volume === 0 ? 0.5 : 0)}
          >
            {volume === 0 ? 'Unmute' : 'Mute'}
          </button>
        </div>

        {/* Center: Crystal Ball */}
        <div className="crystal-ball-focal">
          <CrystalBallVisualizer 
            signalLevel={signalLevel}
            schoolColor={currentStation?.color || "#c9a227"}
            glyph={currentStation?.glyph || "*"}
            isTuning={isTuning}
            size={320}
          />
        </div>

        {/* Right Controls */}
        <div className="arcane-controls-right">
          <button 
            className="arcane-btn"
            onClick={togglePlayPause}
          >
            {isTuning ? "Tuning..." : isPlaying ? "Pause" : "Play"}
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="arcane-btn" onClick={() => handleSeek(-10)}>Rewind</button>
            <button className="arcane-btn" onClick={() => handleSeek(10)}>Fast Fwd</button>
          </div>

          <button className="arcane-btn" onClick={handleReplay}>
            Replay
          </button>
        </div>
      </div>

      {/* Station Grid */}
      <div className="arcane-stations">
        {stations.map((station: any) => (
          <div 
            key={station.id}
            className={`arcane-station-card ${station.id === currentSchoolId ? 'is-active' : ''}`}
            onClick={() => void tuneToSchool(station.id)}
          >
            <span className="arcane-station-glyph" style={{ color: station.color }}>
              {station.glyph}
            </span>
            <span className="arcane-station-name">{station.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
