# Scholomance V10 — AI Architecture & Multi-Agent Collaboration Blueprint

> **Purpose**: Definitive architecture reference for all AI agents working on Scholomance.
> Removes identified weaknesses. Preserves proven strengths. Assigns clear ownership per agent.

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [CODEx — The Brain](#2-codex--the-brain)
3. [Phased Roadmap](#3-phased-roadmap)
4. [AI Agent Roles & Ownership](#4-ai-agent-roles--ownership)
5. [Agent-Specific Playbooks](#5-agent-specific-playbooks)
6. [Architecture Contracts](#6-architecture-contracts)
7. [QA & Anti-Regression](#7-qa--anti-regression)
8. [Risk Mitigations](#8-risk-mitigations)

---

## 1. Vision & Principles

Scholomance is a ritual-themed text combat MUD where words are weapons. Players craft "scrolls" (verses), and the system scores them using phoneme density, poetic heuristics, and linguistic analysis. Schools of magic gate progression. The editor is the arena.

### Core Principles

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Server is truth** | All XP, combat resolution, unlocks are server-authoritative. Client may preview, never decide. |
| 2 | **CODEx is layered, not monolithic** | Four strict layers (Core → Services → Runtime → Server). No layer may skip a level. |
| 3 | **Pure analysis, never DOM** | Scoring/phoneme/combat logic is pure-functional. Zero DOM, zero side effects. |
| 4 | **Security before features** | No new attack surface ships without threat model review. |
| 5 | **Deterministic scoring** | Same input → same output. Every score includes an explanation trace. |
| 6 | **Adapter pattern everywhere** | Dictionary, persistence, transport — all behind adapters. Swap sources without touching consumers. |
| 7 | **Web is source of truth** | Server data wins on conflict. Offline mode queues writes, server reconciles. No CRDT complexity. |

---

## 2. CODEx — The Brain

CODEx is the domain engine. It owns schemas, pipelines, and policy. It does NOT own UI, secrets, or network calls directly.

### 2.1 Layer Definitions

```
┌─────────────────────────────────────────────────────┐
│  CODEx Server (Authority Layer)                     │
│  Auth, accounts, persistence, anti-cheat,           │
│  combat resolution, XP award, unlocks, economy      │
│  ─── Only this layer talks to the database ───      │
├─────────────────────────────────────────────────────┤
│  CODEx Runtime (Orchestrator Layer)                  │
│  "Given event X, run pipeline Y"                    │
│  Caching, rate limits, dedupe, fallbacks            │
│  Emits structured events to UI + server             │
│  ─── Stateful but no domain logic ───               │
├─────────────────────────────────────────────────────┤
│  CODEx Services (Adapter Layer)                     │
│  DictionaryAdapter, PersistenceAdapter,             │
│  ContentIndexAdapter, TransportAdapter              │
│  ─── Normalize external sources into schemas ───    │
├─────────────────────────────────────────────────────┤
│  CODEx Core (Domain Layer)                          │
│  Scroll schema, tokenization, phoneme analysis,     │
│  scoring heuristics, combat rules                   │
│  ─── Pure functions. Testable. Deterministic. ───   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Schemas CODEx Owns

| Schema | Description | Layer |
|--------|-------------|-------|
| `Scroll` | id, title, content, createdAt, updatedAt, authorId | Core |
| `PhonemeAnalysis` | vowelFamily, phonemes, coda, rhymeKey | Core |
| `CombatAction` | scrollId, lines[], timestamp, playerId | Core |
| `CombatResult` | damage, statusEffects, resourceChanges, explainTrace[] | Core |
| `LexicalEntry` | word, definitions[], pos[], synonyms[], etymology?, ipa? | Services |
| `XPEvent` | source, amount, timestamp, playerId, context | Core |
| `ScoreTrace` | heuristic, rawScore, weight, explanation | Core |

### 2.3 What CODEx Must NOT Do

- Touch the DOM or any UI framework
- Store secrets or API keys
- Make network calls directly from Core layer (Services adapters only)
- Bypass the Runtime layer's caching/rate-limit policy
- Hold mutable global state outside of Runtime

### 2.4 Anti-Monolith Guard Rails

**Problem identified**: CODEx could absorb everything and become a god-object.

**Solution**: Strict boundary enforcement.

| If you're adding... | It goes in... | NOT in... |
|---------------------|---------------|-----------|
| A new scoring heuristic | `codex/core/heuristics/` | Runtime or Services |
| A new API data source | `codex/services/adapters/` | Core or Runtime |
| Caching logic | `codex/runtime/` | Core or Services |
| Database queries | `codex/server/` | Anywhere else |
| A UI component | `src/pages/` or `src/components/` | CODEx at all |
| An animation/effect | `src/` (UI layer) | CODEx at all |

**Lint rule**: No file in `codex/core/` may import from `codex/runtime/`, `codex/server/`, or `src/`. Enforce via ESLint `no-restricted-imports`.

---

## 3. Phased Roadmap

### Phase 0 — Security Baseline

**Goal**: Harden before expanding.

| Deliverable | Owner | Details |
|-------------|-------|---------|
| Threat model doc | Claude + Minimax | What we protect (scrolls, accounts, XP), likely attacks (XSS, token theft, API spam) |
| CSP policy | Claude | Starter Content-Security-Policy, tighten over time |
| Input sanitization | Claude | Allow-list validation (already in ARCH_CONTRACT_SECURITY.md), enforce in all new code |
| Dependency audit | Minimax | `npm audit`, lockfile discipline, add audit to CI |
| No secrets in client | All agents | Enforce via ESLint rule + code review |

### Phase 1 — Backend Server (Authority + Persistence)

**Goal**: Server becomes source of truth for progression and combat.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | **Fastify** (Node.js) | Lightweight, fast, CODEx architecture provides structure. No need for NestJS overhead. |
| Database | **Postgres** | Relational integrity for accounts, scrolls, XP. Scales well. |
| Cache | **Redis** (Phase 1.5) | Add when rate limiting and combat queue need it. Not MVP. |

**MVP Endpoints:**

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/auth/register` | Create account | Public |
| POST | `/auth/login` | Get JWT pair | Public |
| POST | `/auth/refresh` | Rotate access token | Refresh token |
| GET | `/scrolls` | List user scrolls | Bearer |
| POST | `/scrolls` | Create scroll | Bearer |
| PUT | `/scrolls/:id` | Update scroll | Bearer + ownership |
| DELETE | `/scrolls/:id` | Delete scroll | Bearer + ownership |
| GET | `/progression` | Get XP, unlocks | Bearer |
| POST | `/combat/submit` | Submit combat action | Bearer |
| GET | `/combat/:id/result` | Get combat result | Bearer |

**Auth strategy**: JWT access tokens (short-lived, 15min) + httpOnly refresh cookies. No localStorage tokens.

### Phase 2 — Dictionary & Thesaurus (Knowledge Layer)

**Goal**: Replace fragile multi-API dependency with local-first lexical data.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary source | **WordNet (OEWN)** | Small, structured, excellent for synonyms/semantic links. Already partially integrated via `build_scholomance_dict.py`. |
| Secondary source | **GCIDE** | Public domain dictionary. Lighter than Wiktionary. Add via adapter when WordNet coverage gaps appear. |
| NOT starting with | Wiktionary | 2.25GB SQLite already exists but is overkill for MVP. Revisit when specific coverage gaps are proven. |
| Pattern | `CodexDictionaryAdapter` | `lookup(word) → { definitions[], pos[], synonyms[], etymology?, examples? }` Normalized schema regardless of source. |

**Adapter interface:**

```javascript
// codex/services/adapters/dictionary.adapter.js
class DictionaryAdapter {
  async lookup(word)    // → LexicalEntry
  async synonyms(word)  // → string[]
  async rhymes(word)    // → string[]
  async related(word)   // → { relation: string, words: string[] }[]
}
```

**Fallback chain**: Local WordNet → Local GCIDE → Datamuse API → Free Dictionary API.
Each source is an adapter. Runtime orchestrates fallback + caching + TTL.

### Phase 3 — Combat System (Phoneme/Poetic Heuristics)

**Goal**: Deterministic, explainable, gameable-but-not-exploitable scoring.

**Input**: A "bar" (line or scroll action).
**Output**: `CombatResult` with damage, effects, and full explanation trace.

#### Scoring Heuristics

| Heuristic | Weight | What It Measures | Anti-Exploit |
|-----------|--------|------------------|-------------|
| Phoneme density | 0.20 | Stressed vowel variety per syllable | Diminishing returns after threshold |
| Internal rhyme | 0.15 | Rhyme proximity within a line | Must be 2+ words apart |
| Alliteration / consonance | 0.15 | Consonant repetition chains | Max 3 consecutive, then decay |
| Multisyllabic rhyme | 0.20 | Multi-syllable end-rhyme runs | Requires distinct root words |
| Meter consistency | 0.15 | Cadence window (iambic, trochaic, etc.) | Tolerance band, not exact |
| Rarity / novelty | 0.15 | Word frequency + repetition penalty | Repeated words in same scroll get 0 novelty |

#### Anti-Cheat Rules

1. Client may preview score; **server re-scores and resolves combat**.
2. Repeated words within same scroll: novelty score → 0 after 2nd use.
3. Nonsense detection: words not in dictionary get 0 for all heuristics except meter.
4. Payload size limit: max 500 characters per combat action.
5. Rate limit: max 1 combat action per 3 seconds per player.
6. Giant payloads: reject > 500 chars server-side before scoring.

#### Explanation Trace Format

```javascript
// Every CombatResult includes:
{
  totalDamage: 47,
  traces: [
    { heuristic: "phoneme_density", rawScore: 0.82, weight: 0.20, contribution: 8.2, explanation: "High vowel variety: AY, IY, OW across 12 syllables" },
    { heuristic: "internal_rhyme", rawScore: 0.65, weight: 0.15, contribution: 4.9, explanation: "'night' ↔ 'light' (positions 3, 7)" },
    // ...
  ]
}
```

### Phase 4 — Desktop Export (Application Packaging)

**Goal**: Ship the editor as a standalone app.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Packaging | **PWA first**, Tauri later | PWA aligns with web-first. Tauri adds native shell when needed. Electron rejected (too heavy). |
| Offline persistence | **IndexedDB** behind adapter | Same `PersistenceAdapter` interface as server. Swap transparently. |
| Sync strategy | **Web is source of truth** | Client queues writes offline. On reconnect, push to server. Server wins on conflict. No CRDT. |
| Conflict resolution | **Last-write-wins with tombstones** | Simple, predictable. Server timestamps are authoritative. Deleted items stay as tombstones for 30 days. |

**Sync pipeline:**

```
[Offline Write] → IndexedDB queue → [Reconnect] → POST /sync/batch → Server applies → Return canonical state → Client replaces local
```

**Quota handling**: Monitor IndexedDB usage. Warn at 80%. Never silently drop data — show user a "storage full" notification and block new writes until resolved.

---

## 4. AI Agent Roles & Ownership

Three AI agents collaborate on Scholomance. Each has a defined domain, tools, and handoff protocol.

### Role Matrix

| Domain | Claude (Opus) | Gemini + OpenAI Codex | Minimax V2.1 (Blackbox) |
|--------|---------------|----------------------|--------------------------|
| **Primary role** | Visual / UI / Debugging | Game mechanics / General code | Testing / QA / Debugging |
| **Codebase areas** | `src/pages/`, `src/components/`, `src/index.css`, all `.css` files, `src/lib/css/` | `codex/`, `src/lib/`, `src/hooks/`, `src/data/`, `server/`, `scripts/` | `tests/`, `playwright/`, CI config, `codex/core/` (read-only for test authoring) |
| **Writes to** | UI components, styles, visual layout, animations, accessibility | CODEx layers, backend endpoints, game logic, data models, adapters | Test suites, test fixtures, CI pipelines, debugging reports |
| **Reviews** | All visual PRs, CSS changes, a11y compliance | All logic PRs, schema changes, API contracts | All PRs (test coverage gate), performance reports |

### Handoff Protocol

```
┌──────────────┐     schema/API contract     ┌──────────────────────┐
│              │ ──────────────────────────→  │                      │
│   Gemini /   │                              │       Claude         │
│   Codex      │  ←── visual bug reports ──── │       (Opus)         │
│              │                              │                      │
└──────┬───────┘                              └──────────┬───────────┘
       │                                                 │
       │  new logic / changed behavior                   │  UI changes
       │                                                 │
       ▼                                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Minimax V2.1 (Blackbox)                      │
│              Tests everything. Blocks merge without coverage.     │
└──────────────────────────────────────────────────────────────────┘
```

**Rules:**
1. Gemini/Codex defines schemas and API contracts. Claude consumes them in UI. Neither changes the other's domain without discussion.
2. Minimax writes tests for both domains. Test failures block all merges.
3. If a bug spans domains (e.g., wrong data rendered in UI), the debugging agent (Claude or Minimax) diagnoses, then the owning agent fixes.

---

## 5. Agent-Specific Playbooks

### 5.1 Claude (Opus) — Visual / UI / Debugging

**You own the pixels.** Everything the user sees, touches, and feels is your responsibility.

#### Your Files

```
src/
├── pages/
│   ├── Watch/WatchPage.jsx          — YouTube embed display
│   ├── Listen/                      — School selector, SoundCloud embed
│   │   ├── ListenPage.jsx
│   │   ├── HolographicEmbed.jsx
│   │   ├── BrassGearDial.jsx
│   │   └── NixieTube.jsx
│   └── Read/                        — Grimoire editor (your flagship)
│       ├── ReadPage.jsx             — State management, orchestration
│       ├── ScrollEditor.jsx         — Textarea overlay technique
│       ├── GrimoireScroll.jsx       — Decoration wrapper
│       ├── ScrollList.jsx           — Scroll sidebar
│       ├── AnnotationPanel.jsx      — Word analysis popover
│       └── ReadPage.css             — Read-specific styles
├── components/
│   ├── AmbientOrb.jsx + .css        — Animated glyph visualization
│   ├── AtmosphereSync.jsx           — Theme hook integration
│   ├── Navigation/Navigation.jsx    — Top nav
│   └── shared/                      — ErrorBoundary, Badge, SectionHeader, Visualizer
├── index.css                        — Global tokens, base styles (26KB)
├── App.jsx                          — App shell, providers, page transitions
└── main.jsx                         — Entry point, router
```

#### Your Responsibilities

1. **Textarea overlay sync** — The core Read page technique. Textarea (z-index:1) + overlay div (z-index:2) must share identical typography (`Georgia, serif; font-size: var(--text-xl); line-height: 1.9; white-space: pre-wrap`). Scroll sync via `textarea.onScroll → overlay.scrollTop = textarea.scrollTop`.

2. **Truesight mode** — When active: textarea gets `color: transparent; caret-color: gold`. Overlay renders colored word buttons from `analyzedWords`. When inactive: overlay hidden, textarea visible.

3. **School theming** — Dynamic CSS variables per school. Generated by `scripts/generate-school-styles.js`. Your job to ensure visual consistency when school changes.

4. **Accessibility** — ARIA labels, screen reader announcements, reduced motion support (`usePrefersReducedMotion`). All interactive elements must be keyboard-navigable.

5. **Animations** — Framer Motion for page transitions, component enter/exit. Respect `prefers-reduced-motion`.

6. **Visual debugging** — When something looks wrong, you diagnose and fix. Use the visual baseline PNGs in `tests/visual/` for regression checks.

7. **Combat UI** (Phase 3) — Render `CombatResult` and `ScoreTrace[]` as an engaging visual breakdown. Show each heuristic's contribution. Animate damage numbers. This is where the game *feels* real.

#### Your Constraints

- Never modify files in `codex/`, `server/`, or `tests/` (except `tests/visual/`).
- Never implement game logic, scoring, or data models. Consume what Gemini/Codex provides.
- Never store state outside React hooks/context. No global mutable variables.
- All user input rendering uses React's built-in escaping. If you must use `dangerouslySetInnerHTML`, sanitize with the patterns from `ARCH_CONTRACT_SECURITY.md`.

#### Your Design Language

| Element | Style |
|---------|-------|
| Typography | Georgia serif (scroll text), Space Grotesk (UI), JetBrains Mono (code/data) |
| Colors | School-driven CSS variables. Parchment/leather/gold aesthetic for Read page. |
| Effects | Aurora background, vignette, scanlines, glass morphism. Subtle, not overwhelming. |
| Motion | Ease-in-out, 200-400ms. No jarring transitions. Framer Motion spring physics where appropriate. |

---

### 5.2 Gemini + OpenAI Codex — Game Mechanics / General Code

**You own the brain.** CODEx, the backend, game logic, data models, and all business rules are your responsibility.

#### Your Files

```
codex/                               — The CODEx brain (to be created)
├── core/                            — Pure domain logic
│   ├── schemas/                     — Scroll, CombatAction, CombatResult, XPEvent, ScoreTrace
│   ├── heuristics/                  — Individual scoring heuristics (one file each)
│   ├── combat.engine.js             — Combat resolution pipeline
│   ├── scoring.engine.js            — Score aggregation + trace generation
│   └── tokenizer.js                 — Text → tokens → phonemes pipeline
├── services/                        — Adapters for external data
│   ├── adapters/
│   │   ├── dictionary.adapter.js    — WordNet/GCIDE/API adapter
│   │   ├── persistence.adapter.js   — LocalStorage/IndexedDB/Server adapter
│   │   └── transport.adapter.js     — HTTP/WebSocket transport
│   └── index.js                     — Adapter registry
├── runtime/                         — Orchestration layer
│   ├── pipeline.js                  — Event → pipeline routing
│   ├── cache.js                     — Caching policy (TTL, LRU)
│   ├── rateLimit.js                 — Client-side rate limiting
│   └── eventBus.js                  — Structured event emission
└── server/                          — Authority layer (Fastify)
    ├── routes/                      — Auth, scrolls, progression, combat
    ├── middleware/                   — Auth, validation, rate limiting
    ├── models/                      — Postgres models
    ├── migrations/                  — Schema migrations
    └── index.js                     — Server entry

src/lib/                             — Existing engines (migrate into codex/core)
├── phoneme.engine.js                — Word phoneme analysis
├── cmu.phoneme.engine.js            — CMUdict wrapper
├── reference.engine.js              — API integration (migrate to adapters)
├── progressionUtils.js              — XP math
└── scholomanceDictionary.api.js     — SQLite dict client (migrate to adapters)

src/hooks/                           — React state (shared ownership with Claude for UI hooks)
├── useProgression.jsx               — XP & school unlock state
├── useScrolls.jsx                   — Scroll CRUD
├── useCurrentSong.jsx               — Track selection
├── usePhonemeEngine.jsx             — Engine initialization
├── useAmbientPlayer.jsx             — Audio (Claude's domain)
├── useAtmosphere.js                 — Theme sync (Claude's domain)
└── usePrefersReducedMotion.js       — a11y (Claude's domain)

src/data/                            — Static data
├── schools.js                       — School definitions
├── library.js                       — Track metadata
├── progression_constants.js         — XP config
└── vowelPalette.js                  — Vowel → color map

scripts/
├── build_scholomance_dict.py        — Dictionary DB builder
└── serve_scholomance_dict.py        — Dict HTTP API
```

#### Your Responsibilities

1. **CODEx Core** — All scoring heuristics, combat resolution, phoneme analysis. Pure functions. No side effects. Every function takes input, returns output, and includes a trace of its reasoning.

2. **CODEx Services** — Build and maintain adapters. Start with `DictionaryAdapter` wrapping WordNet (already have OEWN data in `scholomance_dict.sqlite`). Add GCIDE adapter when coverage gaps emerge. Each adapter normalizes to the `LexicalEntry` schema.

3. **CODEx Runtime** — Pipeline orchestration. When the UI sends "analyze this word," Runtime routes through cache check → adapter lookup → Core analysis → event emission. Rate limiting and dedupe live here.

4. **CODEx Server** — Fastify backend. Auth (JWT + httpOnly refresh). Scroll CRUD. XP tracking. Combat resolution (re-score server-side). All mutations are server-authoritative.

5. **Migration plan** — Move existing `src/lib/phoneme.engine.js`, `reference.engine.js`, `progressionUtils.js` into CODEx layers incrementally. Don't break imports — use re-exports during transition.

6. **Schema governance** — You define all data schemas. When a schema changes, update the TypeScript definitions in `src/types/`, notify Claude for UI updates, and notify Minimax for test updates.

#### Your Constraints

- Core layer: zero imports from Runtime, Server, or `src/`. Enforce via ESLint `no-restricted-imports`.
- Services layer: may import Core schemas. May NOT import Runtime or Server.
- Runtime layer: may import Core and Services. May NOT import Server or `src/`.
- Server layer: may import all CODEx layers. May NOT import `src/`.
- All scoring must be deterministic. Same input → same output. Randomness only via seeded PRNG if ever needed.
- Never touch CSS, JSX layout, or visual components.

#### Combat Heuristic Development Process

```
1. Define heuristic as pure function in codex/core/heuristics/
2. Write unit tests (or request Minimax to write them)
3. Return { rawScore: number, explanation: string }
4. Register in scoring.engine.js with a weight
5. Full pipeline test: input bar → all heuristics → aggregated CombatResult
6. Anti-exploit test: repeated words, nonsense, max-length payloads
```

---

### 5.3 Minimax V2.1 (Blackbox AI) — Testing / QA / Debugging

**You are the gatekeeper.** Nothing ships without your approval. You write tests, run them, and report.

#### Your Files

```
tests/
├── setup.js                         — Vitest/Jest-DOM setup
├── lib/
│   ├── phoneme.engine.test.js       — Phoneme analysis unit tests
│   └── (new) combat.engine.test.js  — Combat scoring tests
│   └── (new) dictionary.adapter.test.js
├── hooks/
│   ├── useProgression.test.jsx      — Progression XP tests
│   └── (new) useScrolls.test.jsx
├── components/
│   └── (new) AnnotationPanel.test.jsx
├── integration/
│   └── (new) combat-pipeline.test.js — End-to-end combat scoring
├── security/
│   └── (new) xss-vectors.test.js    — XSS attack prevention
│   └── (new) input-validation.test.js
├── accessibility.test.jsx           — a11y baseline
├── visual/
│   ├── current/                     — Baseline screenshots
│   └── diff/                        — Diff results
├── exploit/
│   └── (new) combat-abuse.test.js   — Anti-cheat tests
│       — repeated words, nonsense spam, giant payloads, rapid-fire submissions

playwright/                          — E2E tests (if Playwright configured)

CI config (to be created):
├── .github/workflows/test.yml       — Run tests on every PR
└── .github/workflows/audit.yml      — Dependency audit weekly
```

#### Your Responsibilities

1. **Unit tests for Core** — Every scoring heuristic in `codex/core/heuristics/` gets a test file. Test determinism (same input → same output), edge cases (empty input, single word, max length), and expected scores for known inputs.

2. **Integration tests** — Full combat pipeline: input text → tokenize → all heuristics → aggregate → CombatResult. Verify trace completeness.

3. **Anti-exploit tests** — Dedicated test suite for abuse scenarios:
   - Repeated word spam: "fire fire fire fire fire" should score near-zero for novelty
   - Nonsense phoneme spam: "xyzzy qwfp" should score 0 for all heuristics except meter
   - Giant payloads: 500+ character inputs should be rejected
   - Rapid-fire: simulate > 1 action per 3 seconds, verify rate limit kicks in

4. **Security tests** — XSS vector testing per `ARCH_CONTRACT_SECURITY.md`. Input validation boundary tests. CSP violation detection.

5. **Visual regression** — Maintain baseline PNGs in `tests/visual/current/`. When Claude makes UI changes, generate new screenshots and diff. Flag regressions.

6. **Accessibility audits** — Run jest-axe on all page layouts. Verify ARIA labels. Test keyboard navigation paths.

7. **CI pipeline** — Configure GitHub Actions (or equivalent) to:
   - Run `npm test` on every PR
   - Block merge if coverage drops below threshold
   - Run `npm audit` weekly
   - Run visual regression on UI PRs

8. **Debugging support** — When a bug is reported, write a failing test that reproduces it FIRST, then hand off to the owning agent (Claude for visual, Gemini/Codex for logic) to fix. The test becomes the regression guard.

#### Your Constraints

- You write tests and CI config. You do NOT fix production code (hand off to the owning agent).
- You may read any file in the codebase. You write only to `tests/`, CI config, and debugging reports.
- You report test results in a structured format:

```
## Test Report — [Date]

### Summary
- Total: 47 | Pass: 44 | Fail: 3 | Skip: 0
- Coverage: 78% (target: 80%)

### Failures
1. `tests/lib/combat.engine.test.js` — "alliteration heuristic"
   - Expected: 0.65, Got: 0.72
   - Root cause: weight miscalculation in consonance chain
   - Owner: Gemini/Codex

2. `tests/visual/diff/read-page.png` — pixel diff > 2%
   - Suspected cause: font-size change in ReadPage.css
   - Owner: Claude
```

#### Test Naming Convention

```
describe('[Layer] [Module]', () => {
  describe('[Method/Behavior]', () => {
    it('[does X] when [condition Y]', () => { ... });
  });
});

// Example:
describe('[Core] CombatEngine', () => {
  describe('resolve()', () => {
    it('returns zero damage when input is empty', () => { ... });
    it('includes trace for every registered heuristic', () => { ... });
    it('caps novelty at 0 for words repeated 3+ times', () => { ... });
  });
});
```

---

## 6. Architecture Contracts

These contracts are stable across all agents. Breaking a contract requires discussion with all three agents.

### Contract 1: Semantic Surfaces

Components expose semantic props. Hooks provide data-role interface. No implementation details leak through props.

```javascript
// GOOD
<ScrollEditor isEditable={true} isTruesight={true} analyzedWords={words} onWordClick={fn} />

// BAD
<ScrollEditor internalRef={ref} _debugState={state} rawTextareaProps={...} />
```

### Contract 2: State is Hook-Driven

All UI state lives in React hooks/context. No class-based state (except CODEx engine classes which are non-UI). No global mutable variables in UI layer.

### Contract 3: Pure Analysis

All scoring, phoneme, and combat logic is pure-functional. These functions:
- Take typed input, return typed output
- Have zero side effects
- Never import from `src/` (UI layer)
- Always include explanation traces in output

### Contract 4: Security Boundaries

Per `ARCH_CONTRACT_SECURITY.md`:
- Allow-list validation for all user inputs
- Context-appropriate output escaping (HTML, attribute, CSS, URL)
- No `eval()`, `new Function()`, or `dangerouslySetInnerHTML` without sanitization
- Auth tokens in httpOnly cookies only, never localStorage
- CSP headers on all responses

### Contract 5: Adapter Pattern

All external data sources (dictionary, persistence, transport) are behind adapter interfaces. Consumers call the adapter, never the source directly. This allows:
- Swapping WordNet for GCIDE without touching consumers
- Swapping localStorage for IndexedDB for server without touching UI
- Testing with mock adapters

### Contract 6: File Ownership

| Path | Owner | Others May |
|------|-------|------------|
| `src/pages/`, `src/components/`, `*.css` | Claude | Read only |
| `codex/`, `server/`, `src/lib/`, `src/hooks/` (logic hooks), `src/data/` | Gemini/Codex | Read only |
| `tests/`, CI config | Minimax | — |
| `src/hooks/` (UI hooks: atmosphere, ambientPlayer, reducedMotion) | Claude | Read only |
| Architecture docs (`ARCH_*.md`, this file) | All (consensus) | — |
| `scripts/` | Gemini/Codex | Read only |

---

## 7. QA & Anti-Regression

### Coverage Targets

| Area | Target | Tool |
|------|--------|------|
| `codex/core/` | 95% line coverage | Vitest |
| `codex/services/` | 80% line coverage | Vitest |
| `src/hooks/` (logic) | 80% line coverage | Vitest + RTL |
| `src/pages/` | 60% line coverage (UI is harder to unit test) | Vitest + RTL |
| Accessibility | 100% of pages pass jest-axe | jest-axe |
| Visual | All baseline PNGs match within 1% pixel diff | Playwright screenshots |

### Security QA

| Check | Frequency | Tool |
|-------|-----------|------|
| `npm audit` | Every PR + weekly | npm |
| XSS vector tests | Every PR | Vitest |
| CSP violation monitoring | Runtime | Browser + CSP reporter |
| Input boundary tests | Every PR | Vitest |
| Auth token handling | Every auth change | Manual + integration test |

### Combat Balance QA

| Test | What It Catches |
|------|-----------------|
| Determinism test | Run same input 100x, verify identical output |
| Exploit battery | Repeated words, nonsense, max payload, rapid fire |
| Score distribution | Run 1000 real-world bars, verify bell curve (not bimodal) |
| Trace completeness | Every CombatResult has traces for all registered heuristics |
| Weight sanity | All heuristic weights sum to 1.0 |

---

## 8. Risk Mitigations

Every weakness identified in the original plan has a concrete mitigation.

### Risk 1: Monolith Creep (CODEx Absorbs Everything)

**Original weakness**: CODEx could become a god-object.

**Mitigation**:
- Four strict layers with enforced import boundaries (ESLint `no-restricted-imports`)
- "If you're adding X, it goes in Y" table (Section 2.4)
- Quarterly audit: any `codex/core/` file > 300 lines gets reviewed for extraction
- UI logic never enters CODEx. CODEx never touches DOM.

### Risk 2: Dictionary Scale (Wiktionary Is Overkill)

**Original weakness**: Starting with Wiktionary's 2.25GB dataset is premature.

**Mitigation**:
- Start with WordNet (OEWN). Already have the data. Small, structured, sufficient for synonyms + semantic links.
- Add GCIDE only when specific coverage gaps are proven (tracked in a `dictionary-gaps.md` file).
- Wiktionary stays as a build artifact (`scholomance_dict.sqlite`) but is NOT the default adapter source.
- Adapter pattern means swapping sources requires zero consumer changes.

### Risk 3: Combat Fairness (Trivial Exploits)

**Original weakness**: Scoring needs guardrails.

**Mitigation**:
- Novelty penalty: repeated words score 0 after 2nd use in same scroll.
- Nonsense detection: words not in dictionary get 0 for all heuristics except meter.
- Payload limits: 500 chars max per combat action (server-enforced).
- Rate limits: 1 action per 3 seconds per player (server-enforced).
- Server re-scores everything. Client preview is decorative.
- Anti-exploit test suite run on every PR (Minimax's responsibility).

### Risk 4: Offline Sync Complexity

**Original weakness**: Full offline-first with CRDT is a time sink.

**Mitigation**:
- **Decision: Web is source of truth.** No CRDT. No conflict resolution algorithm.
- Offline writes queue in IndexedDB.
- On reconnect: batch POST to server. Server applies with last-write-wins.
- Server timestamps are authoritative.
- Deleted items: tombstone for 30 days, then purge.
- Quota monitoring: warn at 80% IndexedDB usage. Block writes at full. Never silently drop data.

### Risk 5: Multi-Agent Coordination Overhead

**Original weakness**: (New risk) Three AI agents could step on each other.

**Mitigation**:
- Clear file ownership table (Section 6, Contract 6).
- Handoff protocol with structured reports.
- Minimax as gatekeeper: no merge without passing tests.
- Schema changes require notification to all agents.
- Architecture docs require consensus to modify.

---

## Appendix A: Current State Inventory

For AI agents joining the project, here is what exists today:

| Component | Status | Location |
|-----------|--------|----------|
| React SPA (Watch/Listen/Read) | Working | `src/` |
| Phoneme analysis (CMUdict) | Working | `src/lib/phoneme.engine.js` |
| Reference engine (Datamuse, MW, Free Dict) | Working | `src/lib/reference.engine.js` |
| Progression system (XP, school unlocks) | Working | `src/hooks/useProgression.jsx` |
| Scroll editor (textarea overlay) | Working | `src/pages/Read/ScrollEditor.jsx` |
| School theming (CSS variables) | Working | `src/lib/css/generated/school-styles.css` |
| SQLite dictionary (Wiktionary + OEWN) | Built, 2.25GB | `scholomance_dict.sqlite` |
| Python dict server | Working | `scripts/serve_scholomance_dict.py` |
| Unit tests (phoneme, progression, a11y) | Partial | `tests/` |
| Visual regression baselines | Partial | `tests/visual/` |
| CODEx architecture | **Not yet built** | Planned at `codex/` |
| Backend server | **Not yet built** | Planned at `codex/server/` |
| Combat system | **Not yet built** | Planned at `codex/core/` |
| CI pipeline | **Not yet configured** | Planned |

## Appendix B: Quick Commands

```bash
# Development
npm install                              # Install dependencies
npm run dev                              # Start dev server (localhost:5173)
npm run build                            # Production build to dist/
npm run test                             # Run Vitest
npm run lint                             # ESLint (max-warnings=0)
npm run preview                          # Preview built app
node scripts/generate-school-styles.js   # Regenerate school CSS

# Optional dictionary server
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787

# Future (once backend exists)
npm run server:dev                       # Start Fastify dev server
npm run server:migrate                   # Run Postgres migrations
npm run test:combat                      # Run combat-specific test suite
npm run test:exploit                     # Run anti-exploit battery
```

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Bar** | A line of verse submitted as a combat action |
| **Scroll** | A user-created document (poem, verse, freestyle) |
| **Truesight** | Analysis mode where words are color-coded by vowel family |
| **Vowel Family** | Phoneme classification group (AY, IY, OW, etc.) |
| **Rhyme Key** | `{vowelFamily}-{coda}` — determines what words rhyme |
| **Coda** | Consonant cluster at end of a syllable |
| **School** | Thematic magic school (SONIC, PSYCHIC, VOID, ALCHEMY, WILL) |
| **CODEx** | The domain engine — schemas, scoring, pipelines, policy |
| **Score Trace** | Per-heuristic breakdown explaining a combat score |
| **Tombstone** | Deleted record marker kept for 30 days for sync consistency |

---

*This document is the single source of architectural truth for Scholomance V10. All agents reference it. Changes require consensus from all three agents.*
