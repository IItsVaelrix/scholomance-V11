/**
 * Canonical backend service for Read-page panel analysis payloads.
 * Produces unified data for rhyme/scheme, score, and vowel-family panels.
 */

import { analyzeText } from '../../core/analysis.pipeline.js';
import { createScoringEngine } from '../../core/scoring.engine.js';
import { alliterationDensityHeuristic } from '../../core/heuristics/alliteration_density.js';
import { literaryDeviceRichnessHeuristic } from '../../core/heuristics/literary_device_richness.js';
import { meterRegularityHeuristic } from '../../core/heuristics/meter_regularity.js';
import { phonemeDensityHeuristic } from '../../core/heuristics/phoneme_density.js';
import { rhymeQualityHeuristic } from '../../core/heuristics/rhyme_quality.js';
import { vocabularyRichnessHeuristic } from '../../core/heuristics/vocabulary_richness.js';
import { DeepRhymeEngine } from '../../../src/lib/deepRhyme.engine.js';
import { detectScheme, analyzeMeter } from '../../../src/lib/rhymeScheme.detector.js';
import { analyzeLiteraryDevices, detectEmotion } from '../../../src/lib/literaryDevices.detector.js';

const SCORE_HEURISTICS = [
  phonemeDensityHeuristic,
  alliterationDensityHeuristic,
  rhymeQualityHeuristic,
  meterRegularityHeuristic,
  literaryDeviceRichnessHeuristic,
  vocabularyRichnessHeuristic,
];

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

function createScoreEngine() {
  const engine = createScoringEngine();
  SCORE_HEURISTICS.forEach((heuristicDef) => {
    engine.registerHeuristic({
      heuristic: heuristicDef.name,
      scorer: heuristicDef.scorer,
      weight: heuristicDef.weight,
    });
  });
  return engine;
}

function toSerializableGroupEntries(value) {
  const map = value instanceof Map
    ? value
    : Array.isArray(value)
      ? new Map(value.filter((entry) => Array.isArray(entry) && entry.length === 2))
      : new Map();

  return Array.from(map.entries()).map(([group, lineIndices]) => [
    String(group),
    Array.isArray(lineIndices)
      ? lineIndices.filter((lineIndex) => Number.isInteger(lineIndex))
      : [],
  ]);
}

function summarizeVowelFamilies(analyzedDoc) {
  if (!analyzedDoc || !Array.isArray(analyzedDoc.allWords)) {
    return EMPTY_VOWEL_SUMMARY;
  }

  const familyCounts = new Map();
  const uniqueWords = new Set();

  for (const analyzedWord of analyzedDoc.allWords) {
    const normalized = String(analyzedWord?.normalized || '').trim().toUpperCase();
    if (normalized) {
      uniqueWords.add(normalized);
    }

    const familyId = String(analyzedWord?.phonetics?.vowelFamily || '').trim().toUpperCase();
    if (!familyId) continue;
    familyCounts.set(familyId, (familyCounts.get(familyId) || 0) + 1);
  }

  const totalWords = Array.from(familyCounts.values()).reduce((sum, count) => sum + count, 0);

  const families = Array.from(familyCounts.entries())
    .map(([id, count]) => ({
      id,
      count,
      percent: totalWords > 0 ? count / totalWords : 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.localeCompare(b.id);
    });

  return {
    families,
    totalWords,
    uniqueWords: uniqueWords.size,
  };
}

function toMinimalAnalysisPayload(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return null;
  }

  return {
    allConnections: Array.isArray(analysis.allConnections) ? analysis.allConnections : [],
    statistics: analysis.statistics || null,
    schemePattern: typeof analysis.schemePattern === 'string' ? analysis.schemePattern : '',
    rhymeGroups: toSerializableGroupEntries(analysis.rhymeGroups),
  };
}

function createEmptyPanelPayload() {
  return {
    analysis: null,
    scheme: null,
    meter: null,
    literaryDevices: [],
    emotion: 'Neutral',
    scoreData: null,
    vowelSummary: EMPTY_VOWEL_SUMMARY,
  };
}

function normalizeInputText(rawText) {
  if (typeof rawText === 'string') return rawText;
  if (rawText === null || rawText === undefined) return '';
  return String(rawText);
}

export function createPanelAnalysisService(options = {}) {
  const log = options.log ?? console;
  const scoreEngine = createScoreEngine();
  const deepRhymeEngine = new DeepRhymeEngine();

  function analyzePanels(rawText) {
    const text = normalizeInputText(rawText);
    if (!text.trim()) {
      return createEmptyPanelPayload();
    }

    try {
      const analyzedDoc = analyzeText(text);
      const scoreData = scoreEngine.calculateScore(analyzedDoc);

      const deepAnalysis = deepRhymeEngine.analyzeDocument(text);
      const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
      const meter = analyzeMeter(deepAnalysis.lines);
      const literaryDevices = analyzeLiteraryDevices(text);
      const emotion = detectEmotion(text);

      return {
        analysis: toMinimalAnalysisPayload(deepAnalysis),
        scheme: scheme
          ? {
            ...scheme,
            groups: toSerializableGroupEntries(scheme.groups),
          }
          : null,
        meter,
        literaryDevices,
        emotion,
        scoreData,
        vowelSummary: summarizeVowelFamilies(analyzedDoc),
      };
    } catch (error) {
      log?.error?.({ err: error }, '[PanelAnalysisService] Failed to analyze panel payload');
      throw error;
    }
  }

  return {
    analyzePanels,
  };
}
