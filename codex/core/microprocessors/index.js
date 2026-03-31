import { verseIRMicroprocessors } from './factory.js';
import { classifyIntent } from './nlu/intent-classifier.js';
import { extractEntities } from './nlu/entity-extractor.js';
import { generateVerse } from './nlu/verse-generator.js';
import { mapEntitiesToSemanticParameters } from './nlu/semantic-mapper.js';

// Pixel Microprocessors
import { decodeBitStream } from './pixel/BitStreamProcessor.js';
import { resampleSubstrate } from './pixel/SubstrateResampler.js';
import { traceLattice } from './pixel/LatticeTracer.js';
import { quantizeChroma } from './pixel/ChromaQuantizer.js';

// Register NLU Microprocessors
verseIRMicroprocessors.register('nlu.classifyIntent', classifyIntent);
verseIRMicroprocessors.register('nlu.extractEntities', extractEntities);
verseIRMicroprocessors.register('nlu.mapSemantics', mapEntitiesToSemanticParameters);
verseIRMicroprocessors.register('nlu.generateVerse', generateVerse);

// Register Pixel Microprocessors
verseIRMicroprocessors.register('pixel.decode', decodeBitStream);
verseIRMicroprocessors.register('pixel.resample', resampleSubstrate);
verseIRMicroprocessors.register('pixel.trace', traceLattice);
verseIRMicroprocessors.register('pixel.quantize', quantizeChroma);

export { verseIRMicroprocessors };