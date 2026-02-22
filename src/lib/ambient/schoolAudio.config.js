import { LIBRARY } from "../../data/library";
import { SCHOOLS, generateSchoolColor } from "../../data/schools";

function resolveTrackSource(track) {
  if (!track || typeof track !== "object") return null;
  if (track.suno) return track.suno;
  if (track.yt) return `https://www.youtube.com/watch?v=${track.yt}`;
  return track.url || null;
}

function getPrimaryTrackUrl(schoolId) {
  const school = SCHOOLS[schoolId];
  if (!school?.tracks?.length) return null;
  const firstTrackKey = school.tracks[0];
  return resolveTrackSource(LIBRARY[firstTrackKey]);
}

export const SCHOOL_AUDIO_CONFIG = Object.freeze(
  Object.values(SCHOOLS).reduce((acc, school) => {
    const trackUrl = getPrimaryTrackUrl(school.id);
    acc[school.id] = {
      schoolId: school.id,
      paletteKey: school.id.toLowerCase(),
      orbSkinKey: school.id.toLowerCase(),
      color: generateSchoolColor(school.id),
      trackUrl,
      dialSfxUrl: null,
      noiseBedUrl: null,
      moodTags: [],
    };
    return acc;
  }, {})
);

export function getSchoolAudioConfig(schoolId) {
  return SCHOOL_AUDIO_CONFIG[schoolId] || null;
}

export function getPlayableSchoolIds(_unlockedSchools = []) {
  return Object.values(SCHOOL_AUDIO_CONFIG)
    .filter((config) => Boolean(config?.trackUrl))
    .map((config) => config.schoolId);
}

export function getDefaultSchoolId(playableSchoolIds = []) {
  if (!Array.isArray(playableSchoolIds) || playableSchoolIds.length === 0) {
    return null;
  }
  return playableSchoolIds[0];
}
