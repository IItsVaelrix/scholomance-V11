/**
 * PoeticLanguageServer (PLS)
 *
 * LSP-style orchestration layer that wires phonetic engines as competing
 * completion providers with a unified ranker. Pure JS — no React dependencies.
 *
 * Architecture:
 *   Cursor context → Generators (rhyme, prefix) produce candidates
 *                  → Scorers (meter, color) rank them
 *                  → Ranker merges weighted scores → ScoredCandidate[]
 */

import { RhymeIndex } from './pls/rhymeIndex.js';
import { rhymeProvider } from './pls/providers/rhymeProvider.js';
import { prefixProvider } from './pls/providers/prefixProvider.js';
import { meterProvider } from './pls/providers/meterProvider.js';
import { colorProvider } from './pls/providers/colorProvider.js';
import { rankCandidates, DEFAULT_WEIGHTS } from './pls/ranker.js';

/**
 * @typedef {object} PLSContext
 * @property {string} prefix - Current partial word being typed (may be "")
 * @property {string|null} prevWord - Completed word immediately before cursor
 * @property {string|null} prevLineEndWord - Last word of previous non-empty line
 * @property {string[]} currentLineWords - All completed words on current line
 * @property {number|null} targetSyllableCount - Expected syllable count for this line (optional)
 * @property {number[]} priorLineSyllableCounts - Syllable counts of prior lines (for meter inference)
 */

/**
 * @typedef {object} ScoredCandidate
 * @property {string} token - The word
 * @property {number} score - Final combined score (0-1)
 * @property {object} scores - Per-provider raw scores { rhyme, meter, color, prefix }
 * @property {string[]} badges - E.g., ["RHYME", "METER", "COLOR"]
 * @property {string} ghostLine - Completed line preview text
 */

export class PoeticLanguageServer {
  /**
   * @param {object} opts
   * @param {object} opts.phonemeEngine - PhonemeEngine instance
   * @param {object} opts.trie - TriePredictor instance
   * @param {object} [opts.spellchecker] - Spellchecker instance (optional)
   */
  constructor({ phonemeEngine, trie, spellchecker = null }) {
    this.phonemeEngine = phonemeEngine;
    this.trie = trie;
    this.spellchecker = spellchecker;
    this.rhymeIndex = new RhymeIndex();
    this.weights = { ...DEFAULT_WEIGHTS };
    this.ready = false;
  }

  /**
   * Build the rhyme candidate index from a word list.
   * Call once after corpus is loaded.
   * @param {string[]} wordList
   */
  buildIndex(wordList) {
    this.rhymeIndex.build(wordList, this.phonemeEngine);
    this.ready = true;
  }

  /**
   * Main entry point. Returns scored and ranked candidates.
   * @param {PLSContext} context
   * @param {object} [options]
   * @param {number} [options.limit=10]
   * @param {object} [options.weights] - Override provider weights
   * @returns {ScoredCandidate[]}
   */
  getCompletions(context, options = {}) {
    if (!this.ready) return [];

    const { limit = 10, weights } = options;
    const effectiveWeights = weights ? { ...this.weights, ...weights } : this.weights;

    const engines = {
      phonemeEngine: this.phonemeEngine,
      trie: this.trie,
      spellchecker: this.spellchecker,
      rhymeIndex: this.rhymeIndex,
    };

    // Phase 1: Generators produce candidate pools
    const generatorResults = {
      rhyme: rhymeProvider(context, engines),
      prefix: prefixProvider(context, engines),
    };

    // Phase 2: Collect all unique candidates for scorers
    const allCandidates = [];
    const seen = new Set();
    for (const results of Object.values(generatorResults)) {
      for (const r of results) {
        if (!seen.has(r.token)) {
          seen.add(r.token);
          allCandidates.push({ token: r.token, score: 0, scores: {}, badge: null });
        }
      }
    }

    // Phase 3: Scorers rank the combined candidate pool
    const scorerResults = {
      meter: meterProvider(context, engines, allCandidates),
      color: colorProvider(context, engines, allCandidates),
    };

    // Phase 4: Rank and return
    return rankCandidates(generatorResults, scorerResults, effectiveWeights, context, limit);
  }

  /** Get current provider weights. */
  getWeights() {
    return { ...this.weights };
  }

  /** Update weights at runtime. */
  setWeights(weights) {
    Object.assign(this.weights, weights);
  }
}
