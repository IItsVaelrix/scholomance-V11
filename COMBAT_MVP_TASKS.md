# COMBAT_MVP_TASKS.md
## Scholomance V11 — Combat Page: Team Task Board

**Read first:** `SHARED_PREAMBLE.md` → `VAELRIX_LAW.md` → `SCHEMA_CONTRACT.md` → this file.

**Status:** Combat page scaffolded. Route `/combat` live. Phaser scene operational.
**School:** SONIC THAUMATURGY (MVP scope — one school only)
**Install required:** `npm install phaser` before running.

---

## Current State (What Claude Built)

```
src/pages/Combat/
├── combatBridge.js              DONE — pub/sub event bus (React ↔ Phaser)
├── CombatPage.jsx               DONE — page shell, Phaser host, overlay management
├── CombatPage.css               DONE — full grimoire styling
├── hooks/useCombatEngine.js     DONE (stubbed) — state machine, turn loop, log
├── scenes/BattleScene.js        DONE — Phaser scene, sprites, animations, HP bars
└── components/
    ├── Spellbook.jsx            DONE — text input, power meter, MP cost
    ├── ScoreReveal.jsx          DONE — heuristic cascade reveal, damage total
    └── BattleLog.jsx            DONE — scrolling combat chronicle
```

**Live stubs that need Codex to fill:**
- `generateOpponentSpell()` in `useCombatEngine.js:55` — returns random phrase + random damage
- `scoreDataToDamage()` in `useCombatEngine.js:84` — raw formula, no school multiplier
- `estimateSonicAffinity()` in `Spellbook.jsx:31` — regex hack, not real phoneme signal
- Server-side score validation — client score is currently treated as authoritative (violates Vaelrix Law §4)

---

## Dependency Graph

```
Gemini specs mechanics
    ↓
Codex implements (backend + hooks + worklet)
    ↓
Claude wires UI signal to real data
    ↓
Blackbox writes tests and regression baselines
```

Some Claude Phase 2/3 work can start in parallel with Codex — see individual sections.

---

---

# 🎨 CLAUDE — UI Tasks

**Jurisdiction:** `src/pages/Combat/` components and CSS only.
**Consume hooks, never implement logic.**

---

## C-1 — Spellbook: Wire Real Vowel Summary to Affinity Shimmer
**Priority:** HIGH | **Blocks:** nothing | **Depends on:** nothing (can start now)
**State:** `estimateSonicAffinity()` is a regex hack. Replace with real vowel data.

**What to do:**
Import `usePanelAnalysis` vowel summary or an equivalent lightweight hook that
exposes `vowelSummary.families`. Derive SONIC affinity from families matching
`VOWEL_FAMILY_TO_SCHOOL` (`IH`, `AO`, `ER` → `SONIC`). Use that value to drive:
- `spellbook-affinity-shimmer` opacity
- The border glow on `.spellbook-editor-host:focus-within` (SONIC purple intensity)

**Constraint:** Do not call analysis APIs directly. Consume through an existing hook.
If no suitable hook exists, file an ESCALATION to Codex to expose the signal.

**QA checklist:**
- [ ] No logic imported from `codex/` or `src/lib/`
- [ ] School CSS variables consumed, not hardcoded
- [ ] Works when text is empty (no errors, shimmer at 0)

---

## C-2 — Spellbook: Full Truesight Overlay (Phase 2)
**Priority:** MEDIUM | **Blocks:** nothing | **Depends on:** C-1 validated in production

**What to do:**
Upgrade the Spellbook editor to use the full textarea-overlay pattern from the
Read page. The overlay div renders `analyzedWords` as school-colored spans (not
buttons — read-only in combat). This gives players visual phoneme feedback while
typing their spell.

**World-law connection:** Every word the player types should visually declare its
school affiliation. A SONIC-heavy spell should glow purple as it's written.

**Implementation notes:**
- The overlay typography must match the textarea exactly (CLAUDE.md § Textarea Overlay Sync)
- Scroll sync: `textarea.onScroll → overlay.scrollTop = textarea.scrollTop`
- `analyzedWords` source: the same hook that drives Truesight on the Read page
- Truesight is always ON in the Spellbook (no toggle needed — you are always in the arena)

**UI SPEC:**
- Component: `src/pages/Combat/components/Spellbook.jsx`
- World-law connection: Words reveal their phonemic school as you write the spell
- Data consumed: `analyzedWords` from whichever hook Codex exposes post-`usePhonemeEngine` stub fill
- State: overlay div synced to textarea scroll position
- Accessibility: overlay is `aria-hidden="true"`, textarea retains all ARIA
- School theming: colored spans use `--school-{id}-color` CSS variables
- Animation: word color fades in on appearance (200ms ease), respects reduced-motion
- Regression risk: textarea overlay sync is the sacred technique — test thoroughly

---

## C-3 — BattleScene: Opponent Intro Animation
**Priority:** MEDIUM | **Blocks:** nothing | **Depends on:** nothing

**What to do:**
When the opponent name arrives via `combat:init` bridge event, play an entrance
sequence in the Phaser scene:
- Opponent sprite slides in from left (currently appears static)
- Eyes ignite with a flash (camera flash cyan)
- Name renders letter by letter in the opponent info bar (typewriter effect)
- Opponent subtitle text appears briefly beneath name, fades

**World-law connection:** The Cryptonym does not appear. It manifests.

**Implementation:** All in `BattleScene.js`. No React involvement.

---

## C-4 — Victory/Defeat: Scoring Summary
**Priority:** MEDIUM | **Blocks:** nothing | **Depends on:** combat loop validated end-to-end

**What to do:**
The victory overlay currently shows Turns, HP Remaining, MP Remaining.
Add a **Verse Efficiency** score: total damage dealt divided by turns taken.
Add **Best Spell** — excerpt of the player's highest-scoring scroll this combat.
Both values come from `useCombatEngine` state — no new logic needed, just tracking
`lastPlayerDamage` across turns to find the max.

---

## C-5 — Accessibility Audit
**Priority:** HIGH | **Blocks:** merge | **Depends on:** combat loop stable

**What to do:**
Full `jest-axe` pass for all combat components. Specific items to verify:
- Spellbook dialog: `aria-modal`, focus trap while open, Escape closes it
- ScoreReveal dialog: same focus trap requirements
- Victory/Defeat overlay: `aria-live="assertive"` on result announcement
- Battle log: `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`
- Phaser canvas: `aria-label="Battle arena"` already set — verify it persists
- All buttons: visible focus ring, keyboard activation works

**QA checklist (all must pass):**
- [ ] jest-axe: 0 violations on CombatPage, Spellbook, ScoreReveal, BattleLog
- [ ] Keyboard: Tab navigates all interactive elements in logical order
- [ ] Escape closes Spellbook and ScoreReveal
- [ ] Ctrl+Enter casts from Spellbook (already implemented — verify)
- [ ] Reduced motion: all Framer Motion animations are no-ops

---

## C-6 — Responsive: Mobile Layout Polish
**Priority:** LOW | **Blocks:** nothing | **Depends on:** nothing

**What to do:**
On screens below 640px, the Phaser canvas becomes very small (800px scaled down).
The SNES aesthetic holds at small sizes but the bottom panel text becomes illegible.
Adjust `CombatPage.css` for sub-640 screens:
- Battle log collapses to a single-line last-message strip (not full panel)
- Spellbook panel reduces padding and font sizes
- Turn banner compresses to icon-only or collapses the opponent name

---

---

# ⚙️ GEMINI — Mechanic Specs

**Jurisdiction:** World-law definitions, balance values, mechanic intent.
**Deliver specs to Codex for implementation and to Claude if UI surfaces are needed.**

---

## G-1 — Spec: Procedural Opponent Engine
**Priority:** CRITICAL | **Blocks:** Codex CO-1

**What to specify:**
The current opponent (`generateOpponentSpell()` in `useCombatEngine.js:55`) is a
random phrase picker. This needs a real mechanic spec before Codex can implement it.

**Questions that need answers:**

1. **How does the opponent generate its verse?**
   - Seeded from the player's last scroll (counter-verse mechanic)?
   - Drawn from a school-specific phrase corpus (VOID language for void opponent)?
   - Fully generative (LLM-assisted, pre-generated pool, or deterministic from seed)?

2. **What is "High INT" mechanically?**
   - A damage multiplier? A stat that affects heuristic scores?
   - Does INT mean the opponent uses words with higher phoneme density?
   - Does INT scale per-combat (opponent gets harder each turn)?

3. **School affiliation of the opponent**
   - SONIC MVP opponent is what school — VOID? PSYCHIC? Does it counter-school?
   - Does school affiliation affect which heuristics the opponent "optimizes for"?

4. **Damage variance**
   - Current stub: 35–90 damage per turn at 82% INT efficiency.
   - Is this the right range? Should opponent damage be deterministic or seeded?

5. **Counter-spell visual text**
   - The opponent's spell text is displayed in the BattleScene message window.
   - Should it be gibberish/void-corrupted? English? Inverted phonemes?

**Deliver as:** `MECHANIC SPEC` block → Codex for implementation.

---

## G-2 — Spec: School Affinity Damage Multiplier
**Priority:** HIGH | **Blocks:** Codex CO-2

**What to specify:**
`scoreDataToDamage()` in `useCombatEngine.js:84` ignores school.
The world-law says SONIC words carry SONIC force. A SONIC-heavy scroll should
deal bonus damage in a SONIC rite.

**Questions that need answers:**

1. What is the multiplier formula?
   - Example: `damage × (1 + sonicDensity × 0.5)` — 50% bonus at 100% SONIC affinity
   - Or a flat bonus? A threshold bonus (only if > 60% SONIC)?

2. Is there a school penalty?
   - Does a VOID-heavy scroll deal less damage in a SONIC arena?
   - Does it deal VOID damage instead (different damage type for future resistances)?

3. School resistance (future-proofing)
   - Should the damage formula leave room for opponent school resistances?

**Deliver as:** `MECHANIC SPEC` block → Codex for CO-2.

---

## G-3 — Spec: Combat XP Award
**Priority:** MEDIUM | **Blocks:** Codex CO-4

**What to specify:**
No XP is awarded post-combat yet. Define:

1. XP formula — base award for victory? Bonus for efficiency?
2. Is XP awarded to the player's school or globally?
3. Should the opponent's difficulty (INT stat) scale the XP award?
4. Is there an XP penalty for fleeing?

**Deliver as:** `MECHANIC SPEC` block → Codex for CO-4.
Also notify Claude — the Victory overlay needs an XP display (task C-4 extension).

---

## G-4 — Spec: MP System Rules
**Priority:** MEDIUM | **Blocks:** Codex CO-3

**What to specify:**
Current MP: 100 max, 10 cost per cast. At 0 MP, player cannot cast.
Define the complete MP contract:

1. Does MP regenerate between turns? How much?
2. Is there a "drain" state (low MP = half-power casts)?
3. Does SONIC school have any MP interaction (e.g., resonant vowels restore MP)?
4. What happens at 0 MP — forced flee? Skip turn? Basic (0-score) cast?

---

---

# 🔧 CODEX — Implementation Tasks

**Jurisdiction:** `codex/`, `src/lib/`, `src/hooks/`, `src/worklets/`, `src/data/`.
**Do not touch:** `src/pages/Combat/` components (Claude's domain).

---

## CO-1 — Replace Opponent Stub with Procedural Engine
**Priority:** CRITICAL | **Blocks:** full combat loop | **Depends on:** G-1 spec

**Location of stub:** `src/pages/Combat/hooks/useCombatEngine.js:55`

```javascript
// CURRENT STUB — replace this entire function
function generateOpponentSpell() {
  const spell = OPPONENT_SPELLS[Math.floor(Math.random() * OPPONENT_SPELLS.length)];
  const baseDamage = 35 + Math.floor(Math.random() * 55 * OPPONENT_INT);
  return { spell, damage: baseDamage };
}
```

**What to build:**
A `codex/core/opponent.engine.js` (or equivalent layer) that accepts a seed +
player's last scroll + opponent archetype and returns:
```typescript
interface OpponentSpell {
  spell: string;        // The counter-verse text (displayed in BattleScene)
  damage: number;       // Calculated damage (server-authoritative)
  school: School;       // School of the counter-spell
  traces: ScoreTrace[]; // Optional — for future opponent score breakdown display
}
```

Expose via a hook or import that `useCombatEngine` can call without importing
from `codex/core/` directly (maintain the adapter pattern).

**Notify:** Claude when the interface is stable (bridge event shape may change).
**Schema:** If `OpponentSpell` is a new shared type, publish it to `SCHEMA_CONTRACT.md`.

---

## CO-2 — Wire School Affinity Multiplier into Damage Formula
**Priority:** HIGH | **Blocks:** correct scoring | **Depends on:** G-2 spec

**Location of stub:** `src/pages/Combat/hooks/useCombatEngine.js:84`

```javascript
// CURRENT STUB
export function scoreDataToDamage(scoreData) {
  if (!scoreData) return 5;
  const total = scoreData.totalScore ?? scoreData.score ?? 0;
  return Math.max(5, Math.round(total * 1.5 + 5));
}
```

**What to build:**
Replace with a function that:
1. Takes `scoreData` + `vowelSummary` (from `usePanelAnalysis` pipeline)
2. Derives SONIC density from `vowelSummary.families` + `VOWEL_FAMILY_TO_SCHOOL`
3. Applies the Gemini-specced multiplier
4. Returns `{ damage, sonicBonus, schoolDensity }` for display in ScoreReveal

**Expose the vowel summary signal:** Claude's Spellbook needs this for the affinity
shimmer (task C-1). Ensure the signal is accessible from within the Spellbook's
component context without calling `usePanelAnalysis` directly in a deeply nested
component.

---

## CO-3 — MP Regeneration Logic
**Priority:** MEDIUM | **Blocks:** balance | **Depends on:** G-4 spec

**Location:** `useCombatEngine.js` — the `continueAfterReveal` / `OPPONENT_TURN` transitions.

Current behavior: MP only decreases. No regeneration.
Implement per G-4 spec once delivered.

---

## CO-4 — Combat XP Award on Victory
**Priority:** MEDIUM | **Blocks:** progression integration | **Depends on:** G-3 spec

**What to build:**
When `combatState` transitions to `VICTORY`:
1. Calculate XP per G-3 spec
2. Emit `XP_AWARDED` event (reserved event name per `SCHEMA_CONTRACT.md`) — or
   use the current `XPEvent` shape until the runtime bus implements it
3. Integrate with `useProgression` hook so XP is persisted and the progression
   bar in the Read page reflects combat XP

**Notify Claude:** The Victory overlay needs a XP display once this is live.

---

## CO-5 — Server-Side Score Validation
**Priority:** HIGH | **Blocks:** merge per Vaelrix Law §4 | **Depends on:** nothing

**Vaelrix Law §4:** "Server is truth. Client previews decorative data. Server resolves,
scores, and persists. Never make a client authoritative."

**Current violation:** `scoreDataToDamage()` runs client-side and its output is
used directly as the authoritative damage value. This must be fixed before the
combat page ships to production.

**What to build:**
1. Server endpoint: `POST /api/combat/score` — accepts `{ scrollText, playerId }`
2. Server re-scores the scroll using the same heuristics as client-side `useScoring`
3. Returns authoritative `{ damage, traces, totalScore }`
4. `useCombatEngine.castPlayerSpell()` should send the text to the server and wait
   for the server result before calling `combatBridge.emit('player:cast', ...)`

**Client-side `useScoring` output becomes decorative only** — used to populate
the Spellbook power meter in real-time, never used as authoritative damage.

**Schema:** Add `POST /api/combat/score` request/response shape to `SCHEMA_CONTRACT.md`.

---

## CO-6 — Fill `usePhonemeEngine` Stub
**Priority:** HIGH | **Blocks:** C-2 Truesight in Spellbook | **Depends on:** architecture decision

**Current state:** `src/hooks/usePhonemeEngine.jsx:1` returns `{ engine: null }`.

See `PARAEQ_PLUGIN.md § Honest State of the Codebase` for full context.
The Spellbook's full Truesight overlay (Claude task C-2) is blocked on this.

**What to build:**
Expose `analyzedWords` from the phoneme analysis pipeline in a form the Spellbook
can consume. The minimum viable signal:

```typescript
interface AnalyzedWord {
  word: string;
  school: School | null;   // derived via VOWEL_FAMILY_TO_SCHOOL
  vowelFamily: VowelFamily | null;
}
```

This is already partially available via `usePanelAnalysis` + `buildVowelSummaryFromAnalysis`.
The task is exposing it at the word level (not just the summary level) in a hook
Claude can consume.

**Notify Claude** when the interface is ready so C-2 can proceed.

---

## CO-7 — Publish New Combat Events to SCHEMA_CONTRACT
**Priority:** HIGH | **Blocks:** Blackbox test fixtures | **Depends on:** CO-1, CO-5

As CO-1 and CO-5 are built, any new runtime events or request/response shapes
must be published to `SCHEMA_CONTRACT.md` with a version bump and SCHEMA CHANGE
NOTICE block. At minimum:
- `OpponentSpell` interface (if new)
- `POST /api/combat/score` request/response
- Any new `RuntimeEventName` emitted during combat

---

---

# 🔮 BLACKBOX — Test Tasks

**Jurisdiction:** `tests/` — write tests and regression baselines. Do not fix code.
**If a test reveals a bug, issue a MERLIN DATA REPORT and escalate to the owning agent.**

---

## B-1 — Combat State Machine Tests
**Priority:** HIGH | **Blocks:** merge

File: `tests/unit/combat/useCombatEngine.test.js`

```javascript
describe('[Logic] useCombatEngine', () => {
  describe('state transitions', () => {
    it('transitions INTRO → PLAYER_TURN after bridge emits state:update PLAYER_TURN')
    it('transitions PLAYER_TURN → CASTING when action:inscribe received and MP > 0')
    it('does NOT transition to CASTING when MP === 0')
    it('transitions CASTING → SPELL_FLYING when castPlayerSpell called')
    it('transitions SPELL_FLYING → SCORE_REVEAL when anim:player:done received')
    it('transitions SCORE_REVEAL → OPPONENT_TURN when continueAfterReveal called')
    it('transitions OPPONENT_TURN → OPPONENT_CASTING after ~1800ms delay')
    it('transitions OPPONENT_CASTING → PLAYER_TURN when anim:opponent:done received')
    it('transitions to VICTORY when opponentHP reaches 0')
    it('transitions to DEFEAT when playerHP reaches 0')
    it('transitions to DEFEAT when action:flee received')
  })

  describe('HP accounting', () => {
    it('reduces opponentHP by player damage on castPlayerSpell')
    it('never sets opponentHP below 0')
    it('reduces playerHP by opponent damage on opponent cast')
    it('never sets playerHP below 0')
  })

  describe('MP accounting', () => {
    it('reduces playerMP by MP_COST on each castPlayerSpell call')
    it('never sets playerMP below 0')
    it('gates casting when playerMP < MP_COST')
  })

  describe('battle log', () => {
    it('records player spell cast in battleLog')
    it('records opponent counter-spell in battleLog')
    it('records flee action in battleLog')
    it('battle log entries are append-only during a combat session')
  })
})
```

---

## B-2 — Combat Bridge Tests
**Priority:** HIGH | **Blocks:** merge

File: `tests/unit/combat/combatBridge.test.js`

```javascript
describe('[Integration] combatBridge', () => {
  it('delivers event to all registered listeners')
  it('unsubscribe function removes listener — event no longer delivered')
  it('clear() removes all listeners')
  it('emitting with no listeners does not throw')
  it('multiple events do not cross-contaminate listeners')
  it('payload is passed through unchanged')
})
```

---

## B-3 — ScoreReveal Tests
**Priority:** MEDIUM

File: `tests/unit/combat/ScoreReveal.test.jsx`

```javascript
describe('[UI] ScoreReveal', () => {
  it('renders all trace rows from scoreData.traces')
  it('renders all trace rows from scoreData.explainTrace (alias)')
  it('displays damage value prominently')
  it('does not render when isVisible=false')
  it('calls onContinue when continue button clicked')
  it('shows victory hint text when opponentHP === 0')
  it('does not show victory hint when opponentHP > 0')
  it('[REGRESSION GUARD] cascades revealedCount in 220ms increments')
})
```

---

## B-4 — Spellbook Tests
**Priority:** HIGH | **Blocks:** merge

File: `tests/unit/combat/Spellbook.test.jsx`

```javascript
describe('[UI] Spellbook', () => {
  it('enforces 100 character limit — input beyond 100 chars is ignored')
  it('disables CAST button when text is empty')
  it('disables CAST button when playerMP < mpCost')
  it('enables CAST button when text is present and MP sufficient')
  it('calls onCast with text and scoreData when CAST clicked')
  it('calls onCancel when CANCEL clicked')
  it('calls onCancel on Escape keydown')
  it('calls onCast on Ctrl+Enter keydown')
  it('does not render when isVisible=false')
  it('clears text when isVisible transitions false→true')
  it('[REGRESSION GUARD] char counter shows correct remaining chars at 85, 95, 100')
})
```

---

## B-5 — Accessibility Tests
**Priority:** HIGH | **Blocks:** merge

File: `tests/accessibility/combat.axe.test.jsx`

```javascript
describe('[a11y] Combat page components', () => {
  it('CombatPage: jest-axe passes with 0 violations')
  it('Spellbook (visible): jest-axe passes with 0 violations')
  it('ScoreReveal (visible): jest-axe passes with 0 violations')
  it('BattleLog: jest-axe passes with 0 violations')
  it('Victory overlay: jest-axe passes with 0 violations')
  it('Defeat overlay: jest-axe passes with 0 violations')
})
```

---

## B-6 — Anti-Exploit Battery (Combat-Specific)
**Priority:** HIGH | **Blocks:** merge | **Depends on:** CO-5 server validation

Run on every PR that touches `useCombatEngine.js` or `codex/` combat-related files.

File: `tests/exploit/combat.exploit.test.js`

```javascript
describe('[Exploit] Combat scoring', () => {
  // Score manipulation — Vaelrix Law §4
  it('client-submitted score is ignored — server re-scores — REGRESSION GUARD')
  it('modified scoreData.totalScore in client payload does not affect server result')

  // Payload abuse
  it('scroll text > 100 chars is rejected before scoring')
  it('empty string scroll deals minimum damage (not error)')
  it('scroll of all spaces is treated as empty')
  it('scroll with only punctuation scores near-zero on all heuristics')

  // Rapid fire
  it('casting twice within 500ms is debounced — second cast ignored')

  // HP manipulation
  it('client-sent HP values are ignored — server maintains authoritative HP')

  // Determinism
  it('same scroll text scored 100x returns identical totalScore each time — REGRESSION GUARD')
})
```

---

## B-7 — Visual Regression Baselines
**Priority:** MEDIUM | **Blocks:** post-CO-5 stabilization

File: `tests/visual/combat/` — Playwright baselines

Capture baselines for:
- `combat-player-turn.png` — menu active, both sprites visible
- `combat-spellbook-open.png` — Spellbook overlay, 50 chars typed
- `combat-score-reveal.png` — ScoreReveal with all traces revealed
- `combat-opponent-turn.png` — menu disabled, battle log active
- `combat-victory.png` — Victory overlay
- `combat-defeat.png` — Defeat overlay

**Threshold:** < 1% pixel diff (project standard per `BLACKBOX.md`)

---

---

## Merge Gate

The combat page is blocked from merge until all of the following pass:

| Check | Owner | Status |
|-------|-------|--------|
| jest-axe: 0 violations | Blackbox | PENDING |
| State machine tests pass | Blackbox | PENDING |
| Bridge tests pass | Blackbox | PENDING |
| Spellbook tests pass | Blackbox | PENDING |
| Anti-exploit battery | Blackbox | PENDING — blocked on CO-5 |
| Server-side score validation | Codex | PENDING (CO-5) |
| SCHEMA_CONTRACT updated | Codex | PENDING (CO-7) |
| Coverage: combat hooks ≥ 80% | Blackbox | PENDING |

Angel approves merge when all rows read PASS.

---

## Known Risks / Open Questions for Angel

1. **Phaser bundle size** — Phaser is ~1.2MB. It loads dynamically (won't block initial app load) but will delay the combat page's first paint. Is this acceptable, or should we evaluate a lighter 2D canvas library?

2. **Server validation latency (CO-5)** — If the server round-trip for score validation adds 200–400ms before the spell animation plays, the combat loop will feel sluggish. A mitigating pattern: optimistically play the animation using the client score, then reconcile if the server score differs significantly. Needs Angel's decision on acceptable latency vs. strict server-first.

3. **Opponent spell text display** — The opponent's counter-verse is currently shown in the Phaser message window (bottom panel). Gemini needs to decide if this should be real English prose, phonetically corrupted text, or void-glyphs. This affects what CO-1 generates and what Claude renders.

4. **School gate** — SONIC is the only unlocked school for MVP. Should the `/combat` route be gated behind school unlock (SONIC is `unlockXP: 0` so it's always available) or should combat be accessible to all players regardless of school? No gate currently exists.

---

*Document maintained by Claude. Update task statuses as work completes.*
*Escalate conflicts to Angel per `VAELRIX_LAW.md`.*
*Version: 1.0 — 2026-03-10*
