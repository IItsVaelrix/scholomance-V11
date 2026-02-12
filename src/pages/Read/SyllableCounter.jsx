import { useMemo } from "react";

export default function SyllableCounter({
  content,
  lineCounts = [],
  scrollTop = 0,
  viewportHeight,
  lineHeightPx,
}) {
  const resolvedLineCounts = useMemo(() => {
    if (!content) return [];

    const lines = content.split("\n");
    return Array.from({ length: lines.length }, (_, index) => Number(lineCounts[index]) || 0);
  }, [content, lineCounts]);

  const counterStyle = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? { height: `${viewportHeight}px` }
    : undefined;

  const normalizedScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const alignedScrollTop = Math.round(normalizedScrollTop);
  const trackStyle = alignedScrollTop > 0
    ? { transform: `translateY(-${alignedScrollTop}px)` }
    : undefined;

  const rowStyle = Number.isFinite(lineHeightPx) && lineHeightPx > 0
    ? { minHeight: `${lineHeightPx}px`, height: `${lineHeightPx}px` }
    : undefined;

  return (
    <div className="syllable-counter" style={counterStyle} aria-hidden="true">
      <div className="syllable-counter-track" style={trackStyle}>
        {resolvedLineCounts.map((count, i) => (
          <div key={i} className="syllable-count" style={rowStyle}>
            {count > 0 ? count : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
