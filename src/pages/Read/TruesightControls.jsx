import PropTypes from 'prop-types';

/**
 * Analysis mode options for Truesight.
 */
export const ANALYSIS_MODES = {
  VOWEL: 'vowel',
  RHYME: 'rhyme',
  SCHEME: 'scheme',
};

/**
 * Truesight mode control panel.
 * Provides toggle for Truesight and mode selection.
 */
export default function TruesightControls({
  isTruesight,
  onToggle,
  analysisMode,
  onModeChange,
  isAnalyzing = false,
  disabled = false,
}) {
  return (
    <div className="truesight-controls">
      <button
        type="button"
        className={`toolbar-btn toolbar-btn--truesight ${isTruesight ? 'toolbar-btn--active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={isTruesight}
        title="Toggle Truesight analysis overlay"
      >
        <span aria-hidden="true">&#x1F441;</span>
        Truesight
      </button>

      {isTruesight && (
        <div className="truesight-mode-selector" role="group" aria-label="Analysis mode">
          <button
            type="button"
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.VOWEL ? 'mode-btn--active' : ''}`}
            onClick={() => onModeChange(ANALYSIS_MODES.VOWEL)}
            title="Show vowel family colors"
          >
            Vowels
          </button>
          <button
            type="button"
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.RHYME ? 'mode-btn--active' : ''}`}
            onClick={() => onModeChange(ANALYSIS_MODES.RHYME)}
            title="Show rhyme connections between words"
          >
            Rhymes
          </button>
          <button
            type="button"
            className={`mode-btn ${analysisMode === ANALYSIS_MODES.SCHEME ? 'mode-btn--active' : ''}`}
            onClick={() => onModeChange(ANALYSIS_MODES.SCHEME)}
            title="Detect rhyme scheme, meter, and structure"
          >
            Scheme
          </button>
          {isAnalyzing && (
            <span className="analyzing-indicator" aria-live="polite">
              Analyzing...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

TruesightControls.propTypes = {
  isTruesight: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  analysisMode: PropTypes.oneOf(Object.values(ANALYSIS_MODES)).isRequired,
  onModeChange: PropTypes.func.isRequired,
  isAnalyzing: PropTypes.bool,
  disabled: PropTypes.bool,
};
