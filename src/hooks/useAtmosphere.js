import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentSong } from "./useCurrentSong.jsx";
import { SCHOOLS, generateSchoolColor } from "../data/schools.js";
import {
  AMBIENT_PLAYER_STATES,
  getAmbientPlayerService,
} from "../lib/ambient/ambientPlayer.service.js";

// ── Aurora level singleton ────────────────────────────────────────────────────
// 0 = OFF, 1 = DIM, 2 = FULL
const AURORA_STORAGE_KEY = 'scholomance-aurora-level';
const AURORA_FACTORS = [0, 0.3, 1.0];

function readStoredAuroraLevel() {
  try {
    const stored = localStorage.getItem(AURORA_STORAGE_KEY);
    const parsed = parseInt(stored ?? '2', 10);
    return (parsed >= 0 && parsed <= 2) ? parsed : 2;
  } catch {
    return 2;
  }
}

let _auroraLevel = readStoredAuroraLevel();
const _auroraListeners = new Set();

export function cycleAuroraLevel() {
  // FULL(2) → DIM(1) → OFF(0) → FULL(2)
  _auroraLevel = _auroraLevel === 2 ? 1 : _auroraLevel === 1 ? 0 : 2;
  try { localStorage.setItem(AURORA_STORAGE_KEY, String(_auroraLevel)); } catch { /* noop */ }
  _auroraListeners.forEach(fn => fn(_auroraLevel));
}

export function useAuroraLevel() {
  const [level, setLevel] = useState(_auroraLevel);
  useEffect(() => {
    _auroraListeners.add(setLevel);
    return () => { _auroraListeners.delete(setLevel); };
  }, []);
  return level;
}

/**
 * Drives school-themed CSS variables on <html>.
 *
 * Reads the ambient player's current school via a direct service subscription
 * so atmosphere updates are completely decoupled from the React render tree
 * except when we explicitly want them to trigger.
 */
export function useAtmosphere() {
  const { currentSong } = useCurrentSong();
  const location = useLocation();
  const [ambientState, setAmbientState] = useState({ schoolId: null, isActive: false });
  const [auroraLevelState, setAuroraLevelState] = useState(_auroraLevel);
  const prevSchoolRef = useRef(null);

  // Subscribe to aurora level changes so CSS var re-applies on cycle.
  useEffect(() => {
    _auroraListeners.add(setAuroraLevelState);
    return () => { _auroraListeners.delete(setAuroraLevelState); };
  }, []);

  // Subscribe directly to the service singleton for state changes.
  useEffect(() => {
    const service = getAmbientPlayerService();
    const unsubscribe = service.subscribe((state) => {
      const isActive =
        state.status === AMBIENT_PLAYER_STATES.PLAYING ||
        state.status === AMBIENT_PLAYER_STATES.TUNING;
      
      setAmbientState(prev => {
        if (prev.schoolId === state.schoolId && prev.isActive === isActive) {
          return prev;
        }
        return { schoolId: state.schoolId, isActive };
      });

      document.documentElement.style.setProperty(
        "--is-music-active",
        isActive ? "1" : "0"
      );
    });
    return unsubscribe;
  }, []);

  // Persistent audio control: Pause ambient player when on the Watch page.
  useEffect(() => {
    const isWatchPage = location.pathname === "/watch" || location.pathname === "/";
    if (isWatchPage) {
      const service = getAmbientPlayerService();
      // Only pause if it's currently active to avoid redundant state updates.
      if (service.getState().status !== AMBIENT_PLAYER_STATES.PAUSED && 
          service.getState().status !== AMBIENT_PLAYER_STATES.IDLE) {
        void service.pause();
      }
    }
  }, [location.pathname]);

  // Drive global signal level CSS variable at 60fps for "modulation".
  useEffect(() => {
    const service = getAmbientPlayerService();
    let rafId;

    const tick = () => {
      const level = service.getSignalLevel() || 0;
      // We update the CSS variable directly on the root for maximum performance
      // and to allow any component to tap into the audio pulse.
      document.documentElement.style.setProperty("--active-signal-level", level.toFixed(3));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Apply school-specific CSS variables when the song, ambient school, or detected sonic energy changes.
  const [detectedId, setDetectedId] = useState(null);

  useEffect(() => {
    if (!ambientState.isActive) {
      setDetectedId(null);
      return;
    }

    const service = getAmbientPlayerService();
    let rafId;

    const poll = async () => {
      const id = await service.getDetectedSchoolId?.();
      if (id !== detectedId) setDetectedId(id);
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [ambientState.isActive, detectedId]);

  useEffect(() => {
    const { schoolId: ambientSchoolId, isActive } = ambientState;

    // Priority: Detected School (Sonic Energy) > Active ambient station > Active song (Watch) > Last selected ambient > Default
    const activeSchoolId = detectedId
      || (isActive && ambientSchoolId)
      || currentSong?.school
      || ambientSchoolId
      || "SONIC";

    const school = SCHOOLS[activeSchoolId];
    if (!school) return;
    prevSchoolRef.current = school.id;

    const root = document.documentElement;
    const { h, s: baseS, l: baseL } = school.colorHsl;
    const atmo = school.atmosphere;

    // Bytecode Resonance Model: high energy for active tracks
    const saturation = isActive ? Math.min(100, baseS + 15) : baseS;
    const lightness = isActive ? Math.min(90, baseL + 5) : baseL;
    const glowAlpha = isActive ? 0.6 : 0.35;

    root.style.setProperty("--active-school-color", generateSchoolColor(school.id));
    root.style.setProperty("--active-school-h", String(h));
    root.style.setProperty("--active-school-s", `${saturation}%`);
    root.style.setProperty("--active-school-l", `${lightness}%`);
    root.style.setProperty("--active-school-glow", `hsla(${h}, ${saturation}%, ${lightness}%, ${glowAlpha})`);
    root.style.setProperty("--active-aurora-intensity", String(atmo.auroraIntensity * AURORA_FACTORS[_auroraLevel]));
    root.style.setProperty("--active-saturation", `${atmo.saturation}%`);
    root.style.setProperty("--active-vignette-strength", String(atmo.vignetteStrength));
    root.style.setProperty("--active-scanline-opacity", String(atmo.scanlineOpacity));
  }, [currentSong?.school, ambientState, auroraLevelState, detectedId]);
}
