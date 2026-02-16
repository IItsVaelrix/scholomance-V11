import { analyzeLinePhonology } from "./phonology.js";

function parseRhymeKey(key) {
  if (!key) return { family: null, coda: null };
  const [family, ...rest] = String(key).split("-");
  return {
    family: family || null,
    coda: rest.length ? rest.join("-") : null,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function scoreRhymeMatch(observedKey, targetKey) {
  if (!observedKey || !targetKey) return 0;
  if (observedKey === targetKey) return 1;

  const observed = parseRhymeKey(observedKey);
  const target = parseRhymeKey(targetKey);

  if (observed.family && target.family && observed.family === target.family) {
    if (observed.coda && target.coda && observed.coda === target.coda) return 0.95;
    return 0.62;
  }

  if (observed.coda && target.coda && observed.coda === target.coda) return 0.52;
  return 0;
}

function scoreStyleSimilarity(observed, target) {
  if (!target) return null;

  const keys = [
    "averageSyllables",
    "repeatedVowelFamilies",
    "repeatedPhonemeNgrams",
    "internalRhymeDensity",
    "rhymeClusterLength",
  ];

  let aggregate = 0;
  let scored = 0;

  for (const key of keys) {
    const a = Number(observed?.[key]);
    const b = Number(target?.[key]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

    const denom = Math.max(1, Math.abs(a), Math.abs(b));
    const distance = Math.abs(a - b) / denom;
    aggregate += (1 - clamp01(distance));
    scored += 1;
  }

  if (scored === 0) return null;
  return clamp01(aggregate / scored);
}

/**
 * Scores a candidate line against a target rhyme key.
 *
 * @param {string} line
 * @param {string} targetRhymeKey
 * @param {{ styleVector?: object, strict?: boolean }} [options]
 * @returns {{
 *   line: string,
 *   targetRhymeKey: string,
 *   observedRhymeKey: string|null,
 *   rhymeScore: number,
 *   styleScore: number|null,
 *   totalScore: number,
 *   isExactMatch: boolean,
 *   isValid: boolean,
 *   reasons: string[]
 * }}
 */
export function scoreLine(line, targetRhymeKey, options = {}) {
  const strict = options.strict !== false;
  const analysis = analyzeLinePhonology(line);
  const observedRhymeKey = analysis.rhymeKey || null;
  const rhymeScore = scoreRhymeMatch(observedRhymeKey, targetRhymeKey);
  const styleScore = scoreStyleSimilarity(analysis.styleVector, options.styleVector || null);
  const totalScore = styleScore === null
    ? rhymeScore
    : clamp01((rhymeScore * 0.8) + (styleScore * 0.2));

  const isExactMatch = observedRhymeKey === targetRhymeKey;
  const isValid = strict ? isExactMatch : rhymeScore >= 0.62;

  const reasons = [];
  if (!observedRhymeKey) reasons.push("missing_rhyme_key");
  if (isExactMatch) reasons.push("exact_rhyme_match");
  else if (rhymeScore > 0) reasons.push("near_rhyme_match");
  else reasons.push("rhyme_mismatch");

  if (styleScore !== null) {
    reasons.push(styleScore >= 0.7 ? "style_aligned" : "style_drift");
  }

  return {
    line: String(line || ""),
    targetRhymeKey: String(targetRhymeKey || ""),
    observedRhymeKey,
    rhymeScore,
    styleScore,
    totalScore,
    isExactMatch,
    isValid,
    reasons,
  };
}

