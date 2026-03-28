import { createJudiciaryEngine } from '../../../../codex/core/judiciary.js';
import { resolvePlsVerseIRState } from '../verseIRBridge.js';

const pipelineJudiciary = createJudiciaryEngine();

function buildCandidateRhymeKeys(candidateAnalysis) {
  const keys = new Set();

  if (typeof candidateAnalysis?.rhymeKey === 'string' && candidateAnalysis.rhymeKey) {
    keys.add(candidateAnalysis.rhymeKey);
  }

  if (Array.isArray(candidateAnalysis?.extendedRhymeKeys)) {
    candidateAnalysis.extendedRhymeKeys.forEach((key) => {
      const normalizedKey = String(key || '').trim();
      if (normalizedKey) keys.add(normalizedKey);
    });
  }

  return keys;
}

/**
 * DemocracyProvider — Scorer provider.
 * Uses the CODEx Judiciary system to score candidates based on
 * consensus between different layers (Phoneme, Spellcheck, Predictor).
 */
export async function democracyProvider(context, engines, candidates) {
  const { prefix, prevWord, prevLineEndWord, syntaxContext } = context;
  const { trie, spellchecker, phonemeEngine, dictionaryAPI } = engines;
  if (!candidates || candidates.length === 0) return [];

  const trieSuggestions = trie
    ? new Set((trie.predict(prefix || '', 30) || []).map((token) => String(token).toLowerCase()))
    : new Set();
  const bigramSuggestions = (trie && prevWord)
    ? new Set((trie.predictNext(prevWord, 30) || []).map((token) => String(token).toLowerCase()))
    : new Set();

  let spellSuggestions = new Set();
  if (spellchecker && prefix) {
    const spellingCandidates = typeof spellchecker.suggestAsync === 'function'
      ? await spellchecker.suggestAsync(prefix, 15, prevWord)
      : spellchecker.suggest(prefix, 15, prevWord);
    spellSuggestions = new Set(
      (Array.isArray(spellingCandidates) ? spellingCandidates : [])
        .map((token) => String(token).toLowerCase())
    );
  }

  let dictionaryValidWords = new Set();
  if (dictionaryAPI && typeof dictionaryAPI.validateBatch === 'function') {
    try {
      const validWords = await dictionaryAPI.validateBatch(candidates.map((candidate) => candidate.token));
      dictionaryValidWords = new Set(
        (Array.isArray(validWords) ? validWords : [])
          .map((word) => String(word).toLowerCase())
      );
      if (spellchecker && typeof spellchecker.primeValidWords === 'function' && dictionaryValidWords.size > 0) {
        spellchecker.primeValidWords([...dictionaryValidWords]);
      }
    } catch (_error) {
      // Dictionary validation is additive only.
    }
  }

  const verseIRState = resolvePlsVerseIRState(context);
  const verseIRTarget = verseIRState?.previousLineEnd || null;
  const targetAnalysis = (prevLineEndWord && phonemeEngine)
    ? phonemeEngine.analyzeWord(verseIRTarget?.word || prevLineEndWord)
    : null;
  const targetRhymeKey = verseIRTarget?.rhymeTailSignature || targetAnalysis?.rhymeKey || null;

  const judiciaryCandidates = [];

  candidates.forEach((candidate) => {
    const word = candidate.token;
    const normalizedWord = String(word).toLowerCase();

    if (trieSuggestions.has(normalizedWord) || bigramSuggestions.has(normalizedWord)) {
      judiciaryCandidates.push({
        word,
        layer: 'PREDICTOR',
        confidence: 0.8,
      });
    }

    const isSuggestedBySpellchecker = spellSuggestions.has(normalizedWord);
    const isValidatedByDictionary = dictionaryValidWords.has(normalizedWord);
    const isKnownLocally = spellchecker && typeof spellchecker.check === 'function'
      ? spellchecker.check(normalizedWord)
      : false;

    let spellcheckConfidence = null;
    if (isSuggestedBySpellchecker) spellcheckConfidence = 0.7;
    if (isKnownLocally) spellcheckConfidence = Math.max(spellcheckConfidence || 0, 0.78);
    if (isValidatedByDictionary) spellcheckConfidence = Math.max(spellcheckConfidence || 0, 0.9);

    if (spellcheckConfidence !== null) {
      judiciaryCandidates.push({
        word,
        layer: 'SPELLCHECK',
        confidence: spellcheckConfidence,
      });
    }

    if (targetRhymeKey && phonemeEngine) {
      const candidateAnalysis = phonemeEngine.analyzeWord(word);
      const candidateRhymeKeys = buildCandidateRhymeKeys(candidateAnalysis);
      if (candidateRhymeKeys.has(targetRhymeKey)) {
        judiciaryCandidates.push({
          word,
          layer: 'PHONEME',
          confidence: 0.9,
          isRhyme: true,
        });
      }
    }
  });

  const allScores = pipelineJudiciary.calculateAllScores(judiciaryCandidates, syntaxContext || null);
  const graphScores = new Map(
    pipelineJudiciary
      .rankGraphCandidates(pipelineJudiciary.adaptLegacyScoresToGraphCandidates(allScores))
      .map((candidate) => [candidate.token, candidate.totalScore])
  );

  return candidates.map((candidate) => {
    const scoreData = allScores.get(candidate.token);
    const graphScore = graphScores.get(candidate.token) ?? 0;
    return {
      ...candidate,
      scores: {
        ...candidate.scores,
        democracy: scoreData
          ? Math.min(1.0, Math.max(scoreData.total, graphScore))
          : graphScore,
      },
    };
  });
}
