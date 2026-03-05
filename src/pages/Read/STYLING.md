# Read Styling Map

Use this when debugging Read page styles.

- `IDE.css`: page shell/layout/editor styling shared across Read sub-panels.
- `AnalysisPanel.css`: styles for `AnalysisPanel.jsx`.
- `src/components/*.css`: reusable cross-page component styles (e.g. `InfoBeamPanel.css`, `WordTooltip.css`).

Rule of thumb:
- If the UI element exists only in `src/pages/Read/*`, check `src/pages/Read/*.css` first.
- If the UI element is reused in multiple pages, check `src/components/*.css`.
