/**
 * Grimoire-style formatting icons for the Read page toolbar.
 * SVG icons with currentColor fill for theme compatibility.
 */

export const HeadingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 2v12h2V9h6v5h2V2h-2v5H5V2H3z"/>
  </svg>
);

export const BulletListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="3" cy="4" r="1.5"/>
    <circle cx="3" cy="8" r="1.5"/>
    <circle cx="3" cy="12" r="1.5"/>
    <rect x="6" y="3" width="9" height="2" rx="1"/>
    <rect x="6" y="7" width="9" height="2" rx="1"/>
    <rect x="6" y="11" width="9" height="2" rx="1"/>
  </svg>
);

export const NumberListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <text x="1" y="5" fontSize="5" fontFamily="Georgia, serif">1</text>
    <text x="1" y="9" fontSize="5" fontFamily="Georgia, serif">2</text>
    <text x="1" y="13" fontSize="5" fontFamily="Georgia, serif">3</text>
    <rect x="6" y="3" width="9" height="2" rx="1"/>
    <rect x="6" y="7" width="9" height="2" rx="1"/>
    <rect x="6" y="11" width="9" height="2" rx="1"/>
  </svg>
);

export const QuoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 3h4v4c0 2-1 4-4 5l-.5-1c1.5-.5 2.5-1.5 2.5-3H3V3zm6 0h4v4c0 2-1 4-4 5l-.5-1c1.5-.5 2.5-1.5 2.5-3H9V3z"/>
  </svg>
);
