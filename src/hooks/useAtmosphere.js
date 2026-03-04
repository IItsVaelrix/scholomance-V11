import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentSong } from "./useCurrentSong.jsx";
import { SCHOOLS, generateSchoolColor } from "../data/schools.js";
import {
  AMBIENT_PLAYER_STATES,
  getAmbientPlayerService,
} from "../lib/ambient/ambientPlayer.service";

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
  const prevSchoolRef = useRef(null);

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

  // Apply school-specific CSS variables when the song OR ambient school changes.
  useEffect(() => {
    const { schoolId: ambientSchoolId, isActive } = ambientState;
    
    // Priority: Active ambient station > Active song (Watch) > Last selected ambient > Default
    const activeSchoolId = (isActive && ambientSchoolId) 
      || currentSong?.school 
      || ambientSchoolId 
      || "SONIC";

    const school = SCHOOLS[activeSchoolId];
    if (!school || school.id === prevSchoolRef.current) return;
    prevSchoolRef.current = school.id;

    const root = document.documentElement;
    const { h, s, l } = school.colorHsl;
    const atmo = school.atmosphere;

    root.style.setProperty("--active-school-color", generateSchoolColor(school.id));
    root.style.setProperty("--active-school-h", String(h));
    root.style.setProperty("--active-school-s", `${s}%`);
    root.style.setProperty("--active-school-l", `${l}%`);
    root.style.setProperty("--active-school-glow", `hsla(${h}, ${s}%, ${l}%, 0.4)`);
    root.style.setProperty("--active-aurora-intensity", String(atmo.auroraIntensity));
    root.style.setProperty("--active-saturation", `${atmo.saturation}%`);
    root.style.setProperty("--active-vignette-strength", String(atmo.vignetteStrength));
    root.style.setProperty("--active-scanline-opacity", String(atmo.scanlineOpacity));
  }, [currentSong?.school, ambientState]);
}
