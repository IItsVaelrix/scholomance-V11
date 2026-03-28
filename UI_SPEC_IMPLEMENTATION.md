---
version: "1.1"
appliesTo: "HEAD"
status: "current-state"
lastUpdated: "2026-03-24"
---

# Scholomance V11 — UI Implementation Notes

> **Tier 2: Implementation State** — current file locations, line counts, known deviations, and tracked bugs.
>
> This document is a snapshot. For binding rules, see `UI_SPEC.md`.

---

## 1. File Locations & Line Counts

> As of 2026-03-24. Line counts will drift — verify with `wc -l` when precision matters.

### Pages

| Route | Component | File | Lines |
|---|---|---|---|
| `/` | WatchPage | `src/pages/Watch/WatchPage.jsx` | — |
| `/read` | ReadPage | `src/pages/Read/ReadPage.jsx` | ~1641 |
| `/combat` | CombatPage | `src/pages/Combat/CombatPage.jsx` | ~473 |
| `/nexus` | NexusPage | `src/pages/Nexus/NexusPage.jsx` | — |
| `/listen` | ListenPage | `src/pages/Listen/ListenPage.tsx` | — |
| `/profile` | ProfilePage | `src/pages/Profile/ProfilePage.jsx` | — |
| `/collab` | CollabPage | `src/pages/Collab/CollabPage.jsx` | — |
| `/auth` | AuthPage | `src/pages/Auth/AuthPage.jsx` | — |

### Read IDE Components

| Component | File | Lines |
|---|---|---|
| ScrollEditor | `src/pages/Read/ScrollEditor.jsx` | ~1188 |
| IDEChrome | `src/pages/Read/IDEChrome.jsx` | — |
| TruesightControls | `src/pages/Read/TruesightControls.jsx` | — |
| ScrollList | `src/pages/Read/ScrollList.jsx` | — |
| AnalysisPanel | `src/pages/Read/AnalysisPanel.jsx` | — |
| SearchPanel | `src/pages/Read/SearchPanel.jsx` | — |
| Minimap | `src/pages/Read/Minimap.jsx` | — |
| Gutter | `src/pages/Read/Gutter.jsx` | — |
| ToolsSidebar | `src/pages/Read/ToolsSidebar.jsx` | — |

### Combat Components

| Component | File |
|---|---|
| Spellbook | `src/pages/Combat/components/Spellbook.jsx` |
| ScoreReveal | `src/pages/Combat/components/ScoreReveal.jsx` |
| BattleLog | `src/pages/Combat/components/BattleLog.jsx` |
| OpponentDoctrinePanel | `src/pages/Combat/components/OpponentDoctrinePanel.jsx` |
| SpellCastEffect | `src/pages/Combat/components/SpellCastEffect.jsx` |
| BattleScene (Phaser) | `src/pages/Combat/scenes/BattleScene.js` |
| combatBridge | `src/pages/Combat/combatBridge.js` |
| useCombatEngine | `src/pages/Combat/hooks/useCombatEngine.js` |

### Shared Components

| Component | File | Lines |
|---|---|---|
| Navigation | `src/components/Navigation/Navigation.jsx` | ~222 |
| WordTooltip | `src/components/WordTooltip.jsx` | ~824 |
| HeuristicScorePanel | `src/components/HeuristicScorePanel.jsx` | — |
| VowelFamilyPanel | `src/components/VowelFamilyPanel.jsx` | — |
| RhymeDiagramPanel | `src/components/RhymeDiagramPanel.jsx` | — |
| RhymeSchemePanel | `src/components/RhymeSchemePanel.jsx` | — |
| InfoBeamPanel | `src/components/InfoBeamPanel.jsx` | — |
| IntelliSense | `src/components/IntelliSense.jsx` | — |
| AtmosphereSync | `src/components/AtmosphereSync.jsx` | — |
| FloatingPanel | `src/components/shared/FloatingPanel.jsx` | — |
| ErrorBoundary | `src/components/shared/ErrorBoundary.jsx` | — |
| RouteErrorPage | `src/components/shared/RouteErrorPage.jsx` | — |

### Stylesheets

| File | Scope |
|---|---|
| `src/index.css` | Global tokens, base styles, mobile patterns |
| `src/pages/Read/IDE.css` | IDE-specific layout and components |
| `src/pages/Combat/CombatPage.css` | Combat arena styles |
| `src/pages/Combat/components/SpellCastEffect.css` | Cast animation |
| `src/pages/Listen/ListenPage.css` | Listen page |
| `src/components/WordTooltip.css` | Grimoire card styles |
| `src/components/HeuristicScorePanel.css` | Score panel |
| `src/components/shared/FloatingPanel.css` | Floating panel |
| `src/components/shared/ErrorBoundary.css` | Error boundary fallback UI |
| `src/lib/css/generated/school-styles.css` | Generated school theme variables |

### UI Hooks (owned by UI agent)

| Hook | File | Note |
|---|---|---|
| useAtmosphere | `src/hooks/useAtmosphere.js` | Aurora/ambient control |
| useAmbientPlayer | `src/hooks/useAmbientPlayer.ts` | Audio player (TypeScript) |
| usePrefersReducedMotion | `src/hooks/usePrefersReducedMotion.js` | A11y motion preference |

---

## 2. Known Deviations from Canonical Spec

### 2.1 Z-Index Bugs (fixed 2026-03-24)

| Bug | Was | Fixed To | File |
|---|---|---|---|
| WordTooltip collided with scanlines | `zIndex: 1000` (inline) | `zIndex: 1300` | `src/components/WordTooltip.jsx:708` |
| FloatingPanel used `!important` on z-index | `z-index: 2000 !important` | `z-index: 2000` | `src/components/shared/FloatingPanel.css:19` |
| IntelliSense at 9999 | `zIndex: 9999` | KEPT — correct per Layer 6 | `src/components/IntelliSense.jsx:96` |

### 2.2 Implemented (2026-03-24)

| Item | Spec Section | Implementation |
|---|---|---|
| Mobile combat portrait layout | UI_SPEC §7 | `CombatPage.css` — 45vh canvas, 48px status, 56px action bar + safe-area |
| Landscape combat handling | UI_SPEC §7 | `CombatPage.css` — canvas collapses to 30vh in landscape orientation |
| BattleLog empty state | UI_SPEC §6.4 | `BattleLog.jsx` — `♫` glyph + "The chronicle awaits your first verse..." |
| Phaser text-only fallback | UI_SPEC §6.3 | `CombatPage.jsx` + `CombatPage.css` — visual col collapses, terminal fills, hidden on mobile |
| ErrorBoundary thematic surface | UI_SPEC §6.1 | `ErrorBoundary.jsx` + `ErrorBoundary.css` — replaced inline styles with CSS classes, thematic language |
| Spellbook mobile bottom sheet | UI_SPEC §7 | `CombatPage.css` — fixed bottom sheet at z:1400 on ≤640px |
| ScoreReveal mobile bottom sheet | UI_SPEC §7 | `CombatPage.css` — fixed bottom sheet at z:1400 on ≤640px |

### 2.3 Remaining Gaps (blocked on Codex)

| Gap | Spec Section | Status | Blocker |
|---|---|---|---|
| Flow D: School Unlock Ceremony | UI_SPEC §4 Flow D | Blocked | `school:unlocked` event not yet emitted by engine |
| `scroll:saved` event | UI_SPEC §5.1 PLANNED | Blocked | Scroll save uses direct hook, not event bus |
| `combat:resolved` event | UI_SPEC §5.2 PLANNED | Blocked | Combat end uses state machine, not event |
| `xp:awarded` event | UI_SPEC §5.2 PLANNED | Blocked | Not yet implemented by engine |

### 2.4 Existing Error Handling

| Component | Pattern | Notes |
|---|---|---|
| ErrorBoundary | Class-based catch boundary with CSS classes | Thematic language, dev-only stack trace, `role="alert"` |
| RouteErrorPage | Route-level error handler | Smart detection for deployment updates, 404s |
| AuthPage | `loading` state with "Processing..." | Minimal error surface |
| Combat loading | `♩` glyph shimmer with `aria-live` | Matches spec |
| Combat Phaser fallback | Text-only mode with collapsed visual column | Thematic language, full terminal functionality preserved |

### 2.4 Existing Empty States

| Surface | Implementation | Spec Compliant? |
|---|---|---|
| ScrollList | `.scroll-empty` with sparkle glyph | Yes |
| AnalysisPanel | `.analyze-empty` with star glyph | Yes |
| SearchPanel | "No matches found." / "Type at least 2 characters" | Yes |
| Combat loading | `♩` glyph, `role="status"`, `aria-live="polite"` | Yes |
| NexusPanel | "Select a word to view its resonance" | Yes |
| Collab pages | "No activity yet." / "No pipelines running." / "No agents registered." | Yes |
| BattleLog | `.battle-log-empty` with `♫` glyph + "The chronicle awaits your first verse..." | Yes (added 2026-03-24) |

---

## 3. CSS Architecture Notes

### Global Tokens (`src/index.css`)

```css
:root {
  --font-sans: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-display: 'Cinzel', 'Palatino Linotype', Georgia, serif;
  --text-xs: clamp(0.6875rem, 0.75vw, 0.75rem);
  --text-xl: clamp(1.5rem, 2vw, 2rem);
  --space-4: 1rem;
  --bg-void: #090916;
  --text-primary: #ede8d4;
  --border-glow: rgba(201, 168, 64, 0.40);
}
```

### School Style Generation

Generated by `scripts/generate-school-styles.js` → output at `src/lib/css/generated/school-styles.css`.

Variables per school:
```css
:root {
  --school-sonic: #651fff;
  --school-sonic-glow: rgba(101, 31, 255, 0.4);
  /* ... per school ... */
}
```

### Scroll Save Architecture

- Storage abstraction: `src/lib/platform/storage`
- Current format: v2 split-key localStorage (`scholomance.scrolls.v2.index` + per-item keys)
- Server sync: fetches from `/api/scrolls` when authenticated, merges by recency
- Validated with Zod (`ScrollSchema`, `ScrollListSchema`, `ScrollIndexSchema`)

---

## 4. Agent Ownership

| Agent | Domain | Writes To |
|---|---|---|
| **Claude (UI)** | Visuals, UI, debugging, a11y | `src/pages/`, `src/components/`, `*.css` |
| **Gemini** | Game mechanics, balance, world-law specs | Mechanic specs and canonical rule definitions |
| **Codex** | CODEx engine, backend, schemas, data | `codex/`, `codex/server/`, `src/lib/`, `src/hooks/` (logic), `src/data/`, `scripts/` |
| **Minimax** | Testing, QA, CI | `tests/`, CI config |

---

## 5. Schema Contract Reference

Current version: **1.8** (see `SCHEMA_CONTRACT.md`)

Key shapes consumed by UI:
- `CombatScoreResponse` — primary combat result
- `ScoreTrace[]` — heuristic breakdown
- `CombatSpeakingAnalysis` — speech acts, prosody, affect, harmony, severity
- `LexicalEntry` — word lookups
- `InspectableEntity` — world entity inspection
- `TokenGraphNode` / `TokenGraphEdge` — phonosemantic graph (v1.8)
- `VoiceProfileSnapshot` — speaker profile

Implemented endpoints:
- `POST /api/combat/score`
- `GET /api/world/rooms/:roomId`
- `GET /api/world/entities/:entityId`
- `POST /api/world/entities/:entityId/actions/inspect`

---

## 6. Visual Regression Baselines

Location: `tests/visual/`

Components requiring baselines:
- ScrollEditor (Truesight ON/OFF)
- WordTooltip (all rarity variants)
- CombatPage (all combat states)
- Navigation (desktop/mobile)
- ProfilePage (school attunement)
