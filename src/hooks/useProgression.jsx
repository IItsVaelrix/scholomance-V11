// src/hooks/useProgression.jsx

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { z } from "zod";
import { SCHOOLS, getSchoolsByUnlock } from "../data/schools";
import { getLevelFromXp, getLevelProgress, getTierForLevel } from "../lib/progressionUtils";
import { MASTERY_LEVELS } from "../../codex/core/nexus.registry";

const ProgressionContext = createContext(null);

const defaultProgression = {
  xp: 0,
  unlockedSchools: ["SONIC"],
  lastUpdated: Date.now(),
  achievements: [],
  discoveryHistory: [],
  nexus: {
    discoveredWords: {},
    activeSynergies: []
  }
};

const ProgressionPayloadSchema = z.object({
  xp: z.number().optional(),
  unlockedSchools: z.array(z.string()).optional(),
  lastUpdated: z.number().optional(),
  achievements: z.array(z.string()).optional(),
  discoveryHistory: z.array(z.string()).optional(),
  nexus: z.object({
    discoveredWords: z.record(z.object({
      word: z.string(),
      level: z.number(),
      exp: z.number(),
      unlockedSynergies: z.array(z.string()),
      stats: z.object({
        count: z.number(),
        schools: z.array(z.string()),
        maxScore: z.number()
      })
    })).optional(),
    activeSynergies: z.array(z.string()).optional()
  }).optional()
}).passthrough();

const CSRF_HEADER = "x-csrf-token";
let cachedCsrfToken = null;
let csrfPromise = null;

function getApiUrl(path) {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : (import.meta.env.VITE_API_BASE_URL || "http://localhost");
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = fetch(getApiUrl('/auth/csrf-token'), { credentials: 'include' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      cachedCsrfToken = data?.token || null;
      return cachedCsrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

// --- Debounce Utility ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Provides progression state and actions to its children.
 * @param {{children: import("react").ReactNode}} props
 */
export function ProgressionProvider({ children, authReady = true, isAuthenticated = true }) {
  const [progression, setProgression] = useState(defaultProgression);
  const [isLoading, setIsLoading] = useState(true);
  const canPersistRef = useRef(false);

  // Debounced function to save progression to the server
  const debouncedSave = useRef(debounce(async (newProgression) => {
    if (!canPersistRef.current) {
      return;
    }
    try {
      const csrfToken = await getCsrfToken();
      if (!csrfToken) {
        throw new Error("Missing CSRF token");
      }
      const response = await fetch(getApiUrl('/api/progression'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER]: csrfToken,
        },
        body: JSON.stringify({
          xp: newProgression.xp,
          unlockedSchools: newProgression.unlockedSchools
        }),
      });
      if (response.status === 401 || response.status === 403) {
        canPersistRef.current = false;
      }
    } catch (error) {
      console.error("Failed to save progression:", error);
    }
  }, 1000)).current;

  // Fetch progression whenever auth transitions to an authenticated session.
  useEffect(() => {
    if (!authReady) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated) {
      canPersistRef.current = false;
      cachedCsrfToken = null;
      csrfPromise = null;
      setProgression({
        ...defaultProgression,
        lastUpdated: Date.now(),
      });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchProgression = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(getApiUrl('/api/progression'), { credentials: 'include' });
        if (cancelled) return;
        if (response.ok) {
          canPersistRef.current = true;
          const data = await response.json();
          const parsed = ProgressionPayloadSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error("Invalid progression payload");
          }
          // The server only stores xp and unlockedSchools, so we merge it
          // with the default structure to ensure all fields are present.
          // Ensure unlockedSchools always includes SONIC as the base school.
          const serverData = { ...parsed.data };
          if (!serverData.unlockedSchools?.length) {
            serverData.unlockedSchools = defaultProgression.unlockedSchools;
          }
          setProgression((prev) => ({
            ...prev,
            ...serverData,
          }));
        } else if (response.status === 401 || response.status === 403) {
          canPersistRef.current = false;
          setProgression({
            ...defaultProgression,
            lastUpdated: Date.now(),
          });
        } else {
          canPersistRef.current = false;
          console.error("Failed to fetch progression:", response.status, response.statusText);
        }
      } catch (error) {
        if (cancelled) return;
        canPersistRef.current = false;
        console.error("Error fetching progression:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchProgression();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);

  // Persist changes to the server
  useEffect(() => {
    // Don't save the initial default state before loading from server
    if (!isLoading && canPersistRef.current) {
      debouncedSave(progression);
    }
  }, [progression, isLoading, debouncedSave]);

  const addXP = useCallback((amount, source = "general", uniqueId = null) => {
    setProgression(prev => {
      if (uniqueId && prev.discoveryHistory.includes(uniqueId)) {
        return prev;
      }

      const newXP = prev.xp + amount;
      const prevLevel = getLevelFromXp(prev.xp);
      const newLevel = getLevelFromXp(newXP);
      
      const newDiscoveryHistory = uniqueId 
        ? [...prev.discoveryHistory, uniqueId]
        : prev.discoveryHistory;

      const schools = getSchoolsByUnlock();
      const newlyUnlocked = schools.filter(
        school => !prev.unlockedSchools.includes(school.id) && newXP >= school.unlockXP
      );
      const newUnlockedSchools = [...prev.unlockedSchools, ...newlyUnlocked.map(s => s.id)];

      const newAchievements = [...prev.achievements];
      
      if (newLevel > prevLevel) {
        emitXPEvent("level-up", { level: newLevel, tier: getTierForLevel(newLevel) });
      }

      newlyUnlocked.forEach(school => {
        newAchievements.push(`school-unlocked-${school.id.toLowerCase()}`);
        emitXPEvent("school-unlocked", { school });
      });

      return {
        ...prev,
        xp: newXP,
        unlockedSchools: newUnlockedSchools,
        lastUpdated: Date.now(),
        achievements: [...new Set(newAchievements)],
        discoveryHistory: newDiscoveryHistory
      };
    });

    if (amount > 0) {
      emitXPEvent("xp-gained", { amount, source });
    }
  }, []);

  const resetProgression = useCallback(async () => {
    const optimisticReset = {
      ...defaultProgression,
      lastUpdated: Date.now(),
    };
    setProgression(prev => ({
      ...prev,
      ...optimisticReset,
    }));
    if (!canPersistRef.current) {
      return;
    }
    try {
      const csrfToken = await getCsrfToken();
      if (!csrfToken) {
        throw new Error("Missing CSRF token");
      }
      const response = await fetch(getApiUrl('/api/progression'), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          [CSRF_HEADER]: csrfToken,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const parsed = ProgressionPayloadSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Invalid progression payload");
        }
        setProgression(prev => ({
          ...prev,
          ...parsed.data,
        }));
      } else {
        console.error("Failed to reset progression:", response.statusText);
      }
    } catch (error) {
      console.error("Error resetting progression:", error);
    }
  }, []);

  const checkUnlocked = useCallback((schoolId) => {
    return progression.unlockedSchools.includes(schoolId);
  }, [progression.unlockedSchools]);

  const getNextUnlock = useCallback(() => {
    const schools = getSchoolsByUnlock();
    for (const school of schools) {
      if (!progression.unlockedSchools.includes(school.id)) {
        return {
          school,
          xpNeeded: school.unlockXP - progression.xp,
        };
      }
    }
    return null;
  }, [progression.xp, progression.unlockedSchools]);

  const currentLevelInfo = useMemo(() => getLevelProgress(progression.xp), [progression.xp]);

  const recordWordUse = useCallback((word, profile) => {
    setProgression(prev => {
      const upperWord = word.toUpperCase();
      const currentNexus = prev.nexus || { discoveredWords: {}, activeSynergies: [] };
      const currentWordMastery = currentNexus.discoveredWords[upperWord] || {
        word: upperWord,
        level: 1,
        exp: 0,
        unlockedSynergies: [],
        stats: { count: 0, schools: [], maxScore: 0 }
      };

      // Import logic from nexus registry (in a real app, you might use a separate hook or helper)
      const xpGained = 10; // Placeholder for calculateWordMasteryXP logic
      const newExp = currentWordMastery.exp + xpGained;
      const nextLevel = MASTERY_LEVELS.find(l => l.expRequired > newExp)?.level || 5;
      const newLevel = nextLevel > currentWordMastery.level ? nextLevel - 1 : currentWordMastery.level;

      const newWordMastery = {
        ...currentWordMastery,
        exp: newExp,
        level: newLevel,
        stats: {
          count: currentWordMastery.stats.count + 1,
          schools: [...new Set([...currentWordMastery.stats.schools, profile.school])],
          maxScore: Math.max(currentWordMastery.stats.maxScore, profile.totalScore || 0)
        }
      };

      // Achievement for first discovery
      const newAchievements = [...prev.achievements];
      if (currentWordMastery.stats.count === 0) {
        newAchievements.push(`word-discovered-${upperWord.toLowerCase()}`);
        emitXPEvent("word-discovered", { word: upperWord });
      }

      return {
        ...prev,
        achievements: [...new Set(newAchievements)],
        nexus: {
          ...currentNexus,
          discoveredWords: {
            ...currentNexus.discoveredWords,
            [upperWord]: newWordMastery
          }
        }
      };
    });
  }, []);

  const value = useMemo(() => ({
    progression,
    addXP,
    recordWordUse,
    resetProgression,
    checkUnlocked,
    getNextUnlock,
    levelInfo: currentLevelInfo,
    availableSchools: progression.unlockedSchools,
    totalSchools: Object.keys(SCHOOLS).length,
    nexus: progression.nexus || { discoveredWords: {}, activeSynergies: [] }
  }), [
    progression,
    addXP,
    recordWordUse,
    resetProgression,
    checkUnlocked,
    getNextUnlock,
    currentLevelInfo
  ]);

  return (
    <ProgressionContext.Provider value={value}>
      {children}
    </ProgressionContext.Provider>
  );
}

/**
 * Hook to access the progression context.
 * @returns {ProgressionContextValue}
 */
export function useProgression() {
  const context = useContext(ProgressionContext);
  if (!context) {
    throw new Error("useProgression must be used within ProgressionProvider");
  }
  return context;
}

// Event emitter for progression events
const eventListeners = new Map();

export function emitXPEvent(event, data) {
  if (eventListeners.has(event)) {
    eventListeners.get(event).forEach(callback => callback(data));
  }
}

/**
 * Custom hook to subscribe to XP events with automatic cleanup.
 * This is the recommended way to listen for events in React components.
 * @param {string} event - The name of the event to listen for.
 * @param {function} callback - The function to execute when the event is emitted.
 */
export function useXPEventListener(event, callback) {
  useEffect(() => {
    // The callback is a dependency of the effect. 
    // If it's an inline function, it will cause the effect to re-run on every render.
    // Wrap callbacks in useCallback where performance is critical.
    const unsubscribe = onXPEvent(event, callback);
    return unsubscribe;
  }, [event, callback]);
}

/**
 * @deprecated Use useXPEventListener in React components to avoid memory leaks.
 * Low-level event registration.
 * Manually subscribe to a progression event.
 *
 * @param {string} event The event name.
 * @param {function} callback The callback to fire.
 * @returns {function} An unsubscribe function to clean up the listener.
 */
export function onXPEvent(event, callback) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, []);
  }
  eventListeners.get(event).push(callback);
  return () => {
    const listeners = eventListeners.get(event);
    if (!listeners) return;
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  };
}
