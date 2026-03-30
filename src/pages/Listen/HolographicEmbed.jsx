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
  onPrevTrack,
  onNextTrack,
}) {
  const resolvedTrackUrl = trackUrl || trackId || "";
  const embed = getTrackEmbedConfig(resolvedTrackUrl);
  const providerLabel = embed.provider ? String(embed.provider).toUpperCase() : "OFFLINE";
  const displayTitle = title || "No signal";
  const controlsDisabled = !resolvedTrackUrl;

  // Player state enum: standby | loading | playing | paused
  const playerState = !resolvedTrackUrl
    ? "standby"
    : isTuning
    ? "loading"
    : isPlaying
    ? "playing"
    : "paused";

  const stateLabel = {
    standby: "STANDBY",
    loading: "SYNCING",
    playing: "TRANSMITTING",
    paused: "STANDBY",
  }[playerState] ?? "STANDBY";

  const signalStatusValue = {
    standby: "Standby",
    loading: "Synchronizing",
    playing: "Transmitting",
    paused: "Paused",
  }[playerState] ?? "Standby";

  const coreClass = [
    "signal-core",
    !resolvedTrackUrl ? "is-empty" : "",
    isPlaying ? "is-live" : "is-idle",
    isTuning ? "is-tuning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={`listen-console listen-console--${playerState}`}
      aria-label={`${displayTitle} transmission console`}
    >
      {/* TransmissionCore */}
      <div className="listen-console__core-shell">
        <div className={coreClass}>
          <div className="signal-core__halo" />
          <div className="signal-core__aperture">
            <div className="signal-core__bezel">
              <div className="signal-core__screen">
                <svg
                  className="signal-core__schematics"
                  viewBox="0 0 320 320"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <circle className="signal-core__ring-line signal-core__ring-line--outer" cx="160" cy="160" r="118" />
                  <circle className="signal-core__ring-line signal-core__ring-line--mid"   cx="160" cy="160" r="92"  />
                  <circle className="signal-core__ring-line signal-core__ring-line--inner" cx="160" cy="160" r="56"  />
                  <line className="signal-core__grid-line" x1="160" y1="38"  x2="160" y2="282" />
                  <line className="signal-core__grid-line" x1="38"  y1="160" x2="282" y2="160" />

                  <g className="signal-core__sigil-rotor">
                    <path className="signal-core__sigil-line"
                          d="M160 72 L234 198 H86 Z" />
                    <path className="signal-core__sigil-line signal-core__sigil-line--soft"
                          d="M160 64 L228 112 L228 208 L160 256 L92 208 L92 112 Z" />
                    <path className="signal-core__sigil-line signal-core__sigil-line--soft"
                          d="M160 96 L204 160 L160 224 L116 160 Z" />
                  </g>

                  <path className="signal-core__wave-line signal-core__wave-line--primary"
                        d="M26 176 C56 132, 92 208, 124 164 S188 110, 224 168 S280 212, 306 150" />
                  <path className="signal-core__wave-line signal-core__wave-line--secondary"
                        d="M24 144 C54 172, 90 118, 122 146 S188 190, 224 144 S280 108, 304 132" />
                  <circle className="signal-core__focus-dot"   cx="160" cy="160" r="10" />
                  <circle className="signal-core__focus-pulse" cx="160" cy="160" r="18" />
                </svg>

                <div className="signal-core__screen-label">{stateLabel}</div>
                <div className="signal-core__glyph">{glyph || "✦"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ConsoleDivider */}
      <div className="listen-console__divider" aria-hidden="true" />

      {/* StationPlate */}
      <div className="listen-console__plate">
        <span className="listen-console__plate-glyph" aria-hidden="true">✦</span>
        <h2 className="listen-console__title">{displayTitle}</h2>
        <span className="listen-console__plate-glyph" aria-hidden="true">✦</span>
      </div>

      {/* TransportConsole */}
      <div
        className="transport-console"
        role="group"
        aria-label={`${displayTitle} transport controls`}
      >
        {/* Holographic screen surface */}
        <div className="transport-console__screen" aria-hidden="true" />

        {/* StationNavRow */}
        <div className="transport-console__row transport-console__row--station">
          <button
            type="button"
            className="transport-console__btn transport-console__btn--station"
            onClick={onPrevTrack}
            disabled={controlsDisabled}
            aria-label="Previous station"
          >
            ◀ PREV
          </button>
          <button
            type="button"
            className="transport-console__btn transport-console__btn--station"
            onClick={onNextTrack}
            disabled={controlsDisabled}
            aria-label="Next station"
          >
            NEXT ▶
          </button>
        </div>

        {/* PrimaryTransportRow */}
        <div className="transport-console__row transport-console__row--primary">
          <button
            type="button"
            className="transport-console__btn"
            onClick={onRewind}
            disabled={controlsDisabled}
            aria-label="Rewind 10 seconds"
          >
            RW
          </button>
          <button
            type="button"
            className="transport-console__btn transport-console__btn--play"
            onClick={onPlay}
            disabled={controlsDisabled}
            aria-label="Play transmission"
          >
            PLAY
          </button>
          <button
            type="button"
            className="transport-console__btn"
            onClick={onPause}
            disabled={controlsDisabled}
            aria-label="Pause transmission"
          >
            PAUSE
          </button>
          <button
            type="button"
            className="transport-console__btn"
            onClick={onFastForward}
            disabled={controlsDisabled}
            aria-label="Fast forward 10 seconds"
          >
            FF
          </button>
        </div>

        {/* SecondaryTransportRow */}
        <div className="transport-console__row transport-console__row--secondary">
          <button
            type="button"
            className="transport-console__btn"
            onClick={onVolumeDown}
            disabled={controlsDisabled}
            aria-label="Decrease volume by 5 percent"
          >
            VOL −5
          </button>
          <div
            className="transport-console__volume-readout"
            aria-live="polite"
            aria-label={`Volume ${volumePercent} percent`}
          >
            VOL {volumePercent}%
          </div>
          <button
            type="button"
            className="transport-console__btn"
            onClick={onVolumeUp}
            disabled={controlsDisabled}
            aria-label="Increase volume by 5 percent"
          >
            VOL +5
          </button>
        </div>

        {/* ConsoleMetaRow */}
        <div className="transport-console__meta" aria-hidden="true">
          <span>TRANSMISSION CORE</span>
          <span>{providerLabel}</span>
        </div>
      </div>

      {/* SignalStatus */}
      <div
        className="signal-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="signal-status__label">Current Signal:</span>
        <span className="signal-status__value">{signalStatusValue}</span>
        <span className="signal-status__divider" aria-hidden="true">|</span>
        <span className="signal-status__label">Protocol:</span>
        <span className="signal-status__value">Scholomance v11.3</span>
      </div>
    </section>
  );
}
