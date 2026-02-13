import './IDE.css';

export function TopBar({ title, onOpenSearch, showMinimap, onToggleMinimap, isEditable, activeScrollId, onEdit, progression }) {
  return (
    <div className="ide-topbar">
      <div className="ide-topbar-left">
        <span className="ide-logo">📜</span>
        <h1 className="ide-title">{title}</h1>
      </div>
      <div className="ide-topbar-center">
        {progression && (
          <div className="topbar-progression">
            <span className="progression-label">Level {Math.floor(progression.xp / 1000) + 1}</span>
            <div className="progression-bar-mini">
              <div 
                className="progression-fill-mini" 
                style={{ width: `${(progression.xp % 1000) / 10}%` }}
              />
            </div>
            <span className="progression-xp">{progression.xp} XP</span>
          </div>
        )}
      </div>
      <div className="ide-topbar-right">
        {!isEditable && activeScrollId && (
          <button className="ide-icon-btn" title="Edit Scroll" onClick={onEdit}>
            📝
          </button>
        )}
        <button 
          className={`ide-icon-btn ${showMinimap ? 'active' : ''}`}
          title="Toggle Minimap"
          onClick={onToggleMinimap}
        >
          🗺️
        </button>
        <button 
          className="ide-icon-btn" 
          title="Search (Ctrl+F)"
          onClick={onOpenSearch}
        >
          🔍
        </button>
        <button className="ide-icon-btn" title="Settings">⚙️</button>
      </div>
    </div>
  );
}

export function StatusBar({ line, col, language, syllableCount }) {
  return (
    <div className="ide-statusbar">
      <div className="ide-statusbar-left">
        <span className="status-item">Ready</span>
        {syllableCount !== undefined && (
          <span className="status-item syllable-status">
            Syllables: <span className="syllable-count-value">{syllableCount}</span>
          </span>
        )}
      </div>
      <div className="ide-statusbar-right">
        <span className="status-item">{`Ln ${line}, Col ${col}`}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">{language}</span>
      </div>
    </div>
  );
}
