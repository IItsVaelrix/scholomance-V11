import { useEffect, useMemo, useRef } from "react";

const WORD_REGEX = /[A-Za-z']+/g;

export default function SyllableCounter({
  content,
  engine,
  scrollTop = 0,
  viewportHeight,
  lineHeightPx,
}) {
  // Cache: lineIndex -> { text, count } (Fix 3: only recompute changed lines)
  const cacheRef = useRef(new Map());

  useEffect(() => {
    cacheRef.current.clear();
  }, [engine]);

  const lineCounts = useMemo(() => {
    if (!content || !engine) return [];

    const lines = content.split("\n");
    const cache = cacheRef.current;
    const counts = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const cached = cache.get(i);

      // Use cache if line text hasn't changed
      if (cached && cached.text === lineText) {
        counts.push(cached.count);
        continue;
      }

      // Keep counting behavior aligned with DeepRhymeEngine.analyzeLine.
      const words = [...lineText.matchAll(WORD_REGEX)];
      let count = 0;
      for (const match of words) {
        const word = match[0];
        const deepAnalysis = engine.analyzeDeep?.(word);
        if (deepAnalysis?.syllableCount) {
          count += deepAnalysis.syllableCount;
          continue;
        }

        // Defensive fallback for engines without analyzeDeep.
        const basic = engine.analyzeWord?.(word);
        if (typeof basic?.syllableCount === "number") {
          count += basic.syllableCount;
        }
      }

      cache.set(i, { text: lineText, count });
      counts.push(count);
    }

    // Clean up cache entries for deleted lines
    for (const key of cache.keys()) {
      if (key >= lines.length) cache.delete(key);
    }

    return counts;
  }, [content, engine]);

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
        {lineCounts.map((count, i) => (
          <div key={i} className="syllable-count" style={rowStyle}>
            {count > 0 ? count : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
