import { COMBAT_SCHOOLS } from './combat.balance.js';

const SEMANTIC_TIER_COUNT = 5;

export const DEFAULT_SEMANTIC_TIER_LABELS = Object.freeze([
  'Tier I',
  'Tier II',
  'Tier III',
  'Tier IV',
  'Tier V',
]);

function freezeCopy(values) {
  return Object.freeze([...values]);
}

function normalizeKeyword(keyword) {
  return String(keyword || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, '');
}

function normalizeTierLabel(label, index) {
  const normalized = String(label || '').trim();
  return normalized || `Tier ${index + 1}`;
}

export function createSemanticChain({
  keywords = [],
  tierLabels = DEFAULT_SEMANTIC_TIER_LABELS,
  powerRating = null,
} = {}) {
  const normalizedTierLabels = Array.isArray(tierLabels)
    ? tierLabels.map((label, index) => normalizeTierLabel(label, index))
    : DEFAULT_SEMANTIC_TIER_LABELS;

  if (normalizedTierLabels.length !== SEMANTIC_TIER_COUNT) {
    throw new Error(`Semantic chains require exactly ${SEMANTIC_TIER_COUNT} tier labels.`);
  }

  const normalizedKeywords = Array.isArray(keywords)
    ? keywords
      .map((keyword) => normalizeKeyword(keyword))
      .filter(Boolean)
    : [];

  const uniqueKeywords = freezeCopy([...new Set(normalizedKeywords)]);
  const normalizedPowerRating = Number(powerRating);

  return Object.freeze({
    keywords: uniqueKeywords,
    tierLabels: freezeCopy(normalizedTierLabels),
    powerRating: Number.isFinite(normalizedPowerRating) ? normalizedPowerRating : null,
  });
}

export function createSemanticRegistry(seed = {}) {
  const registry = {};

  for (const school of COMBAT_SCHOOLS) {
    const schoolSeed = seed?.[school];
    const chains = {};

    if (schoolSeed && typeof schoolSeed === 'object' && !Array.isArray(schoolSeed)) {
      for (const [chainId, chainConfig] of Object.entries(schoolSeed)) {
        chains[chainId] = createSemanticChain(chainConfig);
      }
    }

    registry[school] = Object.freeze(chains);
  }

  return Object.freeze(registry);
}

export const SEMANTICS_REGISTRY = createSemanticRegistry();

export function getSemanticSchoolRegistry(school) {
  return SEMANTICS_REGISTRY?.[school] || null;
}

export function getSemanticChain(school, chainId) {
  const schoolRegistry = getSemanticSchoolRegistry(school);
  if (!schoolRegistry || !chainId) return null;
  return schoolRegistry?.[chainId] || null;
}

export function getSemanticTierLabel(school, chainId, tier) {
  const chain = getSemanticChain(school, chainId);
  if (!chain) return null;
  const tierIndex = Math.max(0, Math.min(SEMANTIC_TIER_COUNT - 1, Math.floor(Number(tier) || 0)));
  return chain.tierLabels[tierIndex] || null;
}

export function findSemanticChainsByKeyword(school, keyword) {
  const schoolRegistry = getSemanticSchoolRegistry(school);
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!schoolRegistry || !normalizedKeyword) {
    return [];
  }

  return Object.entries(schoolRegistry)
    .filter(([, chain]) => chain.keywords.includes(normalizedKeyword))
    .map(([chainId, chain]) => ({ chainId, chain }));
}

export {
  normalizeKeyword as normalizeSemanticKeyword,
  SEMANTIC_TIER_COUNT,
};
