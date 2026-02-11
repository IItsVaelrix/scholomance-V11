/**
 * Abstract base class for all transport adapters.
 * This allows swapping between HTTP (fetch) and WebSockets.
 *
 * @see AI_Architecture_V2.md section 5.2
 */
export class TransportAdapter {
  /**
   * Make a GET request.
   * @param {string} path The request path.
   * @param {Object} [options] Request options (e.g., headers).
   * @returns {Promise<any>} The response data.
   */
  async get(_path, _options) {
    throw new Error("TransportAdapter.get() must be implemented by subclasses.");
  }

  /**
   * Make a POST request.
   * @param {string} path The request path.
   * @param {any} body The request body.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async post(_path, _body, _options) {
    throw new Error("TransportAdapter.post() must be implemented by subclasses.");
  }

  /**
   * Make a PUT request.
   * @param {string} path The request path.
   * @param {any} body The request body.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async put(_path, _body, _options) {
    throw new Error("TransportAdapter.put() must be implemented by subclasses.");
  }

  /**
   * Make a DELETE request.
   * @param {string} path The request path.
   * @param {Object} [options] Request options.
   * @returns {Promise<any>} The response data.
   */
  async delete(_path, _options) {
    throw new Error("TransportAdapter.delete() must be implemented by subclasses.");
  }
}
