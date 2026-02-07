import { useMemo, useRef } from "react";

export default function SyllableCounter({ content, engine }) {
  // Cache: lineIndex -> { text, count } (Fix 3: only recompute changed lines)
  const cacheRef = useRef(new Map());

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

      // Compute syllable count for this line
      const words = lineText.match(/[A-Za-z']+/g);
      let count = 0;
      if (words) {
        for (const word of words) {
          const analysis = engine.analyzeWord(word);
          if (analysis?.phonemes) {
            count += analysis.phonemes.filter(p => /[0-9]/.test(p)).length;
          }
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

  return (
    <div className="syllable-counter" aria-hidden="true">
      {lineCounts.map((count, i) => (
        <div key={i} className="syllable-count">
          {count > 0 ? count : ""}
        </div>
      ))}
    </div>
  );
}
