import { useCallback } from "react";
import { generateSchoolColor } from "../data/schools";
import { useAmbientPlayer } from "../hooks/useAmbientPlayer";
import "./AmbientOrb.css";

export default function AmbientOrb({ unlockedSchools, variant = "fixed", interactionMode = "full" }) {
  const {
    status,
    currentSchool,
    currentSchoolId,
    queuedSchool,
    playableSchools,
    isPlaying,
    isTuning,
    isLoading,
    signalLevel,
    volume,
    setVolume,
    autoplayAmbient,
    cyclingEnabled,
    toggleAutoplayAmbient,
    toggleCyclingEnabled,
    tuneNextSchool,
    tunePreviousSchool,
    togglePlayPause,
  } = useAmbientPlayer(unlockedSchools);
  const isPlayPauseOnly = interactionMode === "play-pause";

  const canCycle = playableSchools.length > 1;

  const handleClick = useCallback(
    (event) => {
      if (isPlayPauseOnly) {
        togglePlayPause();
        return;
      }
      if (event.altKey) {
        toggleAutoplayAmbient();
        return;
      }
      if (event.shiftKey) {
        toggleCyclingEnabled();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        togglePlayPause();
        return;
      }
      tuneNextSchool();
    },
    [isPlayPauseOnly, toggleAutoplayAmbient, toggleCyclingEnabled, togglePlayPause, tuneNextSchool]
  );

  const handleContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      togglePlayPause();
    },
    [togglePlayPause]
  );

  const handleWheel = useCallback(
    (event) => {
      if (isPlayPauseOnly) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.05 : 0.05;
      setVolume(volume + delta);
    },
    [isPlayPauseOnly, volume, setVolume]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (isPlayPauseOnly) {
        if (event.key === "Enter" || event.key === " " || event.key === "p" || event.key === "P") {
          event.preventDefault();
          togglePlayPause();
        }
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tuneNextSchool();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        tuneNextSchool();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        tunePreviousSchool();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setVolume(volume + 0.05);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setVolume(volume - 0.05);
      } else if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePlayPause();
      } else if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        toggleAutoplayAmbient();
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        toggleCyclingEnabled();
      }
    },
    [
      isPlayPauseOnly,
      tuneNextSchool,
      tunePreviousSchool,
      setVolume,
      volume,
      togglePlayPause,
      toggleAutoplayAmbient,
      toggleCyclingEnabled,
    ]
  );

  if (!playableSchools.length || !currentSchool) return null;

  const color = generateSchoolColor(currentSchoolId);
  const glyph = currentSchool.glyph || "*";
  const skinClass = currentSchoolId ? `ambient-orb--skin-${currentSchoolId.toLowerCase()}` : "";
  const queuedText = isTuning && queuedSchool ? `Queued: ${queuedSchool.name}` : "";
  const liveSignal = Math.max(0, Math.min(1, Number.isFinite(signalLevel) ? signalLevel : 0));

  const tooltip = isPlayPauseOnly
    ? [
        currentSchool.name,
        isTuning ? "Tuning..." : isPlaying ? "Playing" : status,
        "Click: play/pause",
      ]
        .filter(Boolean)
        .join(" | ")
    : [
        currentSchool.name,
        isTuning ? "Tuning..." : isPlaying ? "Playing" : status,
        queuedText,
        "Click: tune next school",
        canCycle ? "Arrow Left/Right: tune previous/next" : "",
        "Ctrl+Click: play/pause",
        "Shift+Click: toggle cycling",
        "Alt+Click: toggle autoplay",
        `Volume: ${Math.round(volume * 100)}%`,
      ]
        .filter(Boolean)
        .join(" | ");

  const orbClasses = [
    "ambient-orb",
    variant === "toolbar" && "ambient-orb--toolbar",
    variant === "panel" && "ambient-orb--panel",
    isPlaying && "ambient-orb--playing",
    isTuning && "ambient-orb--tuning",
    isLoading && "ambient-orb--loading",
    queuedSchool && "ambient-orb--queued",
    !isPlayPauseOnly && autoplayAmbient && "ambient-orb--autoplay",
    !isPlayPauseOnly && !cyclingEnabled && "ambient-orb--cycling-off",
    skinClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={orbClasses}
      style={{
        "--orb-color": color,
        "--orb-color-dim": `${color}66`,
        "--orb-signal": liveSignal.toFixed(3),
        "--orb-glow-near": `${Math.round(8 + liveSignal * 18)}px`,
        "--orb-glow-far": `${Math.round(16 + liveSignal * 32)}px`,
        "--orb-glow-inset": `${Math.round(8 + liveSignal * 14)}px`,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      title={tooltip}
      aria-label={
        isPlayPauseOnly
          ? `Ambient frequency: ${currentSchool.name}. Status: ${
              isTuning ? "tuning" : isPlaying ? "playing" : "paused"
            }. Click to play or pause.`
          : `Ambient frequency: ${currentSchool.name}. Status: ${
              isTuning ? "tuning" : isPlaying ? "playing" : "paused"
            }. Click to tune next school.`
      }
    >
      <span className="ambient-orb__glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="ambient-orb__sweep" aria-hidden="true" />
      {!isPlayPauseOnly ? (
        <span className="ambient-orb__flags" aria-hidden="true">
          <span className={`ambient-orb__flag ${autoplayAmbient ? "is-on" : ""}`}>A</span>
          <span className={`ambient-orb__flag ${cyclingEnabled ? "is-on" : ""}`}>C</span>
        </span>
      ) : null}
      {isLoading && <span className="ambient-orb__loader" aria-hidden="true" />}
    </button>
  );
}
