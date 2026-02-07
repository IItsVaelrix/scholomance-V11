import { getTrackEmbedConfig } from "../../lib/musicEmbeds";

export default function HolographicEmbed({ trackId, color }) {
  const colorHex = color.replace("#", "");
  const embed = getTrackEmbedConfig(trackId, { colorHex });

  return (
    <div className="holo-panel">
      <div className="holo-shimmer" />
      <div className="holo-panel-inner">
        {embed.src ? (
          <iframe
            title={embed.title}
            src={embed.src}
            allow="autoplay"
            style={{ width: "100%", height: embed.provider === "suno" ? 180 : 120, border: 0 }}
          />
        ) : null}
      </div>
      <div className="holo-scanline" />
    </div>
  );
}
