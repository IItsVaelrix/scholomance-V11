/**
 * CODEx Judiciary (Democracy System)
 * Orchestrates multiple analysis layers to reach a consensus choice.
 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'than',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'ours',
  'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs',
  'it', 'its', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'done',
  'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as',
  'not', 'no', 'so', 'too', 'very', 'just', 'can', 'could', 'would', 'should',
  'will', 'shall', 'might', 'may', 'must'
]);

const TIE_BREAK_DELTA = 0.05;

export class JudiciaryEngine {
  constructor() {
    this.layers = {
      PHONEME: { weight: 0.40, name: 'Phoneme Engine' },
      SPELLCHECK: { weight: 0.25, name: 'Spellchecker' },
      PREDICTOR: { weight: 0.20, name: 'Predictor' },
      SYNTAX: { weight: 0.15, name: 'Syntax Analyzer' }
    };
    this.CONSENSUS_THRESHOLD = 0.65; // Must reach 65% weight for automatic pick
  }

  /**
   * Resolves a choice among conflicting suggestions.
   * @param {Array<{word: string, layer: string, confidence: number, isRhyme?: boolean, reason?: string, type?: string, category?: string, strategy?: string, source?: string}>} candidates
   * @param {{role?: string, lineRole?: string, stressRole?: string, rhymePolicy?: string} | null} [syntaxContext=null]
   * @returns {{word: string, confidence: number, consensus: boolean, breakdown: object}}
   */
  vote(candidates, syntaxContext = null) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    const seedCandidates = candidates.filter((candidate) =>
      candidate &&
      typeof candidate.word === 'string' &&
      typeof candidate.layer === 'string' &&
      Number.isFinite(candidate.confidence)
    );
    if (seedCandidates.length === 0) return null;

    const syntaxCandidates = this.buildSyntaxCandidates(seedCandidates, syntaxContext);
    const evaluatedCandidates = seedCandidates.concat(syntaxCandidates);

    const votes = new Map(); // Map<word, totalScore>
    const breakdown = new Map();

    evaluatedCandidates.forEach((candidate) => {
      const layerMeta = this.layers[candidate.layer];
      if (!layerMeta) return;

      const syntaxModifier = this.getSyntaxModifier(candidate, syntaxContext);
      const weightedScore = candidate.confidence * layerMeta.weight * syntaxModifier;

      const current = votes.get(candidate.word) || 0;
      votes.set(candidate.word, current + weightedScore);

      // Track breakdown for transparency
      if (!breakdown.has(candidate.word)) breakdown.set(candidate.word, []);
      breakdown.get(candidate.word).push({ layer: candidate.layer, score: weightedScore });
    });

    // Sort winners
    const sorted = Array.from(votes.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return null;

    const [winner, totalConfidence] = sorted[0];
    
    // TIE-BREAKING LOGIC:
    // If scores are close, prioritize Phoneme Engine's choice when it is a top contender.
    if (sorted.length > 1 && Math.abs(sorted[0][1] - sorted[1][1]) < TIE_BREAK_DELTA) {
      const phonemeChoice = evaluatedCandidates.find((candidate) => candidate.layer === 'PHONEME');
      if (
        phonemeChoice &&
        (phonemeChoice.word === sorted[0][0] || phonemeChoice.word === sorted[1][0])
      ) {
        return this.formatResult(phonemeChoice.word, votes.get(phonemeChoice.word) || 0, breakdown);
      }
    }

    return this.formatResult(winner, totalConfidence, breakdown);
  }

  getSyntaxModifier(candidate, syntaxContext) {
    if (!syntaxContext) return 1;

    let modifier = 1;
    const isRhymeCandidate = this.isRhymeCandidate(candidate);

    if (isRhymeCandidate && syntaxContext.rhymePolicy === 'suppress') {
      modifier *= 0.3;
    } else if (isRhymeCandidate && syntaxContext.rhymePolicy === 'allow_weak') {
      modifier *= 0.6;
    }

    if (
      isRhymeCandidate &&
      syntaxContext.role === 'content' &&
      syntaxContext.lineRole === 'line_end'
    ) {
      modifier *= 1.25;
    }

    if (syntaxContext.stressRole === 'primary' && candidate.layer === 'PHONEME') {
      modifier *= 1.15;
    }

    if (syntaxContext.stressRole === 'unstressed' && syntaxContext.role === 'function') {
      modifier *= 0.8;
    }

    return modifier;
  }

  buildSyntaxCandidates(candidates, syntaxContext) {
    if (!syntaxContext) return [];
    if (!(syntaxContext.role === 'content' && syntaxContext.lineRole === 'line_end')) return [];

    const scoreByWord = new Map();
    candidates.forEach((candidate) => {
      const layerMeta = this.layers[candidate.layer];
      if (!layerMeta) return;
      const score = candidate.confidence * layerMeta.weight;
      scoreByWord.set(candidate.word, (scoreByWord.get(candidate.word) || 0) + score);
    });

    const rankedWords = Array.from(scoreByWord.entries()).sort((a, b) => b[1] - a[1]);
    if (rankedWords.length === 0) return [];

    const contentWords = rankedWords.filter(([word]) => this.isLikelyContentWord(word));
    const syntaxCandidates = [];

    const endorsedWord = contentWords[0]?.[0] || rankedWords[0][0];
    syntaxCandidates.push({
      word: endorsedWord,
      layer: 'SYNTAX',
      confidence: 0.9,
      reason: 'syntax_line_end_content_endorsement'
    });

    const leadingWord = rankedWords[0][0];
    if (!this.isLikelyContentWord(leadingWord) && contentWords.length > 0) {
      const demandStrength = syntaxContext.stressRole === 'primary' ? 0.85 : 0.75;
      const leadingSupport = rankedWords[0][1] || 1;

      contentWords.slice(0, 2).forEach(([word, support], index) => {
        if (word === endorsedWord) return;
        const relativeSupport = support / leadingSupport;
        const confidence = Math.max(
          0.35,
          Math.min(0.9, demandStrength * relativeSupport * (index === 0 ? 1 : 0.9))
        );
        syntaxCandidates.push({
          word,
          layer: 'SYNTAX',
          confidence,
          reason: 'syntax_line_end_content_preference'
        });
      });
    }

    return syntaxCandidates;
  }

  isRhymeCandidate(candidate) {
    if (candidate?.isRhyme === true) return true;
    if (candidate?.isRhyme === false) return false;

    const hints = [
      candidate?.reason,
      candidate?.type,
      candidate?.category,
      candidate?.strategy,
      candidate?.source
    ]
      .filter((value) => typeof value === 'string')
      .map((value) => value.toLowerCase());

    if (hints.some((hint) => hint.includes('rhyme') || hint.includes('phonetic'))) {
      return true;
    }

    return candidate?.layer === 'PHONEME';
  }

  isLikelyContentWord(word) {
    const normalized = String(word || '')
      .toLowerCase()
      .replace(/[^a-z'-]/g, '')
      .replace(/^['-]+|['-]+$/g, '');

    if (!normalized) return false;
    if (FUNCTION_WORDS.has(normalized)) return false;
    return normalized.length >= 3;
  }

  formatResult(word, confidence, breakdown) {
    return {
      word,
      confidence: Math.min(1, confidence),
      consensus: confidence >= this.CONSENSUS_THRESHOLD,
      breakdown: Object.fromEntries(breakdown)
    };
  }
}

export const judiciary = new JudiciaryEngine();
