import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { SCHOOLS, generateSchoolColor } from "../../data/schools.js";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { getSchoolAudioConfig } from "../../lib/ambient/schoolAudio.config.js";
import "./ListenPage.css";

const TRACK_SWITCH_DELAY_MS = 1500;

function getProviderLabel(trackUrl: string | null | undefined) {
  if (!trackUrl) return "Unknown source";
  const normalized = String(trackUrl).toLowerCase();
  if (normalized.includes("suno")) return "Suno";
  if (normalized.match(/\.(mp3|wav|ogg|m4a)$/)) return "Direct stream";
  return "External stream";
}

export default function ListenPage() {
  const [isTrackSwitchLocked, setIsTrackSwitchLocked] = useState(false);
  const trackSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allSchoolIds = useMemo(() => Object.keys(SCHOOLS), []);
  const {
    status,
    currentSchoolId,
    isPlaying,
    isTuning,
    signalLevel,
    volume,
    setVolume,
    autoplayAmbient,
    cyclingEnabled,
    playableSchools = [],
    tuneToSchool,
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
    toggleAutoplayAmbient,
    toggleCyclingEnabled,
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
            unlocked: true,
            trackUrl: config.trackUrl,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.unlockXP - b.unlockXP),
    []
  );

  const currentStation = useMemo(() => {
    if (!stations.length) return null;
    return (
      stations.find((station: any) => station.id === currentSchoolId) || stations[0]
    );
  }, [stations, currentSchoolId]);

  const hasPlayableSignal = playableSchools.length > 0;
  const statusLabel = isTuning || isTrackSwitchLocked
    ? "Stabilizing signal"
    : isPlaying
      ? "Broadcasting live"
      : status === "ERROR"
        ? "Signal unstable"
        : "Signal paused";
  const providerLabel = getProviderLabel(currentStation?.trackUrl);
  const canSwitchTracks = hasPlayableSignal && !isTuning && !isTrackSwitchLocked;
  const canCycleStations = canSwitchTracks && cyclingEnabled && playableSchools.length > 1;
  const livePulse = Math.max(0, Math.min(1, Number.isFinite(signalLevel) ? signalLevel : 0));

  useEffect(
    () => () => {
      if (trackSwitchTimerRef.current) {
        clearTimeout(trackSwitchTimerRef.current);
      }
    },
    []
  );

  const lockTrackSwitching = useCallback(() => {
    setIsTrackSwitchLocked(true);
    if (trackSwitchTimerRef.current) {
      clearTimeout(trackSwitchTimerRef.current);
    }
    trackSwitchTimerRef.current = setTimeout(() => {
      setIsTrackSwitchLocked(false);
      trackSwitchTimerRef.current = null;
    }, TRACK_SWITCH_DELAY_MS);
  }, []);

  const handleTuneStation = async (stationId: string) => {
    if (!canSwitchTracks) return;
    lockTrackSwitching();
    await tuneToSchool(stationId);
  };

  const handlePlayPause = async () => {
    if (!hasPlayableSignal) return;
    await togglePlayPause();
  };

  const handlePreviousStation = async () => {
    if (!canCycleStations) return;
    lockTrackSwitching();
    await tunePreviousSchool();
  };

  const handleNextStation = async () => {
    if (!canCycleStations) return;
    lockTrackSwitching();
    await tuneNextSchool();
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  return (
    <section className="section listen-page">
      <div role="status" aria-live="polite" className="sr-only">
        {currentStation
          ? `${statusLabel}. ${currentStation.name} at ${Math.round(volume * 100)} percent volume.`
          : "No radio stations are currently available."}
      </div>

      <div className="container listen-shell">
        <header className="listen-header">
          <div className="kicker">Aetheric Radio</div>
          <h1 className="title">Scholomance Signal Chamber</h1>
          <p className="subtitle">
            A dedicated ritual console for station control. The active ambience persists through every page except{" "}
            <strong>Watch</strong>.
          </p>
        </header>

        <div className="listen-board">
          <aside className="listen-station-panel glass" aria-label="Available stations">
            <div className="listen-panel-heading">
              <h2>Stations</h2>
              <span>{stations.length} live</span>
            </div>
            <ul className="listen-station-list">
              {stations.map((station: any) => {
                const isActive = station.id === currentSchoolId;
                const stationProviderLabel = getProviderLabel(station.trackUrl);
                return (
                  <li key={station.id}>
                    <button
                      type="button"
                      className={`listen-station-btn ${isActive ? "is-active" : ""}`}
                      onClick={() => {
                        void handleTuneStation(station.id);
                      }}
                      disabled={!canSwitchTracks}
                      style={{ "--station-color": station.color } as CSSProperties}
                    >
                      <span className="listen-station-dot" aria-hidden="true" />
                      <span className="listen-station-meta">
                        <span className="listen-station-name">{station.name}</span>
                        <span className="listen-station-sub">{stationProviderLabel}</span>
                      </span>
                      <span className="listen-station-glyph" aria-hidden="true">
                        {station.glyph || "*"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

          </aside>

          <motion.section
            className="listen-now-card glass-strong"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            aria-label="Now broadcasting"
          >
            <div
              className={`listen-now-aura ${isPlaying ? "is-live" : ""}`}
              style={
                {
                  "--listen-accent": currentStation?.color || "var(--active-school-color)",
                  "--listen-pulse": livePulse.toFixed(3),
                } as CSSProperties
              }
              aria-hidden="true"
            />
            <div className="listen-now-meta">
              <span className="listen-status">{statusLabel}</span>
              <h2>{currentStation?.name || "No active station"}</h2>
              <p>{providerLabel}</p>
            </div>

            <div className="listen-transport">
              <button
                type="button"
                className="listen-control-btn"
                onClick={() => {
                  void handlePreviousStation();
                }}
                disabled={!canCycleStations}
              >
                Prev
              </button>
              <button
                type="button"
                className="listen-control-btn is-primary"
                onClick={() => {
                  void handlePlayPause();
                }}
                disabled={!hasPlayableSignal}
              >
                {isTuning ? "Tuning..." : isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className="listen-control-btn"
                onClick={() => {
                  void handleNextStation();
                }}
                disabled={!canCycleStations}
              >
                Next
              </button>
            </div>
          </motion.section>

          <aside className="listen-control-panel glass" aria-label="Playback settings">
            <div className="listen-panel-heading">
              <h2>Control</h2>
              <span>{playableSchools.length} available</span>
            </div>

            <label className="listen-slider-field" htmlFor="listen-volume">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </label>
            <input
              id="listen-volume"
              className="listen-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
            />

            <button
              type="button"
              className={`listen-toggle ${autoplayAmbient ? "is-on" : ""}`}
              onClick={() => {
                void toggleAutoplayAmbient();
              }}
              aria-pressed={autoplayAmbient}
            >
              <span>Autoplay</span>
              <strong>{autoplayAmbient ? "On" : "Off"}</strong>
            </button>

            <button
              type="button"
              className={`listen-toggle ${cyclingEnabled ? "is-on" : ""}`}
              onClick={toggleCyclingEnabled}
              aria-pressed={cyclingEnabled}
            >
              <span>Cycle Mode</span>
              <strong>{cyclingEnabled ? "On" : "Off"}</strong>
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}
