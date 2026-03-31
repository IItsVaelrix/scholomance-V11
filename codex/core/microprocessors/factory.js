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
     * @param {string} id - The microprocessor ID
     * @param {any} payload - The input data
     * @param {Object} context - Additional configuration or context
     * @returns {any} The processed output
     */
    execute(id, payload, context = {}) {
      const processor = registry.get(id);
      if (!processor) {
        throw new Error(`Microprocessor [${id}] not found in registry.`);
      }
      return processor(payload, context);
    },

    /**
     * Execute a sequence of microprocessors, passing the output of one as the payload to the next
     * @param {string[]} sequence - Array of microprocessor IDs
     * @param {any} initialPayload - Starting input data
     * @param {Object} context - Shared context across the pipeline
     * @returns {any} The final processed output
     */
    executePipeline(sequence, initialPayload, context = {}) {
      if (!Array.isArray(sequence)) return initialPayload;
      
      return sequence.reduce((currentPayload, id) => {
        return this.execute(id, currentPayload, context);
      }, initialPayload);
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
