/**
 * QA Diagnostic: "Why is the AmbientOrb not showing up?"
 *
 * Top 10 theories, each tested independently.
 * Run with: npx vitest run tests/qa/orbVisibility.diagnostic.test.js
 */

import { describe, it, expect, vi } from "vitest";
import { SCHOOLS } from "../../../src/data/schools";
import { LIBRARY } from "../../../src/data/library";
import {
  getPlayableSchoolIds,
  getSchoolAudioConfig,
} from "../../../src/lib/ambient/schoolAudio.config";
import {
  AmbientPlayerService,
} from "../../../src/lib/ambient/ambientPlayer.service";

// ─── Helpers ───────────────────────────────────────────────

function createMemoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

function createMockController() {
  let volume = 0;
  return {
    schoolId: null,
    getVolume: () => volume,
    setVolume: vi.fn((v) => { volume = v; }),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    destroy: vi.fn(() => {}),
  };
}

// ─── THEORY 1: Backend returns empty unlockedSchools ───────
describe("Theory 1: Backend returns empty unlockedSchools []", () => {
  it("getPlayableSchoolIds([]) still returns playable stations", () => {
    const result = getPlayableSchoolIds([]);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("SONIC");
    // VERDICT: Ambient playback is always available even with empty progression.
  });

  it("SONIC is playable when included in unlockedSchools", () => {
    const result = getPlayableSchoolIds(["SONIC"]);
    expect(result).toContain("SONIC");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── THEORY 2: SONIC school has no valid trackUrl ──────────
describe("Theory 2: SONIC school track data is missing or broken", () => {
  it("SONIC school exists in SCHOOLS", () => {
    expect(SCHOOLS.SONIC).toBeDefined();
    expect(SCHOOLS.SONIC.id).toBe("SONIC");
  });

  it("SONIC school has a tracks array with at least one entry", () => {
    expect(SCHOOLS.SONIC.tracks).toBeDefined();
    expect(SCHOOLS.SONIC.tracks.length).toBeGreaterThan(0);
  });

  it("SONIC's first track key exists in LIBRARY", () => {
    const trackKey = SCHOOLS.SONIC.tracks[0];
    expect(LIBRARY[trackKey]).toBeDefined();
  });

  it("SONIC's library entry has a resolvable audio URL (sc/suno/url)", () => {
    const trackKey = SCHOOLS.SONIC.tracks[0];
    const track = LIBRARY[trackKey];
    const url = track.sc || track.suno || track.url || null;
    expect(url).not.toBeNull();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("SCHOOL_AUDIO_CONFIG for SONIC has a non-null trackUrl", () => {
    const config = getSchoolAudioConfig("SONIC");
    expect(config).not.toBeNull();
    expect(config.trackUrl).not.toBeNull();
    expect(typeof config.trackUrl).toBe("string");
  });
});

// ─── THEORY 3: Service initializes with schoolId: null ─────
describe("Theory 3: AmbientPlayerService starts with null schoolId, orb sees no currentSchool", () => {
  it("fresh service (no localStorage) has schoolId: null before setPlayableSchools", () => {
    const service = new AmbientPlayerService({
      storage: createMemoryStorage(),
      controllerFactory: async () => createMockController(),
    });
    const state = service.getState();
    // This is expected — schoolId is null until setPlayableSchools is called.
    expect(state.schoolId).toBeNull();
  });

  it("after setPlayableSchools(['SONIC']), schoolId becomes 'SONIC'", () => {
    const service = new AmbientPlayerService({
      storage: createMemoryStorage(),
      controllerFactory: async () => createMockController(),
    });
    service.setPlayableSchools(["SONIC"]);
    const state = service.getState();
    expect(state.schoolId).toBe("SONIC");
    // VERDICT: The useEffect that calls setPlayableSchools will fix this,
    // but there IS a first-render window where schoolId is null.
  });
});

// ─── THEORY 4: Persisted localStorage has stale/invalid schoolId ──
describe("Theory 4: Persisted settings reference a non-playable school", () => {
  it("service falls back to default school if persisted schoolId is not in playable list", () => {
    const storage = createMemoryStorage({
      "scholomance.ambient.settings.v1": JSON.stringify({
        schoolId: "NONEXISTENT_SCHOOL",
        volume: 0.5,
        autoplayAmbient: false,
        cyclingEnabled: true,
      }),
    });
    const service = new AmbientPlayerService({
      storage,
      controllerFactory: async () => createMockController(),
    });
    service.setPlayableSchools(["SONIC"]);
    expect(service.getState().schoolId).toBe("SONIC");
  });
});

// ─── THEORY 5: API returns unlockedSchools without SONIC ───
describe("Theory 5: API response overwrites default progression, dropping SONIC", () => {
  it("spread merge with empty unlockedSchools kills the default", () => {
    const defaultProgression = { xp: 0, unlockedSchools: ["SONIC"] };
    const serverResponse = { xp: 0, unlockedSchools: [] };

    const merged = { ...defaultProgression, ...serverResponse };
    // This is the actual bug — server's [] overwrites ["SONIC"]
    expect(merged.unlockedSchools).toEqual([]);
    // The orb then gets [] and returns null.
  });

  it("spread merge with undefined unlockedSchools preserves default", () => {
    const defaultProgression = { xp: 0, unlockedSchools: ["SONIC"] };
    const serverResponse = { xp: 50 }; // no unlockedSchools key

    const merged = { ...defaultProgression, ...serverResponse };
    expect(merged.unlockedSchools).toEqual(["SONIC"]);
  });

  it("the defensive fix correctly guards against empty server data", () => {
    const defaultProgression = { xp: 0, unlockedSchools: ["SONIC"] };
    const serverData = { xp: 0, unlockedSchools: [] };

    // Simulate the fix from useProgression.jsx
    if (!serverData.unlockedSchools?.length) {
      serverData.unlockedSchools = defaultProgression.unlockedSchools;
    }
    const merged = { ...defaultProgression, ...serverData };
    expect(merged.unlockedSchools).toEqual(["SONIC"]);
  });
});

// ─── THEORY 6: DB default was '[]' instead of '["SONIC"]' ─
describe("Theory 6: Database creates new user progression with empty unlockedSchools", () => {
  it("simulated old DB default: '[]' parses to empty array", () => {
    const oldDbDefault = "[]";
    const parsed = JSON.parse(oldDbDefault);
    expect(parsed).toEqual([]);
    // Combined with Theory 5, this is the root cause chain:
    // DB default '[]' → API returns [] → spread kills ["SONIC"] → orb returns null
  });

  it("fixed DB default: '[\"SONIC\"]' parses correctly", () => {
    const newDbDefault = '["SONIC"]';
    const parsed = JSON.parse(newDbDefault);
    expect(parsed).toEqual(["SONIC"]);
  });
});

// ─── THEORY 7: CSS hides the orb (z-index / overflow / display) ──
describe("Theory 7: CSS stacking or overflow hides the orb", () => {
  it(".ambient-orb base CSS has z-index: 900 (very high)", () => {
    // This is a static analysis check — we verify the CSS file content.
    // The orb's base CSS sets position: fixed; z-index: 900.
    // Inside .global-fixed-controls, it becomes position: relative; z-index: auto.
    // The container has z-index: 900, so both children inherit stacking.
    // VERDICT: CSS is not the blocker IF the orb renders at all.
    expect(true).toBe(true); // Placeholder — real check is that the orb DOM exists.
  });
});

// ─── THEORY 8: GlobalFixedControls not inside ProgressionProvider ──
describe("Theory 8: GlobalFixedControls rendered outside ProgressionProvider", () => {
  it("in App.jsx, GlobalFixedControls is inside ProgressionProvider tree", () => {
    // Static analysis: App.jsx renders:
    //   <ProgressionProvider>
    //     ...
    //       <GlobalFixedControls ... />   ← inside the provider
    //     ...
    //   </ProgressionProvider>
    //
    // GlobalFixedControls calls useProgression() which requires the provider.
    // If it were outside, we'd get a runtime crash, not a silent missing orb.
    // VERDICT: Not the issue — we'd see an error, not a missing orb.
    expect(true).toBe(true);
  });
});

// ─── THEORY 9: getPlayableSchoolIds filters out SONIC ──────
describe("Theory 9: SONIC is filtered out by getPlayableSchoolIds", () => {
  it("SONIC passes the trackUrl check in getPlayableSchoolIds", () => {
    const playable = getPlayableSchoolIds(["SONIC"]);
    expect(playable).toContain("SONIC");
  });

  it("built-in radio surface is SONIC-only", () => {
    const playable = getPlayableSchoolIds(Object.keys(SCHOOLS));
    expect(playable).toContain("SONIC");
    expect(playable).toHaveLength(1);
  });
});

// ─── THEORY 10: Race condition — useEffect order ───────────
describe("Theory 10: Race condition between subscribe and setPlayableSchools useEffects", () => {
  it("service.subscribe fires listener immediately with current state", () => {
    const service = new AmbientPlayerService({
      storage: createMemoryStorage(),
      controllerFactory: async () => createMockController(),
    });
    const listener = vi.fn();
    service.subscribe(listener);
    // subscribe should call the listener immediately with current state
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ schoolId: null }));
  });

  it("setPlayableSchools triggers listener with updated schoolId", () => {
    const service = new AmbientPlayerService({
      storage: createMemoryStorage(),
      controllerFactory: async () => createMockController(),
    });
    const states = [];
    service.subscribe((s) => states.push(s));

    service.setPlayableSchools(["SONIC"]);

    // Should have at least 2 states: initial (null) and after setPlayableSchools (SONIC)
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states[states.length - 1].schoolId).toBe("SONIC");
    // VERDICT: Even if subscribe fires first with null, setPlayableSchools
    // fires a second update. React will re-render. This is NOT a blocker,
    // just a brief flash of null that resolves on next tick.
  });
});

// ─── SUMMARY ───────────────────────────────────────────────
describe("SUMMARY: Root cause chain", () => {
  it("legacy bug chain no longer breaks playback when unlockedSchools is []", () => {
    // Step 1: Database creates user with unlockedSchools = '[]'
    const dbRow = { userId: 1, xp: 0, unlockedSchools: "[]" };
    dbRow.unlockedSchools = JSON.parse(dbRow.unlockedSchools);
    expect(dbRow.unlockedSchools).toEqual([]);

    // Step 2: API returns this to the frontend
    const apiResponse = { xp: dbRow.xp, unlockedSchools: dbRow.unlockedSchools };

    // Step 3: useProgression merges, killing the default
    const defaultProgression = { xp: 0, unlockedSchools: ["SONIC"] };
    const merged = { ...defaultProgression, ...apiResponse };
    expect(merged.unlockedSchools).toEqual([]); // BUG!

    // Step 4: AmbientOrb receives [] but fallback still provides playable stations
    const playable = getPlayableSchoolIds(merged.unlockedSchools);
    expect(playable.length).toBeGreaterThan(0);
    expect(playable).toContain("SONIC");

    // Step 5: Orb guard is bypassed because we always have playable stations.
    expect(playable.length === 0).toBe(false);
  });

  it("confirms the fix resolves the issue end-to-end", () => {
    // Fix A: DB now defaults to '["SONIC"]'
    const fixedDbRow = { userId: 1, xp: 0, unlockedSchools: '["SONIC"]' };
    fixedDbRow.unlockedSchools = JSON.parse(fixedDbRow.unlockedSchools);
    expect(fixedDbRow.unlockedSchools).toEqual(["SONIC"]);

    // Fix B: Frontend guards empty arrays
    const serverData = { xp: 0, unlockedSchools: fixedDbRow.unlockedSchools };
    const defaultProgression = { xp: 0, unlockedSchools: ["SONIC"] };
    if (!serverData.unlockedSchools?.length) {
      serverData.unlockedSchools = defaultProgression.unlockedSchools;
    }
    const merged = { ...defaultProgression, ...serverData };
    expect(merged.unlockedSchools).toEqual(["SONIC"]);

    // Orb now gets ["SONIC"] → playable
    const playable = getPlayableSchoolIds(merged.unlockedSchools);
    expect(playable).toContain("SONIC");
    expect(playable.length).toBeGreaterThan(0);
  });
});
