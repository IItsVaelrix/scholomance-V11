/**
 * Abstract base class for all persistence adapters.
 * This allows swapping between localStorage, IndexedDB, and server-side persistence.
 *
 * @see AI_Architecture_V2.md section 4 and 5.2
 */
export class PersistenceAdapter {
  /**
   * Get a single item by its ID.
   * @param {string} id The ID of the item to retrieve.
   * @returns {Promise<Object|null>} The retrieved item or null.
   */
  async get(_id) {
    throw new Error("PersistenceAdapter.get() must be implemented by subclasses.");
  }

  /**
   * Get all items.
   * @returns {Promise<Object[]>} An array of all items.
   */
  async getAll() {
    throw new Error("PersistenceAdapter.getAll() must be implemented by subclasses.");
  }

  /**
   * Save an item.
   * @param {Object} item The item to save. It should have an `id` property.
   * @returns {Promise<Object>} The saved item.
   */
  async save(_item) {
    throw new Error("PersistenceAdapter.save() must be implemented by subclasses.");
  }

  /**
   * Delete an item by its ID.
   * @param {string} id The ID of the item to delete.
   * @returns {Promise<void>}
   */
  async delete(_id) {
    throw new Error("PersistenceAdapter.delete() must be implemented by subclasses.");
  }
}
