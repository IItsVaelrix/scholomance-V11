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

function ScrollIcon() {
  return (
    <Svg>
      <path d="M3 1.5h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <line x1="5"  y1="5"   x2="10" y2="5"   />
      <line x1="5"  y1="7.5" x2="10" y2="7.5" />
      <line x1="5"  y1="10"  x2="8"  y2="10"  />
    </Svg>
  );
}

function EditIcon() {
  return (
    <Svg>
      <path d="M9.5 2 L13 5.5 L6 12.5 H2.5 V9 L9.5 2Z" />
      <line x1="8" y1="3.5" x2="11.5" y2="7" />
    </Svg>
  );
}

function MapIcon() {
  return (
    <Svg>
      <rect x="1.5" y="1.5" width="5" height="5" rx="0.5" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="0.5" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="0.5" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="0.5" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg>
      <circle cx="6"   cy="6"   r="4.5" />
      <line   x1="9.5" y1="9.5" x2="13.5" y2="13.5" />
    </Svg>
  );
}

function GearIcon() {
  return (
    <Svg>
      <circle cx="7.5" cy="7.5" r="2.2" />
      <line x1="7.5"  y1="1.5"  x2="7.5"  y2="3.2"  />
      <line x1="7.5"  y1="11.8" x2="7.5"  y2="13.5" />
      <line x1="1.5"  y1="7.5"  x2="3.2"  y2="7.5"  />
      <line x1="11.8" y1="7.5"  x2="13.5" y2="7.5"  />
      <line x1="3.3"  y1="3.3"  x2="4.4"  y2="4.4"  />
      <line x1="10.6" y1="10.6" x2="11.7" y2="11.7" />
      <line x1="11.7" y1="3.3"  x2="10.6" y2="4.4"  />
      <line x1="4.4"  y1="10.6" x2="3.3"  y2="11.7" />
    </Svg>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

const AURORA_LABELS = ['◉ ATMOS', '◈ ATMOS', '◈ ATMOS'];
const AURORA_TITLES = ['Aurora: Off', 'Aurora: Dim', 'Aurora: Full'];

export function TopBar({
  title,
  onOpenSearch,
  showMinimap,
  onToggleMinimap,
  isEditable,
  activeScrollId,
  onEdit,
  progression,
  auroraLevel = 2,
  onCycleAuroraLevel,
}) {
  return (
    <div className="ide-topbar">
      <div className="ide-topbar-left">
        <span className="ide-logo"><ScrollIcon /></span>
        <h1 className="ide-title">{title}</h1>
      </div>

      <div className="ide-topbar-center">
        {progression && (
          <div className="topbar-progression">
            <span className="progression-label">
              Level {Math.floor(progression.xp / 1000) + 1}
            </span>
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
          <button className="ide-icon-btn" title="Edit Scroll" onClick={onEdit} aria-label="Edit Scroll">
            <EditIcon />
          </button>
        )}
        <button
          className={`ide-icon-btn ${showMinimap ? 'active' : ''}`}
          title="Toggle Minimap"
          aria-label="Toggle Minimap"
          onClick={onToggleMinimap}
        >
          <MapIcon />
        </button>
        <button
          className="ide-icon-btn"
          title="Search (Ctrl+F)"
          aria-label="Search"
          onClick={onOpenSearch}
        >
          <SearchIcon />
        </button>
        {onCycleAuroraLevel && (
          <button
            className={`ide-icon-btn ide-atmos-btn ide-atmos-btn--level-${auroraLevel}`}
            title={AURORA_TITLES[auroraLevel]}
            aria-label={AURORA_TITLES[auroraLevel]}
            aria-pressed={auroraLevel > 0}
            onClick={onCycleAuroraLevel}
          >
            {AURORA_LABELS[auroraLevel]}
          </button>
        )}
        <button className="ide-icon-btn" title="Settings" aria-label="Settings">
          <GearIcon />
        </button>
      </div>
    </div>
  );
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

export function StatusBar({ line, col, language, syllableCount, analysisError }) {
  return (
    <div className="ide-statusbar">
      <div className="ide-statusbar-left">
        <span className={`status-item${analysisError ? ' status-item--offline' : ''}`}>
          <span className="status-ready-dot" aria-hidden="true" />
          {analysisError ? 'Analysis Offline' : 'Ready'}
        </span>
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
