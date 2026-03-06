/**
 * 24-hour per-device word cache.
 * Cache key encodes device ID + today's date so old keys self-prune on app load.
 */
import { Storage } from "./storage.js";

const DEVICE_ID_KEY = "scholomance_device_id";
const CACHE_PREFIX = "scholomance_wc_v1_";

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(36);
}

export function getDeviceId() {
  let id = Storage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    Storage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getDayToken() {
  const deviceId = getDeviceId();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return djb2(deviceId + today);
}

function getCacheKey() {
  return CACHE_PREFIX + getDayToken();
}

function getBucket() {
  const raw = Storage.getItem(getCacheKey());
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveBucket(bucket) {
  try {
    Storage.setItem(getCacheKey(), JSON.stringify(bucket));
  } catch {
    // Storage quota exceeded — silently skip caching
  }
}

export function getCachedWord(word) {
  if (!word) return null;
  const normalized = String(word).toLowerCase().trim();
  const bucket = getBucket();
  return bucket[normalized] ?? null;
}

export function setCachedWord(word, data) {
  if (!word || !data) return;
  const normalized = String(word).toLowerCase().trim();
  const bucket = getBucket();
  bucket[normalized] = data;
  saveBucket(bucket);
}

export function pruneOldCaches() {
  const currentKey = getCacheKey();
  const toRemove = [];
  for (let i = 0; i < Storage.length; i++) {
    const k = Storage.key(i);
    if (k && k.startsWith(CACHE_PREFIX) && k !== currentKey) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) {
    Storage.removeItem(k);
  }
}
