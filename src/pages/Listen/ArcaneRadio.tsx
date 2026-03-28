import React, { useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { SCHOOLS, generateSchoolColor } from '../../data/schools';
import { useAmbientPlayer } from '../../hooks/useAmbientPlayer';
import { getSchoolAudioConfig } from '../../lib/ambient/schoolAudio.config';
import { CrystalBallVisualizer } from './CrystalBallVisualizer';
import { ArcaneKnob } from './ArcaneKnob';
import './ArcaneRadio.css';

// ── SVG Icons ────────────────────────────────────────────────────────────────
const PlayIcon  = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><polygon points="6,3 20,12 6,21"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="3" width="5" height="18"/><rect x="14" y="3" width="5" height="18"/></svg>;
const RewindIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="11,4 1,12 11,20"/>
    <polygon points="22,4 12,12 22,20"/>
  </svg>
);
const FastFwdIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="2,4 12,12 2,20"/>
    <polygon points="13,4 23,12 13,20"/>
  </svg>
);
const ReplayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
  </svg>
);
const MuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
  </svg>
);
const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);
const TuningIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="arcane-spin" aria-hidden>
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
  </svg>
);

// ── Oscilloscope ─────────────────────────────────────────────────────────────
const OscilloscopeDisplay: React.FC<{
  signalLevel: number;
  isPlaying: boolean;
  color: string;
}> = ({ signalLevel, isPlaying, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>();
  const tRef      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      tRef.current += 0.04;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(201,162,39,0.06)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < W; gx += W / 4) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += H / 3) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      const opacity = isPlaying ? 0.45 + signalLevel * 0.45 : 0.25;
      ctx.strokeStyle = color || 'rgba(201,162,39,0.8)';
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = isPlaying ? 4 + signalLevel * 6 : 0;
      ctx.beginPath();
      for (let px = 0; px < W; px++) {
        const nx = px / W;
        const sig = isPlaying ? signalLevel : 0.04;
        const w1 = Math.sin(nx * Math.PI * 5 + t) * sig;
        const w2 = Math.sin(nx * Math.PI * 11 + t * 1.4) * sig * 0.35;
        const y = H / 2 + (w1 + w2) * H * 0.38;
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [signalLevel, isPlaying, color]);

  return (
    <canvas
      ref={canvasRef}
      width={176}
      height={64}
      className="arcane-oscilloscope-canvas"
      aria-label="Signal waveform display"
    />
  );
};

// ── ArcaneRadio ──────────────────────────────────────────────────────────────
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
          return { ...school, color: generateSchoolColor(school.id) };
        })
        .filter(Boolean) as any[],
    []
  );

  const currentStation = useMemo(
    () => stations.find((s) => s.id === currentSchoolId) ?? stations[0],
    [stations, currentSchoolId]
  );

  const handleReplay = () => {
    if (currentSchoolId) void tuneToSchool(currentSchoolId);
  };

  const radioStyle = {
    '--active-school-color': currentStation?.color || '#c9a227',
    '--radio-glow': currentStation?.color || '#c9a227',
  } as CSSProperties;

  // VU bar heights driven by signal
  const vuBars = Array.from({ length: 12 }, (_, i) => {
    const threshold = i / 12;
    return signalLevel > threshold;
  });

  const statusLabel = isTuning ? 'SYNCING' : isPlaying ? 'TRANSMITTING' : status === 'ERROR' ? 'ERROR' : 'STANDBY';

  return (
    <div className="arcane-radio" style={radioStyle} aria-label="Arcane Signal Laboratory">

      {/* Corner bracket decorations */}
      <div className="arcane-corner arcane-corner--tl" aria-hidden />
      <div className="arcane-corner arcane-corner--tr" aria-hidden />
      <div className="arcane-corner arcane-corner--bl" aria-hidden />
      <div className="arcane-corner arcane-corner--br" aria-hidden />

      {/* Header */}
      <header className="arcane-lab-header">
        <div className="arcane-lab-title">
          <span className="arcane-lab-badge">◈</span>
          <span>Arcane Signal Laboratory</span>
        </div>
        <div className="arcane-lab-status">
          <span className={`arcane-status-dot ${isPlaying ? 'is-live' : ''} ${isTuning ? 'is-tuning' : ''}`} />
          <span className="arcane-status-text">{statusLabel}</span>
          <span className="arcane-status-sep">|</span>
          <span className="arcane-status-station">
            {currentStation ? currentStation.name.toUpperCase() : 'NO SIGNAL'}
          </span>
        </div>
      </header>

      {/* Main Console */}
      <div className="arcane-console">

        {/* ── Left Panel: Volume ────────────────────────────────────── */}
        <div className="arcane-panel arcane-panel--left">
          <div className="arcane-panel-label">VOL. MATRIX</div>

          <ArcaneKnob
            value={volume}
            onChange={setVolume}
            color={currentStation?.color}
            size={88}
            label="VOL"
          />

          {/* VU Meter */}
          <div className="arcane-vu-meter" aria-label="Signal level meter">
            <div className="arcane-vu-bars">
              {vuBars.map((active, i) => (
                <div
                  key={i}
                  className={`arcane-vu-bar ${active ? 'is-active' : ''} ${i >= 10 ? 'is-hot' : i >= 8 ? 'is-warm' : ''}`}
                  style={{ '--bar-delay': `${i * 0.03}s` } as CSSProperties}
                />
              ))}
            </div>
            <div className="arcane-vu-scale">
              <span>+6</span>
              <span>0</span>
              <span>-∞</span>
            </div>
          </div>

          {/* Readout grid */}
          <div className="arcane-readouts">
            <div className="arcane-readout">
              <span className="arcane-readout-key">SIG</span>
              <span className="arcane-readout-val">{Math.round(signalLevel * 100)}%</span>
            </div>
            <div className="arcane-readout">
              <span className="arcane-readout-key">VOL</span>
              <span className="arcane-readout-val">{Math.round(volume * 100)}%</span>
            </div>
            <div className="arcane-readout">
              <span className="arcane-readout-key">BAND</span>
              <span className="arcane-readout-val">{currentStation?.id || '—'}</span>
            </div>
          </div>
        </div>

        {/* ── Center: Orb Chamber ───────────────────────────────────── */}
        <div className="arcane-orb-chamber">
          {/* Measurement ring with ticks */}
          <div className="arcane-chamber-surround" aria-hidden>
            <svg className="arcane-ring-svg" viewBox="0 0 360 360">
              {Array.from({ length: 36 }, (_, i) => {
                const deg = (i / 36) * 360;
                const rad = ((deg - 90) * Math.PI) / 180;
                const major = i % 9 === 0;
                const mid   = i % 3 === 0;
                const r1 = major ? 158 : mid ? 163 : 167;
                const r2 = 173;
                return (
                  <line
                    key={i}
                    x1={180 + Math.cos(rad) * r1} y1={180 + Math.sin(rad) * r1}
                    x2={180 + Math.cos(rad) * r2} y2={180 + Math.sin(rad) * r2}
                    stroke="rgba(201,162,39,0.45)"
                    strokeWidth={major ? 2 : 1}
                  />
                );
              })}
              <circle cx="180" cy="180" r="173" fill="none" stroke="rgba(201,162,39,0.18)" strokeWidth="1"/>
              <circle cx="180" cy="180" r="148" fill="none" stroke="rgba(201,162,39,0.07)" strokeWidth="1"/>
            </svg>

            {/* Cardinal labels */}
            <span className="arcane-ring-label arcane-ring-n">N</span>
            <span className="arcane-ring-label arcane-ring-e">E</span>
            <span className="arcane-ring-label arcane-ring-s">S</span>
            <span className="arcane-ring-label arcane-ring-w">W</span>
          </div>

          {/* The Orb */}
          <motion.div
            className="arcane-orb-focal"
            animate={{ scale: isTuning ? [1, 1.015, 1] : 1 }}
            transition={{ duration: 1.2, repeat: isTuning ? Infinity : 0, ease: 'easeInOut' }}
          >
            <CrystalBallVisualizer
              signalLevel={signalLevel}
              schoolColor={currentStation?.color || '#c9a227'}
              glyph={currentStation?.glyph || '✦'}
              isTuning={isTuning}
              schoolId={currentStation?.id}
              size={290}
            />
          </motion.div>

          {/* Station nameplate below orb */}
          <div className="arcane-station-plate">
            {currentStation ? (
              <>
                <span className="arcane-plate-glyph" style={{ color: currentStation.color }}>
                  {currentStation.glyph}
                </span>
                <span className="arcane-plate-name">{currentStation.name}</span>
              </>
            ) : (
              <span className="arcane-plate-empty">— NO SIGNAL —</span>
            )}
          </div>
        </div>

        {/* ── Right Panel: Transport ────────────────────────────────── */}
        <div className="arcane-panel arcane-panel--right">
          <div className="arcane-panel-label">SIGNAL CONTROL</div>

          {/* Oscilloscope */}
          <div className="arcane-oscilloscope">
            <div className="arcane-scope-label">
              <span>WAVEFORM</span>
              <span className={`arcane-scope-live ${isPlaying ? 'is-on' : ''}`}>
                {isPlaying ? '● LIVE' : '○ OFF'}
              </span>
            </div>
            <OscilloscopeDisplay
              signalLevel={signalLevel}
              isPlaying={isPlaying}
              color={currentStation?.color || '#c9a227'}
            />
          </div>

          {/* Transport buttons */}
          <div className="arcane-transport" role="group" aria-label="Playback controls">
            {/* Row 1: Rewind | Play | Forward */}
            <div className="arcane-transport-row arcane-transport-row--main">
              <button
                className="arcane-t-btn arcane-t-btn--sm"
                onClick={() => seek(-10)}
                aria-label="Rewind 10 seconds"
                title="Rewind"
              >
                <RewindIcon />
                <span className="arcane-t-label">RW</span>
              </button>

              <button
                className={`arcane-t-btn arcane-t-btn--lg ${isPlaying ? 'is-playing' : ''} ${isTuning ? 'is-tuning' : ''}`}
                onClick={togglePlayPause}
                aria-label={isTuning ? 'Tuning…' : isPlaying ? 'Pause' : 'Play'}
              >
                {isTuning ? <TuningIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                <span className="arcane-t-label">
                  {isTuning ? 'SYNC' : isPlaying ? 'PAUSE' : 'PLAY'}
                </span>
              </button>

              <button
                className="arcane-t-btn arcane-t-btn--sm"
                onClick={() => seek(10)}
                aria-label="Fast forward 10 seconds"
                title="Fast Forward"
              >
                <FastFwdIcon />
                <span className="arcane-t-label">FF</span>
              </button>
            </div>

            {/* Row 2: Replay | Mute */}
            <div className="arcane-transport-row arcane-transport-row--aux">
              <button
                className="arcane-t-btn arcane-t-btn--aux"
                onClick={handleReplay}
                aria-label="Replay current station"
                title="Replay"
              >
                <ReplayIcon />
                <span className="arcane-t-label">REPLAY</span>
              </button>

              <button
                className={`arcane-t-btn arcane-t-btn--aux ${volume === 0 ? 'is-muted' : ''}`}
                onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                title={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0 ? <MuteIcon /> : <SpeakerIcon />}
                <span className="arcane-t-label">{volume === 0 ? 'UNMUTE' : 'MUTE'}</span>
              </button>
            </div>
          </div>

          {/* Signal frequency meter */}
          <div className="arcane-freq-bar-row">
            <span className="arcane-freq-label">FREQ</span>
            <div className="arcane-freq-bars">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className={`arcane-freq-bar ${signalLevel * 20 > i ? 'is-active' : ''}`}
                  style={{ '--bar-n': i } as CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Station Grid */}
      <div className="arcane-stations" role="list" aria-label="Station selector">
        {stations.map((station) => (
          <button
            key={station.id}
            className={`arcane-station-card ${station.id === currentSchoolId ? 'is-active' : ''}`}
            style={{ '--station-color': station.color } as CSSProperties}
            onClick={() => void tuneToSchool(station.id)}
            role="listitem"
            aria-label={`Tune to ${station.name}`}
            aria-pressed={station.id === currentSchoolId}
          >
            <span className="arcane-station-dot" />
            <span className="arcane-station-glyph">{station.glyph}</span>
            <span className="arcane-station-name">{station.name}</span>
            <span className="arcane-station-id-label">{station.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
