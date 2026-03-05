import { AnimatePresence } from "framer-motion";
import PropTypes from 'prop-types';
import RhymeSchemePanel from "../../components/RhymeSchemePanel.jsx";
import VowelFamilyPanel from "../../components/VowelFamilyPanel.jsx";
import HeuristicScorePanel from "../../components/HeuristicScorePanel.jsx";
import { ANALYSIS_MODES } from "./TruesightControls.jsx";
import './AnalysisPanel.css';

export default function AnalysisPanel({
  isVisible,
  analysisMode,
  vowelFamilyAnalytics,
  schemeDetection,
  meterDetection,
  deepAnalysis,
  literaryDevices,
  emotion,
  scoreData,
  onGroupHover,
  onGroupLeave,
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <aside className="analysis-panel">
      <div className="analysis-panel-content">
        <h2>Analysis Mode</h2>
        <p>Aggregate metrics and visualizations will appear here.</p>

        {/* Placeholder for future charts */}
        <div className="chart-placeholder">
          <h4>Rhyme Distribution</h4>
          <div className="chart-mock"></div>
        </div>
        <div className="chart-placeholder">
          <h4>Vowel Family Density</h4>
          <div className="chart-mock"></div>
        </div>

        {/* You can also include existing panels here if desired */}
        <AnimatePresence>
          {analysisMode === ANALYSIS_MODES.VOWEL && (
            <VowelFamilyPanel
              families={vowelFamilyAnalytics.families}
              totalWords={vowelFamilyAnalytics.totalWords}
              uniqueWords={vowelFamilyAnalytics.uniqueWords}
              isEmbedded={true}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          <RhymeSchemePanel
            scheme={schemeDetection}
            meter={meterDetection}
            statistics={deepAnalysis?.statistics}
            literaryDevices={literaryDevices}
            emotion={emotion}
            onGroupHover={onGroupHover}
            onGroupLeave={onGroupLeave}
            visible={analysisMode === ANALYSIS_MODES.ANALYZE}
            isEmbedded={true}
          />
        </AnimatePresence>

        <HeuristicScorePanel scoreData={scoreData} visible={true} isEmbedded={true} />

      </div>
    </aside>
  );
}

AnalysisPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  analysisMode: PropTypes.string.isRequired,
  vowelFamilyAnalytics: PropTypes.object,
  schemeDetection: PropTypes.object,
  meterDetection: PropTypes.object,
  deepAnalysis: PropTypes.object,
  literaryDevices: PropTypes.array,
  emotion: PropTypes.object,
  scoreData: PropTypes.object,
  onGroupHover: PropTypes.func,
  onGroupLeave: PropTypes.func,
};
