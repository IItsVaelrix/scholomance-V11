/**
 * Centralized storage abstraction to avoid direct localStorage coupling.
 * Complies with security policy for data persistence.
 */

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const storage = getStorage();

export const Storage = {
  /**
   * Get an item from storage.
   * @param {string} key
   * @returns {string|null}
   */
  getItem(key) {
    if (!storage) return null;
    return storage.getItem(key);
  },

  /**
   * Set an item in storage.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      console.error("Storage setItem failed", e);
      return false;
    }
  },

  /**
   * Remove an item from storage.
   * @param {string} key
   */
  removeItem(key) {
    if (!storage) return;
    storage.removeItem(key);
  },

  /**
   * Clear all items from storage.
   */
  clear() {
    if (!storage) return;
    storage.clear();
  },

  /**
   * Get key by index.
   * @param {number} index
   * @returns {string|null}
   */
  key(index) {
    if (!storage) return null;
    return storage.key(index);
  },

  /**
   * Number of items in storage.
   */
  get length() {
    if (!storage) return 0;
    return storage.length;
  }
};
