import { PHRASE_BANK, DEFAULT_COMMENTARY_ENTRY } from './phrase-bank.js';

const FALLBACK_TOKEN_LIMIT = 4;
const HARKOV_START_LEFT = '__harkov_start_left__';
const HARKOV_START_RIGHT = '__harkov_start_right__';
const HARKOV_END = '__harkov_end__';
const CTC_BLANK = '__ctc_blank__';
const COMMENTARY_TARGET_WORDS = 35;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'than',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'ours',
  'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs',
  'it', 'its', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as',
  'not', 'no', 'so', 'too', 'very', 'just', 'can', 'could', 'would', 'should',
]);

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function stableHash(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function chooseBySeed(items, seed) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[seed % items.length];
}

function rotateBySeed(items, seed) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const shift = Math.abs(Number(seed) || 0) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

function ensureSentence(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function normalizeToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .replace(/^['-]+|['-]+$/g, '');
}

function tokenizeForHarkov(value) {
  return String(value || '')
    .toLowerCase()
    .match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) || [];
}

function pushToken(set, token) {
  const normalized = normalizeToken(token);
  if (!normalized || normalized.length <= 2) return;
  if (STOP_WORDS.has(normalized)) return;
  set.add(normalized);
}

function collectDiagnosticTokens(trace) {
  const tokens = new Set();
  const diagnostics = Array.isArray(trace?.diagnostics) ? trace.diagnostics : [];

  diagnostics.forEach((diagnostic) => {
    const metadata = diagnostic?.metadata;
    if (!metadata || typeof metadata !== 'object') return;

    const words = Array.isArray(metadata.words) ? metadata.words : [];
    words.forEach((word) => pushToken(tokens, word));

    if (typeof metadata.pair === 'string') {
      metadata.pair
        .split(/<->|\||,|\//g)
        .forEach((part) => pushToken(tokens, part));
    }

    if (typeof metadata.bigram === 'string') {
      metadata.bigram.split(/\s+/g).forEach((part) => pushToken(tokens, part));
    }

    if (typeof metadata.word === 'string') {
      pushToken(tokens, metadata.word);
    }

    if (typeof metadata.anchorWord === 'string') {
      pushToken(tokens, metadata.anchorWord);
    }
  });

  return [...tokens];
}

function collectDocumentTokens(doc) {
  const ranked = [];
  const frequency = doc?.parsed?.contentWordFrequency;
  if (frequency && typeof frequency === 'object') {
    Object.entries(frequency)
      .filter(([token, count]) => normalizeToken(token).length > 2 && Number(count) > 0)
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        if (right[0].length !== left[0].length) return right[0].length - left[0].length;
        return String(left[0]).localeCompare(String(right[0]));
      })
      .forEach(([token]) => ranked.push(normalizeToken(token)));
  }

  if (ranked.length > 0) {
    return [...new Set(ranked)].slice(0, 12);
  }

  const fallback = new Set();
  const allWords = Array.isArray(doc?.allWords) ? doc.allWords : [];
  allWords.forEach((word) => {
    pushToken(fallback, word?.normalized || word?.text);
  });
  return [...fallback].slice(0, 12);
}

function collectAnchorTokens(trace, doc) {
  const diagnosticTokens = collectDiagnosticTokens(trace);
  const documentTokens = collectDocumentTokens(doc);
  return [...new Set([...diagnosticTokens, ...documentTokens])].slice(0, FALLBACK_TOKEN_LIMIT);
}

function formatTokenList(tokens) {
  const quoted = tokens.map((token) => `"${token}"`);
  if (quoted.length <= 1) return quoted[0] || '';
  if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`;
  return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`;
}

function buildEvidencePayload(trace, doc) {
  const scorePercent = Math.round(clamp01(Number(trace?.rawScore) || 0) * 100);
  const anchors = collectAnchorTokens(trace, doc);
  if (anchors.length === 0) {
    return {
      scorePercent,
      anchors,
      anchorText: '',
      evidence: `In this song, the measured signal settles near ${scorePercent} percent across the active lines.`,
    };
  }

  const anchorText = formatTokenList(anchors);
  return {
    scorePercent,
    anchors,
    anchorText,
    evidence: `In this song, the measured signal settles near ${scorePercent} percent around ${anchorText}.`,
  };
}

function resolveSignalBand(scorePercent) {
  if (scorePercent >= 85) return { label: 'dominant', token: 'dominant' };
  if (scorePercent >= 70) return { label: 'strong', token: 'strong' };
  if (scorePercent >= 52) return { label: 'stable', token: 'stable' };
  if (scorePercent >= 35) return { label: 'mixed', token: 'mixed' };
  return { label: 'fragile', token: 'fragile' };
}

function splitTraceExplanation(trace) {
  const explanation = String(trace?.explanation || '').replace(/\s+/g, ' ').trim();
  if (!explanation) return [];
  return explanation
    .split(/[.;]+/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function makePairKey(left, right) {
  return `${left}\u0000${right}`;
}

function buildHarkovTransitionModel(corpusSentences) {
  const transitions = new Map();
  const totals = new Map();
  const vocabulary = new Set([HARKOV_END]);

  const addTransition = (left, right, nextToken) => {
    const key = makePairKey(left, right);
    const bucket = transitions.get(key) || new Map();
    bucket.set(nextToken, (bucket.get(nextToken) || 0) + 1);
    transitions.set(key, bucket);
    totals.set(key, (totals.get(key) || 0) + 1);
  };

  corpusSentences.forEach((sentence) => {
    const tokens = tokenizeForHarkov(sentence);
    if (tokens.length === 0) return;

    let left = HARKOV_START_LEFT;
    let right = HARKOV_START_RIGHT;
    for (const token of tokens) {
      vocabulary.add(token);
      addTransition(left, right, token);
      left = right;
      right = token;
    }
    addTransition(left, right, HARKOV_END);
  });

  return {
    transitions,
    totals,
    vocabularySize: Math.max(2, vocabulary.size),
  };
}

function getHarkovTransitionProbability(model, left, right, nextToken) {
  if (!model || !model.transitions) return 1e-4;
  const key = makePairKey(left, right);
  const bucket = model.transitions.get(key);
  const total = model.totals.get(key) || 0;
  const count = bucket ? (bucket.get(nextToken) || 0) : 0;
  const denominator = total + model.vocabularySize;
  if (denominator <= 0) return 1e-4;
  return (count + 1) / denominator;
}

function buildCtcPath(tokens, seed) {
  const path = [CTC_BLANK];
  const numericSeed = Math.abs(Number(seed) || 0);

  tokens.forEach((token, index) => {
    const replayPrevious = index > 0 && ((numericSeed + (index * 13)) % 7 === 0);
    if (replayPrevious) path.push(tokens[index - 1]);
    path.push(token);
    if ((numericSeed + (index * 17)) % 5 === 0) {
      path.push(CTC_BLANK);
    }
  });

  path.push(CTC_BLANK);
  return path;
}

function collapseCtcPath(path) {
  const collapsed = [];
  let previous = null;
  for (const token of path) {
    if (token === previous) continue;
    collapsed.push(token);
    previous = token;
  }
  return collapsed.filter((token) => token && token !== CTC_BLANK);
}

function scoreTokenCoverage(tokens, context) {
  const tokenSet = new Set(tokens.map((token) => normalizeToken(token)).filter(Boolean));
  let score = 0;

  const conceptHits = context.conceptTokens.reduce(
    (count, token) => count + (tokenSet.has(token) ? 1 : 0),
    0
  );
  if (conceptHits > 0) {
    score += 0.6 + Math.min(0.24, (conceptHits - 1) * 0.12);
  }

  const anchorHits = context.anchorTokens.reduce(
    (count, token) => count + (tokenSet.has(token) ? 1 : 0),
    0
  );
  if (anchorHits > 0) {
    score += Math.min(0.9, anchorHits * 0.3);
  }

  if (tokenSet.has('percent')) score += 0.2;
  if (tokenSet.has(context.signalBandToken)) score += 0.18;

  return score;
}

function scoreRepetitionPenalty(tokens) {
  const tokenCounts = new Map();
  let repeatedTokenExcess = 0;
  tokens.forEach((token) => {
    const key = normalizeToken(token);
    if (!key) return;
    const nextCount = (tokenCounts.get(key) || 0) + 1;
    tokenCounts.set(key, nextCount);
    if (nextCount > 1) repeatedTokenExcess += 1;
  });

  const bigramCounts = new Map();
  let repeatedBigramExcess = 0;
  for (let index = 1; index < tokens.length; index += 1) {
    const left = normalizeToken(tokens[index - 1]);
    const right = normalizeToken(tokens[index]);
    if (!left || !right) continue;
    const key = `${left} ${right}`;
    const nextCount = (bigramCounts.get(key) || 0) + 1;
    bigramCounts.set(key, nextCount);
    if (nextCount > 1) repeatedBigramExcess += 1;
  }

  return (repeatedTokenExcess * 0.17) + (repeatedBigramExcess * 0.13);
}

// CTC-style decode + Harkov transition likelihood ranking for response selection.
function scoreCandidateWithHarkovCtc(candidate, model, context, seed) {
  const tokens = tokenizeForHarkov(candidate);
  if (tokens.length === 0) return Number.NEGATIVE_INFINITY;

  const ctcPath = buildCtcPath(tokens, seed);
  const decodedTokens = collapseCtcPath(ctcPath);
  if (decodedTokens.length === 0) return Number.NEGATIVE_INFINITY;

  let left = HARKOV_START_LEFT;
  let right = HARKOV_START_RIGHT;
  let logLikelihood = 0;
  decodedTokens.forEach((token) => {
    const probability = getHarkovTransitionProbability(model, left, right, token);
    logLikelihood += Math.log(Math.max(1e-8, probability));
    left = right;
    right = token;
  });
  logLikelihood += Math.log(Math.max(1e-8, getHarkovTransitionProbability(model, left, right, HARKOV_END)));

  const coverage = scoreTokenCoverage(decodedTokens, context);
  const repetitionPenalty = scoreRepetitionPenalty(decodedTokens);
  const lengthPenalty = Math.abs(decodedTokens.length - COMMENTARY_TARGET_WORDS) * 0.045;

  return logLikelihood + coverage - repetitionPenalty - lengthPenalty;
}

function buildCommentaryCorpus(entry, trace, doc, generatedCandidates) {
  const corpus = [];

  const citations = Array.isArray(entry?.citations) ? entry.citations : [];
  citations.forEach((citation) => {
    if (citation?.quote) corpus.push(String(citation.quote));
  });

  const bridges = Array.isArray(entry?.bridges) ? entry.bridges : [];
  bridges.forEach((bridge) => corpus.push(String(bridge || '')));

  const closers = Array.isArray(entry?.closers) ? entry.closers : [];
  closers.forEach((closer) => corpus.push(String(closer || '')));

  splitTraceExplanation(trace).forEach((fragment) => corpus.push(fragment));

  const rawDoc = String(doc?.raw || '');
  if (rawDoc) {
    rawDoc
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .forEach((line) => corpus.push(line));
  }

  generatedCandidates.forEach((candidate) => corpus.push(candidate));

  return corpus
    .map((sentence) => ensureSentence(sentence))
    .filter(Boolean);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  candidates.forEach((candidate) => {
    const normalized = ensureSentence(candidate).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(ensureSentence(candidate));
  });
  return out;
}

function buildResponseCandidates({
  seed,
  entry,
  trace,
  evidencePayload,
  signalBand,
  citation,
}) {
  const scorePercent = evidencePayload.scorePercent;
  const anchorText = evidencePayload.anchorText;
  const evidenceBase = evidencePayload.evidence;
  const explanationBits = splitTraceExplanation(trace);
  const concept = String(entry?.concept || 'craft signal').trim();
  const contribution = Number(trace?.contribution) || 0;
  const contributionRounded = Math.round(contribution * 10) / 10;

  const citationSentence = citation?.quote
    ? `"${String(citation.quote)}"${citation.attribution ? ` (${String(citation.attribution)})` : ''}.`
    : '';

  const leadTemplates = [
    `${concept} reads ${signalBand.label} at ${scorePercent} percent.`,
    `At ${scorePercent} percent, ${concept} pressure stays ${signalBand.label}.`,
    `${scorePercent} percent places this ${concept} signal in a ${signalBand.label} band.`,
    `${concept} remains ${signalBand.label}, with a measured return near ${scorePercent} percent.`,
  ];

  const evidenceTemplates = anchorText
    ? [
      evidenceBase,
      `In this song, anchor terms ${anchorText} carry the local weight for this heuristic.`,
      `In this song, the clearest signals cluster around ${anchorText} at roughly ${scorePercent} percent.`,
      `In this song, ${anchorText} become the strongest local predictors in the current passage.`,
    ]
    : [
      evidenceBase,
      `In this song, the active lines hold a ${signalBand.label} pattern near ${scorePercent} percent.`,
      `In this song, the measured signal remains near ${scorePercent} percent across the stanza set.`,
      `In this song, the present section keeps a ${signalBand.label} profile without a single dominant anchor.`,
    ];

  const bridgeTemplates = [
    ...rotateBySeed(Array.isArray(entry?.bridges) ? entry.bridges : [], seed + 19),
    ...explanationBits.map((bit) => `Heuristic trace: ${bit}`),
    `Weighted contribution lands near ${contributionRounded}.`,
    'The secondary Harkov pass favors coherent transitions over abrupt jumps.',
    'A CTC-style collapse removes noisy repeats before final ranking.',
  ].map((sentence) => ensureSentence(sentence));

  const closerTemplates = [
    ...rotateBySeed(Array.isArray(entry?.closers) ? entry.closers : [], seed + 37),
    'The prediction path remains logically consistent under this read.',
    'The resulting critique holds under line-level inspection.',
    'This keeps the commentary specific, varied, and structurally grounded.',
  ].map((sentence) => ensureSentence(sentence));

  const leadPool = rotateBySeed(leadTemplates, seed + 3).slice(0, 4);
  const evidencePool = rotateBySeed(evidenceTemplates, seed + 11).slice(0, 4);
  const bridgePool = rotateBySeed(bridgeTemplates, seed + 23).filter(Boolean).slice(0, 4);
  const closerPool = rotateBySeed(closerTemplates, seed + 31).filter(Boolean).slice(0, 4);

  const candidates = [];
  const structureModes = [
    ['citation', 'lead', 'bridge', 'evidence', 'closer'],
    ['lead', 'bridge', 'evidence', 'closer'],
    ['lead', 'evidence', 'bridge', 'closer'],
    ['citation', 'lead', 'evidence', 'bridge', 'closer'],
  ];

  for (let leadIndex = 0; leadIndex < leadPool.length; leadIndex += 1) {
    for (let bridgeIndex = 0; bridgeIndex < bridgePool.length; bridgeIndex += 1) {
      const evidence = evidencePool[(leadIndex + bridgeIndex) % evidencePool.length];
      const closer = closerPool[(leadIndex * 2 + bridgeIndex) % closerPool.length];
      const mode = structureModes[(seed + leadIndex + bridgeIndex) % structureModes.length];

      const parts = mode.map((piece) => {
        if (piece === 'citation') return citationSentence;
        if (piece === 'lead') return leadPool[leadIndex];
        if (piece === 'bridge') return bridgePool[bridgeIndex];
        if (piece === 'evidence') return evidence;
        if (piece === 'closer') return closer;
        return '';
      }).filter(Boolean);

      if (parts.length > 0) {
        candidates.push(parts.join(' '));
      }
    }
  }

  candidates.push([
    citationSentence,
    chooseBySeed(entry?.bridges, seed + 29),
    evidenceBase,
    chooseBySeed(entry?.closers, seed + 47),
  ].filter(Boolean).join(' '));

  return dedupeCandidates(candidates);
}

function pickBestCandidate(candidates, model, scoringContext, seed) {
  let bestCandidate = '';
  let bestScore = Number.NEGATIVE_INFINITY;
  let tieBreaker = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const score = scoreCandidateWithHarkovCtc(candidate, model, scoringContext, seed + (index * 17));
    const candidateTie = stableHash(`${candidate}|${seed}`);
    if (
      score > bestScore ||
      (Math.abs(score - bestScore) < 1e-9 && candidateTie < tieBreaker)
    ) {
      bestScore = score;
      tieBreaker = candidateTie;
      bestCandidate = candidate;
    }
  });

  return ensureSentence(bestCandidate);
}

function resolveEntry(trace, phraseBank) {
  const heuristic = String(trace?.heuristic || '').trim();
  if (heuristic && phraseBank?.[heuristic]) {
    return phraseBank[heuristic];
  }
  if (phraseBank?.default) {
    return phraseBank.default;
  }
  return DEFAULT_COMMENTARY_ENTRY;
}

/**
 * Build deterministic criticism commentary for a heuristic trace.
 *
 * @param {import('../schemas').ScoreTrace} trace
 * @param {import('../schemas').AnalyzedDocument} doc
 * @param {Record<string, any>} [phraseBank]
 * @returns {string}
 */
export function buildHeuristicCommentary(trace, doc, phraseBank = PHRASE_BANK) {
  if (!trace || typeof trace !== 'object') return '';

  const entry = resolveEntry(trace, phraseBank);
  const heuristic = String(trace?.heuristic || 'unknown');
  const seed = stableHash(`${heuristic}|${trace?.rawScore}|${trace?.contribution}|${doc?.stats?.wordCount || 0}`);

  const evidencePayload = buildEvidencePayload(trace, doc);
  const signalBand = resolveSignalBand(evidencePayload.scorePercent);
  const citation = chooseBySeed(entry.citations, seed + 11);

  const candidates = buildResponseCandidates({
    seed,
    entry,
    trace,
    evidencePayload,
    signalBand,
    citation,
  });

  const conceptTokens = tokenizeForHarkov(entry?.concept)
    .filter((token) => !STOP_WORDS.has(token));
  const scoringContext = {
    conceptTokens,
    anchorTokens: evidencePayload.anchors.map((token) => normalizeToken(token)).filter(Boolean),
    signalBandToken: signalBand.token,
  };

  const corpus = buildCommentaryCorpus(entry, trace, doc, candidates);
  const harkovModel = buildHarkovTransitionModel(corpus);
  const selected = pickBestCandidate(candidates, harkovModel, scoringContext, seed);
  if (selected) {
    return selected.replace(/\s+/g, ' ').trim();
  }

  const fallback = [
    citation?.quote
      ? `"${citation.quote}"${citation.attribution ? ` (${citation.attribution})` : ''}.`
      : '',
    chooseBySeed(entry.bridges, seed + 29) || '',
    evidencePayload.evidence,
    chooseBySeed(entry.closers, seed + 47) || '',
  ].filter(Boolean).join(' ');

  return ensureSentence(fallback).replace(/\s+/g, ' ').trim();
}

/**
 * Build commentary for every trace in a score payload.
 *
 * @param {import('../schemas').ScoreTrace[]} traces
 * @param {import('../schemas').AnalyzedDocument} doc
 * @param {Record<string, any>} [phraseBank]
 * @returns {import('../schemas').ScoreTrace[]}
 */
export function attachHeuristicCommentary(traces, doc, phraseBank = PHRASE_BANK) {
  if (!Array.isArray(traces)) return [];
  return traces.map((trace) => ({
    ...trace,
    commentary: buildHeuristicCommentary(trace, doc, phraseBank),
  }));
}
