/**
 * Abstract base class for all transport adapters.
 * This allows swapping between HTTP (fetch) and WebSockets.
 *
 * All errors use PB-ERR-v1 bytecode for AI-parsable diagnostics.
 *
 * @see AI_Architecture_V2.md section 5.2
 */
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
} from '../../core/pixelbrain/bytecode-error.js';

const MOD = MODULE_IDS.SHARED;

export class TransportAdapter {
  /**
   * Make a GET request.
   * @param {string} path The request path.
   * @param {Object} [options] Request options (e.g., headers).
   * @returns {Promise<any>} The response data.
   */
  async get(_path, _options) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'TransportAdapter.get() must be implemented by subclasses' },
    );
  }

  /**
   * Make a POST request.
   * @param {string} path The request path.
   * @param {any} body The request body.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async post(_path, _body, _options) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'TransportAdapter.post() must be implemented by subclasses' },
    );
  }

  /**
   * Make a PUT request.
   * @param {string} path The request path.
   * @param {any} body The request body.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async put(_path, _body, _options) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'TransportAdapter.put() must be implemented by subclasses' },
    );
  }

  /**
   * Make a DELETE request.
   * @param {string} path The request path.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async delete(_path, _options) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.LIFECYCLE_VIOLATION,
      { reason: 'TransportAdapter.delete() must be implemented by subclasses' },
    );
  }
}
