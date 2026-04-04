/**
 * Abstract base class for all persistence adapters.
 * This allows swapping between localStorage, IndexedDB, and server-side persistence.
 *
 * All errors use PB-ERR-v1 bytecode for AI-parsable diagnostics.
 *
 * @see AI_Architecture_V2.md section 4 and 5.2
 */
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
} from '../../core/pixelbrain/bytecode-error.js';

const MOD = MODULE_IDS.SHARED;

export class PersistenceAdapter {
  /**
   * Get a single item by its ID.
   * @param {string} id The ID of the item to retrieve.
   * @returns {Promise<Object|null>} The retrieved item or null.
   */
  async get(_id) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'PersistenceAdapter.get() must be implemented by subclasses' },
    );
  }

  /**
   * Get all items.
   * @returns {Promise<Object[]>} An array of all items.
   */
  async getAll() {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'PersistenceAdapter.getAll() must be implemented by subclasses' },
    );
  }

  /**
   * Save an item.
   * @param {Object} item The item to save. It should have an `id` property.
   * @returns {Promise<Object>} The saved item.
   */
  async save(_item) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'PersistenceAdapter.save() must be implemented by subclasses' },
    );
  }

  /**
   * Delete an item by its ID.
   * @param {string} id The ID of the item to delete.
   * @returns {Promise<void>}
   */
  async delete(_id) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'PersistenceAdapter.delete() must be implemented by subclasses' },
    );
  }
}
