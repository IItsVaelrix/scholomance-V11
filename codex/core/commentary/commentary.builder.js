import { PHRASE_BANK, DEFAULT_COMMENTARY_ENTRY } from './phrase-bank.js';

const FALLBACK_TOKEN_LIMIT = 4;

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

function normalizeToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .replace(/^['-]+|['-]+$/g, '');
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

function buildEvidenceSentence(trace, doc) {
  const scorePercent = Math.round(clamp01(Number(trace?.rawScore) || 0) * 100);
  const anchors = collectAnchorTokens(trace, doc);
  if (anchors.length === 0) {
    return `In this song, the measured signal settles near ${scorePercent} percent across the active lines.`;
  }

  const anchorText = formatTokenList(anchors);
  return `In this song, the measured signal settles near ${scorePercent} percent around ${anchorText}.`;
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

  const citation = chooseBySeed(entry.citations, seed + 11);
  const bridge = chooseBySeed(entry.bridges, seed + 29) || '';
  const closer = chooseBySeed(entry.closers, seed + 47) || '';
  const evidence = buildEvidenceSentence(trace, doc);

  const parts = [];
  if (citation?.quote) {
    const attribution = citation.attribution ? ` (${citation.attribution})` : '';
    parts.push(`"${citation.quote}"${attribution}.`);
  }
  if (bridge) parts.push(bridge);
  if (evidence) parts.push(evidence);
  if (closer) parts.push(closer);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
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

