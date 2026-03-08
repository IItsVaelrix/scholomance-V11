/**
 * CODEx Judiciary (Democracy System)
 * Orchestrates multiple analysis layers to reach a consensus choice.
 * Factory-based: call createJudiciaryEngine(config) to get an isolated instance.
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

const DEFAULT_LAYERS = {
  SYNTAX: { weight: 0.35, name: 'Syntax Analyzer' },
  PREDICTOR: { weight: 0.30, name: 'Predictor' },
  PHONEME: { weight: 0.25, name: 'Phoneme Engine' },
  SPELLCHECK: { weight: 0.10, name: 'Spellchecker' }
};

const DEFAULT_CONSENSUS_THRESHOLD = 0.65;

export class JudiciaryEngine {
  constructor(config = {}) {
    this.layers = { ...DEFAULT_LAYERS, ...(config.layers || {}) };
    this.CONSENSUS_THRESHOLD = config.consensusThreshold || DEFAULT_CONSENSUS_THRESHOLD;
  }

  /**
   * Resolves a choice among conflicting suggestions.
   * @param {Array<{word: string, layer: string, confidence: number, isRhyme?: boolean, reason?: string, type?: string, category?: string, strategy?: string, source?: string}>} candidates
   * @param {{role?: string, lineRole?: string, stressRole?: string, rhymePolicy?: string} | null} [syntaxContext=null]
   * @returns {{word: string, confidence: number, consensus: boolean, breakdown: object}}
   */
  vote(candidates, syntaxContext = null) {
    const scores = this.calculateAllScores(candidates, syntaxContext);
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].total - a[1].total);

    if (sorted.length === 0) return null;

    const [winner, scoreData] = sorted[0];

    if (sorted.length > 1 && Math.abs(sorted[0][1].total - sorted[1][1].total) < TIE_BREAK_DELTA) {
      const phonemeChoice = (Array.isArray(candidates) ? candidates : []).find(
        (candidate) => candidate?.layer === 'PHONEME'
      );
      if (
        phonemeChoice &&
        (phonemeChoice.word === sorted[0][0] || phonemeChoice.word === sorted[1][0])
      ) {
        const pWord = phonemeChoice.word;
        const pScore = scores.get(pWord);
        if (pScore) {
          return this.formatResult(pWord, pScore.total, pScore.breakdown);
        }
      }
    }

    return this.formatResult(winner, scoreData.total, scoreData.breakdown);
  }

  /**
   * Scores all candidates without picking a single winner.
   * Useful for PLS scorer integration.
   */
  calculateAllScores(candidates, syntaxContext = null) {
    if (!Array.isArray(candidates) || candidates.length === 0) return new Map();

    const seedCandidates = candidates.filter((candidate) =>
      candidate &&
      typeof candidate.word === 'string' &&
      typeof candidate.layer === 'string' &&
      Number.isFinite(candidate.confidence)
    );
    if (seedCandidates.length === 0) return new Map();

    const syntaxCandidates = this.buildSyntaxCandidates(seedCandidates, syntaxContext);
    const evaluatedCandidates = seedCandidates.concat(syntaxCandidates);

    const scores = new Map(); // word -> { total, breakdown: { layer, score }[] }

    evaluatedCandidates.forEach((candidate) => {
      const layerMeta = this.layers[candidate.layer];
      if (!layerMeta) return;

      const syntaxModifier = this.getSyntaxModifier(candidate, syntaxContext);
      const weightedScore = candidate.confidence * layerMeta.weight * syntaxModifier;

      if (!scores.has(candidate.word)) {
        scores.set(candidate.word, { total: 0, breakdown: [] });
      }

      const data = scores.get(candidate.word);
      data.total += weightedScore;
      data.breakdown.push({
        layer: candidate.layer,
        score: weightedScore,
        syntaxModifier,
      });
    });

    return scores;
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
    const breakdownObj = {
      [word]: Array.isArray(breakdown) ? breakdown : []
    };

    return {
      word,
      confidence: Math.min(1, confidence),
      consensus: confidence >= this.CONSENSUS_THRESHOLD,
      breakdown: breakdownObj
    };
  }
}

export function createJudiciaryEngine(config) {
  return new JudiciaryEngine(config);
}

export const judiciary = createJudiciaryEngine();
