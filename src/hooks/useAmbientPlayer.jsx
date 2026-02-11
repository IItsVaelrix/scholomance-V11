import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { SCHOOLS } from "../data/schools";
import {
  AMBIENT_PLAYER_STATES,
  getAmbientPlayerService,
} from "../lib/ambient/ambientPlayer.service";
import { getPlayableSchoolIds, getSchoolAudioConfig } from "../lib/ambient/schoolAudio.config";

const AudioFileSchema = z.object({
  name: z.string(),
  url: z.string(),
});
const AudioFileListSchema = z.array(AudioFileSchema);

export function useAmbientPlayer(unlockedSchools = [], options = {}) {
  const service = useMemo(() => getAmbientPlayerService(), []);
  const [state, setState] = useState(() => service.getState());
  const [dynamicSchools, setDynamicSchools] = useState([]);
  const adminToken =
    typeof options.adminToken === "string" && options.adminToken.trim()
      ? options.adminToken.trim()
      : null;

  const buildAudioApiUrl = useCallback(
    (path) => {
      if (!adminToken || !import.meta.env.PROD) {
        return path;
      }
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}admin=${encodeURIComponent(adminToken)}`;
    },
    [adminToken]
  );

  const fetchDynamicSchools = useCallback(async () => {
    try {
      const res = await fetch(buildAudioApiUrl("/api/audio-files"));
      if (res.ok) {
        const rawData = await res.json();
        const parsed = AudioFileListSchema.safeParse(rawData);
        if (!parsed.success) {
          console.error("Invalid audio files payload", parsed.error);
          return;
        }
        
        const files = parsed.data;
        const schools = files.map((f) => ({
          id: `dynamic-${f.name}`,
          name: f.name.split(".")[0].replace(/_/g, " "),
          trackUrl: f.url,
          paletteKey: "void",
          orbSkinKey: "void",
          isDynamic: true,
        }));
        setDynamicSchools(schools);
        service.setDynamicSchools(schools);
      }
    } catch (e) {
      console.error("Failed to fetch dynamic schools:", e);
    }
  }, [buildAudioApiUrl, service]);

  useEffect(() => {
    fetchDynamicSchools();
  }, [fetchDynamicSchools]);

  const playableSchools = useMemo(() => {
    const base = getPlayableSchoolIds(unlockedSchools);
    const dynamicIds = dynamicSchools.map((s) => s.id);
    return [...base, ...dynamicIds];
  }, [unlockedSchools, dynamicSchools]);

  useEffect(() => service.subscribe(setState), [service]);

  useEffect(() => {
    service.setPlayableSchools(playableSchools);
  }, [service, playableSchools]);

  const currentSchoolId = state.schoolId;
  const queuedSchoolId = state.queuedSchoolId;
  
  const findSchool = (id) => {
    if (!id) return null;
    return SCHOOLS[id] || dynamicSchools.find((s) => s.id === id) || null;
  };

  const currentSchool = findSchool(currentSchoolId);
  const queuedSchool = findSchool(queuedSchoolId);
  
  const currentSchoolConfig = currentSchoolId ? (SCHOOLS[currentSchoolId] ? getSchoolAudioConfig(currentSchoolId) : dynamicSchools.find(s => s.id === currentSchoolId)) : null;

  const tuneToSchool = useCallback(
    async (schoolId) => {
      await service.unlockAudio();
      return await service.setSchool(schoolId);
    },
    [service]
  );

  const tuneNextSchool = useCallback(async () => {
    await service.unlockAudio();
    return await service.cycleSchool(1);
  }, [service]);

  const tunePreviousSchool = useCallback(async () => {
    await service.unlockAudio();
    return await service.cycleSchool(-1);
  }, [service]);

  const play = useCallback(async () => {
    await service.unlockAudio();
    await service.play();
  }, [service]);

  const pause = useCallback(async () => {
    await service.pause();
  }, [service]);

  const togglePlayPause = useCallback(async () => {
    await service.unlockAudio();
    await service.togglePlayPause();
  }, [service]);

  const setVolume = useCallback(
    (value) => {
      service.setVolume(value);
    },
    [service]
  );

  const toggleAutoplayAmbient = useCallback(async () => {
    await service.toggleAutoplayAmbient();
  }, [service]);

  const setAutoplayAmbient = useCallback(
    async (enabled) => {
      await service.setAutoplayAmbient(enabled);
    },
    [service]
  );

  const setCyclingEnabled = useCallback(
    (enabled) => {
      service.setCyclingEnabled(enabled);
    },
    [service]
  );

  const toggleCyclingEnabled = useCallback(() => {
    service.toggleCyclingEnabled();
  }, [service]);

  const setOrbVisibility = useCallback(
    (visible) => {
      service.setOrbVisibility(visible);
    },
    [service]
  );

  const toggleOrbVisibility = useCallback(() => {
    service.toggleOrbVisibility();
  }, [service]);

  const unlockAudio = useCallback(async () => {
    await service.unlockAudio();
  }, [service]);

  return {
    ...state,
    currentSchoolId,
    queuedSchoolId,
    currentSchool,
    queuedSchool,
    currentSchoolConfig,
    playableSchools,
    dynamicSchools,
    refreshDynamicSchools: fetchDynamicSchools,
    isTuning: state.status === AMBIENT_PLAYER_STATES.TUNING,
    isPlaying: state.status === AMBIENT_PLAYER_STATES.PLAYING,
    isPaused: state.status === AMBIENT_PLAYER_STATES.PAUSED,
    isLoading: state.isLoading,
    tuneToSchool,
    tuneNextSchool,
    tunePreviousSchool,
    play,
    pause,
    togglePlayPause,
    setVolume,
    setAutoplayAmbient,
    toggleAutoplayAmbient,
    setCyclingEnabled,
    toggleCyclingEnabled,
    orbVisible: state.orbVisible,
    setOrbVisibility,
    toggleOrbVisibility,
    unlockAudio,
  };
}
