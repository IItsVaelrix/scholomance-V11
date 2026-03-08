import { ANALYSIS_MODES } from './TruesightControls.jsx';
import './IDE.css';

// ─── SVG Icon Primitives ──────────────────────────────────────────────────────

function Svg({ children }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 15 15"
      fill="none" stroke="currentColor"
      strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Open eye with iris — Truesight */
function EyeIcon() {
  return (
    <Svg>
      <path d="M1 7.5C2.5 4.5 4.8 2.5 7.5 2.5S12.5 4.5 14 7.5c-1.5 3-3.8 5-6.5 5S2.5 10.5 1 7.5Z" />
      <circle cx="7.5" cy="7.5" r="2" />
    </Svg>
  );
}

/** 4-pointed star — Ritual Prediction */
function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path
        d="M7.5 1 L8.9 6.1 L14 7.5 L8.9 8.9 L7.5 14 L6.1 8.9 L1 7.5 L6.1 6.1 Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

/** Bar chart — CODEx Metrics */
function MetricsIcon() {
  return (
    <Svg>
      <rect x="1.5"  y="7"  width="3" height="6.5" rx="0.4" />
      <rect x="6"    y="4"  width="3" height="9.5" rx="0.4" />
      <rect x="10.5" y="9"  width="3" height="4.5" rx="0.4" />
    </Svg>
  );
}

/** 8-armed asterisk — Analyze mode */
function AnalyzeIcon() {
  return (
    <Svg>
      <line x1="7.5" y1="1.5"  x2="7.5"  y2="13.5" strokeWidth="1.3" />
      <line x1="1.5" y1="7.5"  x2="13.5" y2="7.5"  strokeWidth="1.3" />
      <line x1="3.2" y1="3.2"  x2="11.8" y2="11.8" strokeWidth="1.0" />
      <line x1="11.8" y1="3.2" x2="3.2"  y2="11.8" strokeWidth="1.0" />
    </Svg>
  );
}

/** Interlocking circles — Rhyme Connections */
function RhymeIcon() {
  return (
    <Svg>
      <circle cx="5.5" cy="7.5" r="3.8" />
      <circle cx="9.5" cy="7.5" r="3.8" />
    </Svg>
  );
}

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
