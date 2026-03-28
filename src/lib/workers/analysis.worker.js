import { DeepRhymeEngine } from "../deepRhyme.engine.js";
import { PhonemeEngine } from "../phonology/phoneme.engine.js";

const engine = new DeepRhymeEngine(PhonemeEngine);

self.onmessage = async (event) => {
  const { id, text, options } = event.data;

  try {
    const result = await engine.analyzeDocument(text, options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
