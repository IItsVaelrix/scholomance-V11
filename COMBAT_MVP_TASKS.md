# COMBAT_MVP_TASKS.md
## Scholomance V11 — Combat Page: Team Task Board

**Read first:** `SHARED_PREAMBLE.md` → `VAELRIX_LAW.md` → `SCHEMA_CONTRACT.md` → this file.

**Status:** Combat page scaffolded. Route `/combat` live. Phaser scene operational.
**School:** SONIC THAUMATURGY (MVP scope — one school only)
**Install required:** `npm install phaser` before running.

---

## Current State (Actual)

```
src/pages/Combat/
├── combatBridge.js              DONE — pub/sub event bus (React ↔ Phaser)
├── CombatPage.jsx               DONE — page shell, Phaser host, overlay management
├── CombatPage.css               DONE — full grimoire styling (Dynamic School Intensity LIVE)
├── hooks/useCombatEngine.js     DONE — state machine, turn loop, log, server scoring
├── scenes/BattleScene.js        DONE — Phaser scene, sprites, animations, signature move VFX
└── components/
    ├── Spellbook.jsx            DONE — text input, Truesight overlay, affinity shimmer
    ├── ScoreReveal.jsx          DONE — heuristic cascade reveal, damage total
    └── BattleLog.jsx            DONE — scrolling combat chronicle
```

**Completed Milestones:**
- [x] **C-1 — Spellbook: Wire Real Vowel Summary to Affinity Shimmer** (Gemini)
- [x] **C-2 — Spellbook: Full Truesight Overlay (Phase 2)** (Gemini/Claude)
- [x] **CO-1 — Replace Opponent Stub with Procedural Engine** (Codex)
- [x] **CO-5 — Server-Side Score Validation** (Codex)
- [x] **CO-3 — MP Regeneration Logic** (Codex)
- [x] **G-1 — Spec: Procedural Opponent Engine** (Gemini)

---

---

# 🎨 GEMINI — UI & Mechanic Tasks

**Jurisdiction:** Full authority over `src/` and World-law definitions.
**Focus:** Visual juice, feel, and mechanical depth.

---

## G-5 — BattleScene: Environment Reactivity (Phase 2)
**Priority:** MEDIUM | **Blocks:** nothing
**What to do:**
The background sigil and aurora shimmer should react to the player's current spell resonance.
- When `scoreData.totalScore` > 80, the sigil should spin faster and glow brighter.
- The aurora alpha should be driven by the current `sonicAffinity`.

---

## G-6 — BattleScene: Opponent Sprite Varaiants (Phase 2)
**Priority:** LOW | **Blocks:** nothing
**What to do:**
Adjust the opponent sprite color/glyphs based on their school (VOID/PSYCHIC/etc.) rather than just the default VOID look.

---

## G-7 — Spellbook: Syntactic Integrity "Bridge Beam"
**Priority:** MEDIUM | **Blocks:** nothing
**What to do:**
Improve the bridge beam visual when integrity is GREEN. Add a particle effect in Phaser that fires from the player sprite to the center sigil when a GREEN spell is cast.

---

---

# ⚙️ GEMINI — Mechanic Specs

---

## G-8 — Spec: Status Effect System
**Priority:** HIGH | **Blocks:** Codex CO-8
**Define:**
- **Silenced:** Player cannot cast for 1 turn.
- **Resonant:** Player damage increased by 20% for 2 turns.
- **Corrupted:** Player takes 5 damage per turn for 3 turns.

---

---

# 🔧 CODEX — Remaining Tasks

---

## CO-4 — Combat XP Award on Victory (Integration)
**Priority:** MEDIUM | **Blocks:** progression integration | **Depends on:** G-3 spec
**Status:** `useCombatEngine` has the logic, but ensure it's persisting correctly to `useProgression`.

---

## CO-8 — Status Effect Implementation
**Priority:** HIGH | **Blocks:** G-8 spec
**What to build:**
Implement the state handling for status effects in `combat.session.js` and expose them to `useCombatEngine`.

---

---

# 🔮 BLACKBOX — Test Tasks

**Jurisdiction:** `tests/` — write tests and regression baselines.

---

## B-1 through B-7
**Status:** PENDING. These need to be run and validated against the new advanced engine.

---

## Merge Gate

The combat page is blocked from merge until all of the following pass:

| Check | Owner | Status |
|-------|-------|--------|
| jest-axe: 0 violations | Blackbox | PENDING |
| State machine tests pass | Blackbox | PENDING |
| Bridge tests pass | Blackbox | PENDING |
| Spellbook tests pass | Blackbox | PENDING |
| Anti-exploit battery | Blackbox | PENDING |
| Coverage: combat hooks ≥ 80% | Blackbox | PENDING |

---

*Document maintained by Gemini. Update task statuses as work completes.*
*Version: 1.1 — 2026-03-30*
