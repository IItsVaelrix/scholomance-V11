import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { SCHOOLS } from "../data/schools";
import {
  AMBIENT_PLAYER_STATES,
  getAmbientPlayerService,
} from "../lib/ambient/ambientPlayer.service";
import { getPlayableSchoolIds, getSchoolAudioConfig } from "../lib/ambient/schoolAudio.config";
import { fetchAudioFiles, normalizeAdminToken, type AudioFilePayload } from "../lib/audioAdminApi";

const AudioFileSchema = z.object({
  name: z.string(),
  url: z.string(),
});
const AudioFileListSchema = z.array(AudioFileSchema);

type AmbientPlayerOptions = {
  adminToken?: string | null;
};

type DynamicSchool = {
  id: string;
  name: string;
  trackUrl: string;
  paletteKey: "void";
  orbSkinKey: "void";
  isDynamic: true;
};

export function useAmbientPlayer(unlockedSchools: string[] = [], options: AmbientPlayerOptions = {}): any {
  const service = useMemo(() => getAmbientPlayerService(), []);
  const [state, setState] = useState<Record<string, any>>(() => service.getState());
  const [dynamicSchools, setDynamicSchools] = useState<DynamicSchool[]>([]);
  const adminToken = normalizeAdminToken(options.adminToken);

  const fetchDynamicSchools = useCallback(async () => {
    try {
      const res = await fetchAudioFiles(adminToken);
      if (res.ok) {
        const rawData = await res.json();
        const parsed = AudioFileListSchema.safeParse(rawData);
        if (!parsed.success) {
          console.error("Invalid audio files payload", parsed.error);
          return;
        }

        const files: AudioFilePayload[] = parsed.data;
        const schools: DynamicSchool[] = files.map((file) => ({
          id: `dynamic-${file.name}`,
          name: file.name.split(".")[0].replace(/_/g, " "),
          trackUrl: file.url,
          paletteKey: "void",
          orbSkinKey: "void",
          isDynamic: true,
        }));
        setDynamicSchools(schools);
        service.setDynamicSchools(schools);
        return;
      }

      if (res.status === 401) {
        setDynamicSchools([]);
        service.setDynamicSchools([]);
      }
    } catch (error) {
      console.error("Failed to fetch dynamic schools:", error);
    }
  }, [adminToken, service]);

  useEffect(() => {
    void fetchDynamicSchools();
  }, [fetchDynamicSchools]);

  const playableSchools = useMemo(() => {
    const base = getPlayableSchoolIds(unlockedSchools);
    const dynamicIds = dynamicSchools.map((school) => school.id);
    return [...base, ...dynamicIds];
  }, [unlockedSchools, dynamicSchools]);

  useEffect(() => service.subscribe(setState), [service]);

  useEffect(() => {
    service.setPlayableSchools(playableSchools);
  }, [service, playableSchools]);

  const currentSchoolId = state.schoolId as string | null;
  const queuedSchoolId = state.queuedSchoolId as string | null;

  const schoolMap = SCHOOLS as Record<string, any>;

  const findSchool = (id: string | null) => {
    if (!id) return null;
    return schoolMap[id] || dynamicSchools.find((school) => school.id === id) || null;
  };

  const currentSchool = findSchool(currentSchoolId);
  const queuedSchool = findSchool(queuedSchoolId);

  const currentSchoolConfig = currentSchoolId
    ? schoolMap[currentSchoolId]
      ? getSchoolAudioConfig(currentSchoolId)
      : dynamicSchools.find((school) => school.id === currentSchoolId) || null
    : null;

  const tuneToSchool = useCallback(
    async (schoolId: string) => {
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
    (value: number) => {
      service.setVolume(value);
    },
    [service]
  );

  const toggleAutoplayAmbient = useCallback(async () => {
    await service.toggleAutoplayAmbient();
  }, [service]);

  const setAutoplayAmbient = useCallback(
    async (enabled: boolean) => {
      await service.setAutoplayAmbient(enabled);
    },
    [service]
  );

  const setCyclingEnabled = useCallback(
    (enabled: boolean) => {
      service.setCyclingEnabled(enabled);
    },
    [service]
  );

  const toggleCyclingEnabled = useCallback(() => {
    service.toggleCyclingEnabled();
  }, [service]);

  const setOrbVisibility = useCallback(
    (visible: boolean) => {
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
