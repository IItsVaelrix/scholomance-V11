let worker = null;
let nextId = 1;
const pendingRequests = new Map();

function getWorker() {
  if (!worker && typeof window !== "undefined") {
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

/**
 * Offload document analysis to a Web Worker.
 * @param {string} text 
 * @param {object} options 
 */
export async function analyzeDocumentAsync(text, options = {}) {
  const w = getWorker();
  if (!w) {
    // Fallback if workers not supported or on server
    const { DeepRhymeEngine } = await import("../deepRhyme.engine.js");
    const { PhonemeEngine } = await import("../phonology/phoneme.engine.js");
    const engine = new DeepRhymeEngine(PhonemeEngine);
    return engine.analyzeDocument(text, options);
  }

  const id = nextId++;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    w.postMessage({ id, text, options });
  });
}
