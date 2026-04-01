/**
 * VerseIR Microprocessor Factory
 * 
 * Central registry for atomic, stateless data transformation units.
 * Designed to slim down "fat" orchestrators (Amps) and provide
 * a clean path for WebWorker-compatible processing pipelines.
 */

export function createMicroprocessorFactory() {
  const registry = new Map();
  
  return {
    /**
     * Register a new microprocessor
     * @param {string} id - Unique identifier (e.g., 'nlu.classifyIntent')
     * @param {Function} processorFn - Stateless processing function
     */
    register(id, processorFn) {
      if (typeof processorFn !== 'function') {
        throw new Error(`Microprocessor [${id}] must be a function.`);
      }
      registry.set(id, processorFn);
    },

    /**
     * Execute a single microprocessor by ID
     * UNIFIED: Always returns a Promise to maintain consistent API across contexts.
     * 
     * @param {string} id - The microprocessor ID
     * @param {any} payload - The input data
     * @param {Object} context - Additional configuration or context
     * @returns {Promise<any>} The processed output
     */
    async execute(id, payload, context = {}) {
      const processor = registry.get(id);
      if (!processor) {
        throw new Error(`Microprocessor [${id}] not found in registry.`);
      }
      
      // Wrapping in try/await to ensure all processors are treated as async
      try {
        return await Promise.resolve(processor(payload, context));
      } catch (error) {
        throw new Error(`Microprocessor [${id}] failed: ${error.message}`);
      }
    },

    /**
     * Execute a sequence of microprocessors
     * UNIFIED: Always returns a Promise.
     * 
     * @param {string[]} sequence - Array of microprocessor IDs
     * @param {any} initialPayload - Starting input data
     * @param {Object} context - Shared context across the pipeline
     * @returns {Promise<any>} The final processed output
     */
    async executePipeline(sequence, initialPayload, context = {}) {
      if (!Array.isArray(sequence)) return initialPayload;
      
      let currentPayload = initialPayload;
      for (const id of sequence) {
        currentPayload = await this.execute(id, currentPayload, context);
      }
      return currentPayload;
    },
    
    /**
     * Check if a processor is registered
     */
    has(id) {
      return registry.has(id);
    },
    
    /**
     * List all registered processors
     */
    list() {
      return Array.from(registry.keys());
    }
  };
}

// Global instance for VerseIR architecture
export const verseIRMicroprocessors = createMicroprocessorFactory();
