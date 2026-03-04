import { phoneticMatcher } from './phonetic_matcher.js';

/**
 * Enhanced Spellchecker with Phonetic Disambiguation and Contextual Scoring
 */
export class Spellchecker {
  constructor() {
    this.dictionary = new Map(); // Map<word, frequency>
    this.phoneticMap = new Map(); // Map<phoneticKey, Set<word>>
    this.isLoaded = false;
  }

  init(words) {
    if (!Array.isArray(words)) return;
    
    words.forEach(w => {
      const lower = w.toLowerCase();
      // Store frequency for contextual scoring
      this.dictionary.set(lower, (this.dictionary.get(lower) || 0) + 1);
      
      // Index by phonetic signature
      const key = phoneticMatcher.encode(lower);
      if (!this.phoneticMap.has(key)) this.phoneticMap.set(key, new Set());
      this.phoneticMap.get(key).add(lower);
    });
    
    this.isLoaded = true;
  }

  check(word) {
    if (!word) return true;
    return this.dictionary.has(word.toLowerCase());
  }

  /**
   * Suggests corrections using a blend of Edit Distance, Phonetics, and Frequency.
   * @param {string} word 
   * @param {string} contextPrevWord - Optional previous word for Bigram context
   */
  suggest(word, limit = 5, _contextPrevWord = null) {
    if (!word) return [];
    const target = word.toLowerCase();
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
