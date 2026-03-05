export const PATTERN_COLORS = [
  "#a78bfa", // A
  "#67e8f9", // B
  "#f0abfc", // C
  "#fb923c", // D
  "#94a3b8", // E
  "#4ade80", // F
  "#fbbf24", // G
  "#f87171", // H
];

export function patternColor(letter) {
  const idx = letter.toUpperCase().charCodeAt(0) - 65;
  return (
    PATTERN_COLORS[
      ((idx % PATTERN_COLORS.length) + PATTERN_COLORS.length) %
        PATTERN_COLORS.length
    ] || "#94a3b8"
  );
}
