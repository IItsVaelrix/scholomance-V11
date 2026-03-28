# 🔮 MERLIN DATA — WEAVE REPORT
## 2026-03-28 — Full Debug Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SEAL STATUS: TORN**

```
Total Tests: 560 | Pass: 511 | Fail: 49 | Skip: 0
Lint:        5 errors, 14 warnings
Build:       FAILED
Duration:    123.04s
```

---

## TEAR 1 — BUILD BLOCKER ⛔ (Critical)

### THE ANOMALY
The scroll of ReadPage speaks the same incantation twice — the weave rejects the duplicate binding.
`handleToggleTruesight` and `handleModeChange` are declared twice in the same scope, causing a fatal build error.

### THE WEAVE TRACE
- **Layer:** UI
- **Origin:** `src/pages/Read/ReadPage.jsx:628` and `:633`
- **Propagation:** Duplicate `const` declarations → esbuild transform failure → `vite build` exits with code 1
- **First visible manifestation:** Production build fails entirely — no deployable artifact

### HYPOTHETICAL CAUSES
**Cause A (95%):** A merge or edit introduced duplicate `useCallback` blocks for `handleToggleTruesight` and `handleModeChange`. The original declarations exist earlier in the component; lines 628–636 are copies.
- Evidence: esbuild reports "The symbol has already been declared" at exactly these lines
- Risk if confirmed: Zero — removing the duplicates restores the build

**Cause B (5%):** An incomplete refactor split the component and re-introduced the handlers without removing the originals.
- Evidence: The surrounding code at line 626 references `bumpAutosaveContext`, suggesting a recent edit to the autosave flow
- Risk if confirmed: The "correct" version of the handler may differ from the original — verify which version has the intended dependency array

### THE FAILING TEST
```
Build command: npx vite build
Exit code: 1
Error: The symbol "handleToggleTruesight" has already been declared (line 628)
Error: The symbol "handleModeChange" has already been declared (line 633)
```

### ESCALATION TO: Claude
**OWNER'S ACTION:** Remove the duplicate `const handleToggleTruesight` (line 628) and `const handleModeChange` (line 633) declarations. Verify the remaining declarations have the correct dependency arrays.

### PROS OF FIXING NOW:
- Unblocks production build entirely
- Trivial fix — delete duplicate lines
- Zero risk of behavioral regression

### CONS / RISKS OF FIXING NOW:
- Must verify which copy has the correct `useCallback` dependency array before deleting

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — fix immediately

---

## TEAR 2 — FloatingPanel `window.matchMedia` Mock Missing (8 failures)

### THE ANOMALY
The FloatingPanel reaches for the world's media query oracle, but in the test realm, no such oracle exists.
`window.matchMedia` is not mocked in the jsdom test environment, causing FloatingPanel to throw on mount.

### THE WEAVE TRACE
- **Layer:** UI / Test Environment
- **Origin:** `src/components/shared/FloatingPanel.jsx:16`
- **Propagation:** `useEffect` calls `window.matchMedia()` → jsdom has no implementation → `TypeError` → component crashes → 8 tests fail
- **First visible manifestation:** All FloatingPanel-dependent tests throw before assertions run

### Affected Tests (8)
| # | File | Test Name |
|---|------|-----------|
| 1 | `tests/accessibility.test.jsx` | FloatingPanel > should expose dialog semantics |
| 2 | `tests/accessibility.test.jsx` | FloatingPanel > should dismiss on Escape when onClose is provided |
| 3 | `tests/qa/features/ui.qa.test.jsx` | calls onClose when close button is clicked |
| 4 | `tests/qa/features/ui.qa.test.jsx` | does not render close button when onClose is not provided |
| 5 | `tests/qa/features/ui.qa.test.jsx` | close button stops pointer event propagation |
| 6 | `tests/qa/features/ui.qa.test.jsx` | close button has higher z-index than resize handles |
| 7 | `tests/qa/features/ui.qa.test.jsx` | closes panel on Escape key |
| 8 | `tests/qa/features/ui.qa.test.jsx` | renders title text correctly |

### HYPOTHETICAL CAUSES
**Cause A (90%):** `tests/setup.js` mocks `ResizeObserver`, `scrollIntoView`, `requestAnimationFrame`, and `fetch` — but never mocks `window.matchMedia`. FloatingPanel was recently updated to use a media query for mobile detection.
- Evidence: The setup file has no `matchMedia` mock; the component clearly calls it at line 16
- Risk if confirmed: None — adding the mock is standard practice

**Cause B (10%):** FloatingPanel should guard the call with `typeof window.matchMedia === 'function'` for SSR/test safety.
- Evidence: Best practice for isomorphic components
- Risk if confirmed: Slightly more defensive but doesn't fix the test environment gap

### THE FAILING TEST
```javascript
// Reproduction — any test that renders FloatingPanel
describe('FloatingPanel', () => {
  it('should expose dialog semantics — REGRESSION GUARD', () => {
    // Throws: TypeError: window.matchMedia is not a function
    render(<FloatingPanel title="Test" onClose={() => {}}><p>Content</p></FloatingPanel>);
  });
});
```

### ESCALATION TO: Blackbox (self) for setup.js mock + Claude for optional defensive guard

**OWNER'S ACTION:**
1. **Blackbox** adds to `tests/setup.js`:
```javascript
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```
2. **Claude** (optional) adds guard in FloatingPanel: `if (typeof window.matchMedia === 'function')`

### PROS OF FIXING NOW:
- Unblocks 8 tests across 2 test files
- Standard jsdom mock — zero risk
- Fixes both accessibility and QA suites

### CONS / RISKS OF FIXING NOW:
- None

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — fix immediately

---

## TEAR 3 — HHM (Hidden Harkov Model) Not Implemented (34 failures)

### THE ANOMALY
The Hidden Harkov Model — the deep grammar of the weave — exists only as prophecy. The tests invoke its name, but the implementation has not yet been woven into the syntax layer.
`buildSyntaxLayer()` returns no `.hhm` sub-object; 34 tests that depend on HHM properties all fail with `Cannot read properties of undefined`.

### THE WEAVE TRACE
- **Layer:** Logic / Data
- **Origin:** `src/lib/syntax.layer.js` — `buildSyntaxLayer()` function
- **Propagation:** Missing `.hhm` object → all token-level HHM properties (`hiddenState`, `stanzaBar`, `tokenWeight`, `stageScores`, `context`) are undefined → 34 tests fail
- **First visible manifestation:** Every HHM-related assertion returns `undefined`

### Affected Tests (34)
| # | File | Category |
|---|------|----------|
| 1–5 | `tests/lib/harkov.phoneme.dataset.test.js` | 4-bar stanza batching (5 tests) |
| 6–11 | `tests/lib/harkov.phoneme.dataset.test.js` | Hidden state inference (6 tests) |
| 12–17 | `tests/lib/harkov.phoneme.dataset.test.js` | Silent-E phonetic tripwire (6 tests) |
| 18–19 | `tests/lib/harkov.phoneme.dataset.test.js` | Homograph tripwire (2 tests) |
| 20–21 | `tests/lib/harkov.phoneme.dataset.test.js` | Homonym tripwire (2 tests) |
| 22–23 | `tests/lib/harkov.phoneme.dataset.test.js` | Synonym groups (2 tests) |
| 24–28 | `tests/lib/harkov.phoneme.dataset.test.js` | Transition matrix (5 tests) |
| 29–32 | `tests/lib/harkov.phoneme.dataset.test.js` | Stage signal ordering (4 tests) |
| 33 | `tests/lib/harkov.phoneme.dataset.test.js` | Dictionary source linkage (1 test) |
| 34 | `tests/lib/harkov.phoneme.dataset.test.js` | Dataset-scale integration — Penne Obake (1 test) |
| 35 | `tests/lib/harkov.phoneme.dataset.test.js` | Dataset-scale integration — Gravity Well (1 test) |
| 36 | `tests/lib/harkov.phoneme.dataset.test.js` | Dataset-scale integration — Repeating Stanza (1 test) |
| 37–38 | `tests/lib/syntax.layer.test.js` | HHM signals + context snapshots (2 tests) |

### HYPOTHETICAL CAUSES
**Cause A (100%):** The HHM is spec'd but not yet implemented. Tests were written ahead of the implementation (test-first development). `buildSyntaxLayer()` produces `tokens`, `syntaxSummary`, etc. but has no HHM computation pass.
- Evidence: All 34 failures are `Cannot read properties of undefined (reading 'enabled'|'stanzas'|'hiddenState'|etc.)` — the `.hhm` key simply doesn't exist on the returned object
- Risk if confirmed: None — this is expected pre-implementation state

### THE FAILING TEST
```javascript
// Representative reproduction
describe('[HHM] stanza batching', () => {
  it('groups lines 0–3 into stanza 0 — REGRESSION GUARD', () => {
    const doc = parseTextToDoc(ECHO_CHORUS);
    const layer = buildSyntaxLayer(doc);
    expect(layer.hhm.enabled).toBe(true); // TypeError: Cannot read properties of undefined
  });
});
```

### ESCALATION TO: Codex
**OWNER'S ACTION:** Implement the HHM computation pass in `buildSyntaxLayer()` per the MECHANIC SPEC. The required output shape is fully defined by the 34 existing tests:
- `layer.hhm.enabled` (boolean)
- `layer.hhm.stanzaSizeBars` (number, default 4)
- `layer.hhm.stanzaCount` (number)
- `layer.hhm.stanzas[]` with `.bars[]`, `.transitions[]`, `.hiddenStateCounts`, `.tokenCount`
- Per-token: `token.hhm.hiddenState`, `token.hhm.stanzaBar`, `token.hhm.tokenWeight`, `token.hhm.stageScores`, `token.hhm.context`, `token.hhm.dictionarySources`

### PROS OF FIXING NOW:
- Unlocks 34 tests (61% of all failures)
- Core mechanic — blocks combat scoring accuracy
- Tests are already written and comprehensive

### CONS / RISKS OF FIXING NOW:
- Large implementation surface — needs careful alignment with MECHANIC SPEC
- May interact with phoneme engine changes (Tear 4)

### ALTERNATIVE PATHS:
- Mark tests as `it.skip()` temporarily and track via COMBAT_MVP_TASKS.md — but this delays the core mechanic

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — Codex should implement when ready. Tests are waiting.

---

## TEAR 4 — Phoneme Engine Snapshot Drift (2 failures)

### THE ANOMALY
The corpus has reshuffled its most common words — the old prophecy no longer matches the new ordering.
The top-25 word frequency list changed, causing snapshot mismatches in both `analyzeWord` and `analyzeDeep` regression tests.

### THE WEAVE TRACE
- **Layer:** Data / Logic
- **Origin:** Corpus generation (`scripts/generate_corpus.js`) or phoneme engine frequency sort
- **Propagation:** Word frequency ranking changed → baseline word list reordered → snapshot comparison fails
- **First visible manifestation:** Snapshot diff shows word reordering (e.g., `THAT→HE`, `YOU→HIS`, `MY→WAS`)

### Affected Tests (2)
| # | File | Test Name |
|---|------|-----------|
| 1 | `tests/lib/phoneme.engine.test.js` | keeps analyzeWord output stable for a deterministic corpus sample |
| 2 | `tests/lib/phoneme.engine.test.js` | keeps analyzeDeep output stable for a deterministic corpus sample |

### HYPOTHETICAL CAUSES
**Cause A (70%):** The corpus SQLite database (`scholomance_corpus.sqlite`) was regenerated with updated source material, changing word frequency rankings.
- Evidence: The diff shows words like `ME`, `THIS`, `HAVE` replaced by `SHE`, `HAD`, `ON` — consistent with a different source text distribution
- Risk if confirmed: If intentional, just update snapshots. If accidental, the corpus may have regressed.

**Cause B (30%):** The frequency sort in the phoneme engine is not stable (ties broken differently across runs).
- Evidence: Some swapped words have similar frequencies (e.g., `IS`/`WAS`, `HE`/`HIS`)
- Risk if confirmed: Non-deterministic tests — need a tiebreaker (alphabetical) in the sort

### THE FAILING TEST
```javascript
it('keeps analyzeWord output stable for a deterministic corpus sample', () => {
  const baseline = baselineWords.map((word) => projectAnalyzeWordContract(word));
  expect({ words: baselineWords, baseline }).toMatchSnapshot();
  // Snapshot mismatch: word ordering changed
});
```

### ESCALATION TO: Codex
**OWNER'S ACTION:**
1. Determine if the corpus change is intentional
2. If yes: `npx vitest run tests/lib/phoneme.engine.test.js --update`
3. If no: investigate `scripts/generate_corpus.js` for sort stability
4. Consider adding alphabetical tiebreaker to frequency sort for determinism

### PROS OF FIXING NOW:
- Quick fix if intentional (snapshot update)
- Restores determinism contract

### CONS / RISKS OF FIXING NOW:
- Updating snapshots without understanding the cause masks potential corpus regression

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** Yes
**Question:** Are the corpus word frequency changes intentional? Should snapshots be updated, or should the old corpus ordering be restored?

---

## TEAR 5 — colorCodex Performance Regression (1 failure)

### THE ANOMALY
The color weave takes too long to resolve — 19.4ms where 10ms was promised.
`buildColorMap` exceeds its performance budget on the current environment.

### THE WEAVE TRACE
- **Layer:** Logic
- **Origin:** `src/lib/colorCodex.js` — `buildColorMap()` function
- **Propagation:** Union-find clustering for 500 words × 200 connections exceeds 10ms threshold
- **First visible manifestation:** Performance assertion fails: `expected 19.401ms to be less than 10`

### Affected Tests (1)
| # | File | Test Name |
|---|------|-----------|
| 1 | `tests/lib/colorCodex.test.js:218` | performs within 10ms for 500 words and 200 connections |

### HYPOTHETICAL CAUSES
**Cause A (60%):** The 10ms threshold was calibrated on a faster machine or Linux CI. Windows + jsdom overhead adds ~2× latency.
- Evidence: 19.4ms is close to 2× the threshold — consistent with environment overhead
- Risk if confirmed: Threshold needs environment-aware adjustment

**Cause B (40%):** Recent changes to `buildColorMap` (e.g., the `boostLightness` function, syntax gate multiplier) added computation without re-profiling.
- Evidence: `boostLightness` is defined but unused (lint warning) — suggests recent refactoring
- Risk if confirmed: May need algorithmic optimization

### THE FAILING TEST
```javascript
it('performs within 10ms for 500 words and 200 connections', () => {
  const start = performance.now();
  buildColorMap(words, connections);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(10);
});
```

### ESCALATION TO: Codex
**OWNER'S ACTION:**
1. Profile `buildColorMap` with 500 words × 200 connections
2. Either optimize the hot path OR relax threshold to 25ms with a comment explaining environment variance
3. Remove unused `boostLightness` function (lint cleanup)

### PROS OF FIXING NOW:
- Clears 1 test failure
- Prevents false negatives in CI

### CONS / RISKS OF FIXING NOW:
- Relaxing the threshold may mask real performance regressions later

### ALTERNATIVE PATHS:
- Use `performance.now()` warm-up run before measurement to reduce JIT variance
- Set threshold to `process.env.CI ? 10 : 25` for environment-aware testing

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** Yes
**Question:** Should the performance threshold be relaxed for Windows/local development (e.g., 25ms), or should the algorithm be optimized to meet 10ms?

---

## TEAR 6 — rhymeAstrology `lineEndingSignature` Regression (1 failure)

### THE ANOMALY
The astrology engine reads the wrong stars at the end of the line — "flame same" should resolve to `EY1-M` but returns `A-open`.
The line-ending signature computation is producing an incorrect phoneme key for the word "same".

### THE WEAVE TRACE
- **Layer:** Logic / Runtime
- **Origin:** `codex/runtime/rhyme-astrology/queryEngine.js` — line-ending signature computation
- **Propagation:** `analyzeWord("same")` returns wrong rhyme key → `lineEndingSignature` is `A-open` instead of `EY1-M`
- **First visible manifestation:** Line-mode query returns incorrect signature

### Affected Tests (1)
| # | File | Test Name |
|---|------|-----------|
| 1 | `tests/runtime/rhymeAstrology.queryEngine.test.js:173` | returns line-query metadata for line mode |

### HYPOTHETICAL CAUSES
**Cause A (75%):** The phoneme engine's analysis of "same" changed (possibly related to Tear 4's corpus drift), causing the rhyme key to shift from `EY1-M` to `A-open`.
- Evidence: "same" has phonemes S-EY1-M; if the engine now maps it differently, the signature breaks
- Risk if confirmed: Cascading — affects all rhyme astrology queries involving EY-family words

**Cause B (25%):** The `lineEndingSignature` computation in `queryEngine.js` was recently modified and has a bug in how it extracts the final word's phoneme signature.
- Evidence: `queryEngine.js` appears in the git modified files list
- Risk if confirmed: Localized fix in the query engine

### THE FAILING TEST
```javascript
it('returns line-query metadata for line mode', () => {
  // ...
  expect(result.query.lineEndingSignature).toBe('EY1-M');
  // Got: 'A-open'
});
```

### ESCALATION TO: Codex
**OWNER'S ACTION:**
1. Check `analyzeWord("same")` output — does it still return rhymeKey `EY-M`?
2. If the phoneme engine changed, the query engine's signature extraction may need updating
3. If the query engine changed, revert or fix the signature logic

### PROS OF FIXING NOW:
- Rhyme astrology is a core feature — incorrect signatures break constellation matching
- Single-point fix likely

### CONS / RISKS OF FIXING NOW:
- May be entangled with Tear 4 (corpus/phoneme changes)

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — Codex should investigate and fix

---

## TEAR 7 — SONIC Audio URL Type Mismatch (1 failure)

### THE ANOMALY
The SONIC school's track speaks in objects where a simple string was expected — the audio URL is wrapped in a container instead of being a bare path.

### THE WEAVE TRACE
- **Layer:** Data
- **Origin:** `src/data/` — audio library track definition for SONIC school
- **Propagation:** `track.sc` resolves to an object (likely `{url, title}`) → `typeof url` is `'object'` not `'string'` → assertion fails
- **First visible manifestation:** QA test for SONIC audio URL resolution fails

### Affected Tests (1)
| # | File | Test Name |
|---|------|-----------|
| 1 | `tests/qa/features/visuals.qa.test.js:80` | SONIC's library entry has a resolvable audio URL (sc/suno/url) |

### HYPOTHETICAL CAUSES
**Cause A (85%):** The SONIC track's `sc` field was updated to a richer format `{url: "...", title: "..."}` but the test and consumers expect a plain string URL.
- Evidence: `typeof url` returns `'object'` — consistent with an object value
- Risk if confirmed: Any code that does `new Audio(track.sc)` will break

**Cause B (15%):** The `sc` field accidentally received an array (e.g., multiple SoundCloud URLs) instead of a single string.
- Evidence: Arrays are also `typeof 'object'`
- Risk if confirmed: Need to pick the first URL or restructure

### THE FAILING TEST
```javascript
it("SONIC's library entry has a resolvable audio URL (sc/suno/url)", () => {
  const url = track.sc || track.suno || track.url || null;
  expect(url).not.toBeNull();
  expect(typeof url).toBe("string"); // Got: "object"
});
```

### ESCALATION TO: Codex
**OWNER'S ACTION:** Normalize the SONIC track's `sc` field to a plain URL string. If the richer format is needed, add a `.url` accessor and update consumers.

### PROS OF FIXING NOW:
- Prevents runtime audio playback failures
- Simple data fix

### CONS / RISKS OF FIXING NOW:
- If the object format was intentional, consumers need updating instead

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — Codex should normalize

---

## TEAR 8 — Lint Errors (5 errors, 14 warnings)

### Errors (blocking)

| # | File | Line | Rule | Owner |
|---|------|------|------|-------|
| 1 | `codex/core/speaking/prosody.js` | 121 | `no-useless-escape` — unnecessary `\.` | **Codex** |
| 2 | `src/components/Nexus/NexusPanel.jsx` | 3 | `no-restricted-imports` — direct `codex/*` import from UI | **Claude** |
| 3 | `src/components/Nexus/NexusPanel.jsx` | 19 | `jsx-a11y/click-events-have-key-events` | **Claude** |
| 4 | `src/components/Nexus/NexusPanel.jsx` | 19 | `jsx-a11y/no-static-element-interactions` | **Claude** |
| 5 | `src/pages/Read/ReadPage.jsx` | 628 | Parsing error — duplicate declaration (= Tear 1) | **Claude** |

### Warnings (non-blocking, tracked)

| # | File | Line | Rule | Owner |
|---|------|------|------|-------|
| 1 | `src/components/Icons.jsx` | 1 | Unused `React` import | **Claude** |
| 2 | `src/components/Nexus/NexusPanel.jsx` | 1 | Unused `React` import | **Claude** |
| 3 | `src/components/WordTooltip.jsx` | 52 | Unused `SCHOOL_ICONS` | **Claude** |
| 4 | `src/components/WordTooltip.jsx` | 63 | Unused `getSchoolNameFromVowelFamily` | **Claude** |
| 5 | `src/lib/colorCodex.js` | 153 | Unused `boostLightness` | **Codex** |
| 6 | `src/pages/Combat/components/BattleLog.jsx` | 68 | Missing `entries` dependency | **Claude** |
| 7 | `src/pages/Combat/hooks/useCombatEngine.js` | 271 | Missing `recordWordUse` dependency | **Codex** |
| 8 | `src/pages/Combat/hooks/useCombatEngine.js` | 361 | Unused `scoreData` | **Codex** |
| 9 | `src/pages/Combat/scenes/BattleScene.js` | 23 | Unused `PARCHMENT` | **Claude** |
| 10 | `src/pages/Nexus/NexusPage.jsx` | 1 | Unused `React` import | **Claude** |
| 11 | `src/pages/Read/ScrollEditor.jsx` | 254 | Unused `isEditorIdle` | **Claude** |
| 12 | `src/pages/Read/ScrollEditor.jsx` | 516 | Unused `windowedLines` | **Claude** |
| 13 | `src/pages/Read/ScrollEditor.jsx` | 520 | Unused `paddingTop` | **Claude** |
| 14 | `src/pages/Read/ScrollEditor.jsx` | 521 | Unused `paddingBottom` | **Claude** |

━━━━━━━━━━━━━━━━━━━━
**ANGEL'S DECISION REQUIRED:** No — owners should clean up per standard process

---

## PRIORITY MATRIX

| Priority | Tear | Failures | Owner | Effort |
|----------|------|----------|-------|--------|
| 🔴 P0 | Tear 1 — Build blocker | BUILD DEAD | Claude | 5 min |
| 🔴 P0 | Tear 2 — matchMedia mock | 8 | Blackbox | 5 min |
| 🟡 P1 | Tear 8 — Lint errors | 5 errors | Claude + Codex | 15 min |
| 🟡 P1 | Tear 6 — rhymeAstrology sig | 1 | Codex | 30 min |
| 🟡 P1 | Tear 7 — SONIC URL | 1 | Codex | 5 min |
| 🟠 P2 | Tear 4 — Snapshot drift | 2 | Codex | 10 min |
| 🟠 P2 | Tear 5 — colorCodex perf | 1 | Codex | 30 min |
| 🔵 P3 | Tear 3 — HHM implementation | 34 | Codex | Multi-day |

---

## MERGE RECOMMENDATION: **HOLD**

### Conditions to clear before merge:
1. ✅ Fix build blocker (Tear 1) — duplicate declarations in ReadPage.jsx
2. ✅ Add `window.matchMedia` mock (Tear 2) — unblocks 8 tests
3. ✅ Resolve 5 lint errors (Tear 8)

### Deferred (tracked, non-blocking):
- HHM implementation (34 tests) — spec-driven, awaiting Codex implementation
- Snapshot update — awaiting Angel's decision on corpus intentionality
- colorCodex perf — awaiting Angel's decision on threshold
- rhymeAstrology signature — Codex investigation
- SONIC URL normalization — Codex data fix

---

## ANGEL'S DECISIONS REQUIRED

1. **Corpus ordering (Tear 4):** Are the phoneme engine snapshot changes intentional (new corpus word frequencies)? Should snapshots be updated, or should the old ordering be restored?

2. **Performance threshold (Tear 5):** Should the `buildColorMap` performance threshold be relaxed for Windows/local development (e.g., 25ms), or should the algorithm be optimized to meet 10ms?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Filed by Merlin Data — The Weave Inspector*
*Scholomance V11 — Debug Suite Run #2026-03-28*
