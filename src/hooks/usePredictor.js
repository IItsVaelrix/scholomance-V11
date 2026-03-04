import { useState, useCallback, useEffect, useRef } from 'react';
import { TriePredictor } from '../../codex/core/trie.js';
import { Spellchecker } from '../../codex/core/spellchecker.js';
import { judiciary } from '../../codex/core/judiciary.js';
import { PhonemeEngine } from '../lib/phoneme.engine.js';
import { PoeticLanguageServer } from '../lib/poeticLanguageServer.js';
import { ScholomanceDictionaryAPI } from '../lib/scholomanceDictionary.api.js';

/**
 * Enhanced Hook for managing robust predictive text, spellchecking,
 * and the Poetic Language Server (PLS).
 */
export function usePredictor() {
  const [model] = useState(() => new TriePredictor());
  const [spellchecker] = useState(() => new Spellchecker());
  const [isReady, setIsReady] = useState(false);
  const plsRef = useRef(null);

  // democracy layer
  const getDemocraticChoice = useCallback((suggestions) => {
    // Convert raw suggestions into vote candidates
    const candidates = suggestions.map(s => ({
      word: s.token || s,
      layer: s.reason === 'phonetic' ? 'PHONEME' :
             s.reason === 'edit' ? 'SPELLCHECK' : 'PREDICTOR',
      confidence: s.score ? s.score / 2 : 0.8 // Normalize confidence
    }));

    return judiciary.vote(candidates);
  }, []);

  useEffect(() => {
    async function loadCorpus() {
      try {
        // Skip fetch if we're in a test environment without a proper URL structure
        if (typeof window === 'undefined' || !window.location || !window.location.origin) return;

        const response = await fetch('/corpus.json');
        if (!response.ok) {
          console.warn("[Predictor] Failed to load corpus.json:", response.status);
          return;
        }

        const rawWords = await response.json();
        if (!Array.isArray(rawWords)) {
          console.error("[Predictor] corpus.json is not an array");
          return;
        }

        // Filter tokenization artifacts (single chars, numbers, split contractions)
        const words = rawWords.filter(w => typeof w === 'string' && w.length >= 2 && !/^\d+$/.test(w));

        // Train Trie and Spellchecker
        for (let i = 0; i < words.length - 1; i++) {
          model.insert(words[i], words[i + 1]);
        }
        if (words.length > 0) model.insert(words[words.length - 1]);

        spellchecker.init(words);

        // Initialize PLS with the PhonemeEngine and trained Trie
        await PhonemeEngine.ensureInitialized();
        
        // Pre-fetch authority data for the top corpus words to ensure high quality initial suggestions
        const uniqueWords = [...new Set(words)];
        // Limit to top 500 to avoid massive initial requests
        const authoritySample = uniqueWords.slice(0, 500);
        await PhonemeEngine.ensureAuthorityBatch(authoritySample);

        const pls = new PoeticLanguageServer({
          phonemeEngine: PhonemeEngine,
          trie: model,
          spellchecker,
          dictionaryAPI: ScholomanceDictionaryAPI.isEnabled() ? ScholomanceDictionaryAPI : null,
        });
        pls.buildIndex(words);
        plsRef.current = pls;

        setIsReady(true);
      } catch (err) {
        console.error("Failed to load ritual corpus:", err);
      }
    }
    loadCorpus();
  }, [model, spellchecker]);

  /**
   * Predicts words starting with prefix OR next word if prefix is empty but context exists.
   */
  const predict = useCallback((prefix, contextWord = null, limit = 5) => {
    if (!isReady) return [];

    // If we have a prefix (user currently typing), use Trie prefix lookup
    if (prefix && prefix.length > 0) {
      return model.predict(prefix, limit);
    }

    // If no prefix but we have a previous word, use Bigram prediction
    if (contextWord) {
      return model.predictNext(contextWord, limit);
    }

    return [];
  }, [isReady, model]);

  /**
   * PLS-powered completions with rhyme, meter, color, and ghost-line support.
   * @param {import('../lib/poeticLanguageServer.js').PLSContext} context
   * @param {object} [options]
   * @returns {Promise<import('../lib/poeticLanguageServer.js').ScoredCandidate[]>}
   */
  const getCompletions = useCallback(async (context, options) => {
    if (!isReady || !plsRef.current) return [];
    return plsRef.current.getCompletions(context, options);
  }, [isReady]);

  /**
   * Spellcheck a word
   */
  const checkSpelling = useCallback((word) => {
    if (!isReady) return true;
    return spellchecker.check(word);
  }, [isReady, spellchecker]);

  const getSpellingSuggestions = useCallback((word, prevWord = null, limit = 5) => {
    if (!isReady) return [];
    return spellchecker.suggest(word, limit, prevWord);
  }, [isReady, spellchecker]);

  return { predict, getCompletions, checkSpelling, getSpellingSuggestions, getDemocraticChoice, isReady };
}
