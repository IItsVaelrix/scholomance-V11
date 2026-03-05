/**
 * Canonical backend service for Read-page panel analysis payloads.
 * Produces unified data for rhyme/scheme, score, and vowel-family panels.
 */

import { analyzeText } from '../../core/analysis.pipeline.js';
import { createScoringEngine } from '../../core/scoring.engine.js';
import { PhonemeEngine } from '../../../src/lib/phonology/phoneme.engine.js';
import { alliterationDensityHeuristic } from '../../core/heuristics/alliteration_density.js';
import { literaryDeviceRichnessHeuristic } from '../../core/heuristics/literary_device_richness.js';
import { meterRegularityHeuristic } from '../../core/heuristics/meter_regularity.js';
import { phonemeDensityHeuristic } from '../../core/heuristics/phoneme_density.js';
import { rhymeQualityHeuristic } from '../../core/heuristics/rhyme_quality.js';
import { scrollPowerHeuristic } from '../../core/heuristics/scroll_power.js';
import { vocabularyRichnessHeuristic } from '../../core/heuristics/vocabulary_richness.js';
import { phoneticHackingHeuristic } from '../../core/heuristics/phonetic_hacking.js';
import { DeepRhymeEngine } from '../../../src/lib/deepRhyme.engine.js';
import { detectScheme, analyzeMeter } from '../../../src/lib/rhymeScheme.detector.js';
import { analyzeLiteraryDevices, detectEmotion } from '../../../src/lib/literaryDevices.detector.js';
import { normalizeVowelFamily } from '../../../src/lib/phonology/vowelFamily.js';
import { buildSyntaxLayer } from '../../../src/lib/syntax.layer.js';
import { LiteraryClassifier } from '../../../src/lib/literaryClassifier.js';
import { parseBooleanFlag } from '../utils/envFlags.js';

const SCORE_HEURISTICS = [
  phonemeDensityHeuristic,
  alliterationDensityHeuristic,
  rhymeQualityHeuristic,
  scrollPowerHeuristic,
  meterRegularityHeuristic,
  literaryDeviceRichnessHeuristic,
  vocabularyRichnessHeuristic,
  phoneticHackingHeuristic,
];

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

function getPrimaryStressedVowelFamily(analyzedWord) {
  const syllables = Array.isArray(analyzedWord?.deepPhonetics?.syllables)
    ? analyzedWord.deepPhonetics.syllables
    : [];
  const stressed = syllables.find((syllable) => Number(syllable?.stress) > 0) || syllables[0];
  const fallback = analyzedWord?.phonetics?.vowelFamily;
  return normalizeVowelFamily(stressed?.vowelFamily || fallback);
}

function buildAnalysisWordProfiles(analyzedDoc, syntaxLayer = null) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  const profiles = [];

  for (const line of lines) {
    const lineIndex = Number.isInteger(line?.number) ? line.number : 0;
    const words = Array.isArray(line?.words) ? line.words : [];
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const analyzedWord = words[wordIndex];
      const charStart = Number.isInteger(analyzedWord?.start) ? analyzedWord.start : -1;
      const syntaxIdentity = `${lineIndex}:${wordIndex}:${charStart}`;
      const syntaxToken = syntaxLayer
        ? (
          syntaxLayer.tokenByIdentity?.get?.(syntaxIdentity) ||
          syntaxLayer.tokenByCharStart?.get?.(charStart) ||
          null
        )
        : null;
      profiles.push({
        word: String(analyzedWord?.text || ''),
        normalizedWord: String(analyzedWord?.normalized || '').toUpperCase(),
        lineIndex,
        wordIndex,
        charStart,
        charEnd: Number.isInteger(analyzedWord?.end) ? analyzedWord.end : -1,
        vowelFamily: getPrimaryStressedVowelFamily(analyzedWord) || null,
        syllableCount: Number(analyzedWord?.syllableCount) || 0,
        rhymeKey: analyzedWord?.deepPhonetics?.rhymeKey || analyzedWord?.phonetics?.rhymeKey || null,
        stressPattern: String(analyzedWord?.deepPhonetics?.stressPattern || ''),
        role: String(syntaxToken?.role || ''),
        lineRole: String(syntaxToken?.lineRole || ''),
        stressRole: String(syntaxToken?.stressRole || ''),
        rhymePolicy: String(syntaxToken?.rhymePolicy || ''),
      });
    }
  }

  return profiles;
}

function buildLineSyllableCounts(analyzedDoc) {
  const lines = Array.isArray(analyzedDoc?.lines) ? analyzedDoc.lines : [];
  return lines.map((line) => Number(line?.syllableCount) || 0);
}

function createScoreEngine() {
  const engine = createScoringEngine();
  SCORE_HEURISTICS.forEach((heuristicDef) => {
    engine.registerHeuristic({
      name: heuristicDef.name,
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

    const familyId = normalizeVowelFamily(analyzedWord?.phonetics?.vowelFamily);
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

function toMinimalAnalysisPayload(analysis, analyzedDoc, syntaxLayer = null) {
  if (!analysis || typeof analysis !== 'object') {
    return null;
  }

  return {
    allConnections: Array.isArray(analysis.allConnections) ? analysis.allConnections : [],
    statistics: analysis.statistics || null,
    schemePattern: typeof analysis.schemePattern === 'string' ? analysis.schemePattern : '',
    rhymeGroups: toSerializableGroupEntries(analysis.rhymeGroups),
    syntaxSummary: analysis.syntaxSummary || null,
    wordAnalyses: buildAnalysisWordProfiles(analyzedDoc, syntaxLayer),
    lineSyllableCounts: buildLineSyllableCounts(analyzedDoc),
  };
}

function createEmptyPanelPayload() {
  return {
    analysis: null,
    scheme: null,
    meter: null,
    literaryDevices: [],
    genreProfile: null,
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
  const enableSyntaxRhymeLayer = options.enableSyntaxRhymeLayer ?? parseBooleanFlag(
    process.env.ENABLE_SYNTAX_RHYME_LAYER,
    false
  );
  const scoreEngine = createScoreEngine();
  const deepRhymeEngine = new DeepRhymeEngine();

  async function analyzePanels(rawText) {
    const text = normalizeInputText(rawText);
    if (!text.trim()) {
      return createEmptyPanelPayload();
    }

    try {
      const uniqueWords = [...new Set(text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [])];
      await PhonemeEngine.ensureAuthorityBatch(uniqueWords);

      const analyzedDoc = analyzeText(text);
      const scoreData = await scoreEngine.calculateScore(analyzedDoc);
      const syntaxLayer = enableSyntaxRhymeLayer ? buildSyntaxLayer(analyzedDoc) : null;

      const deepAnalysis = await deepRhymeEngine.analyzeDocument(
        text,
        syntaxLayer ? { syntaxLayer } : {}
      );
      
      const genreProfile = LiteraryClassifier.classify(analyzedDoc, deepAnalysis);
      const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
      const meter = analyzeMeter(deepAnalysis.lines);
      const literaryDevices = analyzeLiteraryDevices(text);
      const emotion = detectEmotion(text);

      return {
        analysis: toMinimalAnalysisPayload(deepAnalysis, analyzedDoc, syntaxLayer),
        scheme: scheme
          ? {
            ...scheme,
            groups: toSerializableGroupEntries(scheme.groups),
          }
          : null,
        meter,
        genreProfile,
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
