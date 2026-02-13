import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { SCHOOLS, generateSchoolColor } from "../../data/schools.js";
import { useAmbientPlayer } from "../../hooks/useAmbientPlayer";
import { useProgression } from "../../hooks/useProgression.jsx";
import { getSchoolAudioConfig } from "../../lib/ambient/schoolAudio.config.js";
import {
  normalizeAdminToken,
  readAudioAdminError,
  uploadAudioFile,
} from "../../lib/audioAdminApi";
import "./ListenPage.css";

const TRACK_SWITCH_DELAY_MS = 1500;

function getProviderLabel(trackUrl: string | null | undefined) {
  if (!trackUrl) return "Unknown source";
  const normalized = String(trackUrl).toLowerCase();
  if (normalized.includes("youtube") || normalized.includes("youtu.be")) return "YouTube";
  if (normalized.includes("suno")) return "Suno";
  if (normalized.match(/\.(mp3|wav|ogg|m4a)$/)) return "Direct stream";
  return "External stream";
}

function formatXp(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(value)));
}

export default function ListenPage() {
  const [isTrackSwitchLocked, setIsTrackSwitchLocked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const trackSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const adminToken = normalizeAdminToken(adminTokenInput);

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
    playableSchools = [],
    dynamicSchools = [],
    refreshDynamicSchools,
    tuneToSchool,
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
    toggleAutoplayAmbient,
    toggleCyclingEnabled,
    unlockAudio,
  } = useAmbientPlayer(progression.unlockedSchools, {
    adminToken,
  });

  const stations = useMemo(
    () =>
      Object.values(SCHOOLS)
        .map((school: any) => {
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
        .sort((a: any, b: any) => a.unlockXP - b.unlockXP),
    [checkUnlocked]
  );

  const currentStation = useMemo(() => {
    if (!stations.length && !dynamicSchools.length) return null;
    return (
      stations.find((station: any) => station.id === currentSchoolId) ||
      dynamicSchools.find((school: any) => school.id === currentSchoolId) ||
      stations.find((station: any) => station.unlocked) ||
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

  const handleTuneStation = async (stationId: string, isUnlocked = true) => {
    if (!isUnlocked || !canSwitchTracks) return;
    lockTrackSwitching();
    await unlockAudio();
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

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isUploading) return;
    if (!adminToken) {
      setUploadStatus("Upload failed: admin token required.");
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const res = await uploadAudioFile(file, adminToken);
      if (res.ok) {
        await refreshDynamicSchools();
        setUploadStatus(`Uploaded successfully! (${file.name})`);
        setTimeout(() => setUploadStatus(null), 3000);
      } else if (res.status === 401) {
        const errorData = await readAudioAdminError(res);
        if (errorData?.reason === "missing_admin_token") {
          setUploadStatus("Upload failed: missing admin token.");
        } else if (errorData?.reason === "invalid_admin_token") {
          setUploadStatus("Upload failed: invalid admin token.");
        } else {
          setUploadStatus("Upload failed: unauthorized.");
        }
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

  const hasAdminToken = Boolean(adminToken);

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

        <div className="listen-admin-panel glass-elevated p-4 mb-4 rounded-xl flex items-center justify-between animate-fadeIn">
          <div>
            <h2 className="text-lg font-bold mb-1">Chamber of Echoes</h2>
            <p className="text-sm text-muted">Direct upload to local archive</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <label htmlFor="listen-admin-token" className="sr-only">
              Audio admin token
            </label>
            <input
              id="listen-admin-token"
              type="password"
              value={adminTokenInput}
              onChange={(event) => setAdminTokenInput(event.target.value)}
              placeholder="Audio admin token"
              className="listen-admin-token-input"
              autoComplete="off"
              spellCheck={false}
              aria-label="Audio admin token"
            />
            {uploadStatus && <span className="text-xs font-mono">{uploadStatus}</span>}
            <input
              type="file"
              accept="audio/*"
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
              aria-label="Audio file upload"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !hasAdminToken}
            >
              {isUploading ? "Uploading..." : "Upload Audio"}
            </button>
          </div>
        </div>

        <div className="listen-board">
          <aside className="listen-station-panel glass" aria-label="Available stations">
            <div className="listen-panel-heading">
              <h2>Stations</h2>
              <span>{stations.filter((station: any) => !station.unlocked).length} locked</span>
            </div>
            <ul className="listen-station-list">
              {stations.map((station: any) => {
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
                      style={{ "--station-color": station.color } as CSSProperties}
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
                  {dynamicSchools.map((school: any) => {
                    const isActive = school.id === currentSchoolId;
                    return (
                      <li key={school.id}>
                        <button
                          type="button"
                          className={`listen-station-btn ${isActive ? "is-active" : ""}`}
                          onClick={() => {
                            void handleTuneStation(school.id);
                          }}
                          disabled={!canSwitchTracks}
                          style={{ "--station-color": "var(--school-void)" } as CSSProperties}
                        >
                          <span className="listen-station-dot" aria-hidden="true" />
                          <span className="listen-station-meta">
                            <span className="listen-station-name">{school.name}</span>
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
