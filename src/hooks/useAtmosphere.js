import { useEffect, useRef } from "react";
import { useCurrentSong } from "./useCurrentSong.jsx";
import { useAmbientPlayer } from "./useAmbientPlayer.jsx";
import { useProgression } from "./useProgression.jsx";
import { SCHOOLS, generateSchoolColor } from "../data/schools.js";

export function useAtmosphere() {
  const { currentSong } = useCurrentSong();
  const { progression } = useProgression();
  const { currentSchoolId, isPlaying, isTuning } = useAmbientPlayer(progression.unlockedSchools);
  const prevSchoolRef = useRef(null);

  useEffect(() => {
    // Determine the active school ID.
    // If the ambient orb is playing or tuning, its school takes precedence.
    // Otherwise, fall back to the school associated with the currently selected song.
    const activeSchoolId = (isPlaying || isTuning) && currentSchoolId
      ? currentSchoolId
      : currentSong?.school;

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
  }, [currentSong?.school, currentSchoolId, isPlaying, isTuning]);
}
