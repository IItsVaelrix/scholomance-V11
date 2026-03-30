const DEFAULT_SONIC_STATION_BUCKETS = Object.freeze({
  SONIC: Object.freeze([
    "https://suno.com/song/44c7a9b9-4053-4d1e-84e3-2b8252f0f57b",
    "https://suno.com/song/236e9f87-4d38-43da-a98a-b39447256d21",
    "https://suno.com/song/74a37c2a-3c4c-4841-a618-fe244ba981a8",
  ]),
  PSYCHIC: Object.freeze([]),
  VOID: Object.freeze([]),
  ALCHEMY: Object.freeze([]),
  WILL: Object.freeze([]),
});

const TRACK_URL_KEYS = Object.freeze(["url", "trackUrl", "suno", "sc"]);

function resolveTrackUrlFromEntry(entry) {
  if (!entry || typeof entry !== "object") return "";
  for (const key of TRACK_URL_KEYS) {
    const candidate = entry[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function normalizeTrackEntry(entry) {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return { url: trimmed, weight: 1 };
  }
  if (!entry || typeof entry !== "object") return null;
  const rawUrl = resolveTrackUrlFromEntry(entry);
  if (!rawUrl) return null;
  const parsedWeight = Number(entry.weight);
  const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
  return { url: rawUrl, weight };
}

export function getSonicStationBuckets() {
  return DEFAULT_SONIC_STATION_BUCKETS;
}

export function getSonicStationTrackPool() {
  return Object.entries(DEFAULT_SONIC_STATION_BUCKETS).flatMap(([schoolId, tracks]) =>
    (tracks || [])
      .map((track) => normalizeTrackEntry(track))
      .filter(Boolean)
      .map((track) => ({ ...track, schoolId }))
  );
}

export function getDefaultSonicStationTrackUrl() {
  const first = getSonicStationTrackPool()[0];
  return first?.url || null;
}

export function pickRandomSonicStationTrack({ excludeUrl = null, randomFn = Math.random } = {}) {
  const pool = getSonicStationTrackPool();
  if (!pool.length) return null;

  const filtered = excludeUrl ? pool.filter((track) => track.url !== excludeUrl) : pool;
  const candidates = filtered.length ? filtered : pool;
  const totalWeight = candidates.reduce((acc, track) => acc + track.weight, 0);
  if (!totalWeight) return candidates[0]?.url || null;

  let cursor = Math.max(0, randomFn()) * totalWeight;
  for (const track of candidates) {
    cursor -= track.weight;
    if (cursor <= 0) return track.url;
  }
  return candidates[candidates.length - 1]?.url || null;
}
