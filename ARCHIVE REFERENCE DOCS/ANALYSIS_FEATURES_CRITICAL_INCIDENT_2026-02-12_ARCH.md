# Analysis Features Critical Incident (ARCH)

## 1. Incident Summary

**Incident:** Read-page analysis features stopped functioning at runtime.  
**Severity:** Critical (core workflow regression)  
**Date identified:** February 12, 2026  
**Date resolved:** February 12, 2026  
**Primary affected area:** `/read` analysis stack (rhyme/scheme/meter/scoring/vowel panels)

---

## 2. User-Visible Symptoms

- Analysis panels remained empty or stopped updating after entering text.
- Rhyme/connection-driven Truesight behavior appeared non-functional.
- Analysis error states surfaced when backend analysis endpoint was unavailable.
- End users experienced this as "all analysis features are broken."

---

## 3. Root Cause

## 3.1 Technical Cause

`src/hooks/usePanelAnalysis.js` had regressed to a **server-only** execution path:

- It always attempted `POST /api/analysis/panels`.
- It had no local runtime fallback path.
- On server/network/proxy failures, the hook propagated error and never produced analysis payloads.

This made the analysis UX brittle and dependent on backend reachability even though the app already has local-capable analysis primitives.

## 3.2 Why This Was Critical

The `/read` page depends on `usePanelAnalysis` as the upstream provider for:

- `analysis` (connections/groups/statistics)
- `schemeDetection`
- `meterDetection`
- `scoreData`
- `vowelSummary`

When this hook failed, downstream features lost their data source simultaneously.

---

## 4. Impacted Components

- `src/hooks/usePanelAnalysis.js` (incident origin)
- `src/pages/Read/ReadPage.jsx` (consumer of analysis state)
- Truesight-related color/connection rendering paths that depend on connection payloads

---

## 5. Resolution Implemented

## 5.1 Hook Resilience Restored

**File:** `src/hooks/usePanelAnalysis.js`

Reintroduced server-first, local-fallback execution:

1. Try backend panel analysis (`/api/analysis/panels`).
2. If backend fails and fallback is enabled, run local analysis pipeline.
3. Return normalized payload with source tag (`server-analysis` or `local-runtime`).

## 5.2 Local Runtime Analysis Path Rebuilt

Inside `usePanelAnalysis`, local fallback now composes:

- `analyzeText` (pipeline document analysis)
- `DeepRhymeEngine` document analysis
- `detectScheme` / `analyzeMeter`
- `createScoringEngine` + registered heuristics
- `analyzeLiteraryDevices` / `detectEmotion`
- `buildSyntaxLayer` (when syntax layer flag enabled)

This ensures functional analysis even during backend outage or proxy misconfiguration.

## 5.3 Config Surface Formalized

**File:** `.env.example`

Added explicit panel-analysis flags:

- `VITE_USE_SERVER_PANEL_ANALYSIS=true`
- `VITE_ENABLE_LOCAL_PANEL_ANALYSIS_FALLBACK=true`

This prevents accidental server-hard-dependency in normal development and improves graceful degradation.

---

## 6. Verification Performed

## 6.1 Regression Test Added

**File:** `tests/hooks/usePanelAnalysis.test.jsx`

Added test case:

- Simulate server fetch rejection.
- Assert hook falls back to local runtime analysis.
- Assert `source === "local-runtime"` and analysis payload is populated.

## 6.2 Validation Commands

Executed on February 12, 2026:

```bash
npx vitest run tests/hooks/usePanelAnalysis.test.jsx
npx vitest run tests/pages/read-scroll-editor.truesight.test.jsx tests/qa/truesightColorCoding.qa.test.jsx
npm run build
npx eslint src/hooks/usePanelAnalysis.js tests/hooks/usePanelAnalysis.test.jsx
```

**Result:** All commands passed.

---

## 7. Contributing Factors

- Backend-first architecture was correct, but no guardrail preserved local fallback behavior.
- Feature reliability depended on runtime server availability without explicit resilience contract enforcement.
- Existing tests validated successful server path but did not enforce failure fallback behavior.

---

## 8. Preventative Actions

1. Keep fallback test mandatory in CI for `usePanelAnalysis`.
2. Treat fallback behavior as contract, not optional behavior.
3. Preserve explicit env flags in `.env.example` and release docs.
4. For core hooks, require both-path tests:
   - happy path (server success)
   - degraded path (server failure => local fallback)

---

## 9. Final State

As of **February 12, 2026**, analysis features are resilient again:

- Backend analysis remains the preferred source.
- Local runtime analysis now restores continuity when backend is unavailable.
- Critical user-facing analysis features no longer fail as a single point of backend dependency.
