import { createLexiconAbyssService } from './lexiconAbyss.service.js';
import { createWordLookupService } from './wordLookup.service.js';

const NARRATIVE_AMP_VERSION = '1.0.0';
const GENERIC_NARRATOR = 'VerseIR Narrative AMP';
const DECAY_WARNING_THRESHOLD = 0.85;
const MIN_GAIN_THRESHOLD = 0.05;
const MAX_BEATS = 5;
const MAX_REVISIONS = 3;

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
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

function formatHeuristicLabel(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createBeat(id, tone, title, message, evidence = [], signal = null) {
  const beat = {
    id,
    tone,
    title,
    message,
  };
  if (Array.isArray(evidence) && evidence.length > 0) {
    beat.evidence = evidence;
  }
  if (Number.isFinite(Number(signal))) {
    beat.signal = Number(Number(signal).toFixed(3));
  }
  return beat;
}

function getLeadingTrace(scoreData) {
  const traces = Array.isArray(scoreData?.traces) ? scoreData.traces : [];
  return traces
    .filter((trace) => trace && typeof trace === 'object')
    .slice()
    .sort((left, right) => (Number(right?.contribution) || 0) - (Number(left?.contribution) || 0))[0] || null;
}

function buildVerseIRBeat(verseIR) {
  const tokenCount = Number(verseIR?.metadata?.tokenCount) || Number(verseIR?.tokens?.length) || 0;
  const lineCount = Number(verseIR?.metadata?.lineCount) || Number(verseIR?.lines?.length) || 0;
  const syllableWindowCount = Number(verseIR?.metadata?.syllableWindowCount) || Number(verseIR?.syllableWindows?.length) || 0;
  const mode = String(verseIR?.metadata?.mode || 'balanced');

  if (tokenCount <= 0 || lineCount <= 0) {
    return null;
  }

  return createBeat(
    'verseir-substrate',
    'TECHNICAL',
    'VerseIR substrate',
    `VerseIR compiled ${tokenCount} tokens across ${lineCount} lines into ${syllableWindowCount} syllable windows in ${mode} mode.`,
    [
      `tokens:${tokenCount}`,
      `lines:${lineCount}`,
      `windows:${syllableWindowCount}`,
      `mode:${mode}`,
    ],
    clamp01(syllableWindowCount / Math.max(tokenCount, 1))
  );
}

function buildAmplifierBeat(verseIRAmplifier) {
  if (!verseIRAmplifier || typeof verseIRAmplifier !== 'object') return null;

  const dominantTier = String(verseIRAmplifier?.dominantTier || 'NONE');
  const dominantArchetype = String(verseIRAmplifier?.dominantArchetype?.label || '').trim();
  const noveltySignal = clamp01(Number(verseIRAmplifier?.noveltySignal) || 0);
  const semanticDepth = clamp01(Number(verseIRAmplifier?.semanticDepth) || 0);
  const raritySignal = clamp01(Number(verseIRAmplifier?.raritySignal) || 0);
  if (dominantTier === 'NONE' && noveltySignal <= 0 && semanticDepth <= 0 && raritySignal <= 0) {
    return null;
  }

  let tone = 'STRUCTURAL';
  let message = 'VerseIR is keeping the narrative lane stable, with the active archetype carrying the clearest semantic anchor.';

  if (dominantTier === 'INEXPLICABLE') {
    tone = 'ARCANE';
    message = dominantArchetype
      ? `${dominantArchetype} has pushed the VerseIR amplifier into an inexplicable tier. The verse is behaving like authored source-law, not a routine cast.`
      : 'VerseIR has pushed the amplifier into an inexplicable tier. The verse is behaving like authored source-law, not a routine cast.';
  } else if (dominantTier === 'RARE') {
    tone = 'ARCANE';
    message = dominantArchetype
      ? `${dominantArchetype} is routing a rare amplifier lane, increasing semantic depth without collapsing the line structure.`
      : 'A rare amplifier lane is increasing semantic depth without collapsing the line structure.';
  } else if (dominantArchetype) {
    message = `${dominantArchetype} is the dominant semantic anchor inside the amplifier field. VerseIR is reading it as the clearest narrative lane.`;
  }

  return createBeat(
    'verseir-amplifier',
    tone,
    'Amplifier lane',
    message,
    [
      `tier:${dominantTier}`,
      `archetype:${dominantArchetype || 'none'}`,
      `novelty:${noveltySignal.toFixed(2)}`,
      `depth:${semanticDepth.toFixed(2)}`,
      `rarity:${raritySignal.toFixed(2)}`,
    ],
    Math.max(noveltySignal, semanticDepth, raritySignal)
  );
}

function buildTrueVisionBeat(verseIRAmplifier) {
  const dominantBand = String(verseIRAmplifier?.trueVision?.dominantBand?.label || '').trim();
  const confidence = clamp01(Number(verseIRAmplifier?.trueVision?.confidence) || 0);
  const salientWindows = Array.isArray(verseIRAmplifier?.trueVision?.salientWindows)
    ? verseIRAmplifier.trueVision.salientWindows
    : [];

  if (!dominantBand || confidence < 0.45) {
    return null;
  }

  return createBeat(
    'truevision-wavefront',
    'TECHNICAL',
    'Travelling-wave lock',
    `${dominantBand} is carrying the travelling-wave front. VerseIR is holding cochlear lock at ${(confidence * 100).toFixed(0)}% confidence.`,
    salientWindows
      .slice(0, 3)
      .map((window) => `${String(window?.signature || 'window').slice(0, 48)}:${Number(window?.confidence || 0).toFixed(2)}`),
    confidence
  );
}

function buildHeuristicBeat(scoreData) {
  const leadingTrace = getLeadingTrace(scoreData);
  if (!leadingTrace) return null;

  const heuristic = formatHeuristicLabel(leadingTrace.heuristic);
  const contribution = toFiniteNumber(leadingTrace.contribution, 0);
  const rawScore = clamp01(Number(leadingTrace.rawScore) || 0);
  const weight = toFiniteNumber(leadingTrace.weight, 0);

  return createBeat(
    'resolved-heuristic',
    'STRUCTURAL',
    'Resolved pressure point',
    `${heuristic || 'Resolved Heuristic'} is the leading pressure point at ${contribution.toFixed(1)} contribution. This is the most legible force in the current cast.`,
    [
      `heuristic:${String(leadingTrace.heuristic || 'unknown')}`,
      `signal:${rawScore.toFixed(2)}`,
      `weight:${weight.toFixed(2)}`,
    ],
    rawScore
  );
}

function buildHhmBeat(hhmSummary) {
  if (!hhmSummary || typeof hhmSummary !== 'object' || !hhmSummary.enabled) {
    return null;
  }

  const tokenCount = Number(hhmSummary.tokenCount) || 0;
  const stanzaCount = Number(hhmSummary.stanzaCount) || 0;
  const model = String(hhmSummary.model || 'hidden_harkov_model');
  if (tokenCount <= 0) {
    return null;
  }

  return createBeat(
    'hhm-routing',
    'TECHNICAL',
    'Syntax relay',
    `${model} staged ${tokenCount} tokens across ${stanzaCount} stanzas before the VerseIR projection resolved the narrative lane.`,
    [
      `tokens:${tokenCount}`,
      `stanzas:${stanzaCount}`,
      `model:${model}`,
    ]
  );
}

function buildDecayBeat(decayedDetails) {
  if (!Array.isArray(decayedDetails) || decayedDetails.length === 0) return null;

  const mostDecayed = decayedDetails[0];
  return createBeat(
    'abyssal-decay',
    'REVISION',
    'Abyssal drag',
    `The Abyss is exhausting ${mostDecayed.token}. Its stored mass has dropped to ${Number(mostDecayed.multiplier).toFixed(2)}x, so repetition is bleeding force out of the line.`,
    decayedDetails
      .slice(0, 3)
      .map((detail) => `${detail.token}:${Number(detail.multiplier).toFixed(2)}`),
    clamp01(1 - (Number(mostDecayed.multiplier) || 0))
  );
}

async function buildDecayRevisions(decayedDetails, { text, wordLookupService, lexiconAbyssService, log }) {
  const usedTokens = collectVerseTokens(text);
  const revisions = [];

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

      revisions.push({
        original,
        suggested: best.candidate,
        reason: `${best.candidate} is currently holding more abyssal resonance than ${original}.`,
        resonanceGain: Number((best.multiplier - (Number(detail?.multiplier) || 0)).toFixed(3)),
      });
    } catch (error) {
      log?.warn?.({ err: error, token: original }, '[NarrativeAMPService] Revision lookup failed');
    }

    if (revisions.length >= MAX_REVISIONS) {
      break;
    }
  }

  return revisions;
}

function buildNarrator(verseIRAmplifier, scoreData) {
  const dominantTier = String(verseIRAmplifier?.dominantTier || '');
  if (dominantTier === 'INEXPLICABLE') {
    return 'Source-Law Relay';
  }

  const dominantArchetype = String(verseIRAmplifier?.dominantArchetype?.label || '').trim();
  if (dominantArchetype) {
    return `${dominantArchetype} Relay`;
  }

  const leadingTrace = getLeadingTrace(scoreData);
  if (leadingTrace?.heuristic) {
    return `${formatHeuristicLabel(leadingTrace.heuristic)} Relay`;
  }

  return GENERIC_NARRATOR;
}

function buildMood({ verseIRAmplifier, decayedDetails, positiveSignal }) {
  const dominantTier = String(verseIRAmplifier?.dominantTier || 'NONE');
  const trueVisionConfidence = clamp01(Number(verseIRAmplifier?.trueVision?.confidence) || 0);
  const noveltySignal = clamp01(Number(verseIRAmplifier?.noveltySignal) || 0);
  const semanticDepth = clamp01(Number(verseIRAmplifier?.semanticDepth) || 0);

  if (dominantTier === 'INEXPLICABLE' || trueVisionConfidence >= 0.8) return 'AWE';
  if ((Array.isArray(decayedDetails) && decayedDetails.length > 0) || positiveSignal < 0.35) return 'CRITICAL';
  if (positiveSignal >= 0.7 || ((noveltySignal + semanticDepth) / 2) >= 0.6) return 'ENLIGHTENED';
  return 'OBSERVANT';
}

function buildResonance(verseIR, verseIRAmplifier, scoreData) {
  const leadingTrace = getLeadingTrace(scoreData);
  return {
    source: 'VERSEIR',
    tokenCount: Number(verseIR?.metadata?.tokenCount) || Number(verseIR?.tokens?.length) || 0,
    lineCount: Number(verseIR?.metadata?.lineCount) || Number(verseIR?.lines?.length) || 0,
    activeAmplifiers: Number(verseIRAmplifier?.activeAmplifiers) || 0,
    dominantTier: String(verseIRAmplifier?.dominantTier || 'NONE'),
    dominantArchetype: verseIRAmplifier?.dominantArchetype && typeof verseIRAmplifier.dominantArchetype === 'object'
      ? verseIRAmplifier.dominantArchetype
      : null,
    noveltySignal: Number(clamp01(Number(verseIRAmplifier?.noveltySignal) || 0).toFixed(3)),
    semanticDepth: Number(clamp01(Number(verseIRAmplifier?.semanticDepth) || 0).toFixed(3)),
    raritySignal: Number(clamp01(Number(verseIRAmplifier?.raritySignal) || 0).toFixed(3)),
    trueVisionBand: String(verseIRAmplifier?.trueVision?.dominantBand?.label || '') || null,
    trueVisionConfidence: Number(clamp01(Number(verseIRAmplifier?.trueVision?.confidence) || 0).toFixed(3)),
    leadingHeuristic: String(leadingTrace?.heuristic || '') || null,
    leadingContribution: Number(toFiniteNumber(leadingTrace?.contribution, 0).toFixed(3)),
  };
}

function buildSummary({ narrator, mood, beats, revisions, resonance }) {
  if (mood === 'AWE') {
    return `${narrator} detects source-law turbulence. VerseIR is carrying a resonance profile that exceeds routine cast behavior.`;
  }
  if (revisions.length > 0) {
    return `${narrator} has identified decaying lexemes and plotted stronger replacements through the VerseIR field.`;
  }
  if (beats.length > 0) {
    return beats[0].message;
  }
  if ((Number(resonance?.semanticDepth) || 0) > 0.55) {
    return `${narrator} reads stable semantic depth with room to push novelty harder without losing coherence.`;
  }
  return `${narrator} detects no urgent fracture. The cast is readable, but the VerseIR field still has unused headroom.`;
}

export function createNarrativeAMPService(options = {}) {
  const log = options.log ?? console;
  const lexiconAbyssService = options.lexiconAbyssService || createLexiconAbyssService({ log });
  const ownsLexiconAbyssService = !options.lexiconAbyssService;
  const wordLookupService = options.wordLookupService || createWordLookupService({ log });

  async function analyzeVerse({ text = '', verseIR = null, hhmSummary = null, scoreData = null, verseIRAmplifier = null } = {}) {
    const normalizedText = String(text || '');
    if (!normalizedText.trim()) return null;

    let decayedDetails = [];
    let revisions = [];

    try {
      const resonance = await lexiconAbyssService.resolveResonance({ text: normalizedText, verseIR });
      decayedDetails = Array.isArray(resonance?.tokenDetails)
        ? resonance.tokenDetails
          .filter((detail) => Number(detail?.multiplier) > 0 && Number(detail?.multiplier) < DECAY_WARNING_THRESHOLD)
          .sort((left, right) => (Number(left?.multiplier) || 1) - (Number(right?.multiplier) || 1))
          .slice(0, MAX_REVISIONS)
        : [];
      revisions = await buildDecayRevisions(decayedDetails, {
        text: normalizedText,
        wordLookupService,
        lexiconAbyssService,
        log,
      });
    } catch (error) {
      log?.warn?.({ err: error }, '[NarrativeAMPService] Abyss resonance analysis failed');
    }

    const beats = [
      buildVerseIRBeat(verseIR),
      buildAmplifierBeat(verseIRAmplifier),
      buildTrueVisionBeat(verseIRAmplifier),
      buildHhmBeat(hhmSummary),
      buildHeuristicBeat(scoreData),
      buildDecayBeat(decayedDetails),
    ].filter(Boolean).slice(0, MAX_BEATS);

    const positiveSignal = Array.isArray(scoreData?.traces)
      ? scoreData.traces.reduce((sum, trace) => sum + Math.max(0, Number(trace?.rawScore) || 0), 0) / Math.max(scoreData.traces.length, 1)
      : 0;

    const narrator = buildNarrator(verseIRAmplifier, scoreData);
    const mood = buildMood({
      verseIRAmplifier,
      decayedDetails,
      positiveSignal,
    });
    const resonance = buildResonance(verseIR, verseIRAmplifier, scoreData);

    return {
      version: NARRATIVE_AMP_VERSION,
      engine: 'VERSEIR',
      narrator,
      mood,
      summary: buildSummary({
        narrator,
        mood,
        beats,
        revisions,
        resonance,
      }),
      beats,
      revisions: revisions.slice(0, MAX_REVISIONS),
      resonance,
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
