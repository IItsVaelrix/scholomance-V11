import { tokenizeLine } from "./phonology.js";

function incrementCounter(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function stableHash(value) {
  const text = String(value || "");
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function chooseBySeed(items, seed) {
  if (!items.length) return null;
  return items[seed % items.length];
}

function parseRhymeKey(key) {
  if (!key) return { family: null, coda: null };
  const [family, ...rest] = String(key).split("-");
  return {
    family: family || null,
    coda: rest.length ? rest.join("-") : null,
  };
}

function toLineArray(context) {
  if (Array.isArray(context)) return context;
  if (context && Array.isArray(context.context)) return context.context;
  return [];
}

const TEMPLATE_BANK = Object.freeze([
  ["trace", "the", "signal", "through"],
  ["hold", "this", "cadence", "inside"],
  ["thread", "the", "needle", "through"],
  ["turn", "that", "silence", "into"],
  ["forge", "the", "echo", "through"],
  ["let", "the", "rhythm", "cut"],
]);

/**
 * Lightweight line generator conditioned on target rhyme + style vector.
 */
export class RhymeLineGenerator {
  constructor() {
    this.rhymeLexicon = new Map();
    this.wordBank = new Map();
  }

  reset() {
    this.rhymeLexicon.clear();
    this.wordBank.clear();
  }

  fit(pairs) {
    this.reset();
    if (!Array.isArray(pairs)) return this;

    for (const pair of pairs) {
      const rhymeKey = String(pair?.targetRhymeKey || "");
      const endWord = String(pair?.targetEndWord || "").toLowerCase();
      if (rhymeKey && endWord) {
        if (!this.rhymeLexicon.has(rhymeKey)) this.rhymeLexicon.set(rhymeKey, new Map());
        incrementCounter(this.rhymeLexicon.get(rhymeKey), endWord, 1);
      }

      const tokens = tokenizeLine(pair?.targetLine || "");
      for (const token of tokens) {
        if (token.length < 3) continue;
        incrementCounter(this.wordBank, token, 1);
      }
    }

    return this;
  }

  pickEndingWord(targetRhymeKey, seed) {
    const direct = this.rhymeLexicon.get(targetRhymeKey);
    if (direct && direct.size > 0) {
      const words = [...direct.entries()]
        .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])))
        .map(([word]) => word);
      return chooseBySeed(words, seed);
    }

    const { family: targetFamily } = parseRhymeKey(targetRhymeKey);
    if (targetFamily) {
      const candidates = [];
      for (const [rhymeKey, words] of this.rhymeLexicon.entries()) {
        const { family } = parseRhymeKey(rhymeKey);
        if (family !== targetFamily) continue;
        for (const [word, count] of words.entries()) {
          candidates.push({ word, count });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.count - a.count) || String(a.word).localeCompare(String(b.word)));
        return chooseBySeed(candidates.map((entry) => entry.word), seed);
      }
    }

    return "echo";
  }

  generateLine(context, targetRhymeKey, styleVector = {}, options = {}) {
    const variationIndex = Number.isInteger(options.variationIndex) ? options.variationIndex : 0;
    const contextLines = toLineArray(context);
    const contextWords = contextLines.flatMap((line) => tokenizeLine(line)).filter((word) => word.length >= 3);
    const seedBase = stableHash(`${contextLines.join("|")}|${targetRhymeKey}|${variationIndex}`);

    const endingWord = this.pickEndingWord(targetRhymeKey, seedBase);
    const template = chooseBySeed(TEMPLATE_BANK, seedBase + 7) || TEMPLATE_BANK[0];

    const reusableWords = [...new Set(contextWords)].slice(0, 24);
    const injectedWord = chooseBySeed(reusableWords, seedBase + 19);
    const phrase = [...template];
    if (injectedWord && !phrase.includes(injectedWord)) {
      phrase.push(injectedWord);
    }

    const density = Number(styleVector?.internalRhymeDensity) || 0;
    if (density >= 0.5 && injectedWord) {
      phrase.push(injectedWord);
    }

    phrase.push(endingWord);
    const line = phrase.join(" ").replace(/\s+/g, " ").trim();

    if (!line) return endingWord;
    return line.charAt(0).toUpperCase() + line.slice(1);
  }
}

export const defaultRhymeLineGenerator = new RhymeLineGenerator();

export function generateLine(
  context,
  targetRhymeKey,
  styleVector = {},
  options = {},
  generator = defaultRhymeLineGenerator
) {
  return generator.generateLine(context, targetRhymeKey, styleVector, options);
}

