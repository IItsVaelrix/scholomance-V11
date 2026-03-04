import { SCHOOLS, generateSchoolColor } from "../../data/schools";
import { getDefaultSonicStationTrackUrl, pickRandomSonicStationTrack } from "../../data/sonicStationBuckets";

function getPrimaryTrackUrl(schoolId) {
  if (schoolId !== "SONIC") return null;
  return getDefaultSonicStationTrackUrl();
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
    };
    return acc;
  }, {})
);

export function getSchoolAudioConfig(schoolId) {
  return SCHOOL_AUDIO_CONFIG[schoolId] || null;
}

export function getRandomizedStationTrackUrl(schoolId, { excludeUrl = null } = {}) {
  if (schoolId !== "SONIC") {
    return getSchoolAudioConfig(schoolId)?.trackUrl || null;
  }
  return pickRandomSonicStationTrack({ excludeUrl }) || getDefaultSonicStationTrackUrl();
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
