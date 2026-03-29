import { createLexiconAbyssService } from './lexiconAbyss.service.js';
import { createWordLookupService } from './wordLookup.service.js';

const ORACLE_VERSION = '0.1.0';
const GENERIC_PERSONA = 'The Phonemic Oracle';
const DECAY_WARNING_THRESHOLD = 0.85;
const MIN_GAIN_THRESHOLD = 0.05;
const MAX_INSIGHTS = 4;
const MAX_SUGGESTIONS = 3;

const PERSONA_BY_HEURISTIC = Object.freeze({
  phoneme_density: 'The Vowel Scribe',
  alliteration_density: 'The Vowel Scribe',
  rhyme_quality: 'The Echo Warden',
  vocabulary_richness: 'The Echo Warden',
  emotional_resonance: 'The Neural Archon',
  literary_device_richness: 'The Substance Chronicler',
  meter_regularity: 'The Pulse Arbiter',
  scroll_power: 'The Pulse Arbiter',
});

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeWord(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, '');
}

function collectVerseTokens(text) {
  return new Set(
    (String(text || '').match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [])
      .map((token) => normalizeWord(token))
      .filter(Boolean)
  );
}

function createInsight(id, category, message, evidence = [], scoreImpact = null) {
  const insight = {
    id,
    category,
    message,
  };
  if (Array.isArray(evidence) && evidence.length > 0) {
    insight.evidence = evidence;
  }
  if (Number.isFinite(Number(scoreImpact))) {
    insight.scoreImpact = Number(Number(scoreImpact).toFixed(3));
  }
  return insight;
}

function aggregateHiddenStateCounts(hhmSummary) {
  const counts = {};
  const stanzas = Array.isArray(hhmSummary?.stanzas) ? hhmSummary.stanzas : [];
  stanzas.forEach((stanza) => {
    const stanzaCounts = stanza?.hiddenStateCounts;
    if (!stanzaCounts || typeof stanzaCounts !== 'object') return;
    Object.entries(stanzaCounts).forEach(([key, value]) => {
      counts[key] = (counts[key] || 0) + (Number(value) || 0);
    });
  });
  return counts;
}

function buildHhmInsights(hhmSummary) {
  if (!hhmSummary || typeof hhmSummary !== 'object') return [];

  const insights = [];
  const counts = aggregateHiddenStateCounts(hhmSummary);
  const tokenCount = Number(hhmSummary?.tokenCount) || 0;
  const launchCount = counts.line_launch || 0;
  const flowCount = counts.flow || 0;
  const terminalCount = counts.terminal_anchor || 0;
  const functionGateCount = counts.function_gate || 0;

  if (launchCount >= 3 && launchCount > flowCount * 1.35) {
    insights.push(createInsight(
      'hhm-launch-flow',
      'TECHNICAL',
      'Your kinetic launch is outrunning sustained flow. The bar starts hot, then drops its resonance before the line can settle.',
      [`line_launch:${launchCount}`, `flow:${flowCount}`],
      (flowCount - launchCount) / Math.max(launchCount, 1)
    ));
  }

  if (tokenCount >= 8 && terminalCount === 0) {
    insights.push(createInsight(
      'hhm-terminal-anchor',
      'WARNING',
      'The stanza lacks a terminal anchor. Your endings are landing without a stabilizing vowel root.',
      [`tokens:${tokenCount}`, 'terminal_anchor:0'],
      -0.12
    ));
  }

  if (tokenCount >= 8 && functionGateCount / Math.max(tokenCount, 1) >= 0.28) {
    insights.push(createInsight(
      'hhm-function-gate',
      'STRATEGIC',
      'Function gates are crowding the payload. Trim connective tissue so the content words carry more mass per line.',
      [`function_gate:${functionGateCount}`, `tokens:${tokenCount}`],
      -0.08
    ));
  }

  return insights;
}

function buildAmplifierInsight(verseIRAmplifier) {
  const inexplicableMatches = Array.isArray(verseIRAmplifier?.elementMatches?.inexplicable)
    ? verseIRAmplifier.elementMatches.inexplicable
    : [];
  if (inexplicableMatches.length === 0 && verseIRAmplifier?.dominantTier !== 'INEXPLICABLE') {
    return null;
  }

  const evidence = inexplicableMatches
    .slice(0, 3)
    .map((match) => `${String(match?.label || 'inexplicable').trim()}:${Number(match?.hits) || 0}`);

  return createInsight(
    'amplifier-inexplicable',
    'ARCANE',
    'You have breached source-law. The verse is producing inexplicable resonance that reads more like authorship over language than reuse of it.',
    evidence,
    0.18
  );
}

async function buildDecaySuggestions(decayedDetails, { text, wordLookupService, lexiconAbyssService, log }) {
  const usedTokens = collectVerseTokens(text);
  const suggestions = [];

  for (const detail of decayedDetails) {
    const original = normalizeWord(detail?.token);
    if (!original) continue;

    try {
      const lookupResult = await wordLookupService.lookupWord(original);
      const synonymPool = Array.isArray(lookupResult?.data?.synonyms)
        ? lookupResult.data.synonyms
        : [];
      const candidates = [...new Set(
        synonymPool
          .map((candidate) => normalizeWord(candidate))
          .filter((candidate) => candidate && !usedTokens.has(candidate) && candidate !== original && !candidate.includes(' '))
      )].slice(0, 6);

      if (candidates.length === 0) continue;

      const candidateSignals = await Promise.all(
        candidates.map(async (candidate) => {
          const signal = await lexiconAbyssService.resolveResonance({ text: candidate });
          return {
            candidate,
            multiplier: toFiniteNumber(signal?.averageMultiplier, 1),
          };
        })
      );

      const best = candidateSignals.sort((left, right) => right.multiplier - left.multiplier)[0] || null;
      if (!best || best.multiplier <= (Number(detail?.multiplier) || 0) + MIN_GAIN_THRESHOLD) {
        continue;
      }

      suggestions.push({
        original,
        suggested: best.candidate,
        reason: `${best.candidate} is currently carrying more abyssal resonance than ${original}.`,
        resonanceGain: Number((best.multiplier - (Number(detail?.multiplier) || 0)).toFixed(3)),
      });
    } catch (error) {
      log?.warn?.({ err: error, token: original }, '[PhonemicOracleService] Suggestion lookup failed');
    }

    if (suggestions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}

function buildDecayInsight(decayedDetails) {
  if (!Array.isArray(decayedDetails) || decayedDetails.length === 0) return null;
  const mostDecayed = decayedDetails[0];
  const evidence = decayedDetails
    .slice(0, 3)
    .map((detail) => `${detail.token}:${Number(detail.multiplier).toFixed(2)}`);

  return createInsight(
    'abyss-semantic-decay',
    'WARNING',
    `The Abyss is exhausting ${mostDecayed.token}. Its stored mass has dropped to ${Number(mostDecayed.multiplier).toFixed(2)}x, so repeated casting is leaking power.`,
    evidence,
    -Math.max(0, 1 - (Number(mostDecayed.multiplier) || 0))
  );
}

function pickPersona(scoreData, verseIRAmplifier) {
  if (verseIRAmplifier?.dominantTier === 'INEXPLICABLE') {
    return GENERIC_PERSONA;
  }

  const traces = Array.isArray(scoreData?.traces) ? scoreData.traces : [];
  const leadTrace = traces
    .filter((trace) => trace && typeof trace === 'object')
    .slice()
    .sort((left, right) => (Number(right?.contribution) || 0) - (Number(left?.contribution) || 0))[0];

  return PERSONA_BY_HEURISTIC[String(leadTrace?.heuristic || '')] || GENERIC_PERSONA;
}

function pickMood({ hasAwe, hasDecay, positiveSignal }) {
  if (hasAwe) return 'AWE';
  if (hasDecay) return 'CRITICAL';
  if (positiveSignal >= 0.7) return 'ENLIGHTENED';
  return 'OBSERVANT';
}

function buildSummary({ persona, mood, insights, suggestions }) {
  if (mood === 'AWE') {
    return `${persona} detects source-law turbulence. Something in the verse is exceeding ordinary semantic resonance.`;
  }
  if (suggestions.length > 0) {
    return `${persona} has identified decaying lexemes and found stronger replacements in the active field.`;
  }
  if (insights.length > 0) {
    return insights[0].message;
  }
  return `${persona} detects no urgent instability. The verse is structurally legible but still has unused headroom.`;
}

export function createPhonemicOracleService(options = {}) {
  const log = options.log ?? console;
  const lexiconAbyssService = options.lexiconAbyssService || createLexiconAbyssService({ log });
  const ownsLexiconAbyssService = !options.lexiconAbyssService;
  const wordLookupService = options.wordLookupService || createWordLookupService({ log });

  async function analyzeVerse({ text = '', verseIR = null, hhmSummary = null, scoreData = null, verseIRAmplifier = null } = {}) {
    const normalizedText = String(text || '');
    if (!normalizedText.trim()) return null;

    const insights = [];
    insights.push(...buildHhmInsights(hhmSummary));

    const amplifierInsight = buildAmplifierInsight(verseIRAmplifier);
    if (amplifierInsight) {
      insights.push(amplifierInsight);
    }

    let suggestions = [];
    let decayedDetails = [];

    try {
      const resonance = await lexiconAbyssService.resolveResonance({ text: normalizedText, verseIR });
      decayedDetails = Array.isArray(resonance?.tokenDetails)
        ? resonance.tokenDetails
          .filter((detail) => Number(detail?.multiplier) > 0 && Number(detail?.multiplier) < DECAY_WARNING_THRESHOLD)
          .sort((left, right) => (Number(left?.multiplier) || 1) - (Number(right?.multiplier) || 1))
          .slice(0, MAX_SUGGESTIONS)
        : [];
      const decayInsight = buildDecayInsight(decayedDetails);
      if (decayInsight) {
        insights.push(decayInsight);
      }
      suggestions = await buildDecaySuggestions(decayedDetails, {
        text: normalizedText,
        wordLookupService,
        lexiconAbyssService,
        log,
      });
    } catch (error) {
      log?.warn?.({ err: error }, '[PhonemicOracleService] Abyss resonance analysis failed');
    }

    const persona = pickPersona(scoreData, verseIRAmplifier);
    const positiveSignal = Array.isArray(scoreData?.traces)
      ? scoreData.traces.reduce((sum, trace) => sum + Math.max(0, Number(trace?.rawScore) || 0), 0) / Math.max(scoreData.traces.length, 1)
      : 0;
    const mood = pickMood({
      hasAwe: Boolean(amplifierInsight),
      hasDecay: decayedDetails.length > 0,
      positiveSignal,
    });

    return {
      version: ORACLE_VERSION,
      persona,
      mood,
      summary: buildSummary({
        persona,
        mood,
        insights,
        suggestions,
      }),
      insights: insights.slice(0, MAX_INSIGHTS),
      suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
    };
  }

  function close() {
    if (ownsLexiconAbyssService) {
      lexiconAbyssService.close?.();
    }
  }

  return {
    analyzeVerse,
    close,
  };
}
