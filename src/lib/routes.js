import { lazyWithRetry } from "./lazyWithRetry.js";

export const WatchPage = lazyWithRetry(() => import("../pages/Watch/WatchPage.jsx"), "watch-page");
export const ListenPage = lazyWithRetry(() => import("../pages/Listen/ListenPage"), "listen-page");
export const ReadPage = lazyWithRetry(() => import("../pages/Read/ReadPage.jsx"), "read-page");
export const AuthPage = lazyWithRetry(() => import("../pages/Auth/AuthPage.jsx"), "auth-page");
export const CollabPage = lazyWithRetry(() => import("../pages/Collab/CollabPage.jsx"), "collab-page");
export const ProfilePage = lazyWithRetry(() => import("../pages/Profile/ProfilePage.jsx"), "profile-page");
export const CombatPage = lazyWithRetry(() => import("../pages/Combat/CombatPage.jsx"), "combat-page");
export const NexusPage = lazyWithRetry(() => import("../pages/Nexus/NexusPage.jsx"), "nexus-page");

export const PAGE_COMPONENTS = {
  "/watch": WatchPage,
  "/listen": ListenPage,
  "/read": ReadPage,
  "/auth": AuthPage,
  "/collab": CollabPage,
  "/profile": ProfilePage,
  "/combat": CombatPage,
  "/nexus": NexusPage,
};

/**
 * Trigger pre-fetching of a page chunk.
 * @param {string} path 
 */
export function preloadRoute(path) {
  const component = PAGE_COMPONENTS[path];
  if (component && typeof component.preload === "function") {
    void component.preload();
  }
}
