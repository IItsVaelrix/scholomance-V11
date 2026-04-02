import { useMemo } from 'react';
import { Z_BASE } from '../../data/stacking_tiers';
import './IDE.css';

export default function Gutter({
  content,
  lineCounts = [],
  scrollTop = 0,
  viewportHeight,
  lineHeightPx,
}) {
  const lines = useMemo(() => content ? content.split('\n') : [], [content]);
  
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
        {lines.map((_, i) => {
          const syllableCount = Number(lineCounts[i]) || 0;
          return (
            <div key={i} className="gutter-row" style={rowStyle}>
              <div className="gutter-icons"></div>
              <span className="line-number">{i + 1}</span>
              <span className="syllable-count-mini">{syllableCount > 0 ? syllableCount : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
