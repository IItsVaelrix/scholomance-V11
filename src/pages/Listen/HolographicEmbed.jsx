import { getTrackEmbedConfig } from "../../lib/musicEmbeds";

export default function HolographicEmbed({
  trackUrl,
  trackId,
  title,
  glyph,
  isPlaying = false,
  isTuning = false,
  volumePercent = 0,
  onPlay,
  onPause,
  onRewind,
  onFastForward,
  onVolumeDown,
  onVolumeUp,
}) {
  const resolvedTrackUrl = trackUrl || trackId || "";
  const embed = getTrackEmbedConfig(resolvedTrackUrl);
  const providerLabel = embed.provider ? String(embed.provider).toUpperCase() : "OFFLINE";
  const displayTitle = title || "No signal";
  const controlsDisabled = !resolvedTrackUrl;
  const stateLabel = !resolvedTrackUrl
    ? "NO SIGNAL"
    : isTuning
      ? "SYNCING"
      : isPlaying
        ? "TRANSMITTING"
        : "STANDBY";
  const rootClassName = [
    "signal-core",
    resolvedTrackUrl ? "" : "is-empty",
    isPlaying ? "is-live" : "is-idle",
    isTuning ? "is-tuning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName} aria-label={`${displayTitle} transmission core`}>
      <div className="signal-core__halo" />

      <div className="signal-core__aperture">
        <div className="signal-core__bezel">
          <div className="signal-core__screen">
            <svg
              className="signal-core__schematics"
              viewBox="0 0 320 320"
              preserveAspectRatio="xMidYMid meet"
            >
              <circle className="signal-core__ring-line signal-core__ring-line--outer" cx="160" cy="160" r="118" />
              <circle className="signal-core__ring-line signal-core__ring-line--mid" cx="160" cy="160" r="92" />
              <circle className="signal-core__ring-line signal-core__ring-line--inner" cx="160" cy="160" r="56" />
              <line className="signal-core__grid-line" x1="160" y1="38" x2="160" y2="282" />
              <line className="signal-core__grid-line" x1="38" y1="160" x2="282" y2="160" />

              <g className="signal-core__sigil-rotor">
                <path className="signal-core__sigil-line" d="M160 72 L234 198 H86 Z" />
                <path
                  className="signal-core__sigil-line signal-core__sigil-line--soft"
                  d="M160 64 L228 112 L228 208 L160 256 L92 208 L92 112 Z"
                />
                <path
                  className="signal-core__sigil-line signal-core__sigil-line--soft"
                  d="M160 96 L204 160 L160 224 L116 160 Z"
                />
              </g>

              <path
                className="signal-core__wave-line signal-core__wave-line--primary"
                d="M26 176 C56 132, 92 208, 124 164 S188 110, 224 168 S280 212, 306 150"
              />
              <path
                className="signal-core__wave-line signal-core__wave-line--secondary"
                d="M24 144 C54 172, 90 118, 122 146 S188 190, 224 144 S280 108, 304 132"
              />
              <circle className="signal-core__focus-dot" cx="160" cy="160" r="10" />
              <circle className="signal-core__focus-pulse" cx="160" cy="160" r="18" />
            </svg>

            <div className="signal-core__screen-label">{stateLabel}</div>
            <div className="signal-core__glyph">{glyph || "✦"}</div>
          </div>
        </div>
      </div>

      <div className="signal-core__plaque">
        <span className="signal-core__plaque-ornament">◈</span>
        <span className="signal-core__plaque-text">{displayTitle}</span>
        <span className="signal-core__plaque-ornament">◈</span>
      </div>

      <div className="signal-core__controls" role="group" aria-label={`${displayTitle} transport controls`}>
        <button
          type="button"
          className="signal-core__control-btn"
          onClick={onRewind}
          disabled={controlsDisabled}
          aria-label="Rewind transmission by 10 seconds"
        >
          RW
        </button>
        <button
          type="button"
          className="signal-core__control-btn signal-core__control-btn--primary"
          onClick={onPlay}
          disabled={controlsDisabled}
          aria-label="Play transmission"
        >
          PLAY
        </button>
        <button
          type="button"
          className="signal-core__control-btn"
          onClick={onPause}
          disabled={controlsDisabled}
          aria-label="Pause transmission"
        >
          PAUSE
        </button>
        <button
          type="button"
          className="signal-core__control-btn"
          onClick={onFastForward}
          disabled={controlsDisabled}
          aria-label="Fast forward transmission by 10 seconds"
        >
          FF
        </button>
      </div>

      <div className="signal-core__volume-strip" role="group" aria-label={`${displayTitle} volume controls`}>
        <button
          type="button"
          className="signal-core__control-btn signal-core__control-btn--volume"
          onClick={onVolumeDown}
          disabled={controlsDisabled}
          aria-label="Decrease volume by 5 percent"
        >
          VOL -5
        </button>
        <div className="signal-core__volume-readout" aria-live="polite">
          VOL {volumePercent}%
        </div>
        <button
          type="button"
          className="signal-core__control-btn signal-core__control-btn--volume"
          onClick={onVolumeUp}
          disabled={controlsDisabled}
          aria-label="Increase volume by 5 percent"
        >
          VOL +5
        </button>
      </div>

      <div className="signal-core__readout">
        <span>Transmission Core</span>
        <span>{providerLabel}</span>
      </div>
    </section>
  );
}
