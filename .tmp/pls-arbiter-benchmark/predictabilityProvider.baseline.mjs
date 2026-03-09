import { HHM_LOGIC_ORDER, HHM_STAGE_WEIGHTS } from 'file:///C:/Users/Vaelrix/Desktop/scholomance-V11/src/lib/models/harkov.model.js';

const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'than',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'ours',
  'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs',
  'it', 'its', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'done',
  'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as',
  'not', 'no', 'so', 'too', 'very', 'just', 'can', 'could', 'would', 'should',
  'will', 'shall', 'might', 'may', 'must',
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRankMap(words) {
  const values = Array.isArray(words) ? words : [];
  const total = values.length || 1;
  const map = new Map();

  values.forEach((word, index) => {
    const token = normalizeToken(word);
    if (!token || map.has(token)) return;
    map.set(token, clamp(1 - (index / total), 0, 1));
  });

  return map;
}

function normalizeHhmStageWeights(stageWeights) {
  if (!stageWeights || typeof stageWeights !== 'object') {
    return { ...HHM_STAGE_WEIGHTS };
  }

  const merged = { ...HHM_STAGE_WEIGHTS };
  let total = 0;
  HHM_LOGIC_ORDER.forEach((stage) => {
    const raw = Number(stageWeights?.[stage]);
    if (Number.isFinite(raw) && raw > 0) {
      merged[stage] = raw;
    }
    total += merged[stage];
  });

  if (total <= 0) {
    return { ...HHM_STAGE_WEIGHTS };
  }

  const normalized = {};
  HHM_LOGIC_ORDER.forEach((stage) => {
    normalized[stage] = merged[stage] / total;
  });
  return normalized;
}

function getStageSignal(hhm, stage) {
  const signalRaw = Number(hhm?.stageScores?.[stage]?.signal);
  if (!Number.isFinite(signalRaw)) return 1;
  return clamp(signalRaw, 0.05, 1.6);
}

function getOrderBonus(logicOrder, stage) {
  const index = logicOrder.indexOf(stage);
  if (index < 0) return 1;
  return Math.max(0.9, 1.08 - (index * 0.04));
}

function getLexicalFit(token, preferredRole) {
  if (!token) return 0;
  const isFunctionWord = FUNCTION_WORDS.has(token);

  if (preferredRole === 'content') {
    return isFunctionWord ? 0.2 : 1;
  }
  if (preferredRole === 'function') {
    return isFunctionWord ? 1 : 0.55;
  }
  return isFunctionWord ? 0.65 : 0.9;
}

/**
 * PredictabilityProvider - Scorer provider.
 * Builds an explicit predictability signal from trie sequence evidence and HHM stage metadata.
 */
export function predictabilityProvider(context, engines, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const trie = engines?.trie;
  const prefix = normalizeToken(context?.prefix);
  const prevWord = normalizeToken(context?.prevWord);
  const hasPrefix = prefix.length > 0;
  const hasPrevWord = prevWord.length > 0;
  const queryLimit = Math.max(30, candidates.length * 4);

  const prefixScores = hasPrefix && trie && typeof trie.predict === 'function'
    ? buildRankMap(trie.predict(prefix, queryLimit))
    : new Map();
  const sequentialScores = hasPrevWord && trie && typeof trie.predictNext === 'function'
    ? buildRankMap(trie.predictNext(prevWord, queryLimit))
    : new Map();

  const syntaxContext = context?.syntaxContext || null;
  const preferredRole = syntaxContext?.role === 'function'
    ? 'function'
    : (syntaxContext?.role === 'content' ? 'content' : null);

  const hhm = syntaxContext?.hhm && typeof syntaxContext.hhm === 'object'
    ? syntaxContext.hhm
    : null;
  const stageWeights = normalizeHhmStageWeights(hhm?.stageWeights);
  const logicOrder = Array.isArray(hhm?.logicOrder) && hhm.logicOrder.length > 0
    ? hhm.logicOrder
    : HHM_LOGIC_ORDER;
  const tokenWeightRaw = Number(hhm?.tokenWeight);
  const tokenWeight = Number.isFinite(tokenWeightRaw)
    ? clamp(tokenWeightRaw, 0.05, 1.5)
    : 1;

  const predictorSignal = getStageSignal(hhm, 'PREDICTOR');
  const syntaxSignal = getStageSignal(hhm, 'SYNTAX');
  const predictorOrder = getOrderBonus(logicOrder, 'PREDICTOR');
  const syntaxOrder = getOrderBonus(logicOrder, 'SYNTAX');
  const predictorStrength = stageWeights.PREDICTOR * predictorSignal * predictorOrder;
  const syntaxStrength = stageWeights.SYNTAX * syntaxSignal * syntaxOrder;
  const hhmAmplifier = clamp(
    0.75 + (tokenWeight * (predictorStrength + (syntaxStrength * 0.6))),
    0.5,
    1.8
  );

  return candidates.map((candidate) => {
    const token = normalizeToken(candidate?.token);
    const prefixEvidence = prefixScores.get(token) || 0;
    const sequentialEvidence = sequentialScores.get(token) || 0;
    const lexicalFit = getLexicalFit(token, preferredRole);

    let baseEvidence = 0;
    if (hasPrefix && hasPrevWord) {
      baseEvidence = (prefixEvidence * 0.4) + (sequentialEvidence * 0.45) + (lexicalFit * 0.15);
    } else if (hasPrefix) {
      baseEvidence = (prefixEvidence * 0.78) + (lexicalFit * 0.22);
    } else if (hasPrevWord) {
      baseEvidence = (sequentialEvidence * 0.78) + (lexicalFit * 0.22);
    } else {
      baseEvidence = lexicalFit * 0.5;
    }

    const score = clamp(baseEvidence * hhmAmplifier, 0, 1);
    return {
      ...candidate,
      scores: {
        ...candidate.scores,
        predictability: score,
      },
    };
  });
}
