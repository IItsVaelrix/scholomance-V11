import { getRhymeKey } from "./phonology.js";

function incrementCounter(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function incrementNestedCounter(container, key, nestedKey, amount = 1) {
  if (!container.has(key)) container.set(key, new Map());
  const nested = container.get(key);
  incrementCounter(nested, nestedKey, amount);
}

function getContextRhymeKeys(context) {
  if (Array.isArray(context)) {
    return context.map((line) => getRhymeKey(line) || "UNK").filter(Boolean);
  }

  if (context && Array.isArray(context.contextRhymeKeys)) {
    return context.contextRhymeKeys.map((key) => String(key || "UNK"));
  }

  if (context && Array.isArray(context.context)) {
    return context.context.map((line) => getRhymeKey(line) || "UNK").filter(Boolean);
  }

  return [];
}

function signatureForOrder(rhymeKeys, order) {
  const slice = rhymeKeys.slice(-order);
  if (!slice.length) return null;
  return slice.join(">");
}

function rankMap(counter) {
  return [...counter.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return String(a[0]).localeCompare(String(b[0]));
    })
    .map(([key, count]) => ({ key, count }));
}

/**
 * Context-conditioned predictor for the next end-rhyme key.
 */
export class RhymeKeyPredictor {
  constructor(options = {}) {
    this.maxOrder = Math.max(1, Number(options.maxOrder) || 4);
    this.reset();
  }

  reset() {
    this.totalPairs = 0;
    this.globalCounts = new Map();
    this.refrainCounts = new Map();
    this.orderCounts = new Map();
  }

  fit(pairs) {
    this.reset();
    if (!Array.isArray(pairs)) return this;
    for (const pair of pairs) this.observe(pair);
    return this;
  }

  observe(pair) {
    const targetKey = String(pair?.targetRhymeKey || "");
    if (!targetKey) return;

    this.totalPairs += 1;
    incrementCounter(this.globalCounts, targetKey, 1);

    if (pair?.refrainId) {
      incrementNestedCounter(this.refrainCounts, String(pair.refrainId), targetKey, 1);
    }

    const contextRhymeKeys = getContextRhymeKeys(pair);
    for (let order = 1; order <= this.maxOrder; order += 1) {
      const signature = signatureForOrder(contextRhymeKeys, order);
      if (!signature) continue;
      incrementNestedCounter(this.orderCounts, `${order}:${signature}`, targetKey, 1);
    }
  }

  getMostCommonRhymeKeys(limit = 5) {
    return rankMap(this.globalCounts).slice(0, Math.max(1, limit)).map((entry) => entry.key);
  }

  predictRhymeKey(context, options = {}) {
    const topK = Math.max(1, Number(options.topK) || 5);
    const refrainId = options.refrainId || context?.refrainId || null;
    const contextRhymeKeys = getContextRhymeKeys(context);

    const weighted = new Map();
    const provenance = new Map();

    for (let order = this.maxOrder; order >= 1; order -= 1) {
      const signature = signatureForOrder(contextRhymeKeys, order);
      if (!signature) continue;
      const counts = this.orderCounts.get(`${order}:${signature}`);
      if (!counts) continue;

      for (const [rhymeKey, count] of counts.entries()) {
        const weight = count * (1 + order * 0.5);
        incrementCounter(weighted, rhymeKey, weight);
        incrementCounter(provenance, `order_${order}`, count);
      }
    }

    if (refrainId && this.refrainCounts.has(refrainId)) {
      const counts = this.refrainCounts.get(refrainId);
      for (const [rhymeKey, count] of counts.entries()) {
        incrementCounter(weighted, rhymeKey, count * 1.35);
      }
      incrementCounter(provenance, "refrain", 1);
    }

    for (const [rhymeKey, count] of this.globalCounts.entries()) {
      incrementCounter(weighted, rhymeKey, count * 0.2);
    }
    if (this.globalCounts.size > 0) incrementCounter(provenance, "global", 1);

    if (weighted.size === 0) {
      return {
        rhymeKey: null,
        confidence: 0,
        candidates: [],
        contextRhymeKeys,
        strategy: "untrained",
      };
    }

    const ranked = rankMap(weighted).map((entry) => ({
      rhymeKey: entry.key,
      score: entry.count,
    }));

    const totalScore = ranked.reduce((sum, entry) => sum + entry.score, 0) || 1;
    const candidates = ranked.slice(0, topK).map((entry) => ({
      ...entry,
      probability: entry.score / totalScore,
    }));

    return {
      rhymeKey: candidates[0].rhymeKey,
      confidence: candidates[0].probability,
      candidates,
      contextRhymeKeys,
      strategy: rankMap(provenance).map((item) => item.key).join("+") || "global",
    };
  }
}

export const defaultRhymeKeyPredictor = new RhymeKeyPredictor();

export function predictRhymeKey(context, predictor = defaultRhymeKeyPredictor, options = {}) {
  return predictor.predictRhymeKey(context, options);
}

