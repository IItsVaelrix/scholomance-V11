import { ANALYSIS_MODES } from './TruesightControls.jsx';
import { EyeIcon, SparkleIcon, MetricsIcon, AnalyzeIcon, RhymeIcon, AstrologyIcon } from '../../components/Icons.jsx';
import './IDE.css';

// ─── ToolsSidebar ─────────────────────────────────────────────────────────────

export default function ToolsSidebar({
  isTruesight,
  onToggleTruesight,
  isPredictive,
  onTogglePredictive,
  mirrored,
  onToggleMirrored,
  analysisMode,
  onModeChange,
  isAnalyzing,
  showScorePanel,
  onToggleScorePanel,
  selectedSchool,
  onSchoolChange,
  schoolList,
  editorRef,
  isEditable,
}) {
  const handleFormat = (type) => {
    editorRef?.current?.applyFormat(type);
  };

  return (
    <div className="tools-sidebar">

      {/* ── Formatting Tools ── */}
      {isEditable && (
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">
            <span className="sidebar-section-glyph" aria-hidden="true">✎</span>
            Format
          </h3>
          <div className="format-toolbar">
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('heading')} title="Heading (##)">
              <span className="material-symbols-outlined">title</span>
            </button>
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('bold')} title="Bold (**)">
              <span className="material-symbols-outlined">format_bold</span>
            </button>
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('italic')} title="Italic (*)">
              <span className="material-symbols-outlined">format_italic</span>
            </button>
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('code')} title="Code (`)">
              <span className="material-symbols-outlined">code</span>
            </button>
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('bullet')} title="Bullet List (-)">
              <span className="material-symbols-outlined">format_list_bulleted</span>
            </button>
            <button type="button" className="toolbar-btn" onClick={() => handleFormat('quote')} title="Quote (> )">
              <span className="material-symbols-outlined">format_quote</span>
            </button>
          </div>
        </div>
      )}
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
          className={`sidebar-tool-btn ${mirrored ? 'active' : ''}`}
          onClick={onToggleMirrored}
        >
          <span className="tool-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M12 3v18" />
              <path d="M5 8l-2 2 2 2" />
              <path d="M19 8l2 2-2 2" />
              <path d="M3 10h18" />
            </svg>
          </span>
          <span className="tool-label">Symmetrical</span>
          <span className={`status-dot ${mirrored ? 'on' : 'off'}`} aria-hidden="true" />
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
