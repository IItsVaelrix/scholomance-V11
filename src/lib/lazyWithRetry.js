import { lazy } from "react";

const DEFAULT_RELOAD_KEY_PREFIX = "scholomance:lazy-reload:";

/**
 * Detect dynamic import/chunk load failures that usually happen during deploy rollovers.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isLikelyDynamicImportFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  return (
    name === "chunkloaderror" ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("dynamically imported module")
  );
}

/**
 * Attempts a single hard reload when a lazy import fails due to stale chunk references.
 * @template T
 * @param {() => Promise<T>} importer
 * @param {string} moduleId
 * @param {{ sessionStorage?: Storage|null, reload?: (() => void)|null }} [options]
 * @returns {Promise<T>}
 */
export async function loadModuleWithRetry(importer, moduleId, options = {}) {
  const storage = options.sessionStorage ?? (
    typeof window !== "undefined" && window.sessionStorage
      ? window.sessionStorage
      : null
  );
  const reload = options.reload ?? (
    typeof window !== "undefined" && typeof window.location?.reload === "function"
      ? () => window.location.reload()
      : null
  );

  try {
    const loaded = await importer();
    storage?.removeItem(`${DEFAULT_RELOAD_KEY_PREFIX}${moduleId}`);
    return loaded;
  } catch (error) {
    if (isLikelyDynamicImportFailure(error)) {
      const reloadKey = `${DEFAULT_RELOAD_KEY_PREFIX}${moduleId}`;
      const alreadyRetried = storage?.getItem(reloadKey) === "1";
      if (!alreadyRetried) {
        storage?.setItem(reloadKey, "1");
        if (typeof reload === "function") {
          reload();
        }
        // Keep Suspense pending while the browser navigates.
        return new Promise(() => {});
      }
    }
    throw error;
  }
}

/**
 * React.lazy wrapper that auto-recovers from stale chunk references once.
 * @template T
 * @param {() => Promise<T>} importer
 * @param {string} moduleId
 * @returns {import("react").LazyExoticComponent<import("react").ComponentType<any>> & { preload: () => Promise<T> }}
 */
export function lazyWithRetry(importer, moduleId) {
  const load = () => loadModuleWithRetry(importer, moduleId);
  const component = lazy(load);
  component.preload = load;
  return component;
}
