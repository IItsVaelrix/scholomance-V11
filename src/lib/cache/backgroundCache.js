/**
 * Background Cache - IndexedDB storage for pre-rendered canvas data
 * 
 * Stores static background renders to eliminate LCP delay on subsequent visits.
 * Uses IndexedDB because canvas data URLs can be large (localStorage has 5MB limit).
 */

const DB_NAME = 'scholomance-background-cache';
const DB_VERSION = 1;
const STORE_NAME = 'renders';
const CACHE_KEY = 'alchemical-lab-static';

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get cached canvas data URL
 * @returns {Promise<string|null>} Data URL or null if not cached
 */
export async function getCachedBackground() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

/**
 * Cache canvas data URL
 * @param {string} dataURL - Canvas data URL to cache
 * @returns {Promise<void>}
 */
export async function cacheBackground(dataURL) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataURL, CACHE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Failed to cache background:', error);
  }
}

/**
 * Clear cached background
 * @returns {Promise<void>}
 */
export async function clearCachedBackground() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Failed to clear cached background:', error);
  }
}

/**
 * Check if cache exists
 * @returns {Promise<boolean>}
 */
export async function hasCachedBackground() {
  const cached = await getCachedBackground();
  return cached !== null;
}
