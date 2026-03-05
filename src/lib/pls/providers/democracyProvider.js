import { createJudiciaryEngine } from '../../../../codex/core/judiciary.js';

// Create a stable judiciary instance for the PLS pipeline
const pipelineJudiciary = createJudiciaryEngine();

/**
 * DemocracyProvider — Scorer provider.
 * Uses the CODEx Judiciary system to score candidates based on
 * consensus between different layers (Phoneme, Spellcheck, Predictor).
 */
export async function democracyProvider(context, engines, candidates) {
  const { prefix, prevWord, prevLineEndWord, syntaxContext } = context;
  const { trie, spellchecker, phonemeEngine, dictionaryAPI } = engines;
  if (!candidates || candidates.length === 0) return [];

  // 1. Prepare "voters" for each candidate by checking endorsements from each layer.
  // To avoid expensive lookups for every single candidate, we'll pre-check 
  // the top-tier suggestions for the current context.
  
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

  const targetAnalysis = (prevLineEndWord && phonemeEngine) ? phonemeEngine.analyzeWord(prevLineEndWord) : null;

  // 2. Build the candidate pool for the Judiciary
  const judiciaryCandidates = [];
  
  candidates.forEach(candidate => {
    const word = candidate.token;
    const normalizedWord = String(word).toLowerCase();

    // Endorsement from Predictor Layer
    if (trieSuggestions.has(normalizedWord) || bigramSuggestions.has(normalizedWord)) {
      judiciaryCandidates.push({
        word,
        layer: 'PREDICTOR',
        confidence: 0.8
      });
    }

    // Endorsement from Spellcheck Layer
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
        confidence: spellcheckConfidence
      });
    }

    // Endorsement from Phoneme Layer (Rhyme check)
    if (targetAnalysis && phonemeEngine) {
      const candidateAnalysis = phonemeEngine.analyzeWord(word);
      if (candidateAnalysis && candidateAnalysis.rhymeKey === targetAnalysis.rhymeKey) {
        judiciaryCandidates.push({
          word,
          layer: 'PHONEME',
          confidence: 0.9,
          isRhyme: true
        });
      }
    }
  });

  // 3. Batch score all candidates using Judiciary's standardized multi-winner logic
  const allScores = pipelineJudiciary.calculateAllScores(judiciaryCandidates, syntaxContext || null);

  return candidates.map(candidate => {
    const scoreData = allScores.get(candidate.token);
    return {
      ...candidate,
      scores: {
        ...candidate.scores,
        democracy: scoreData ? Math.min(1.0, scoreData.total) : 0
      }
    };
  });
}
