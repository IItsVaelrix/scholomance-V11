export const TRUESIGHT_ANALYSIS_MODES = Object.freeze({
  LIVE_FAST: 'live_fast',
  BALANCED: 'balanced',
  DEEP_TRUESIGHT: 'deep_truesight',
});

const DEFAULT_MODE = TRUESIGHT_ANALYSIS_MODES.BALANCED;

const MODE_CONFIGS = Object.freeze({
  [TRUESIGHT_ANALYSIS_MODES.LIVE_FAST]: Object.freeze({
    id: TRUESIGHT_ANALYSIS_MODES.LIVE_FAST,
    maxWindowSyllables: 3,
    maxWindowTokenSpan: 3,
  }),
  [TRUESIGHT_ANALYSIS_MODES.BALANCED]: Object.freeze({
    id: TRUESIGHT_ANALYSIS_MODES.BALANCED,
    maxWindowSyllables: 4,
    maxWindowTokenSpan: 4,
  }),
  [TRUESIGHT_ANALYSIS_MODES.DEEP_TRUESIGHT]: Object.freeze({
    id: TRUESIGHT_ANALYSIS_MODES.DEEP_TRUESIGHT,
    maxWindowSyllables: 5,
    maxWindowTokenSpan: 6,
  }),
});

export function resolveTruesightAnalysisMode(mode) {
  if (typeof mode !== 'string') {
    return DEFAULT_MODE;
  }

  return MODE_CONFIGS[mode] ? mode : DEFAULT_MODE;
}

export function getTruesightAnalysisModeConfig(mode) {
  return MODE_CONFIGS[resolveTruesightAnalysisMode(mode)];
}
