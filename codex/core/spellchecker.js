import { phoneticMatcher } from './phonetic_matcher.js';

/**
 * Enhanced Spellchecker with Phonetic Disambiguation and Contextual Scoring
 */
export class Spellchecker {
  constructor() {
    this.dictionary = new Map(); // Map<word, frequency>
    this.phoneticMap = new Map(); // Map<phoneticKey, Set<word>>
    this.validationCache = new Map(); // Map<word, boolean>
    this.validationInFlight = new Map(); // Map<word, Promise<boolean>>
    this.asyncValidator = null; // (word: string) => Promise<boolean>
    this.asyncSuggestor = null; // (prefix: string, limit: number) => Promise<string[]>
    this.isLoaded = false;
  }

  normalizeWord(word) {
    return String(word || '').trim().toLowerCase();
  }

  remember(word, weight = 1) {
    const normalized = this.normalizeWord(word);
    if (!normalized) return false;

    this.dictionary.set(normalized, (this.dictionary.get(normalized) || 0) + Math.max(1, Number(weight) || 1));

    const key = phoneticMatcher.encode(normalized);
    if (!this.phoneticMap.has(key)) this.phoneticMap.set(key, new Set());
    this.phoneticMap.get(key).add(normalized);
    return true;
  }

  primeValidWords(words) {
    if (!Array.isArray(words)) return;
    words.forEach((word) => {
      const normalized = this.normalizeWord(word);
      if (!normalized) return;
      this.validationCache.set(normalized, true);
      this.remember(normalized);
    });
  }

  configureAsync({ validateWord = null, suggestWords = null } = {}) {
    this.asyncValidator = typeof validateWord === 'function' ? validateWord : null;
    this.asyncSuggestor = typeof suggestWords === 'function' ? suggestWords : null;
  }

  init(words) {
    if (!Array.isArray(words)) return;
    
    words.forEach(w => {
      const lower = this.normalizeWord(w);
      if (!lower) return;
      this.remember(lower, 1);
    });
    
    this.isLoaded = true;
  }

  check(word) {
    if (!word) return true;
    return this.dictionary.has(this.normalizeWord(word));
  }

  async checkAsync(word) {
    const normalized = this.normalizeWord(word);
    if (!normalized) return true;

    if (this.dictionary.has(normalized)) return true;

    if (this.validationCache.has(normalized)) {
      const cached = Boolean(this.validationCache.get(normalized));
      if (cached) this.remember(normalized);
      return cached;
    }

    if (!this.asyncValidator) return false;

    if (this.validationInFlight.has(normalized)) {
      return this.validationInFlight.get(normalized);
    }

    const pending = (async () => {
      try {
        const valid = Boolean(await this.asyncValidator(normalized));
        this.validationCache.set(normalized, valid);
        if (valid) this.remember(normalized);
        return valid;
      } catch (_error) {
        return false;
      } finally {
        this.validationInFlight.delete(normalized);
      }
    })();

    this.validationInFlight.set(normalized, pending);
    return pending;
  }

  /**
   * Suggests corrections using a blend of Edit Distance, Phonetics, and Frequency.
   * @param {string} word 
   * @param {string} contextPrevWord - Optional previous word for Bigram context
   */
  suggest(word, limit = 5, _contextPrevWord = null) {
    if (!word) return [];
    const target = this.normalizeWord(word);
    if (!target) return [];
    const suggestions = [];

    // 1. Check Phonetic Matches (High Priority)
    const phoneticKey = phoneticMatcher.encode(target);
    const soundAlikes = this.phoneticMap.get(phoneticKey) || [];
    
    soundAlikes.forEach(sa => {
      if (sa !== target) {
        suggestions.push({ 
          word: sa, 
          reason: 'phonetic', 
          score: 2.0, 
          freq: this.dictionary.get(sa) 
        });
      }
    });

    // 2. Check Levenshtein Matches (Distance <= 2)
    for (const [entry, freq] of this.dictionary.entries()) {
      if (Math.abs(entry.length - target.length) > 2) continue;
      
      // Skip if already added via phonetics
      if (suggestions.some(s => s.word === entry)) continue;

      const distance = this.levenshtein(target, entry);
      if (distance <= 2) {
        suggestions.push({ 
          word: entry, 
          reason: 'edit', 
          score: 1.0 / (distance + 1), 
          freq 
        });
      }
    }

    // 3. Final Scoring (Heuristic: Similarity * Frequency)
    return suggestions
      .sort((a, b) => {
        const scoreA = a.score * Math.log10(a.freq + 1.1);
        const scoreB = b.score * Math.log10(b.freq + 1.1);
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map(s => s.word);
  }

  async suggestAsync(word, limit = 5, contextPrevWord = null) {
    const normalized = this.normalizeWord(word);
    if (!normalized) return [];

    const local = this.suggest(normalized, limit, contextPrevWord);
    const merged = [];
    const seen = new Set();

    const pushWord = (candidate) => {
      const candidateWord = this.normalizeWord(candidate);
      if (!candidateWord || candidateWord === normalized || seen.has(candidateWord)) return;
      seen.add(candidateWord);
      merged.push(candidateWord);
    };

    local.forEach(pushWord);

    if (this.asyncSuggestor) {
      try {
        const remote = await this.asyncSuggestor(normalized, Math.max(limit * 3, 15));
        (Array.isArray(remote) ? remote : []).forEach((candidate) => {
          const candidateWord = this.normalizeWord(candidate);
          if (!candidateWord) return;
          this.validationCache.set(candidateWord, true);
          this.remember(candidateWord);
          pushWord(candidateWord);
        });
      } catch (_error) {
        // Remote suggestions are additive only; keep local fallback.
      }
    }

    if (merged.length < limit) {
      this.suggest(normalized, limit + 10, contextPrevWord).forEach(pushWord);
    }

    return merged.slice(0, limit);
  }

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
        else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }
}

export const spellchecker = new Spellchecker();
