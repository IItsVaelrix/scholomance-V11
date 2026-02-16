import { TriePredictor } from './trie.js';
import fs from 'fs';
import {
  RhymeKeyPredictor,
  defaultRhymeKeyPredictor,
  predictRhymeKey as predictRhymeKeyFromContext,
} from './rhyme/predictor.js';
import {
  RhymeLineGenerator,
  defaultRhymeLineGenerator,
  generateLine as generateRhymeLine,
} from './rhyme/generator.js';
import { scoreLine as scoreRhymeLine } from './rhyme/validator.js';

/**
 * Robust Predictive Text Engine
 */
export class PredictorEngine {
  constructor() {
    this.trie = new TriePredictor();
    this.isLoaded = false;
  }

  /**
   * Initializes the model from corpus data.
   * @param {string} corpusPath 
   */
  async init(corpusPath) {
    if (!fs.existsSync(corpusPath)) {
      throw new Error(`Corpus not found at ${corpusPath}`);
    }

    const words = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
    
    // Train the Trie with N-grams (Bigrams)
    for (let i = 0; i < words.length - 1; i++) {
      this.trie.insert(words[i], words[i + 1]);
    }
    // Last word
    if (words.length > 0) {
      this.trie.insert(words[words.length - 1]);
    }

    this.isLoaded = true;
  }

  /**
   * Predicts words based on a prefix.
   * API: predict(prefix: string): string[]
   * @param {string} prefix 
   * @param {number} limit 
   * @returns {string[]}
   */
  predict(prefix, limit = 5) {
    const startTime = Date.now();
    const results = this.trie.predict(prefix, limit);
    const latency = Date.now() - startTime;
    
    if (latency > 50) {
      console.warn(`[Predictor] Prediction latency exceeded 50ms: ${latency}ms`);
    }
    
    return results;
  }

  /**
   * Bigram prediction (next word)
   * @param {string} word 
   * @returns {string[]}
   */
  predictNext(word, limit = 5) {
    return this.trie.predictNext(word, limit);
  }
}

export const predictor = new PredictorEngine();

/**
 * Rhyme-planning wrapper so runtime callers can use a single entry point.
 */
export class RhymePredictorEngine {
  constructor() {
    this.predictor = new RhymeKeyPredictor();
    this.generator = new RhymeLineGenerator();
  }

  fit(pairs) {
    this.predictor.fit(pairs);
    this.generator.fit(pairs);
    return this;
  }

  predictRhymeKey(context, options = {}) {
    return this.predictor.predictRhymeKey(context, options);
  }

  generateLine(context, targetRhymeKey, styleVector = {}, options = {}) {
    return this.generator.generateLine(context, targetRhymeKey, styleVector, options);
  }

  scoreLine(line, targetRhymeKey, options = {}) {
    return scoreRhymeLine(line, targetRhymeKey, options);
  }
}

export const rhymePredictor = new RhymePredictorEngine();
export {
  RhymeKeyPredictor,
  defaultRhymeKeyPredictor,
  predictRhymeKeyFromContext as predictRhymeKey,
  RhymeLineGenerator,
  defaultRhymeLineGenerator,
  generateRhymeLine as generateLine,
  scoreRhymeLine as scoreLine,
};
