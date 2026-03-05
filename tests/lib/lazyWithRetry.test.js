import { describe, it, expect, vi, beforeEach } from "vitest";
import { isLikelyDynamicImportFailure, loadModuleWithRetry } from "../../src/lib/lazyWithRetry.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

describe("lazyWithRetry helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("detects common dynamic import failure messages", () => {
    expect(isLikelyDynamicImportFailure(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isLikelyDynamicImportFailure(new Error("Importing a module script failed"))).toBe(true);
    expect(isLikelyDynamicImportFailure({ name: "ChunkLoadError", message: "Loading chunk 1 failed." })).toBe(true);
    expect(isLikelyDynamicImportFailure(new Error("Regular API failure"))).toBe(false);
  });

  it("reloads once for a chunk failure, then throws on repeat", async () => {
    const reloadSpy = vi.fn();
    const storage = createStorage();
    const error = new Error("Failed to fetch dynamically imported module");

    void loadModuleWithRetry(async () => {
      throw error;
    }, "watch-page", { sessionStorage: storage, reload: reloadSpy });

    await Promise.resolve();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(storage.getItem("scholomance:lazy-reload:watch-page")).toBe("1");

    await expect(loadModuleWithRetry(async () => {
      throw error;
    }, "watch-page", { sessionStorage: storage, reload: reloadSpy })).rejects.toBe(error);
  });

  it("clears retry marker after a successful module load", async () => {
    const storage = createStorage();
    storage.setItem("scholomance:lazy-reload:watch-page", "1");

    const mod = await loadModuleWithRetry(
      async () => ({ default: () => null }),
      "watch-page",
      { sessionStorage: storage, reload: vi.fn() }
    );

    expect(typeof mod.default).toBe("function");
    expect(storage.getItem("scholomance:lazy-reload:watch-page")).toBeNull();
  });
});
