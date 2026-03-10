import { analyzeText } from './analysis.pipeline.js';
import {
  COMBAT_ARENA_SCHOOL,
  COMBAT_SCHOOLS,
  clamp01,
  getCombatRarityByScore,
} from './combat.balance.js';
import { WORD_REGEX_GLOBAL } from '../../src/lib/wordTokenization.js';
import { normalizeVowelFamily } from '../../src/lib/phonology/vowelFamily.js';
import { VOWEL_FAMILY_TO_SCHOOL } from '../../src/data/schools.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has',
  'have', 'he', 'her', 'his', 'i', 'if', 'in', 'is', 'it', 'its', 'me', 'my',
  'not', 'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that', 'the', 'their',
  'them', 'there', 'they', 'this', 'to', 'us', 'was', 'we', 'were', 'with', 'you',
  'your',
]);

const HEAL_KEYWORDS = new Set([
  'amend', 'cure', 'cleanse', 'heal', 'health', 'mend', 'mending', 'recover',
  'recovery', 'remedy', 'restore', 'restored', 'salve', 'seal', 'sew', 'soothe',
  'stitch', 'vitalize',
]);

const BODY_KEYWORDS = new Set([
  'blood', 'bone', 'bones', 'fever', 'flesh', 'hurt', 'hurts', 'injury', 'limb',
  'scar', 'sick', 'sickness', 'skin', 'wound', 'wounds',
]);

const TERRAIN_KEYWORDS = new Set([
  'ash', 'bridge', 'earth', 'field', 'fire', 'flood', 'gate', 'glass', 'ground',
  'hill', 'ice', 'metal', 'river', 'road', 'sky', 'soil', 'space', 'stone',
  'storm', 'terrain', 'wall', 'water', 'wind', 'world',
]);

const TERRAIN_VERBS = new Set([
  'alter', 'bend', 'break', 'build', 'carve', 'forge', 'lift', 'open', 'raise',
  'reshape', 'seal', 'shift', 'shutter', 'split', 'transmute', 'turn', 'warp',
]);

const BUFF_KEYWORDS = new Set([
  'arm', 'bless', 'bolster', 'brighten', 'crown', 'empower', 'guard', 'harden',
  'lift', 'protect', 'sanctify', 'shield', 'steady', 'strengthen', 'ward',
]);

const DEBUFF_KEYWORDS = new Set([
  'blind', 'break', 'curse', 'dim', 'drain', 'fray', 'freeze', 'hex', 'rot',
  'shatter', 'silence', 'slow', 'split', 'sunder', 'weaken', 'wilt',
]);

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeCombatText(rawText) {
  if (typeof rawText === 'string') return rawText;
  if (rawText === null || rawText === undefined) return '';
  return String(rawText);
}

function normalizeToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .replace(/^['-]+|['-]+$/g, '');
}

function tokenizeCombatWords(text) {
  const input = normalizeCombatText(text);
  const matches = input.match(WORD_REGEX_GLOBAL) || [];
  return matches
    .map((token) => normalizeToken(token))
    .filter(Boolean);
}

function createEmptySchoolDensity() {
  return {
    SONIC: 0,
    PSYCHIC: 0,
    VOID: 0,
    ALCHEMY: 0,
    WILL: 0,
  };
}

function buildSchoolDensity(analyzedDoc) {
  const density = createEmptySchoolDensity();
  const words = Array.isArray(analyzedDoc?.allWords) ? analyzedDoc.allWords : [];
  let total = 0;

  for (const word of words) {
    const family = normalizeVowelFamily(word?.phonetics?.vowelFamily);
    const school = family ? VOWEL_FAMILY_TO_SCHOOL[family] : null;
    if (!school || !COMBAT_SCHOOLS.includes(school)) continue;
    density[school] += 1;
    total += 1;
  }

  if (total <= 0) {
    return density;
  }

  for (const school of COMBAT_SCHOOLS) {
    density[school] = density[school] / total;
  }

  return density;
}

function getScoreTrace(scoreData, heuristic) {
  const traces = Array.isArray(scoreData?.traces)
    ? scoreData.traces
    : Array.isArray(scoreData?.explainTrace)
      ? scoreData.explainTrace
      : [];
  return traces.find((trace) => trace?.heuristic === heuristic) || null;
}

function getTraceSignal(scoreData, heuristic) {
  const trace = getScoreTrace(scoreData, heuristic);
  const rawScore = Number(trace?.rawScore);
  if (Number.isFinite(rawScore)) return clamp01(rawScore);
  const contribution = Number(trace?.contribution);
  if (Number.isFinite(contribution)) return clamp01(contribution / 20);
  return 0;
}

export function createCorpusRankMap(dictionary = []) {
  const ranks = new Map();
  const words = Array.isArray(dictionary) ? dictionary : [];
  for (let index = 0; index < words.length; index += 1) {
    const token = normalizeToken(words[index]);
    if (!token || ranks.has(token)) continue;
    ranks.set(token, index);
  }
  return ranks;
}

function computeCorpusRarity(tokens, corpusRanks) {
  if (!(corpusRanks instanceof Map) || corpusRanks.size === 0 || tokens.length === 0) {
    return 0;
  }

  const maxRank = Math.max(1, corpusRanks.size - 1);
  let total = 0;
  let counted = 0;

  for (const token of tokens) {
    if (!token || STOP_WORDS.has(token)) continue;
    counted += 1;
    if (!corpusRanks.has(token)) {
      total += token.length >= 6 ? 0.96 : 0.82;
      continue;
    }
    const rank = corpusRanks.get(token);
    total += clamp01(1 - (rank / maxRank));
  }

  return counted > 0 ? clamp01(total / counted) : 0;
}

function detectSpellIntent(tokens) {
  let healHits = 0;
  let bodyHits = 0;
  let terrainHits = 0;
  let terrainVerbHits = 0;
  let buffHits = 0;
  let debuffHits = 0;

  for (const token of tokens) {
    if (HEAL_KEYWORDS.has(token)) healHits += 1;
    if (BODY_KEYWORDS.has(token)) bodyHits += 1;
    if (TERRAIN_KEYWORDS.has(token)) terrainHits += 1;
    if (TERRAIN_VERBS.has(token)) terrainVerbHits += 1;
    if (BUFF_KEYWORDS.has(token)) buffHits += 1;
    if (DEBUFF_KEYWORDS.has(token)) debuffHits += 1;
  }

  const healing = healHits > 0 && (bodyHits > 0 || healHits >= 2);
  const terrain = terrainHits > 0 && terrainVerbHits > 0;
  const buff = buffHits > debuffHits && buffHits > 0;
  const debuff = debuffHits >= buffHits && debuffHits > 0;
  const failureDisposition = debuff
    ? 'DEBUFF'
    : buff
      ? 'BUFF'
      : 'NEUTRAL';

  return {
    healing,
    terrain,
    buff,
    debuff,
    failureDisposition,
  };
}

function resolveDominantSchool({
  schoolDensity,
  intent,
  fallbackSchool = COMBAT_ARENA_SCHOOL,
}) {
  if (intent.healing || intent.terrain) {
    return 'ALCHEMY';
  }

  let winner = COMBAT_SCHOOLS.includes(fallbackSchool) ? fallbackSchool : COMBAT_ARENA_SCHOOL;
  let bestDensity = -1;

  for (const school of COMBAT_SCHOOLS) {
    const density = clamp01(schoolDensity?.[school] ?? 0);
    if (density > bestDensity) {
      bestDensity = density;
      winner = school;
    }
  }

  return winner;
}

function buildRarityPraise(rarity, dominantSchool) {
  const schoolLabel = dominantSchool || COMBAT_ARENA_SCHOOL;
  if (rarity.id === 'SOURCE') {
    return `CODEx kneels before a Source-grade ${schoolLabel} spell.`;
  }
  if (rarity.id === 'LEGENDARY') {
    return `CODEx marks this ${schoolLabel} casting as legendary ordinance.`;
  }
  if (rarity.id === 'MYTHIC') {
    return `CODEx praises the spell as mythic ${schoolLabel} craftsmanship.`;
  }
  if (rarity.id === 'GRIMOIRE') {
    return `CODEx recognizes grimoire-grade structure in the spell.`;
  }
  if (rarity.id === 'UNCOMMON') {
    return `CODEx notes uncommon force gathering through the line.`;
  }
  return `CODEx judges the spell as common but coherent.`;
}

export function buildCombatProfile({
  text = '',
  scoreData = null,
  analyzedDoc = null,
  arenaSchool = COMBAT_ARENA_SCHOOL,
  corpusRanks = null,
  fallbackSchool = arenaSchool,
} = {}) {
  const normalizedText = normalizeCombatText(text);
  const doc = analyzedDoc || analyzeText(normalizedText);
  const tokens = tokenizeCombatWords(normalizedText);
  const schoolDensity = buildSchoolDensity(doc);
  const intent = detectSpellIntent(tokens);
  const school = resolveDominantSchool({ schoolDensity, intent, fallbackSchool });
  const dominantDensity = clamp01(schoolDensity[school] ?? 0);
  const totalScore = toFiniteNumber(scoreData?.totalScore ?? scoreData?.score, 0);
  const lexicalDiversity = clamp01(doc?.stats?.lexicalDiversity ?? 0);
  const avgWordLength = toFiniteNumber(doc?.stats?.avgWordLength, 0);
  const corpusRarity = computeCorpusRarity(tokens, corpusRanks);
  const scoreSignal = clamp01(totalScore / 100);
  const vocabularySignal = getTraceSignal(scoreData, 'vocabulary_richness');
  const phonemeSignal = getTraceSignal(scoreData, 'phoneme_density');
  const hackingSignal = getTraceSignal(scoreData, 'phonetic_hacking');
  const scrollPowerSignal = getTraceSignal(scoreData, 'scroll_power');

  const rarityScore = clamp01(
    (corpusRarity * 0.4)
    + (lexicalDiversity * 0.15)
    + (clamp01(avgWordLength / 10) * 0.1)
    + (scoreSignal * 0.15)
    + (vocabularySignal * 0.1)
    + (((phonemeSignal + hackingSignal + scrollPowerSignal) / 3) * 0.1)
  );
  const rarity = getCombatRarityByScore(rarityScore);

  return {
    text: normalizedText,
    analyzedDoc: doc,
    tokens,
    tokenCount: tokens.length,
    school,
    schoolDensity,
    dominantDensity,
    sonicDensity: clamp01(schoolDensity.SONIC ?? 0),
    arenaSchool,
    totalScore,
    lexicalDiversity,
    avgWordLength,
    traceSignals: {
      phonemeDensity: phonemeSignal,
      phoneticHacking: hackingSignal,
      vocabulary: vocabularySignal,
      scrollPower: scrollPowerSignal,
    },
    rarity: {
      ...rarity,
      score: rarityScore,
      praise: buildRarityPraise(rarity, school),
    },
    intent,
  };
}

export {
  normalizeCombatText,
  tokenizeCombatWords,
};
