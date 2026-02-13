import React, { useMemo } from 'react';
import './IDE.css';

export default function Minimap({ content, scrollTop, viewportHeight, totalHeight, onScrollTo }) {
  const lines = useMemo(() => content.split('\n'), [content]);
  
  const handleMinimapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const scrollPercent = clickY / rect.height;
    onScrollTo?.(scrollPercent * totalHeight);
  };

  const thumbTop = (scrollTop / totalHeight) * 100;
  const thumbHeight = (viewportHeight / totalHeight) * 100;

  return (
    <div className="minimap-container" onClick={handleMinimapClick}>
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
