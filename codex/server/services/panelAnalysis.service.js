/**
 * Canonical backend service for Read-page panel analysis payloads.
 * Produces unified data for rhyme/scheme, score, and vowel-family panels.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { analyzeText } from '../../core/analysis.pipeline.js';
import { createDefaultScoringEngine } from '../../core/scoring.defaults.js';
import { buildPlsPhoneticFeatures } from '../../core/rhyme-astrology/scoring.js';
import { PhonemeEngine } from '../../../src/lib/phonology/phoneme.engine.js';
import { DeepRhymeEngine } from '../../../src/lib/deepRhyme.engine.js';
import { detectScheme, analyzeMeter } from '../../../src/lib/rhymeScheme.detector.js';
import { analyzeLiteraryDevices, detectEmotionDetailed } from '../../../src/lib/literaryDevices.detector.js';
import { normalizeVowelFamily } from '../../../src/lib/phonology/vowelFamily.js';
import { buildSyntaxLayer } from '../../../src/lib/syntax.layer.js';
import { buildHiddenHarkovSummary } from '../../../src/lib/models/harkov.model.js';
import { LiteraryClassifier } from '../../../src/lib/literaryClassifier.js';
import { compileVerseToIR } from '../../../src/lib/truesight/compiler/compileVerseToIR.js';
import { parseBooleanFlag } from '../utils/envFlags.js';
import { createRhymeAstrologyQueryEngine } from '../../runtime/rhyme-astrology/queryEngine.js';
import { createRhymeAstrologyLexiconRepo } from '../../services/rhyme-astrology/lexiconRepo.js';
import { createRhymeAstrologyIndexRepo } from '../../services/rhyme-astrology/indexRepo.js';

const EMPTY_VOWEL_SUMMARY = Object.freeze({
  families: [],
  totalWords: 0,
  uniqueWords: 0,
});

const DEFAULT_RHYME_ASTROLOGY_OUTPUT_DIR = path.resolve(process.cwd(), 'dict_data', 'rhyme-astrology');
const DEFAULT_RHYME_ASTROLOGY_ANCHOR_LIMIT = 14;
const DEFAULT_RHYME_ASTROLOGY_MATCH_LIMIT = 6;
const DEFAULT_RHYME_ASTROLOGY_MIN_SCORE = 0.35;
const DEFAULT_RHYME_ASTROLOGY_MAX_CLUSTERS = 4;
const DEFAULT_RHYME_ASTROLOGY_BUCKET_CAP = 200;
const DEFAULT_RHYME_ASTROLOGY_CACHE_SIZE = 500;
const DEFAULT_RHYME_ASTROLOGY_WINDOW_LIMIT = 12;
const DEFAULT_RHYME_EMOTION_PRIORS_PATH = path.resolve(DEFAULT_RHYME_ASTROLOGY_OUTPUT_DIR, 'rhyme_emotion_priors.json');

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function parseScore(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function resolveArtifactPath(rawPath, fallbackPath) {
  if (typeof rawPath === 'string' && rawPath.trim()) {
    return path.resolve(rawPath.trim());
  }
  return fallbackPath;
}

function loadGutenbergEmotionPriors(priorsPath, log) {
  if (!priorsPath || !existsSync(priorsPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(priorsPath, 'utf8'));
    const emotions = parsed?.emotions;
    if (!emotions || typeof emotions !== 'object') return null;

    return {
      version: Number(parsed?.version) || 1,
      generatedAt: String(parsed?.generatedAt || ''),
      emotions,
    };
  } catch (error) {
    log?.warn?.({ err: error, priorsPath }, '[PanelAnalysisService] Failed to load emotion priors');
    return null;
  }
}

function getPrimaryStressedVowelFamily(analysis, fallbackVowelFamily = null) {
  const syllables = Array.isArray(analysis?.syllables)
    ? analysis.syllables
    : [];
  const stressed = syllables.find((syllable) => Number(syllable?.stress) > 0) || syllables[0];
  return normalizeVowelFamily(stressed?.vowelFamily || fallbackVowelFamily);
}

function buildAnalysisWordProfiles(analysis, syntaxLayer = null) {
  const lines = Array.isArray(analysis?.lines) ? analysis.lines : [];
  const profiles = [];

  for (const line of lines) {
    const lineIndex = Number.isInteger(line?.lineIndex) ? line.lineIndex : 0;
    const words = Array.isArray(line?.words) ? line.words : [];
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const analyzedWord = words[wordIndex];
      const charStart = Number.isInteger(analyzedWord?.charStart) ? analyzedWord.charStart : -1;
      const syntaxIdentity = `${lineIndex}:${wordIndex}:${charStart}`;
      const syntaxToken = syntaxLayer
        ? (
          syntaxLayer.tokenByIdentity?.get?.(syntaxIdentity) ||
          syntaxLayer.tokenByCharStart?.get?.(charStart) ||
          null
        )
        : null;
      profiles.push({
        word: String(analyzedWord?.word || ''),
        normalizedWord: String(analyzedWord?.normalizedWord || analyzedWord?.word || '').toUpperCase(),
        lineIndex,
        wordIndex,
        charStart,
        charEnd: Number.isInteger(analyzedWord?.charEnd) ? analyzedWord.charEnd : -1,
        vowelFamily: getPrimaryStressedVowelFamily(analyzedWord?.analysis, analyzedWord?.vowelFamily) || null,
        syllableCount: Number(analyzedWord?.syllableCount) || 0,
        rhymeKey: analyzedWord?.rhymeKey || analyzedWord?.analysis?.rhymeKey || null,
        stressPattern: String(analyzedWord?.stressPattern || analyzedWord?.analysis?.stressPattern || ''),
        role: String(syntaxToken?.role || ''),
        lineRole: String(syntaxToken?.lineRole || ''),
        stressRole: String(syntaxToken?.stressRole || ''),
        rhymePolicy: String(syntaxToken?.rhymePolicy || ''),
      });
    }
  }

  return profiles;
}

function buildLineSyllableCounts(analysis) {
  const lines = Array.isArray(analysis?.lines) ? analysis.lines : [];
  return lines.map((line) => Number(line?.syllableTotal) || 0);
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

function toMinimalAnalysisPayload(analysis, wordAnalyses, lineSyllableCounts) {
  if (!analysis || typeof analysis !== 'object') {
    return null;
  }

  return {
    allConnections: Array.isArray(analysis.allConnections) ? analysis.allConnections : [],
    statistics: analysis.statistics || null,
    schemePattern: typeof analysis.schemePattern === 'string' ? analysis.schemePattern : '',
    rhymeGroups: toSerializableGroupEntries(analysis.rhymeGroups),
    syntaxSummary: analysis.syntaxSummary || null,
    compiler: analysis.compiler || null,
    wordAnalyses: Array.isArray(wordAnalyses) ? wordAnalyses : [],
    lineSyllableCounts: Array.isArray(lineSyllableCounts) ? lineSyllableCounts : [],
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
    rhymeAstrology: null,
  };
}

function normalizeInputText(rawText) {
  if (typeof rawText === 'string') return rawText;
  if (rawText === null || rawText === undefined) return '';
  return String(rawText);
}

function buildRhymeAstrologyAnchorCandidates(wordAnalyses, maxAnchors) {
  const profiles = Array.isArray(wordAnalyses) ? wordAnalyses : [];
  if (profiles.length === 0) return [];

  const byLine = new Map();
  for (const profile of profiles) {
    const lineIndex = Number(profile?.lineIndex);
    if (!Number.isInteger(lineIndex)) continue;
    if (!byLine.has(lineIndex)) byLine.set(lineIndex, []);
    byLine.get(lineIndex).push(profile);
  }

  /** @type {Array<any>} */
  const anchors = [];
  const seen = new Set();
  const addAnchor = (profile) => {
    const lineIndex = Number(profile?.lineIndex);
    const wordIndex = Number(profile?.wordIndex);
    const charStart = Number(profile?.charStart);
    if (!Number.isInteger(lineIndex) || !Number.isInteger(wordIndex) || !Number.isInteger(charStart)) return;
    const key = `${lineIndex}:${wordIndex}:${charStart}`;
    if (seen.has(key)) return;
    seen.add(key);
    anchors.push(profile);
  };

  const sortedLineEntries = [...byLine.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, lineWords] of sortedLineEntries) {
    const sortedWords = [...lineWords].sort(
      (a, b) => (Number(a?.wordIndex) || 0) - (Number(b?.wordIndex) || 0)
    );
    const lineEndWord = sortedWords[sortedWords.length - 1];
    if (lineEndWord) addAnchor(lineEndWord);
  }

  if (anchors.length < maxAnchors) {
    const internalCandidates = profiles
      .filter((profile) => Number(profile?.syllableCount) >= 2)
      .sort((a, b) => {
        const syllableDiff = (Number(b?.syllableCount) || 0) - (Number(a?.syllableCount) || 0);
        if (syllableDiff !== 0) return syllableDiff;
        const lineDiff = (Number(a?.lineIndex) || 0) - (Number(b?.lineIndex) || 0);
        if (lineDiff !== 0) return lineDiff;
        return (Number(a?.wordIndex) || 0) - (Number(b?.wordIndex) || 0);
      });
    for (const candidate of internalCandidates) {
      if (anchors.length >= maxAnchors) break;
      addAnchor(candidate);
    }
  }

  return anchors.slice(0, maxAnchors);
}

function buildRhymeAstrologyClusterSummary(anchors, maxClusters) {
  const rows = Array.isArray(anchors) ? anchors : [];
  const clusterMap = new Map();

  for (const anchor of rows) {
    const anchorWord = String(anchor?.word || '');
    const anchorSign = String(anchor?.sign || '');
    const constellations = Array.isArray(anchor?.constellations) ? anchor.constellations : [];
    for (const constellation of constellations) {
      const id = String(constellation?.id || '');
      if (!id) continue;
      if (!clusterMap.has(id)) {
        clusterMap.set(id, {
          id,
          label: String(constellation?.label || ''),
          anchorWord,
          sign: anchorSign,
          dominantVowelFamily: Array.isArray(constellation?.dominantVowelFamily)
            ? constellation.dominantVowelFamily
            : [],
          dominantStressPattern: String(constellation?.dominantStressPattern || ''),
          densityScore: Number(constellation?.densityScore) || 0,
          cohesionScore: Number(constellation?.cohesionScore) || 0,
          membersCount: Array.isArray(constellation?.members) ? constellation.members.length : 0,
        });
      }
    }
  }

  return [...clusterMap.values()]
    .sort((first, second) => {
      if (second.cohesionScore !== first.cohesionScore) {
        return second.cohesionScore - first.cohesionScore;
      }
      if (second.densityScore !== first.densityScore) {
        return second.densityScore - first.densityScore;
      }
      return first.label.localeCompare(second.label);
    })
    .slice(0, maxClusters);
}

export function createPanelAnalysisService(options = {}) {
  const log = options.log ?? console;
  const enableSyntaxRhymeLayer = options.enableSyntaxRhymeLayer ?? parseBooleanFlag(
    process.env.ENABLE_SYNTAX_RHYME_LAYER,
    false
  );
  const enableRhymeAstrology = options.enableRhymeAstrology ?? parseBooleanFlag(
    process.env.ENABLE_RHYME_ASTROLOGY,
    false
  );
  const scoreEngine = createDefaultScoringEngine();
  const deepRhymeEngine = new DeepRhymeEngine();

  const rhymeAstrologyAnchorLimit = parsePositiveInt(
    options.rhymeAstrologyAnchorLimit ?? process.env.RHYME_ASTROLOGY_PANEL_ANCHOR_LIMIT,
    DEFAULT_RHYME_ASTROLOGY_ANCHOR_LIMIT
  );
  const rhymeAstrologyMatchLimit = parsePositiveInt(
    options.rhymeAstrologyMatchLimit ?? process.env.RHYME_ASTROLOGY_PANEL_MATCH_LIMIT,
    DEFAULT_RHYME_ASTROLOGY_MATCH_LIMIT
  );
  const rhymeAstrologyMaxClusters = parsePositiveInt(
    options.rhymeAstrologyMaxClusters ?? process.env.RHYME_ASTROLOGY_PANEL_MAX_CLUSTERS,
    DEFAULT_RHYME_ASTROLOGY_MAX_CLUSTERS
  );
  const rhymeAstrologyMinScore = parseScore(
    options.rhymeAstrologyMinScore ?? process.env.RHYME_ASTROLOGY_PANEL_MIN_SCORE,
    DEFAULT_RHYME_ASTROLOGY_MIN_SCORE
  );
  const rhymeAstrologyOutputDir = resolveArtifactPath(
    options.rhymeAstrologyOutputDir ?? process.env.RHYME_ASTROLOGY_OUTPUT_DIR,
    DEFAULT_RHYME_ASTROLOGY_OUTPUT_DIR
  );
  const rhymeAstrologyLexiconDbPath = resolveArtifactPath(
    options.rhymeAstrologyLexiconDbPath ?? process.env.RHYME_ASTROLOGY_LEXICON_DB_PATH,
    path.join(rhymeAstrologyOutputDir, 'rhyme_lexicon.sqlite')
  );
  const rhymeAstrologyIndexDbPath = resolveArtifactPath(
    options.rhymeAstrologyIndexDbPath ?? process.env.RHYME_ASTROLOGY_INDEX_DB_PATH,
    path.join(rhymeAstrologyOutputDir, 'rhyme_index.sqlite')
  );
  const rhymeAstrologyEdgesDbPath = resolveArtifactPath(
    options.rhymeAstrologyEdgesDbPath ?? process.env.RHYME_ASTROLOGY_EDGES_DB_PATH,
    path.join(rhymeAstrologyOutputDir, 'rhyme_edges.sqlite')
  );
  const rhymeEmotionPriorsPath = resolveArtifactPath(
    options.rhymeEmotionPriorsPath ?? process.env.RHYME_EMOTION_PRIORS_PATH,
    DEFAULT_RHYME_EMOTION_PRIORS_PATH
  );
  const gutenbergEmotionPriors = options.gutenbergEmotionPriors
    ?? loadGutenbergEmotionPriors(rhymeEmotionPriorsPath, log);

  const hasInjectedRhymeAstrologyQueryEngine = Boolean(options.rhymeAstrologyQueryEngine);
  let rhymeAstrologyQueryEngine = options.rhymeAstrologyQueryEngine || null;

  if (!rhymeAstrologyQueryEngine && enableRhymeAstrology) {
    const lexiconRepo = createRhymeAstrologyLexiconRepo(rhymeAstrologyLexiconDbPath, { log });
    const indexRepo = createRhymeAstrologyIndexRepo({
      indexDbPath: rhymeAstrologyIndexDbPath,
      edgesDbPath: rhymeAstrologyEdgesDbPath,
      log,
    });
    rhymeAstrologyQueryEngine = createRhymeAstrologyQueryEngine({
      lexiconRepo,
      indexRepo,
      phonemeEngine: options.phonemeEngine || PhonemeEngine,
      cacheSize: parsePositiveInt(
        options.rhymeAstrologyCacheSize ?? process.env.RHYME_ASTROLOGY_CACHE_SIZE,
        DEFAULT_RHYME_ASTROLOGY_CACHE_SIZE
      ),
      bucketCandidateCap: parsePositiveInt(
        options.rhymeAstrologyBucketCandidateCap ?? process.env.RHYME_ASTROLOGY_BUCKET_QUERY_CAP,
        DEFAULT_RHYME_ASTROLOGY_BUCKET_CAP
      ),
      maxClusters: rhymeAstrologyMaxClusters,
      log,
    });
  }

  async function buildRhymeAstrologyPayload(wordAnalyses) {
    if (!enableRhymeAstrology || !rhymeAstrologyQueryEngine) return null;
    const anchors = buildRhymeAstrologyAnchorCandidates(wordAnalyses, rhymeAstrologyAnchorLimit);
    if (anchors.length === 0) {
      return {
        enabled: true,
        features: buildPlsPhoneticFeatures([]),
        inspector: {
          anchors: [],
          clusters: [],
        },
        diagnostics: {
          anchorCount: 0,
          cacheHitCount: 0,
          averageQueryTimeMs: 0,
        },
      };
    }

    const anchorResults = (await Promise.all(
      anchors.map(async (anchor) => {
        const word = String(anchor?.normalizedWord || anchor?.word || '').trim();
        if (!word) return null;
        try {
          const result = await rhymeAstrologyQueryEngine.query({
            text: word,
            mode: 'word',
            limit: rhymeAstrologyMatchLimit,
            minScore: rhymeAstrologyMinScore,
            includeConstellations: true,
            includeDiagnostics: true,
          });
          const resolvedNodes = Array.isArray(result?.query?.resolvedNodes)
            ? result.query.resolvedNodes
            : [];
          const resolvedAnchor = resolvedNodes[resolvedNodes.length - 1] || null;
          return {
            word: String(anchor?.word || '').trim(),
            normalizedWord: String(anchor?.normalizedWord || '').toUpperCase(),
            lineIndex: Number.isInteger(anchor?.lineIndex) ? anchor.lineIndex : -1,
            wordIndex: Number.isInteger(anchor?.wordIndex) ? anchor.wordIndex : -1,
            charStart: Number.isInteger(anchor?.charStart) ? anchor.charStart : -1,
            charEnd: Number.isInteger(anchor?.charEnd) ? anchor.charEnd : -1,
            sign: String(resolvedAnchor?.endingSignature || ''),
            dominantVowelFamily: String(anchor?.vowelFamily || ''),
            topMatches: Array.isArray(result?.topMatches) ? result.topMatches : [],
            constellations: Array.isArray(result?.constellations) ? result.constellations : [],
            diagnostics: result?.diagnostics || {
              queryTimeMs: 0,
              cacheHit: false,
              candidateCount: 0,
            },
          };
        } catch (error) {
          log?.warn?.(
            { err: error, word },
            '[PanelAnalysisService] RhymeAstrology anchor query failed.'
          );
          return null;
        }
      })
    )).filter(Boolean);

    const frequencyResolver = (nodeId) => {
      const lexiconRepo = rhymeAstrologyQueryEngine?.__unsafe?.lexiconRepo;
      if (typeof lexiconRepo?.lookupNodeById !== 'function') return null;
      return Number(lexiconRepo.lookupNodeById(nodeId)?.frequencyScore) || 0;
    };

    const features = buildPlsPhoneticFeatures(anchorResults, { frequencyResolver });
    const cacheHitCount = anchorResults.reduce(
      (sum, row) => sum + (row?.diagnostics?.cacheHit ? 1 : 0),
      0
    );
    const avgQueryTimeMs = anchorResults.length > 0
      ? anchorResults.reduce(
        (sum, row) => sum + (Number(row?.diagnostics?.queryTimeMs) || 0),
        0
      ) / anchorResults.length
      : 0;

    return {
      enabled: true,
      features,
      inspector: {
        anchors: anchorResults,
        clusters: buildRhymeAstrologyClusterSummary(anchorResults, rhymeAstrologyMaxClusters),
      },
      diagnostics: {
        anchorCount: anchorResults.length,
        cacheHitCount,
        averageQueryTimeMs: Number(avgQueryTimeMs.toFixed(3)),
      },
    };
  }

  async function analyzePanels(rawText) {
    const text = normalizeInputText(rawText);
    if (!text.trim()) {
      return createEmptyPanelPayload();
    }

    try {
      const uniqueWords = [...new Set(text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [])];
      await PhonemeEngine.ensureAuthorityBatch(uniqueWords);

      const analyzedDoc = analyzeText(text);
      const syntaxLayerForEmotion = buildSyntaxLayer(analyzedDoc);
      const syntaxLayer = enableSyntaxRhymeLayer ? syntaxLayerForEmotion : null;
      const hhmSignals = syntaxLayerForEmotion?.enabled
        ? buildHiddenHarkovSummary(syntaxLayerForEmotion.tokens)
        : { summary: null, tokenStateByIdentity: null };

      const scoreData = await scoreEngine.calculateScore(analyzedDoc);
      const deepAnalysis = await deepRhymeEngine.analyzeDocument(
        text,
        syntaxLayer ? { syntaxLayer } : {}
      );
      const wordAnalyses = buildAnalysisWordProfiles(deepAnalysis, syntaxLayer);
      const lineSyllableCounts = buildLineSyllableCounts(deepAnalysis);

      const genreProfile = LiteraryClassifier.classify(analyzedDoc, deepAnalysis);
      const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
      const meter = analyzeMeter(deepAnalysis.lines);
      const literaryDevices = analyzeLiteraryDevices(text);
      const emotion = detectEmotionDetailed(text, {
        syntaxLayer: syntaxLayerForEmotion,
        hhmSummary: hhmSignals.summary,
        hhmTokenStateByIdentity: hhmSignals.tokenStateByIdentity,
        gutenbergPriors: gutenbergEmotionPriors,
      }).emotion;
      const rhymeAstrology = await buildRhymeAstrologyPayload(wordAnalyses);
      const scoreDataWithPlsFeatures = scoreData && rhymeAstrology?.features
        ? {
          ...scoreData,
          plsPhoneticFeatures: rhymeAstrology.features,
        }
        : scoreData;

      return {
        analysis: toMinimalAnalysisPayload(deepAnalysis, wordAnalyses, lineSyllableCounts),
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
        scoreData: scoreDataWithPlsFeatures,
        vowelSummary: summarizeVowelFamilies(analyzedDoc),
        rhymeAstrology,
      };
    } catch (error) {
      log?.error?.({ err: error }, '[PanelAnalysisService] Failed to analyze panel payload');
      throw error;
    }
  }

  function close() {
    if (!hasInjectedRhymeAstrologyQueryEngine) {
      rhymeAstrologyQueryEngine?.close?.();
    }
  }

  return {
    analyzePanels,
    close,
  };
}
