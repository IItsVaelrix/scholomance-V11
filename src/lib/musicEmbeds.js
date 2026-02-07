const SUNO_HOSTS = new Set(["suno.com", "www.suno.com"]);
const SUNO_CDN_BASE = "https://audiocdn001.suno.ai";

function parseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function getMusicProvider(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return "unknown";

  const host = parsed.hostname.toLowerCase();

  if (SUNO_HOSTS.has(host)) {
    return "suno";
  }

  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }

  if (parsed.pathname.match(/\.(mp3|wav|ogg|m4a)$/i)) {
    return "direct";
  }

  return "unknown";
}

export function getYouTubeEmbedUrl(trackUrl, { autoPlay = false } = {}) {
  const parsed = parseUrl(trackUrl);
  if (!parsed) return null;

  let videoId = "";
  if (parsed.hostname.includes("youtu.be")) {
    videoId = parsed.pathname.slice(1);
  } else {
    videoId = parsed.searchParams.get("v") || "";
  }

  if (!videoId) return trackUrl;

  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.searchParams.set("rel", "0");
  url.searchParams.set("modestbranding", "1");
  if (autoPlay) {
    url.searchParams.set("autoplay", "1");
  }

  return url.toString();
}

export function getSunoEmbedUrl(trackUrl, { autoPlay = false } = {}) {
  const parsed = parseUrl(trackUrl);
  if (!parsed) return null;

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  let embedUrl;

  if ((pathParts[0] === "song" || pathParts[0] === "embed") && pathParts[1]) {
    embedUrl = new URL(`https://suno.com/embed/${pathParts[1]}`);
  } else {
    embedUrl = new URL(parsed.toString());
  }

  if (autoPlay) {
    embedUrl.searchParams.set("autoplay", "1");
  }

  return embedUrl.toString();
}

export function getSunoSongId(trackUrl) {
  const parsed = parseUrl(trackUrl);
  if (!parsed) return null;
  if (!SUNO_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if ((pathParts[0] === "song" || pathParts[0] === "embed") && pathParts[1]) {
    return pathParts[1];
  }

  return null;
}

export function getSunoAudioUrl(trackUrl) {
  const songId = getSunoSongId(trackUrl);
  if (!songId) return null;
  return `${SUNO_CDN_BASE}/${songId}.mp3`;
}

export function getTrackEmbedConfig(trackUrl, options = {}) {
  const provider = getMusicProvider(trackUrl);

  if (provider === "suno") {
    return {
      provider,
      src: getSunoEmbedUrl(trackUrl, options),
      audioUrl: getSunoAudioUrl(trackUrl),
      title: "Suno player",
    };
  }

  if (provider === "direct") {
    return {
      provider,
      src: null,
      audioUrl: trackUrl,
      title: "Local audio player",
    };
  }

  if (provider === "youtube") {
    return {
      provider,
      src: getYouTubeEmbedUrl(trackUrl, options),
      title: "YouTube player",
    };
  }

  return {
    provider: "unknown",
    src: null,
    title: "Track player",
  };
}
