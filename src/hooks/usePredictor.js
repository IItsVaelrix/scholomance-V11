import { useState, useCallback, useEffect, useRef } from 'react';
import { TriePredictor } from '../../codex/core/trie.js';
import { Spellchecker } from '../../codex/core/spellchecker.js';
import { createJudiciaryEngine } from '../../codex/core/judiciary.js';
import { PhonemeEngine } from '../lib/phonology/phoneme.engine.js';
import { PoeticLanguageServer } from '../lib/poeticLanguageServer.js';
import { ScholomanceDictionaryAPI } from '../lib/scholomanceDictionary.api.js';

const MIN_CORPUS_WORD_LENGTH = 2;

function normalizeCorpusWord(value) {
  const token = String(value || '').trim().toLowerCase();
  if (token.length < MIN_CORPUS_WORD_LENGTH) return '';
  if (/^\d+$/.test(token)) return '';
  return token;
}

function normalizeSequenceWeight(weight) {
  const parsed = Number(weight);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.trunc(parsed));
}

function normalizeSequenceEntry(entry) {
  let prevRaw = null;
  let nextRaw = null;
  let weightRaw = 1;

  if (Array.isArray(entry)) {
    [prevRaw, nextRaw] = entry;
    if (entry.length >= 3) weightRaw = entry[2];
  } else if (entry && typeof entry === 'object') {
    prevRaw = entry.prev ?? entry.from ?? null;
    nextRaw = entry.next ?? entry.to ?? null;
    weightRaw = entry.weight ?? entry.count ?? entry.frequency ?? 1;
  } else {
    return null;
  }

  const prev = normalizeCorpusWord(prevRaw);
  const next = normalizeCorpusWord(nextRaw);
  if (!prev || !next) return null;

  return {
    prev,
    next,
    weight: normalizeSequenceWeight(weightRaw),
  };
}

function normalizeCorpusPayload(rawPayload) {
  const dictionaryRaw = Array.isArray(rawPayload)
    ? rawPayload
    : (Array.isArray(rawPayload?.dictionary) ? rawPayload.dictionary : []);
  const sequencesRaw = Array.isArray(rawPayload?.sequences) ? rawPayload.sequences : [];

  const dictionary = [];
  dictionaryRaw.forEach((entry) => {
    const normalized = normalizeCorpusWord(entry);
    if (!normalized) return;
    dictionary.push(normalized);
  });

  const sequenceByPair = new Map();
  const addSequence = (prev, next, weight = 1) => {
    const key = `${prev}\u0000${next}`;
    const current = sequenceByPair.get(key) || 0;
    sequenceByPair.set(key, current + normalizeSequenceWeight(weight));
  };

  if (sequencesRaw.length > 0) {
    sequencesRaw.forEach((entry) => {
      const normalizedEntry = normalizeSequenceEntry(entry);
      if (!normalizedEntry) return;
      addSequence(normalizedEntry.prev, normalizedEntry.next, normalizedEntry.weight);
    });
  } else if (Array.isArray(rawPayload)) {
    // Legacy compatibility: when corpus.json is still a flat array, infer adjacent bigrams.
    for (let i = 0; i < rawPayload.length - 1; i++) {
      const prev = normalizeCorpusWord(rawPayload[i]);
      const next = normalizeCorpusWord(rawPayload[i + 1]);
      if (!prev || !next) continue;
      addSequence(prev, next, 1);
    }
  }

  const sequences = [...sequenceByPair.entries()].map(([pair, weight]) => {
    const [prev, next] = pair.split('\u0000');
    return { prev, next, weight };
  });

  return { dictionary, sequences };
}

/**
 * Enhanced Hook for managing robust predictive text, spellchecking,
 * and the Poetic Language Server (PLS).
 */
export function usePredictor() {
  const [model] = useState(() => new TriePredictor());
  const [spellchecker] = useState(() => new Spellchecker());
  const [judiciary] = useState(() => createJudiciaryEngine());
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
  }, [judiciary]);

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

        const payload = await response.json();
        const { dictionary: words, sequences } = normalizeCorpusPayload(payload);

        if (words.length === 0) {
          console.warn("[Predictor] corpus dictionary is empty");
          return;
        }

        // 1. Train Trie and Spellchecker (Vocabulary)
        for (const word of words) {
          model.insert(word);
        }
        spellchecker.init(words);

        // 2. Train Bigrams (Natural Sequences)
        for (const { prev, next, weight } of sequences) {
          model.insert(prev, next, weight);
          spellchecker.rememberSequence(prev, next, weight);
        }

        // Initialize PLS with the PhonemeEngine
        await PhonemeEngine.ensureInitialized();
        
        // Pre-fetch authority data for the top corpus words to ensure high quality initial suggestions
        const uniqueWords = [...new Set(words)];
        // Limit to top 500 to avoid massive initial requests
        const authoritySample = uniqueWords.slice(0, 500);
        await PhonemeEngine.ensureAuthorityBatch(authoritySample);

        const dictionaryAPI = ScholomanceDictionaryAPI.isEnabled() ? ScholomanceDictionaryAPI : null;
        spellchecker.configureAsync({
          validateWord: (dictionaryAPI && typeof dictionaryAPI.validateBatch === 'function')
            ? async (candidateWord) => {
              const valid = await dictionaryAPI.validateBatch([candidateWord]);
              const normalizedCandidate = String(candidateWord || '').toLowerCase();
              return Array.isArray(valid) && valid.some((word) => String(word || '').toLowerCase() === normalizedCandidate);
            }
            : null,
          suggestWords: (dictionaryAPI && typeof dictionaryAPI.suggest === 'function')
            ? async (prefix, limit) => dictionaryAPI.suggest(prefix, { limit })
            : null,
        });

        const pls = new PoeticLanguageServer({
          phonemeEngine: PhonemeEngine,
          trie: model,
          spellchecker,
          dictionaryAPI,
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
    const normalizedPrefix = String(prefix || '').toLowerCase();
    const normalizedContextWord = String(contextWord || '').toLowerCase();

    // If we have a prefix (user currently typing), use Trie prefix lookup
    if (normalizedPrefix.length > 0) {
      const queryLimit = Math.max(limit * 4, 20);
      const prefixMatches = model.predict(normalizedPrefix, queryLimit);
      const contextMatches = normalizedContextWord
        ? model.predictNext(normalizedContextWord, queryLimit).filter((token) => String(token || '').startsWith(normalizedPrefix))
        : [];

      if (contextMatches.length === 0) {
        return prefixMatches.slice(0, limit);
      }

      const scoreByToken = new Map();
      const applyScore = (token, score) => {
        const normalizedToken = String(token || '').toLowerCase();
        if (!normalizedToken) return;
        const current = scoreByToken.get(normalizedToken) || 0;
        if (score > current) scoreByToken.set(normalizedToken, score);
      };

      prefixMatches.forEach((token, index) => {
        applyScore(token, 1 - (index / Math.max(prefixMatches.length, 1)));
      });
      contextMatches.forEach((token, index) => {
        const normalizedToken = String(token || '').toLowerCase();
        const contextualScore = 1 - (index / Math.max(contextMatches.length, 1));
        const prefixScore = scoreByToken.get(normalizedToken) || 0;
        applyScore(token, (prefixScore * 0.58) + (contextualScore * 0.42));
      });

      return [...scoreByToken.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([token]) => token);
    }

    // If no prefix but we have a previous word, use Bigram prediction
    if (normalizedContextWord) {
      return model.predictNext(normalizedContextWord, limit);
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
  const checkSpelling = useCallback(async (word) => {
    if (!isReady) return true;
    return spellchecker.checkAsync(word);
  }, [isReady, spellchecker]);

  const getSpellingSuggestions = useCallback(async (word, prevWord = null, limit = 5) => {
    if (!isReady) return [];
    return spellchecker.suggestAsync(word, limit, prevWord);
  }, [isReady, spellchecker]);

  return { predict, getCompletions, checkSpelling, getSpellingSuggestions, getDemocraticChoice, isReady };
}
