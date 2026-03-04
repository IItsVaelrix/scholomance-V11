import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS } from "../data/schools";
import {
  AMBIENT_PLAYER_STATES,
  getAmbientPlayerService,
} from "../lib/ambient/ambientPlayer.service";
import { getPlayableSchoolIds, getSchoolAudioConfig } from "../lib/ambient/schoolAudio.config";

const ORB_VISIBILITY_STORAGE_KEY = "scholomance.ambient.orb.visible.v1";
const AMBIENT_PLAYER_CONTAINER_ID = "scholomance-ambient-player";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function readOrbVisibilityPreference() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(ORB_VISIBILITY_STORAGE_KEY);
    if (raw === null) return true;
    const parsed = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : true;
  } catch {
    return true;
  }
}

function writeOrbVisibilityPreference(visible: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORB_VISIBILITY_STORAGE_KEY, JSON.stringify(Boolean(visible)));
  } catch {
    // Ignore storage errors.
  }
}

function ensureAmbientPlayerContainer() {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(AMBIENT_PLAYER_CONTAINER_ID);
  if (existing) return existing;
  const container = document.createElement("div");
  container.id = AMBIENT_PLAYER_CONTAINER_ID;
  container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);
  return container;
}

export function useAmbientPlayer(unlockedSchools: string[] = []): any {
  const service = useMemo(() => getAmbientPlayerService(), []);
  const [state, setState] = useState<Record<string, any>>(() => service.getState());
  const [signalLevel, setSignalLevel] = useState(0);
  const [orbVisible, setOrbVisibleState] = useState(() => readOrbVisibilityPreference());

  const playableSchools = useMemo(() => {
    return getPlayableSchoolIds(unlockedSchools);
  }, [unlockedSchools]);

  useEffect(() => service.subscribe(setState), [service]);

  useEffect(() => {
    service.setContainer?.(ensureAmbientPlayerContainer());
  }, [service]);

  const isSignalActive =
    state.isPlaying || state.status === AMBIENT_PLAYER_STATES.TUNING;

  useEffect(() => {
    if (!isSignalActive) {
      setSignalLevel(0);
      return;
    }

    let rafId: number | null = null;
    let fallbackTimerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = (callback: FrameRequestCallback) => {
      if (typeof requestAnimationFrame === "function") {
        rafId = requestAnimationFrame(callback);
        return;
      }
      fallbackTimerId = setTimeout(() => callback(Date.now()), 16);
    };

    const cancel = () => {
      if (rafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      }
      if (fallbackTimerId !== null) {
        clearTimeout(fallbackTimerId);
      }
    };

    const tick: FrameRequestCallback = () => {
      if (cancelled) return;
      const sampledLevel = service.getSignalLevel?.() ?? null;
      const nextLevel = Number.isFinite(sampledLevel) ? clamp01(sampledLevel as number) : 0;
      setSignalLevel((previousLevel) =>
        Math.abs(nextLevel - previousLevel) < 0.01 ? previousLevel : nextLevel
      );
      schedule(tick);
    };

    schedule(tick);
    return () => {
      cancelled = true;
      cancel();
    };
  }, [service, isSignalActive]);

  // Upload/archive stations were removed; clear any stale dynamic schools from prior sessions.
  useEffect(() => {
    service.setDynamicSchools([]);
  }, [service]);

  useEffect(() => {
    service.setPlayableSchools(playableSchools);
  }, [service, playableSchools]);

  const currentSchoolId = state.schoolId as string | null;
  const queuedSchoolId = state.queuedSchoolId as string | null;

  const schoolMap = SCHOOLS as Record<string, any>;

  const findSchool = (id: string | null) => {
    if (!id) return null;
    return schoolMap[id] || null;
  };

  const currentSchool = findSchool(currentSchoolId);
  const queuedSchool = findSchool(queuedSchoolId);

  const currentSchoolConfig = currentSchoolId
    ? schoolMap[currentSchoolId]
      ? getSchoolAudioConfig(currentSchoolId)
      : null
    : null;

  const paletteKey = currentSchoolConfig?.paletteKey || null;
  const orbSkinKey = currentSchoolConfig?.orbSkinKey || null;

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

  const setOrbVisibility = useCallback((visible: boolean) => {
    const nextVisible = Boolean(visible);
    setOrbVisibleState(nextVisible);
    writeOrbVisibilityPreference(nextVisible);
  }, []);

  const toggleOrbVisibility = useCallback(() => {
    setOrbVisibleState((previousValue) => {
      const nextValue = !previousValue;
      writeOrbVisibilityPreference(nextValue);
      return nextValue;
    });
  }, []);

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
    paletteKey,
    orbSkinKey,
    playableSchools,
    signalLevel,
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
    orbVisible,
    setOrbVisibility,
    toggleOrbVisibility,
    unlockAudio,
  };
}
