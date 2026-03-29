/**
 * SignalChamberConsole.tsx — React mount for SignalChamberScene
 * ─────────────────────────────────────────────────────────────
 * Mounts a single Phaser game (SignalChamberScene) and bridges all
 * reactive state from useAmbientPlayer into the scene via updateState().
 *
 * This replaces ThaumaturgyConsole + ThaumaturgyRadar as the primary
 * full-canvas visualization. Text, controls, and interaction all live
 * inside Phaser — the DOM wrapper is intentionally minimal.
 *
 * Accessibility note: for ARIA labels and keyboard-accessible controls,
 * add a visually-hidden <div> overlay above the canvas with the same
 * interactive affordances. That layer can be synced from the same hook.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { SCHOOLS, generateSchoolColor } from '../../data/schools';
import { useAmbientPlayer } from '../../hooks/useAmbientPlayer';
import { getSchoolAudioConfig } from '../../lib/ambient/schoolAudio.config';
import type { SignalChamberScene as SignalChamberSceneType } from './scenes/SignalChamberScene';

// Canvas dimensions — 16:9 at safe display width
const CANVAS_W = 1280;
const CANVAS_H = 720;

export const SignalChamberConsole: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<import('phaser').Game | null>(null);
  const sceneRef     = useRef<SignalChamberSceneType | null>(null);

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
    () => stations.find(s => s.id === currentSchoolId) ?? stations[0],
    [stations, currentSchoolId]
  );

  const statusLabel = isTuning
    ? 'SYNCING'
    : isPlaying
    ? 'TRANSMITTING'
    : status === 'ERROR'
    ? 'ERROR'
    : 'STANDBY';

  // ── Mount Phaser once ──────────────────────────────────────────────────

  useEffect(() => {
    let game: import('phaser').Game | null = null;

    const mount = async () => {
      if (!containerRef.current) return;
      const [{ default: PhaserLib }, { SignalChamberScene }] = await Promise.all([
        import('phaser'),
        import('./scenes/SignalChamberScene'),
      ]);

      game = new PhaserLib.Game({
        type:   PhaserLib.AUTO,
        width:  CANVAS_W,
        height: CANVAS_H,
        parent: containerRef.current,
        transparent: true,
        antialias:   true,
        scene: [SignalChamberScene],
        scale: {
          mode:            PhaserLib.Scale.FIT,
          autoCenter:      PhaserLib.Scale.CENTER_BOTH,
          width:           CANVAS_W,
          height:          CANVAS_H,
        },
        fps: { target: 30 },
      });

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('SignalChamberScene') as SignalChamberSceneType;
        if (!scene) return;
        sceneRef.current = scene;

        // Wire interaction callbacks back to React state
        scene.onPlayPause     = togglePlayPause;
        scene.onVolumeChange  = setVolume;
        scene.onStationSelect = tuneToSchool;
      });

      gameRef.current = game;
    };

    void mount();

    return () => {
      game?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-wire callbacks when React closures change
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.onPlayPause     = togglePlayPause;
    sceneRef.current.onVolumeChange  = setVolume;
    sceneRef.current.onStationSelect = tuneToSchool;
  }, [togglePlayPause, setVolume, tuneToSchool]);

  // ── Push reactive state into scene each render ─────────────────────────

  useEffect(() => {
    sceneRef.current?.updateState({
      signalLevel,
      volume,
      isTuning,
      isPlaying,
      status:      statusLabel,
      stationName: currentStation?.name?.toUpperCase() ?? 'NO SIGNAL',
      schoolColor: currentStation?.color ?? '#d5b34b',
      schoolId:    currentSchoolId,
      glyph:       currentStation?.glyph ?? '✦',
      stations,
    });
  }, [signalLevel, volume, isTuning, isPlaying, statusLabel, currentStation, currentSchoolId, stations]);

  // ── Accessibility: visually-hidden control layer ───────────────────────
  // Mirrors all Phaser-side interactive surfaces with real DOM controls.
  // Screen readers and keyboard users interact with this layer exclusively.

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: CANVAS_W }}>
      {/* Phaser canvas mount */}
      <div
        ref={containerRef}
        style={{ width: '100%', aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        aria-hidden="true"
      />

      {/* Visually-hidden accessible control layer */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'center',
          paddingBottom: '3%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', pointerEvents: 'auto' }}>
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause transmission' : 'Play transmission'}
            className="sr-only-control"
            style={srOnly}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <label style={srOnly}>
            Volume
            <input
              type="range" min="0" max="1" step="0.01"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              aria-label="Volume control"
            />
          </label>

          <fieldset style={srOnly}>
            <legend>Select station</legend>
            {stations.map(sta => (
              <button
                key={sta.id}
                onClick={() => tuneToSchool(sta.id)}
                aria-pressed={sta.id === currentSchoolId}
                aria-label={`Tune to ${sta.name}`}
              >
                {sta.name}
              </button>
            ))}
          </fieldset>
        </div>

        {/* Live region for screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={srOnly}
        >
          {statusLabel}: {currentStation?.name ?? 'no signal'}, signal {Math.round(signalLevel * 100)}%
        </div>
      </div>
    </div>
  );
};

// Visually hidden but accessible
const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1, height: 1,
  padding: 0, margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
