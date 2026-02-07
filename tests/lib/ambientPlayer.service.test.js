import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENT_PLAYER_STATES,
  AmbientPlayerService,
} from "../../src/lib/ambient/ambientPlayer.service";

function createMemoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    dump(key) {
      return store.get(key);
    },
  };
}

function createMockController(initialVolume = 0) {
  let volume = initialVolume;
  return {
    schoolId: null,
    getVolume: () => volume,
    setVolume: vi.fn((nextVolume) => {
      volume = nextVolume;
    }),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    destroy: vi.fn(() => {}),
  };
}

describe("AmbientPlayerService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("queues a school selected during tuning and resolves to the queued target", async () => {
    const controllerFactory = vi.fn(async ({ schoolId }) => {
      const controller = createMockController(0);
      controller.schoolId = schoolId;
      return controller;
    });

    const service = new AmbientPlayerService({
      controllerFactory,
      storage: createMemoryStorage(),
      tuningDurationMs: 50,
      fadeOutMs: 0,
      fadeInMs: 0,
      dialSfxPlayer: vi.fn(),
    });

    service.setPlayableSchools(["SONIC", "PSYCHIC", "VOID"]);
    await service.setSchool("SONIC");
    await service.setSchool("PSYCHIC");

    await vi.runAllTimersAsync();

    expect(controllerFactory).toHaveBeenCalledTimes(1);
    expect(controllerFactory).toHaveBeenLastCalledWith(
      expect.objectContaining({ schoolId: "PSYCHIC" })
    );
    expect(service.getState().schoolId).toBe("PSYCHIC");
    expect(service.getState().status).toBe(AMBIENT_PLAYER_STATES.PLAYING);
  });

  it("retunes the active school without reloading the track", async () => {
    const controllerFactory = vi.fn(async ({ schoolId }) => {
      const controller = createMockController(0);
      controller.schoolId = schoolId;
      return controller;
    });

    const service = new AmbientPlayerService({
      controllerFactory,
      storage: createMemoryStorage(),
      tuningDurationMs: 50,
      fadeOutMs: 0,
      fadeInMs: 0,
      dialSfxPlayer: vi.fn(),
    });

    service.setPlayableSchools(["SONIC"]);
    await service.setSchool("SONIC");
    await vi.runAllTimersAsync();

    await service.setSchool("SONIC");
    await vi.runAllTimersAsync();

    expect(controllerFactory).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe(AMBIENT_PLAYER_STATES.PLAYING);
  });

  it("loads and persists ambient settings", () => {
    const storage = createMemoryStorage({
      "scholomance.ambient.settings.v1": JSON.stringify({
        schoolId: "PSYCHIC",
        volume: 0.2,
        autoplayAmbient: true,
        cyclingEnabled: false,
      }),
    });

    const service = new AmbientPlayerService({
      storage,
      controllerFactory: vi.fn(async () => createMockController(0)),
      dialSfxPlayer: vi.fn(),
    });

    service.setPlayableSchools(["SONIC", "PSYCHIC"]);

    expect(service.getState().schoolId).toBe("PSYCHIC");
    expect(service.getState().volume).toBe(0.2);
    expect(service.getState().autoplayAmbient).toBe(true);
    expect(service.getState().cyclingEnabled).toBe(false);

    service.setVolume(0.77);
    service.setAutoplayAmbient(false);
    service.setCyclingEnabled(true);

    const persisted = JSON.parse(storage.dump("scholomance.ambient.settings.v1"));
    expect(persisted.schoolId).toBe("PSYCHIC");
    expect(persisted.volume).toBe(0.77);
    expect(persisted.autoplayAmbient).toBe(false);
    expect(persisted.cyclingEnabled).toBe(true);
  });
});