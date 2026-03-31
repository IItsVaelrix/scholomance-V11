/**
 * MICROPROCESSOR WORKER CLIENT
 * 
 * Orchestrates communication with the Microprocessor WebWorker.
 * Turns message-passing into clean Async/Await promises.
 */

class MicroprocessorWorkerClient {
  constructor() {
    this.worker = null;
    this.pendingTasks = new Map();
    this.nextTaskId = 1;
    this._initialized = false;
  }

  /**
   * Initialize the worker thread
   */
  init() {
    if (this._initialized) return;
    
    // Create worker using Vite's URL constructor pattern
    this.worker = new Worker(
      new URL('../workers/microprocessor.worker.js', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event) => {
      const { taskId, success, result, error } = event.data;
      const promise = this.pendingTasks.get(taskId);

      if (promise) {
        if (success) {
          promise.resolve(result);
        } else {
          promise.reject(new Error(error));
        }
        this.pendingTasks.delete(taskId);
      }
    };

    this._initialized = true;
  }

  /**
   * Execute a single microprocessor in the background
   */
  execute(id, payload, context = {}) {
    this.init();
    const taskId = this.nextTaskId++;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });
      this.worker.postMessage({
        type: 'EXECUTE',
        id,
        payload,
        context,
        taskId
      });
    });
  }

  /**
   * Execute a pipeline of microprocessors in the background
   */
  executePipeline(sequence, payload, context = {}) {
    this.init();
    const taskId = this.nextTaskId++;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });
      this.worker.postMessage({
        type: 'PIPELINE',
        sequence,
        payload,
        context,
        taskId
      });
    });
  }

  /**
   * Terminate the worker (rarely needed)
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this._initialized = false;
    }
  }
}

export const workerClient = new MicroprocessorWorkerClient();
