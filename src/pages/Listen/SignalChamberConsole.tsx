/**
 * SignalChamberConsole.tsx — React mount for SignalChamberScene
 * ─────────────────────────────────────────────────────────────
 * Attaches to the shared Phaser game created by AlchemicalLabBackground.
 * Does NOT create its own game — uses the unified game instance.
 * 
 * This component:
 * - Gets SignalChamberScene from shared game
 * - Wires interaction callbacks (play/pause, volume, station select)
 * - Syncs React state to scene via updateState()
 * - Renders HolographicEmbed overlay for music player UI
 *
 * Accessibility note: for ARIA labels and keyboard-accessible controls,
 * add a visually-hidden <div> overlay above the canvas with the same
 * interactive affordances. That layer can be synced from the same hook.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { SCHOOLS, generateSchoolColor } from '../../data/schools';
import { useAmbientPlayer } from '../../hooks/useAmbientPlayer';
import { getSharedPhaserGame } from './AlchemicalLabBackground';
import { getSchoolAudioConfig } from '../../lib/ambient/schoolAudio.config';
import type { SignalChamberScene as SignalChamberSceneType } from './scenes/SignalChamberScene';
import HolographicEmbed from './HolographicEmbed.jsx';

interface SignalChamberConsoleProps {
  overrideSchoolId?: string;
}

export const SignalChamberConsole: React.FC<SignalChamberConsoleProps> = ({ overrideSchoolId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef     = useRef<SignalChamberSceneType | null>(null);

  const allSchoolIds = useMemo(() => Object.keys(SCHOOLS), []);

  const {
    status,
    currentSchoolId: rawSchoolId,
    isPlaying,
    isTuning,
    signalLevel,
    volume,
    seek,
    setVolume,
    tuneToSchool,
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
  } = useAmbientPlayer(allSchoolIds);

  const currentSchoolId = overrideSchoolId || rawSchoolId;

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
  const currentTrackUrl = useMemo(() => {
    const schoolId = rawSchoolId ?? currentStation?.id ?? null;
    return schoolId ? getSchoolAudioConfig(schoolId)?.trackUrl ?? null : null;
  }, [rawSchoolId, currentStation]);

  const statusLabel = isTuning
    ? 'SYNCING'
    : isPlaying
    ? 'TRANSMITTING'
    : status === 'ERROR'
    ? 'ERROR'
    : 'STANDBY';
  const playTransmission = useCallback(() => {
    if (!isPlaying) {
      void togglePlayPause();
    }
  }, [isPlaying, togglePlayPause]);
  const pauseTransmission = useCallback(() => {
    if (isPlaying || isTuning) {
      void togglePlayPause();
    }
  }, [isPlaying, isTuning, togglePlayPause]);
  const rewindTransmission = useCallback(() => {
    seek(-10);
  }, [seek]);
  const fastForwardTransmission = useCallback(() => {
    seek(10);
  }, [seek]);
  const prevTrack = useCallback(() => {
    void tunePreviousSchool();
  }, [tunePreviousSchool]);
  const nextTrack = useCallback(() => {
    void tuneNextSchool();
  }, [tuneNextSchool]);
  const stepVolume = useCallback((delta: number) => {
    const currentStep = Math.round(volume * 20);
    const nextStep = Math.max(0, Math.min(20, currentStep + Math.round(delta * 20)));
    setVolume(nextStep / 20);
  }, [setVolume, volume]);

  // ── Attach to Shared Phaser Game ───────────────────────────────────────

  useEffect(() => {
    const attachToSharedGame = () => {
      if (!containerRef.current) return;

      const sharedGame = getSharedPhaserGame();
      if (!sharedGame) {
        // Game not ready yet — use RAF for instant check on next frame
        let rafId = requestAnimationFrame(function checkGame() {
          const game = getSharedPhaserGame();
          if (game && game.scene.isActive('SignalChamberScene')) {
            onGameReady(game);
          } else {
            rafId = requestAnimationFrame(checkGame);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }

      onGameReady(sharedGame);
    };

    const onGameReady = (game: Phaser.Game) => {
      const scene = game.scene.getScene('SignalChamberScene') as SignalChamberSceneType;
      if (!scene) return;

      sceneRef.current = scene;

      // Wire interaction callbacks back to React state
      scene.onPlayPause     = togglePlayPause;
      scene.onVolumeChange  = setVolume;
      scene.onStationSelect = tuneToSchool;
    };

    attachToSharedGame();

    return () => {
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
    <div className="signal-chamber-shell">
      {/* Phaser canvas mount */}
      <div
        ref={containerRef}
        className="signal-chamber-canvas"
        aria-hidden="true"
      />

      <div className="signal-chamber-player-overlay">
        <HolographicEmbed
          trackUrl={currentTrackUrl}
          title={currentStation?.name ?? 'No signal'}
          glyph={currentStation?.glyph ?? '✦'}
          schoolColor={currentStation?.color ?? '#2ddbde'}
          isPlaying={isPlaying}
          isTuning={isTuning}
          volumePercent={Math.round(volume * 100)}
          onPlay={playTransmission}
          onPause={pauseTransmission}
          onRewind={rewindTransmission}
          onFastForward={fastForwardTransmission}
          onVolumeDown={() => stepVolume(-0.05)}
          onVolumeUp={() => stepVolume(0.05)}
          onPrevTrack={prevTrack}
          onNextTrack={nextTrack}
        />
      </div>

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
