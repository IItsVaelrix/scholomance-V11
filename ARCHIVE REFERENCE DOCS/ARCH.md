# ARCH.md - Scholomance Language IDE Architecture Review

## Context

Scholomance is a linguistic analysis IDE / text-combat MUD built on React 18 + Vite 7.3 (frontend) and Fastify 5 + SQLite (backend). The CODEx system provides phoneme analysis, heuristic scoring, dictionary lookups, and multi-agent collaboration. Three architectural concerns have been identified, ranked by severity.

---

## 1. CRITICAL: Multi-User Efficiency & API Token Isolation

### Current State

| Layer | Isolation Status | Risk |
|-------|-----------------|------|
| EventBus (`codex/runtime/eventBus.js`) | Client-side singleton per browser tab | None - naturally isolated |
| Scoring Engine (`codex/core/scoring.engine.js`) | Factory-based, new instance per call | None - pure functions |
| Phoneme/Rhyme Analysis (`src/lib/phoneme.engine.js`, `deepRhyme.engine.js`) | Client-side computation | None - no API calls |
| Dictionary Lookups (Datamuse, Free Dictionary) | Free APIs, no auth tokens | **MEDIUM** - shared rate limits |
| Server Rate Limiting (`codex/server/index.js:209-221`) | Per-IP, 100 req/min | **HIGH** - NAT/proxy conflation |
| IndexedDB Cache (`codex/runtime/cache.js`) | Per-browser, 24hr TTL | **MEDIUM** - no cross-user benefit |

### Problems Detected

**P1: IP-based rate limiting collapses behind NAT/reverse proxy.** All users on the same network or behind Render's proxy appear as one IP. One active user can exhaust the 100 req/min budget for everyone.

**P2: No server-side word cache.** Every user's dictionary lookup hits external APIs independently. 50 users looking up "ephemeral" = 50 outbound API calls, when 1 would suffice.

**P3: No request coalescing.** Concurrent in-flight requests for the same word are not deduplicated. Each becomes a separate external API call.

**P4: Client-side rate limiter is per-instance only.** The 10 lookups/sec limit in `wordLookupPipeline.js:22` protects a single tab, not the server's outbound API budget.

### Fixes

#### Fix 1: Server-Side Word Lookup with Redis Cache
- **Create** `codex/server/routes/wordLookup.routes.js` - new endpoint `GET /api/word-lookup/:word`
- Server checks Redis (7-day TTL for stable dictionary data) before hitting external APIs
- Client `wordLookupPipeline.js` updated to call server endpoint instead of external APIs directly
- Keeps IndexedDB as L1 (client), Redis as L2 (shared), external APIs as L3

#### Fix 2: Request Coalescing
- **Create** `codex/server/services/wordLookupCoalescer.js`
- Tracks in-flight promises by normalized word key
- 100 concurrent requests for same word = 1 outbound API call, 100 resolved promises
- Automatic cleanup on completion

#### Fix 3: Per-User Rate Limiting
- **Modify** `codex/server/index.js` lines 209-221
- Change `keyGenerator` from `request.ip` to `request.session?.userId || request.ip`
- Each authenticated user gets their own 100 req/min budget
- Unauthenticated users still rate-limited by IP

#### Fix 4: Batch Lookup Endpoint
- **Add** `POST /api/word-lookup/batch` accepting `{ words: string[] }`
- Truesight mode can analyze entire document in 1-2 requests instead of N
- Server deduplicates, checks cache, coalesces, returns merged results

### Architecture After Fixes

```
User A browser          User B browser
  |                       |
  v                       v
[IndexedDB L1 cache]   [IndexedDB L1 cache]    <-- per-user, 24hr
  |                       |
  +------- HTTPS ---------+
           |
     [Fastify Server]
           |
     [Per-user rate limit]
           |
     [Redis L2 cache]                           <-- shared, 7-day TTL
           |
     [Request Coalescer]                        <-- dedup in-flight
           |
     [Adapter Chain: Local -> FreeDictionary -> Datamuse]
```

### Files to Modify
- `codex/server/index.js` - rate limit keyGenerator
- `codex/runtime/wordLookupPipeline.js` - add server endpoint + batch mode
- **New:** `codex/server/routes/wordLookup.routes.js`
- **New:** `codex/server/services/wordLookupCoalescer.js`

---

## 2. MEDIUM: Visual Improvement with Lightning CSS

### Current State

- Plain CSS with CSS custom properties (no preprocessor, no PostCSS)
- Well-structured design token system in `src/index.css` (1104 lines)
- Manual vendor prefixing throughout
- No CSS nesting - verbose selector chains like `.readPage .codex-layout .codex-sidebar`
- Vite config (`vite.config.js`) has zero CSS processing configured
- Theme system (dark/light + school colors) works well via CSS variables

### Problems Detected

**P1: No build-time CSS optimization.** Production bundles contain unprefixed, unminified CSS.

**P2: Verbose nested selectors.** Without nesting, deep component styles require full selector paths, hurting readability and maintainability.

**P3: No custom media queries.** Responsive breakpoints are repeated as magic numbers throughout stylesheets.

### Fixes

#### Fix 1: Add Lightning CSS to Vite
- `npm install -D lightningcss`
- **Modify** `vite.config.js`:

```js
css: {
  transformer: 'lightningcss',
  lightningcss: {
    drafts: { nesting: true, customMedia: true },
    targets: { chrome: 100, firefox: 100, safari: 15 },
    minify: process.env.NODE_ENV === 'production',
  },
},
```

- Zero breaking changes - Lightning CSS is backward compatible with existing plain CSS
- Gains: automatic vendor prefixing, production minification (~20-30% smaller), native nesting support

#### Fix 2: Add Custom Media Queries
- **Modify** `src/index.css` - add at top:

```css
@custom-media --mobile (max-width: 640px);
@custom-media --tablet (min-width: 641px) and (max-width: 1024px);
@custom-media --desktop (min-width: 1025px);
@custom-media --reduced-motion (prefers-reduced-motion: reduce);
```

- Replace magic number breakpoints across all CSS files gradually

#### Fix 3: Gradual Nesting Refactor
- Convert verbose selector chains to nested syntax in `ReadPage.css`, `CollabPage.css`, `index.css`
- No big-bang rewrite - refactor file-by-file as they're touched

### Files to Modify
- `vite.config.js` - add Lightning CSS config
- `package.json` - add `lightningcss` devDependency
- `src/index.css` - add custom media queries (optional first pass)
- `src/pages/Read/ReadPage.css` - nesting refactor (gradual)

---

## 3. LOWER: Heuristic System Expansion & Stylized Toolbars

### Current State

**Scoring Engine** (`codex/core/scoring.engine.js`): Well-designed factory pattern, supports N heuristics with weighted scoring and explanation traces.

**Heuristics Implemented**: Only 1 - `phoneme_density` (`codex/core/heuristics/phoneme_density.js`) and it's a **placeholder** using basic regex instead of the real phoneme engine.

**Disconnected Engines**: These sophisticated analysis systems exist but are NOT wired into scoring:

| Engine | File | Lines | Status |
|--------|------|-------|--------|
| Phoneme Engine | `src/lib/phoneme.engine.js` | 623 | Used by UI only |
| Deep Rhyme Engine | `src/lib/deepRhyme.engine.js` | 540 | Used by UI only |
| Rhyme Scheme Detector | `src/lib/rhymeScheme.detector.js` | ~300 | Used by UI only |
| Literary Device Detector | `src/lib/literaryDevices.detector.js` | ~200 | Used by UI only |

**Toolbar**: Basic toolbar in `ReadPage.css` lines 323-506 with mode toggles, formatting buttons, and school palette. Functional but not visually rich.

### Problems Detected

**P1: Scoring system is effectively non-functional.** The single placeholder heuristic uses `new Set(line.match(/[aeiou]/gi)).size` instead of the actual phoneme engine sitting 2 directories away.

**P2: Rich analysis engines are siloed.** Phoneme, rhyme, meter, and literary device engines all produce analysis data that never reaches the scoring system.

**P3: No real-time score feedback.** Users write scrolls with no live indication of linguistic quality or how their text scores.

### Fixes

#### Fix 1: Replace Placeholder phoneme_density
- **Modify** `codex/core/heuristics/phoneme_density.js`
- Import and use `analyzeWord()` from `src/lib/phoneme.engine.js`
- Score based on actual vowel family variety and phonemes-per-word ratio
- Weight: 0.20

#### Fix 2: Add New Heuristics (wire existing engines)

| Heuristic | Source Engine | Weight | What It Scores |
|-----------|-------------|--------|----------------|
| `alliteration_density` | `phoneme.engine.js` | 0.15 | Consecutive consonant-initial words |
| `rhyme_quality` | `deepRhyme.engine.js` | 0.25 | Perfect/near/slant rhyme connections |
| `meter_regularity` | `rhymeScheme.detector.js` | 0.15 | Iambic/trochaic consistency |
| `literary_device_richness` | `literaryDevices.detector.js` | 0.15 | Alliteration, anaphora, epistrophe count |
| `vocabulary_richness` | (new, simple) | 0.10 | Unique words / total words ratio |

Total weight: 1.00 (0.20 + 0.15 + 0.25 + 0.15 + 0.15 + 0.10)

All heuristics follow the existing contract:
```
scorer(line) => { heuristic: string, rawScore: 0-1, explanation: string }
```

**New files:**
- `codex/core/heuristics/alliteration_density.js`
- `codex/core/heuristics/rhyme_quality.js`
- `codex/core/heuristics/meter_regularity.js`
- `codex/core/heuristics/literary_device_richness.js`
- `codex/core/heuristics/vocabulary_richness.js`

#### Fix 3: HeuristicScorePanel Component
- **Create** `src/components/HeuristicScorePanel.jsx` + `.css`
- Floating panel (right side) with animated score bars per heuristic
- School-themed styling (gold accents, dark glass background, `backdrop-filter: blur`)
- Uses `framer-motion` for bar fill animations and panel entrance
- Wired into `ReadPage.jsx` via `createScoringEngine()` with all heuristics
- Recalculates on content change (debounced)

#### Fix 4: Enhanced Toolbar
- **Modify** `src/pages/Read/ReadPage.css` toolbar section (lines 323-506)
- Add CODEx score toggle button to existing toolbar
- School-color gradient accents on active toolbar buttons
- Lightning CSS nesting for cleaner toolbar styles (pairs with Concern 2)

### Files to Modify
- `codex/core/heuristics/phoneme_density.js` - replace placeholder
- **New:** 5 heuristic files in `codex/core/heuristics/`
- **New:** `src/components/HeuristicScorePanel.jsx` + `.css`
- `src/pages/Read/ReadPage.jsx` - integrate scoring engine + panel
- `src/pages/Read/ReadPage.css` - toolbar visual enhancements

---

## Verification Plan

### Concern 1 (Multi-User Efficiency)
1. Start server, open 2+ browser sessions as different users
2. Both look up the same word simultaneously - verify Redis cache hit on 2nd request
3. Check server logs: only 1 outbound API call, not 2
4. Test rate limiting: exhaust limit on User A, verify User B is unaffected
5. Run `tests/collab/` test suite to verify no regressions

### Concern 2 (Lightning CSS)
1. `npm run build` - verify no CSS errors
2. Inspect production CSS: confirm vendor prefixes present, minified
3. Visual comparison: open app before/after, confirm no visual regressions
4. Test dark/light theme toggle still works
5. Test school color transitions still work

### Concern 3 (Heuristics & Toolbar)
1. Open Read page, write a scroll with known rhymes and alliteration
2. Toggle CODEx score panel - verify all 6 heuristics report scores
3. Verify score traces include explanations
4. Confirm scores are deterministic (same text = same score every time)
5. Run `npm test` for unit tests on each heuristic
