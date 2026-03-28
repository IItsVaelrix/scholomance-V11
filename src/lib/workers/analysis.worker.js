import { DeepRhymeEngine } from "../deepRhyme.engine.js";
import { PhonemeEngine } from "../phonology/phoneme.engine.js";

const engine = new DeepRhymeEngine(PhonemeEngine);
const workerReadyPromise = Promise.resolve(PhonemeEngine.ensureInitialized()).catch(() => null);

self.onmessage = async (event) => {
  const { id, text, options, type } = event.data;

  try {
    await workerReadyPromise;
    if (type === "warmup") {
      self.postMessage({ id, result: true });
      return;
    }

    const result = await engine.analyzeDocument(text, options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
