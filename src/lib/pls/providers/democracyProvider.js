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
  const { trie, spellchecker, phonemeEngine } = engines;
  if (!candidates || candidates.length === 0) return [];

  // 1. Prepare "voters" for each candidate by checking endorsements from each layer.
  // To avoid expensive lookups for every single candidate, we'll pre-check 
  // the top-tier suggestions for the current context.
  
  const trieSuggestions = trie ? new Set(trie.predict(prefix || '', 30)) : new Set();
  const bigramSuggestions = (trie && prevWord) ? new Set(trie.predictNext(prevWord, 30)) : new Set();
  const spellSuggestions = (spellchecker && prefix) ? new Set(spellchecker.suggest(prefix, 15)) : new Set();

  const targetAnalysis = (prevLineEndWord && phonemeEngine) ? phonemeEngine.analyzeWord(prevLineEndWord) : null;

  // 2. Build the candidate pool for the Judiciary
  const judiciaryCandidates = [];
  
  candidates.forEach(candidate => {
    const word = candidate.token;

    // Endorsement from Predictor Layer
    if (trieSuggestions.has(word) || bigramSuggestions.has(word)) {
      judiciaryCandidates.push({
        word,
        layer: 'PREDICTOR',
        confidence: 0.8
      });
    }

    // Endorsement from Spellcheck Layer
    if (spellSuggestions.has(word)) {
      judiciaryCandidates.push({
        word,
        layer: 'SPELLCHECK',
        confidence: 0.7
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
