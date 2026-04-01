import { verseIRMicroprocessors } from './factory.js';

/**
 * LAZY MICROPROCESSOR REGISTRY
 * 
 * Maps IDs to dynamic import functions.
 * Prevents loading NLU dependencies when only Pixel work is needed (and vice-versa).
 */

// --- NLU Microprocessors (Lazy) ---
verseIRMicroprocessors.register('nlu.classifyIntent', async (payload, context) => {
  const { classifyIntent } = await import('./nlu/intent-classifier.js');
  return classifyIntent(payload, context);
});

verseIRMicroprocessors.register('nlu.extractEntities', async (payload, context) => {
  const { extractEntities } = await import('./nlu/entity-extractor.js');
  return extractEntities(payload, context);
});

verseIRMicroprocessors.register('nlu.mapSemantics', async (payload, context) => {
  const { mapEntitiesToSemanticParameters } = await import('./nlu/semantic-mapper.js');
  return mapEntitiesToSemanticParameters(payload, context);
});

verseIRMicroprocessors.register('nlu.generateVerse', async (payload, context) => {
  const { generateVerse } = await import('./nlu/verse-generator.js');
  return generateVerse(payload, context);
});

// --- Pixel Microprocessors (Lazy) ---
verseIRMicroprocessors.register('pixel.decode', async (payload, context) => {
  const { decodeBitStream } = await import('./pixel/BitStreamProcessor.js');
  return decodeBitStream(payload, context);
});

verseIRMicroprocessors.register('pixel.resample', async (payload, context) => {
  const { resampleSubstrate } = await import('./pixel/SubstrateResampler.js');
  return resampleSubstrate(payload, context);
});

verseIRMicroprocessors.register('pixel.trace', async (payload, context) => {
  const { traceLattice } = await import('./pixel/LatticeTracer.js');
  return traceLattice(payload, context);
});

verseIRMicroprocessors.register('pixel.quantize', async (payload, context) => {
  const { quantizeChroma } = await import('./pixel/ChromaQuantizer.js');
  return quantizeChroma(payload, context);
});

verseIRMicroprocessors.register('pixel.transmute', async (payload, context) => {
  const { transmuteAIArt } = await import('./pixel/Transmuter.js');
  return transmuteAIArt(payload, context);
});

// --- Symmetry AMP Microprocessors ---
verseIRMicroprocessors.register('amp.symmetry', async (payload, context) => {
  const { runSymmetryAmpProcessor } = await import('../pixelbrain/symmetry-amp.js');
  return runSymmetryAmpProcessor(payload, context);
});

verseIRMicroprocessors.register('amp.coord-symmetry', async (payload, context) => {
  const { runCoordSymmetryAmp } = await import('../pixelbrain/coord-symmetry-amp.js');
  return runCoordSymmetryAmp(payload, context);
});

export { verseIRMicroprocessors };
