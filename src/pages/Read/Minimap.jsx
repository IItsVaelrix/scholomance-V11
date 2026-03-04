import { useMemo } from 'react';
import './IDE.css';

export default function Minimap({ content, scrollTop, viewportHeight, totalHeight, onScrollTo }) {
  const lines = useMemo(() => content.split('\n'), [content]);
  
  const handleMinimapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const scrollPercent = clickY / rect.height;
    onScrollTo?.(scrollPercent * totalHeight);
  };

  const handleMinimapKeyDown = (e) => {
    if (e.key === 'ArrowDown') onScrollTo?.(scrollTop + viewportHeight * 0.5);
    if (e.key === 'ArrowUp') onScrollTo?.(scrollTop - viewportHeight * 0.5);
  };

  const thumbTop = (scrollTop / totalHeight) * 100;
  const thumbHeight = (viewportHeight / totalHeight) * 100;

  return (
    <div
      className="minimap-container"
      role="scrollbar"
      aria-controls="scroll-editor"
      aria-valuenow={Math.round((scrollTop / totalHeight) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onClick={handleMinimapClick}
      onKeyDown={handleMinimapKeyDown}
    >
      <div className="minimap-content">
        {lines.map((line, i) => (
          <div key={i} className="minimap-line" style={{ width: `${Math.min(line.length * 2, 100)}%` }}></div>
        ))}
      </div>
      <div 
        className="minimap-thumb" 
        style={{ 
          top: `${thumbTop}%`, 
          height: `${Math.max(thumbHeight, 5)}%` 
        }}
      ></div>
    </div>
  );
}
