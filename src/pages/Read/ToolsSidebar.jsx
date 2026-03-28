import { ANALYSIS_MODES } from './TruesightControls.jsx';
import { EyeIcon, SparkleIcon, MetricsIcon, AnalyzeIcon, RhymeIcon, AstrologyIcon } from '../../components/Icons.jsx';
import './IDE.css';

// ─── ToolsSidebar ─────────────────────────────────────────────────────────────

export default function ToolsSidebar({
  isTruesight,
  onToggleTruesight,
  isPredictive,
  onTogglePredictive,
  analysisMode,
  onModeChange,
  isAnalyzing,
  showScorePanel,
  onToggleScorePanel,
  selectedSchool,
  onSchoolChange,
  schoolList,
}) {
  return (
    <div className="tools-sidebar">

      {/* ── Visual Skin ── */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">
          <span className="sidebar-section-glyph" aria-hidden="true">◈</span>
          Visual Skin
        </h3>
        <select
          className="school-dropdown-sidebar"
          value={selectedSchool}
          onChange={(e) => onSchoolChange(e.target.value)}
          aria-label="Select school color skin"
        >
          {schoolList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.glyph} {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Core Analysis ── */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">
          <span className="sidebar-section-glyph" aria-hidden="true">⊕</span>
          Core Analysis
        </h3>
        <button
          className={`sidebar-tool-btn ${isTruesight ? 'active' : ''}`}
          onClick={onToggleTruesight}
        >
          <span className="tool-icon"><EyeIcon /></span>
          <span className="tool-label">Truesight</span>
          <span className={`status-dot ${isTruesight ? 'on' : 'off'}`} aria-hidden="true" />
        </button>
        <button
          className={`sidebar-tool-btn ${isPredictive ? 'active' : ''}`}
          onClick={onTogglePredictive}
        >
          <span className="tool-icon"><SparkleIcon /></span>
          <span className="tool-label">Ritual Prediction</span>
          <span className={`status-dot ${isPredictive ? 'on' : 'off'}`} aria-hidden="true" />
        </button>
        <button
          className={`sidebar-tool-btn ${showScorePanel ? 'active' : ''}`}
          onClick={onToggleScorePanel}
        >
          <span className="tool-icon"><MetricsIcon /></span>
          <span className="tool-label">CODEx Metrics</span>
          <span className={`status-dot ${showScorePanel ? 'on' : 'off'}`} aria-hidden="true" />
        </button>
      </div>

      {/* ── Modes ── */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">
          <span className="sidebar-section-glyph" aria-hidden="true">⋈</span>
          Modes
        </h3>
        <button
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.ASTROLOGY ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.ASTROLOGY)}
        >
          <span className="tool-icon"><AstrologyIcon /></span>
          <span className="tool-label">Rhyme Astrology</span>
        </button>
        <button
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.ANALYZE ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.ANALYZE)}
        >
          <span className="tool-icon"><AnalyzeIcon /></span>
          <span className="tool-label">Analyze</span>
        </button>
        <button
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.RHYME ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.RHYME)}
        >
          <span className="tool-icon"><RhymeIcon /></span>
          <span className="tool-label">Rhyme Connections</span>
        </button>
      </div>

      {isAnalyzing && (
        <div className="sidebar-footer">
          <div className="analyzing-indicator">
            <span className="analyzing-spinner" aria-hidden="true" />
            Analyzing…
          </div>
        </div>
      )}

    </div>
  );
}
