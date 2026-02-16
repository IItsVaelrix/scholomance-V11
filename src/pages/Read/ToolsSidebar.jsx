import React from 'react';
import { ANALYSIS_MODES } from './TruesightControls.jsx';
import './IDE.css';

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
  schoolList
}) {
  return (
    <div className="tools-sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Visual Skin</h3>
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

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Core Analysis</h3>
        <button 
          className={`sidebar-tool-btn ${isTruesight ? 'active' : ''}`}
          onClick={onToggleTruesight}
        >
          <span className="tool-icon">👁️</span>
          <span className="tool-label">Truesight</span>
          <span className={`status-dot ${isTruesight ? 'on' : 'off'}`}></span>
        </button>
        <button 
          className={`sidebar-tool-btn ${isPredictive ? 'active' : ''}`}
          onClick={onTogglePredictive}
        >
          <span className="tool-icon">✨</span>
          <span className="tool-label">Ritual Prediction</span>
          <span className={`status-dot ${isPredictive ? 'on' : 'off'}`}></span>
        </button>
        <button 
          className={`sidebar-tool-btn ${showScorePanel ? 'active' : ''}`}
          onClick={onToggleScorePanel}
        >
          <span className="tool-icon">📊</span>
          <span className="tool-label">CODEx Metrics</span>
          <span className={`status-dot ${showScorePanel ? 'on' : 'off'}`}></span>
        </button>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Modes</h3>
        <button 
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.VOWEL ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.VOWEL)}
        >
          <span className="tool-icon">🌈</span>
          <span className="tool-label">Vowel Families</span>
        </button>
        <button 
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.SCHEME ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.SCHEME)}
        >
          <span className="tool-icon">🎼</span>
          <span className="tool-label">Rhyme Scheme</span>
        </button>
        <button 
          className={`sidebar-tool-btn ${analysisMode === ANALYSIS_MODES.RHYME ? 'active' : ''}`}
          onClick={() => onModeChange(ANALYSIS_MODES.RHYME)}
        >
          <span className="tool-icon">🔗</span>
          <span className="tool-label">Rhyme Connections</span>
        </button>
      </div>

      {isAnalyzing && (
        <div className="sidebar-footer">
          <div className="analyzing-indicator">
            <span className="spinner">⏳</span> Analyzing...
          </div>
        </div>
      )}
    </div>
  );
}
