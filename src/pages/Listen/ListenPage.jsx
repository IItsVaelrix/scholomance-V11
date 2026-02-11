import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { SCHOOLS, generateSchoolColor } from "../../data/schools.js";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer.jsx";
import { useProgression } from "../../hooks/useProgression.jsx";
import { getSchoolAudioConfig } from "../../lib/ambient/schoolAudio.config.js";
import "./ListenPage.css";

const TRACK_SWITCH_DELAY_MS = 1500;

function getProviderLabel(trackUrl) {
  if (!trackUrl) return "Unknown source";
  const normalized = String(trackUrl).toLowerCase();
  if (normalized.includes("youtube") || normalized.includes("youtu.be")) return "YouTube";
  if (normalized.includes("suno")) return "Suno";
  if (normalized.match(/\.(mp3|wav|ogg|m4a)$/)) return "Direct stream";
  return "External stream";
}

function formatXp(value) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(value)));
}

export default function ListenPage() {
  const [isTrackSwitchLocked, setIsTrackSwitchLocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const trackSwitchTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const { search } = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const adminToken = searchParams.get("admin");
  const isAdmin = adminToken === "echo";

  const { progression, checkUnlocked } = useProgression();
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
    playableSchools,
    dynamicSchools,
    refreshDynamicSchools,
    tuneToSchool,
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
    toggleAutoplayAmbient,
    toggleCyclingEnabled,
    unlockAudio,
  } = useAmbientPlayer(progression.unlockedSchools, {
    adminToken: isAdmin ? adminToken : null,
  });

  const stations = useMemo(
    () =>
      Object.values(SCHOOLS)
        .map((school) => {
          const config = getSchoolAudioConfig(school.id);
          if (!config?.trackUrl) return null;
          return {
            ...school,
            color: generateSchoolColor(school.id),
            unlocked: checkUnlocked(school.id),
            trackUrl: config.trackUrl,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.unlockXP - b.unlockXP),
    [checkUnlocked]
  );

  const currentStation = useMemo(() => {
    if (!stations.length && !dynamicSchools.length) return null;
    return (
      stations.find((station) => station.id === currentSchoolId) ||
      dynamicSchools.find((s) => s.id === currentSchoolId) ||
      stations.find((station) => station.unlocked) ||
      stations[0] ||
      dynamicSchools[0]
    );
  }, [stations, dynamicSchools, currentSchoolId]);

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

  const buildAdminApiUrl = useCallback(
    (path) => {
      if (!isAdmin || !adminToken || !import.meta.env.PROD) {
        return path;
      }
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}admin=${encodeURIComponent(adminToken)}`;
    },
    [isAdmin, adminToken]
  );

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

  const handleTuneStation = async (stationId, isUnlocked = true) => {
    if (!isUnlocked || !canSwitchTracks) return;
    lockTrackSwitching();
    await unlockAudio();
    // For dynamic schools we don't have setCurrentKey mappings in library
    await tuneToSchool(stationId);
  };

  const handlePlayPause = async () => {
    if (!hasPlayableSignal) return;
    await unlockAudio();
    await togglePlayPause();
  };

  const handlePreviousStation = async () => {
    if (!canCycleStations) return;
    lockTrackSwitching();
    await unlockAudio();
    await tunePreviousSchool();
  };

  const handleNextStation = async () => {
    if (!canCycleStations) return;
    lockTrackSwitching();
    await unlockAudio();
    await tuneNextSchool();
  };

  const handleVolumeChange = (event) => {
    setVolume(Number(event.target.value));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    setIsUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(buildAdminApiUrl("/api/upload"), {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await refreshDynamicSchools();
        setUploadStatus(`Uploaded successfully! (${file.name})`);
        setTimeout(() => setUploadStatus(null), 3000);
      } else if (res.status === 401) {
        setUploadStatus("Upload failed: unauthorized.");
      } else if (res.status === 429) {
        setUploadStatus("Upload failed: rate limited.");
      } else {
        setUploadStatus("Upload failed.");
      }
    } catch {
      setUploadStatus("Error uploading.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="section min-h-screen listen-page">
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

        {isAdmin && (
          <div className="listen-admin-panel glass-elevated p-6 mb-8 rounded-xl flex items-center justify-between animate-fadeIn">
            <div>
              <h3 className="text-lg font-bold mb-1">Chamber of Echoes</h3>
              <p className="text-sm text-muted">Direct upload to local archive</p>
            </div>
            <div className="flex items-center gap-4">
              {uploadStatus && <span className="text-xs font-mono">{uploadStatus}</span>}
              <input
                type="file"
                accept="audio/*"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
              />
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload Audio"}
              </button>
            </div>
          </div>
        )}

        <div className="listen-board">
          <aside className="listen-station-panel glass" aria-label="Available stations">
            <div className="listen-panel-heading">
              <h2>Stations</h2>
              <span>{stations.filter((station) => !station.unlocked).length} locked</span>
            </div>
            <ul className="listen-station-list">
              {stations.map((station) => {
                const isActive = station.id === currentSchoolId;
                const xpRemaining = Math.max(0, station.unlockXP - progression.xp);
                const stationProviderLabel = getProviderLabel(station.trackUrl);
                return (
                  <li key={station.id}>
                    <button
                      type="button"
                      className={`listen-station-btn ${isActive ? "is-active" : ""} ${
                        station.unlocked ? "" : "is-locked"
                      }`}
                      onClick={() => {
                        void handleTuneStation(station.id, station.unlocked);
                      }}
                      disabled={!station.unlocked || !canSwitchTracks}
                      style={{ "--station-color": station.color }}
                    >
                      <span className="listen-station-dot" aria-hidden="true" />
                      <span className="listen-station-meta">
                        <span className="listen-station-name">{station.name}</span>
                        <span className="listen-station-sub">
                          {station.unlocked ? stationProviderLabel : `${formatXp(xpRemaining)} XP required`}
                        </span>
                      </span>
                      <span className="listen-station-glyph" aria-hidden="true">
                        {station.glyph || "*"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {dynamicSchools.length > 0 && (
              <>
                <div className="listen-panel-heading mt-8">
                  <h2>Archive</h2>
                  <span>{dynamicSchools.length} items</span>
                </div>
                <ul className="listen-station-list">
                  {dynamicSchools.map((s) => {
                    const isActive = s.id === currentSchoolId;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={`listen-station-btn ${isActive ? "is-active" : ""}`}
                          onClick={() => {
                            void handleTuneStation(s.id);
                          }}
                          disabled={!canSwitchTracks}
                          style={{ "--station-color": "var(--school-void)" }}
                        >
                          <span className="listen-station-dot" aria-hidden="true" />
                          <span className="listen-station-meta">
                            <span className="listen-station-name">{s.name}</span>
                            <span className="listen-station-sub">Local Archive</span>
                          </span>
                          <span className="listen-station-glyph" aria-hidden="true">
                            *
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
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
              style={{
                "--listen-accent": currentStation?.color || "var(--active-school-color)",
                "--listen-pulse": livePulse.toFixed(3),
              }}
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
                {isPlaying || isTuning ? "Pause" : "Play"}
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
              <span>{playableSchools.length} unlocked</span>
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
              <strong>{cyclingEnabled ? "On" : "Locked"}</strong>
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}

