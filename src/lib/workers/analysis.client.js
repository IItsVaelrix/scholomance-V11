let worker = null;
let nextId = 1;
const pendingRequests = new Map();
let warmupPromise = null;

function getWorker() {
  if (!worker && typeof window !== "undefined" && typeof Worker !== "undefined") {
    worker = new Worker(new URL("./analysis.worker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => {
      const { id, result, error } = event.data;
      const handlers = pendingRequests.get(id);
      if (handlers) {
        pendingRequests.delete(id);
        if (error) handlers.reject(new Error(error));
        else handlers.resolve(result);
      }
    };
  }
  return worker;
}

function postWorkerMessage(message) {
  const w = getWorker();
  if (!w) return null;

  const id = nextId++;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    w.postMessage({ id, ...message });
  });
}

export function warmAnalysisWorker() {
  if (warmupPromise) return warmupPromise;

  const request = postWorkerMessage({ type: "warmup" });
  warmupPromise = request
    ? request.catch(() => false)
    : Promise.resolve(false);
  return warmupPromise;
}

/**
 * Offload document analysis to a Web Worker.
 * @param {string} text 
 * @param {object} options 
 */
export async function analyzeDocumentAsync(text, options = {}) {
  const request = postWorkerMessage({ type: "analyze", text, options });
  if (!request) {
    // Fallback if workers not supported or on server
    const { DeepRhymeEngine } = await import("../deepRhyme.engine.js");
    const { PhonemeEngine } = await import("../phonology/phoneme.engine.js");
    const engine = new DeepRhymeEngine(PhonemeEngine);
    return engine.analyzeDocument(text, options);
  }

  return request;
}
