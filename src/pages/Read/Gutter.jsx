import { Z_BASE } from '../../data/stacking_tiers';
import './IDE.css';

export default function Gutter({
  overlayLines = [],
  lineCounts = [],
  scrollTop = 0,
  viewportHeight,
  lineHeightPx,
}) {
  // Use a fallback for line height to prevent zero-division or collapsed rows
  const safeLineHeight = Number.isFinite(lineHeightPx) && lineHeightPx > 0 ? lineHeightPx : 24;

  const alignedScrollTop = Math.round(Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0);
  const trackStyle = alignedScrollTop > 0
    ? { transform: `translateY(-${alignedScrollTop}px)` }
    : undefined;

  const rowStyle = { 
    minHeight: `${safeLineHeight}px`, 
    height: `${safeLineHeight}px` 
  };

  // Track which raw lines have already shown their line number to avoid duplicates on wrap
  const shownRawLines = new Set();

  return (
    <div 
      className="editor-gutter" 
      style={{ 
        height: viewportHeight,
        zIndex: Z_BASE 
      }} 
      aria-hidden="true"
    >
      <div className="gutter-track" style={trackStyle}>
        {overlayLines.map((line, i) => {
          const rawIdx = line.rawLineIndex;
          const isFirstVisualLine = !shownRawLines.has(rawIdx);
          if (isFirstVisualLine) shownRawLines.add(rawIdx);
          
          const syllableCount = isFirstVisualLine ? (Number(lineCounts[rawIdx]) || 0) : 0;
          
          return (
            <div key={i} className="gutter-row" style={rowStyle}>
              <div className="gutter-icons"></div>
              <span className="line-number">{isFirstVisualLine ? rawIdx + 1 : ''}</span>
              <span className="syllable-count-mini">{syllableCount > 0 ? syllableCount : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
