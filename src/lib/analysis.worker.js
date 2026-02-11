import { DeepRhymeEngine } from "./deepRhyme.engine.js";
import { detectScheme, analyzeMeter } from "./rhymeScheme.detector.js";
import { analyzeLiteraryDevices, detectEmotion } from "./literaryDevices.detector.js";

/**
 * CODEx Analysis Worker
 * Offloads heavy linguistic analysis to a background thread.
 */

let deepEngine = null;

// The worker's message handler
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    // We could pass config or data here if needed
    deepEngine = new DeepRhymeEngine();
    self.postMessage({ type: 'READY' });
  }

  if (type === 'ANALYZE') {
    if (!deepEngine) {
      self.postMessage({ type: 'ERROR', error: 'Engine not initialized' });
      return;
    }

    const { text, analysisId } = payload;
    const perfStart = performance.now();

    try {
      // 1. Core Rhyme Analysis
      const result = deepEngine.analyzeDocument(text);

      // 2. Scheme Detection
      const scheme = detectScheme(result.schemePattern, result.rhymeGroups);

      // 3. Meter Analysis
      const meter = analyzeMeter(result.lines);

      // 4. Literary Devices
      const literary = analyzeLiteraryDevices(text);

      // 5. Emotion Detection
      const emotion = detectEmotion(text);

      const perfEnd = performance.now();

      self.postMessage({
        type: 'ANALYSIS_COMPLETE',
        payload: {
          analysisId,
          result,
          scheme,
          meter,
          literary,
          emotion,
          duration: perfEnd - perfStart
        }
      });
    } catch (error) {
      self.postMessage({ type: 'ERROR', payload: { analysisId, error: error.message } });
    }
  }
};
