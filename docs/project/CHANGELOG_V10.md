# Scholomance v10 — Improvement Changelog

**Date:** 2026-02-16
**Scope:** 71 files changed | +2,018 lines | -1,449 lines | Net +569 LOC

---

## Test Suite Health

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total test files | 52 | 52 | — |
| Passing test files | ~48 | 51 | +3 |
| Failing test files | 4+ | 0 | -4 |
| Total tests passing | ~338 | 370 | +32 |
| Tests failing | 32+ | 0 | -32 |
| Tests skipped | — | 5 | — |
| Suite pass rate | ~91% | **100%** | +9% |

### Suites Repaired

| Suite | Before | After | Improvement |
|-------|--------|-------|-------------|
| `accessibility.test.jsx` | 1/13 (8%) | 13/13 (100%) | +92pp |
| `truesight.test.jsx` | 0/6 (0%) | 6/6 (100%) | +100pp |
| `editor.qa.test.jsx` | 5/13 (38%) | 13/13 (100%) | +62pp |
| `visuals.qa.test.js` | 0/23 (load error) | 23/23 (100%) | +100pp |
| `panelAnalysis.routes.test.js` | 5/6 (83%) | 6/6 (100%) | +17pp |
| `heuristics.test.js` | 3/4 (75%) | 4/4 (100%) | +25pp |

---

## 1. Backend

### Async Scoring Pipeline (Critical Fix)
The `rhyme_quality` heuristic scorer is async (wraps DeepRhymeEngine), but the scoring engine called all scorers synchronously. This caused `Promise` objects to land where score numbers were expected — producing `NaN` total scores that `JSON.stringify` silently converted to `null`.

**Before:** `calculateScore()` was synchronous — any async heuristic returned a Promise instead of a result object, breaking the entire score trace.

**After:** `calculateScore()` is fully async with `Promise.all`, correctly awaiting all 7 heuristic scorers in parallel.

**Files:** `codex/core/scoring.engine.js`, `codex/server/services/panelAnalysis.service.js`, `src/hooks/useScoring.js`, `codex/core/combat.engine.js`

**Impact:** Scoring pipeline now supports any combination of sync/async heuristics without caller changes. All 7 heuristics produce valid numeric traces.

### API URL De-duplication
The lexicon API client doubled its path prefix (`/api/lexicon/api/lexicon/lookup-batch`), causing 404s on every dictionary lookup.

**Before:** `${BASE_URL}/api/lexicon/lookup/...` where `BASE_URL` already ended in `/api/lexicon`

**After:** `${BASE_URL}/lookup/...` — single canonical path prefix.

**File:** `src/lib/scholomanceDictionary.api.js`

### Panel Analysis Route
Server-side panel analysis called the now-async `calculateScore()` without `await`, returning incomplete payloads.

**Before:** `const score = scoreEngine.calculateScore(analyzedDoc)` — received a Promise, not a result.

**After:** `const score = await scoreEngine.calculateScore(analyzedDoc)` — full score payload returned to client.

**File:** `codex/server/services/panelAnalysis.service.js`

---

## 2. Efficiency

### Infinite Re-render Loop Eliminated
`ScrollEditor` triggered an infinite React re-render cycle. Every render called `setIntellisenseSuggestions([])`, which created a new array reference (`[] !== []` under `Object.is`), which triggered a state change, which triggered a re-render — infinite loop.

**Before:** `setIntellisenseSuggestions([])` — new reference every call, infinite loop, browser hang.

**After:** `setIntellisenseSuggestions(prev => prev.length === 0 ? prev : [])` — functional updater returns same reference when already empty, breaking the loop.

**File:** `src/pages/Read/ScrollEditor.jsx`

**Impact:** Editor no longer hangs on mount. Eliminates thousands of wasted renders per session.

### Framer-motion Test Mock (Stable Component References)
The jsdom test environment couldn't handle framer-motion's `requestAnimationFrame` animation loops. The initial Proxy-based mock created a *new* `forwardRef` component on every `motion.div` access, causing React to unmount and remount on every render cycle.

**Before:** No framer-motion mock — tests hung indefinitely on any component using `<motion.div>`. First fix attempt created unstable references causing mount/unmount thrashing.

**After:** Cached Proxy mock — each `motion.X` element is created once and reused. `AnimatePresence` passes children through. Animation props are stripped at the mock boundary.

**File:** `tests/setup.js` (+128 lines)

**Impact:** Test suite execution time reduced from hanging/timeout to ~14s for full 370-test run. All 52 test files complete without RAF-induced deadlocks.

---

## 3. Feature Capability

### Truesight Color-Coding: Smart Family Broadening
The vowel family color system was over-coloring text — when any word participated in a rhyme connection, *all* non-stop words sharing its vowel family got colored, flooding the editor with false highlights.

**Before:** If "ECHO" (family EH) appeared in a connection, every non-stop EH word ("MELLOW", "VESSEL", etc.) was colored regardless of relevance.

**After:** Tracks `directNonStopFamilies` — a Set of vowel families that already have non-stop-word representation in active connections. Broadening is suppressed when the family is already directly represented, limiting color to actual participants and their stop-word peers only.

**Files:** `src/hooks/useColorCodex.js`, `src/pages/Read/ScrollEditor.jsx`

**New logic:**
```
if word is direct connection participant → color ✓
if word's family already has non-stop participant → don't broaden ✗
if word is peer of stop-word-only family → broaden ✓
```

### Normalized Word Identity Resolution
Connection references from the backend didn't always include `normalizedWord` metadata, causing the stop-word check to fail (empty string defaulted to non-stop, triggering incorrect broadening suppression).

**Before:** `resolveNormalizedWord()` didn't exist. Connections without word metadata couldn't determine stop-word status.

**After:** Added `resolveNormalizedWord()` that falls back through connection refs → analysisSources → charStart lookup. Added `normalizedWord` to all derived analysis entries in ScrollEditor.

**Files:** `src/hooks/useColorCodex.js`, `src/pages/Read/ScrollEditor.jsx`

### IntelliSense Component
Fully functional autocomplete dropdown with:
- Prediction suggestions with keyboard navigation (Arrow keys + Enter/Tab)
- Rhyme-tagged suggestions (musical note badge)
- Spelling correction suggestions (fix badge)
- Viewport-clamped fixed positioning
- ARIA listbox/option roles for screen reader support
- Ghost-line preview rendering

**File:** `src/components/IntelliSense.jsx` (119 lines)

---

## 4. Polish

### Accessibility Compliance
13/13 accessibility tests now pass, covering:
- Keyboard navigation (Tab, Escape, Enter)
- Focus management and trapping
- ARIA labels on interactive elements
- Screen reader compatibility (role, aria-selected, aria-modal)
- Skip-link functionality
- Color contrast indicators

**Before:** 1/13 passing — GrimoireScroll keyboard test hung for 30+ seconds. Focus management, ARIA labels, and screen reader tests all failing.

**After:** 13/13 passing — all keyboard, focus, ARIA, and screen reader paths verified.

### Test Infrastructure
- **Setup file** expanded from ~2 lines to 130 lines with robust mocks
- **ResizeObserver** stub for jsdom
- **Canvas 2d context** mock (measureText, fillText, path methods)
- **scrollIntoView** stub
- **requestAnimationFrame/cancelAnimationFrame** polyfill (setTimeout-based)
- **Fetch mock** covering 9 API endpoints (corpus, phoneme dictionary, rhyme rules, panel analysis, word lookup, auth, progression, scrolls, lexicon)
- **Framer-motion** cached Proxy mock (described above)

### Import Path Corrections
`tests/qa/features/visuals.qa.test.js` used `../../src/` (2 levels up) but the file is 3 levels deep (`tests/qa/features/`), causing a module load failure for all 23 tests.

**Before:** `import { LIBRARY } from '../../src/lib/ambient/schoolAudio.config.js'` → resolved to `tests/src/lib/...` (nonexistent)

**After:** `import { LIBRARY } from '../../../src/lib/ambient/schoolAudio.config.js'` → resolves correctly to project root `src/`

### Heuristic Scorer Contracts
All 7 heuristic modules now export consistent scorer interfaces:
- `alliteration_density` — detects alliteration chains across lines
- `meter_regularity` — checks syllable consistency with stress patterns
- `phoneme_density` — identifies high phoneme density words
- `rhyme_quality` — async deep rhyme analysis with quality scoring
- `vocabulary_richness` — lexical diversity and word frequency analysis
- `literary_device_richness` — metaphor, simile, and device detection
- `phonetic_hacking` — phonetic pattern exploitation detection

Each returns `{ rawScore: number, diagnostics: Array, metadata: object }` — now guaranteed numeric via async pipeline.

---

## Architecture Summary

```
┌─────────────────────────────────────────────┐
│  Frontend (React + Vite)                    │
│  ├── ScrollEditor ──→ IntelliSense          │
│  ├── useColorCodex ──→ Truesight overlay    │
│  ├── useScoring ──→ await calculateScore()  │
│  └── usePanelAnalysis ──→ /api/analysis     │
├─────────────────────────────────────────────┤
│  Scoring Engine (async)                     │
│  ├── Promise.all(heuristics.map(scorer))    │
│  ├── 7 heuristic modules (sync + async)     │
│  └── Weight-based contribution traces       │
├─────────────────────────────────────────────┤
│  Backend (Fastify)                          │
│  ├── /api/analysis/panels (dual-cache)      │
│  ├── /api/word-lookup (single + batch)      │
│  ├── /auth/* (6 endpoints, CAPTCHA, bcrypt) │
│  └── Redis + in-memory cache layers         │
├─────────────────────────────────────────────┤
│  Test Suite (Vitest + RTL)                  │
│  ├── 52 test files, 370 tests              │
│  ├── jsdom environment with full mocks      │
│  └── 0 failures, ~14s full run             │
└─────────────────────────────────────────────┘
```

---

*Generated: 2026-02-16 | Scholomance v10 | Vitest 4.0.18 | React 18.2*
