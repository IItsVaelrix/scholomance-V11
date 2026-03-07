# BATTLE UI — Full Specification
**Handoff: Gemini / Codex | Visual Owner: Claude**
**Status: Ready for Implementation**

---

## 0. Purpose

This document specifies the complete architecture, component tree, data contracts, CSS scaffolding, and Phaser integration plan for the `/battle` page — Scholomance's Sonic Thaumaturgy Battle Simulator.

The battle UI is the first playable expression of the combat loop. It is deliberately different from the IDE (`/read`). The IDE is a workshop. The battle arena is an arena. Every design decision reflects that distinction.

---

## 1. Vision

**Tone:** Immediate. Powerful. Elegant. Sleek.
**Reference:** Modernized SNES RPG combat — clear split-screen initiative structure, dramatic but readable, no clutter.
**Grimoire aesthetic maintained** but shifted from parchment/scholar to obsidian/ritual — darker, sharper, higher contrast.
**Phaser.js** drives a canvas layer beneath React for particle effects, ambient aurora, and hit animations. React owns all UI, state, and interaction. Phaser owns visual spectacle only.

The player opens the arena and immediately knows: something is at stake here.

---

## 2. Route Registration

**Gemini/Codex owns `src/main.jsx`.** Add the following entry:

```js
// In src/main.jsx — add to the router children array
const BattlePage = lazyWithRetry(() => import("./pages/Battle/BattlePage.jsx"), "battle-page");

// In createBrowserRouter children:
{ path: "battle", element: <BattlePage /> },
```

The battle page uses its own layout — it overrides the standard `page-content` wrapper to suppress the navigation bar during active combat (full-screen immersion). See Section 5 for the layout class contract.

---

## 3. File Structure

Claude owns all files listed below. Create them all.

```
src/pages/Battle/
├── BattlePage.jsx           — Root page component, layout shell, Phaser bootstrap
├── BattlePage.css           — All battle-specific styles (import into BattlePage.jsx)
├── BattleArena.jsx          — Main arena split layout (opponent | log | player)
├── OpponentDisplay.jsx      — Enemy portrait, name, school, HP, "thinking" state
├── PlayerDisplay.jsx        — Player stats, school, HP, turn indicator
├── BattleScrollInput.jsx    — Simplified scroll editor for combat input
├── CombatLog.jsx            — Scrolling combat history terminal
├── ScoreResolutionPanel.jsx — Animated score breakdown after submission
├── TurnTimer.jsx            — 20-second countdown arc/bar
├── PhaserLayer.jsx          — Phaser canvas mount (effects only, no game logic)
└── BattleChrome.jsx         — Top chrome bar (school, round, flee button)
```

**Codex/Gemini owns these new files** (must be created before Claude can consume them):

```
src/hooks/useBattleSession.js    — Battle state machine hook
src/hooks/useBattleScoring.js    — Wraps CODEx scoring for combat context
codex/core/battle.schemas.js     — OpponentScroll, BattleState, TurnResult types
```

---

## 4. CODEx Contract Requirements

**Gemini must deliver these before the UI can be completed.** Blocking dependencies.

### 4.1 `codex/core/battle.schemas.js` (new file)

```js
/**
 * @typedef {Object} OpponentArchetype
 * @property {string} id               — Unique archetype ID (e.g., "void_wraith_03")
 * @property {string} name             — Display name (e.g., "The Hollow Cantor")
 * @property {string} school           — One of: SONIC | PSYCHIC | ALCHEMY | WILL | VOID
 * @property {number} level            — 1–30 difficulty tier
 * @property {number} hp               — Max HP (e.g., 120)
 * @property {number} minScoreToHit    — Minimum scroll score for any damage (e.g., 20)
 * @property {number} baseResistance   — Flat damage reduction (0–50)
 * @property {string} glyph            — School glyph character
 * @property {string} description      — One-line flavor text
 * @property {string[]} preferredVowelFamilies — Vowel affinities used for response gen
 */

/**
 * @typedef {Object} GeneratedOpponentScroll
 * @property {string} text             — The generated counter-verse text
 * @property {string} archetypeId      — Which archetype generated this
 * @property {number} targetScore      — The score the opponent was targeting (for display)
 * @property {string} school           — School of the response
 */

/**
 * @typedef {Object} TurnResult
 * @property {string} phase            — "player_attack" | "opponent_attack" | "resolution"
 * @property {number} playerScore      — Scored result of player's scroll (0–100)
 * @property {number} opponentScore    — Scored result of opponent's scroll (0–100)
 * @property {number} playerDamage     — Damage dealt to opponent
 * @property {number} opponentDamage   — Damage dealt to player
 * @property {boolean} playerBlocked   — Whether opponent scroll nullified player's
 * @property {boolean} opponentBlocked — Whether player scroll nullified opponent's
 * @property {ScoreTrace[]} playerTraces   — Full scoring breakdown for player
 * @property {ScoreTrace[]} opponentTraces — Full scoring breakdown for opponent
 * @property {string} outcomeLabel     — "NULLIFIED" | "GLANCING" | "SOLID HIT" | "CRITICAL" | "GODLIKE"
 * @property {string} narrativeLog     — One-line combat log entry (e.g., "Your seismic verse shattered their vacuum — CRITICAL HIT")
 */

/**
 * @typedef {Object} BattleState
 * @property {string} id               — Session ID
 * @property {OpponentArchetype} opponent
 * @property {number} playerHP         — Current player HP
 * @property {number} opponentHP       — Current opponent HP
 * @property {number} playerMaxHP
 * @property {number} opponentMaxHP
 * @property {number} round            — Current round number (1-based)
 * @property {string} phase            — "idle" | "player_writing" | "resolving" | "opponent_responding" | "victory" | "defeat"
 * @property {TurnResult[]} history    — All past turn results
 */
```

### 4.2 `src/hooks/useBattleSession.js` (new file, Gemini owns)

Must expose:

```js
{
  battleState,          // BattleState
  startBattle,          // (archetypeId: string) => void
  submitScroll,         // (text: string) => Promise<TurnResult>
  fleeBattle,           // () => void
  isResolving,          // boolean — true during score computation
  opponentScroll,       // GeneratedOpponentScroll | null — revealed after resolution
  turnTimeRemaining,    // number — seconds remaining in 20s window (0–20)
  isPlayerTurn,         // boolean
}
```

### 4.3 `src/hooks/useBattleScoring.js` (new file, Gemini owns)

Must expose:

```js
{
  scoreLive,            // (text: string) => { totalScore: number, rating: string }
  // rating: "NEOPHYTE" | "ADEPT" | "MASTER" | "GODLIKE"
  // Called on every keystroke for real-time meter display
}
```

### 4.4 Extend `combat.engine.js` (Gemini)

Current implementation only scores `lines[0]`. Must implement:
- Multi-line aggregation: weight terminal line at 1.4×, internal lines at 1.0×, sum with diminishing returns past line 4
- Damage formula: `damage = Math.max(0, playerScore - opponent.baseResistance) * (1 + round * 0.05)`
- Block detection: if `opponentScore >= playerScore * 0.85`, player is blocked; vice versa

---

## 5. Layout Architecture

### 5.1 Full-Screen Override

The battle page uses `battle-immersive-mode` on the page wrapper to suppress standard navigation during combat:

```
.battle-page-root
  .battle-immersive-mode          ← full viewport, no nav visible during combat
    PhaserLayer                   ← position: fixed, z-index: 0, canvas covers viewport
    BattleChrome (top bar)        ← z-index: 20, 48px, school + round + flee
    BattleArena                   ← z-index: 10, fills remaining height
      .arena-grid
        OpponentDisplay           ← left column (or top on mobile)
        CombatLog                 ← center column
        PlayerDisplay             ← right column (or stacked on mobile)
    .battle-lower
      TurnTimer                   ← thin arc bar above input
      BattleScrollInput           ← the scroll input, always at bottom
      ScoreResolutionPanel        ← slides up from bottom on resolve
```

### 5.2 Grid Proportions

**Desktop (>1024px):**
```
.arena-grid: grid-template-columns: 280px 1fr 280px
             grid-template-rows: 100%
             height: calc(100vh - 48px - 180px)
             /* 48px = chrome bar, 180px = lower input area */
```

**Tablet (641–1024px):**
```
.arena-grid: grid-template-columns: 220px 1fr 220px
```

**Mobile (<640px):**
```
.arena-grid: grid-template-columns: 1fr
             grid-template-rows: auto auto auto
             /* Stack: opponent → log → player */
```

---

## 6. Component Specifications

### 6.1 `BattlePage.jsx`

Root component. Responsibilities:
- Mount the Phaser canvas via `<PhaserLayer />`
- Apply `battle-immersive-mode` class to suppress navigation
- Bootstrap `useBattleSession` and pass props down
- Handle victory/defeat overlays via `AnimatePresence`
- Restore navigation on unmount

```jsx
// Skeleton only — Claude implements
export default function BattlePage() {
  // useBattleSession hook drives all state
  // On mount: hide nav, on unmount: restore nav
  // Render: PhaserLayer + BattleChrome + BattleArena + lower section
}
```

### 6.2 `OpponentDisplay.jsx`

Props interface:
```ts
{
  archetype: OpponentArchetype,
  currentHP: number,
  maxHP: number,
  phase: string,         // drives "thinking" pulse animation
  lastScroll: GeneratedOpponentScroll | null,
}
```

Visual structure:
```
.opponent-display
  .opponent-portrait-frame       ← geometric glyph frame (SVG or CSS clip-path)
    .opponent-glyph               ← school glyph rendered large (e.g., "♩" for SONIC)
    .opponent-school-ring         ← animated ring in school color
  .opponent-info
    .opponent-name                ← Space Grotesk, bold, school-color
    .opponent-school-label        ← school badge pill
    .opponent-description         ← italic flavor text, muted
  .opponent-hp-bar
    .hp-bar-track
      .hp-bar-fill                ← animates on damage, color: school → red at <25%
  .opponent-scroll-reveal         ← shown after resolution phase
    .scroll-text                  ← Georgia serif, opponent's counter-verse
    .scroll-score-chip            ← small badge: opponent score
  .opponent-thinking              ← only visible during "opponent_responding" phase
    .thinking-dots                ← CSS keyframe pulse dots
```

### 6.3 `PlayerDisplay.jsx`

Props interface:
```ts
{
  playerHP: number,
  playerMaxHP: number,
  school: string,
  lastScore: number | null,
  lastRating: string | null,
  isPlayerTurn: boolean,
}
```

Visual structure mirrors OpponentDisplay but right-aligned:
```
.player-display
  .player-hp-bar                 ← player color: school accent
  .player-school-badge
  .player-turn-indicator         ← glows when isPlayerTurn, pulse animation
  .player-last-score             ← score from last turn, fades out
```

### 6.4 `BattleScrollInput.jsx`

Simplified version of `ScrollEditor`. Key differences from IDE editor:
- No Truesight mode
- No panel system
- No syllable counter sidebar
- DOES show real-time `scoreLive` rating as colored meter below input
- DOES show character/line feedback
- Submit via Enter+Shift or button

Props interface:
```ts
{
  onSubmit: (text: string) => void,
  isDisabled: boolean,           // true during resolution or opponent turn
  isPlayerTurn: boolean,
  scoreLive: (text: string) => { totalScore: number, rating: string },
}
```

Visual structure:
```
.battle-scroll-input-wrapper
  .scroll-label                  ← "CAST YOUR VERSE" — uppercase, letter-spaced, school-color
  .scroll-textarea-container
    textarea.battle-scroll-textarea   ← Georgia serif, same overlay technique as IDE
    .live-meter                  ← thin bar beneath textarea, animates with scoreLive
      .meter-fill                ← color: NEOPHYTE=zinc, ADEPT=violet, MASTER=gold, GODLIKE=aurora
    .rating-label                ← text rating, updates live: "NEOPHYTE" → "GODLIKE"
  .submit-bar
    .word-count                  ← subtle word/line count
    .submit-button               ← "UNLEASH" — school-colored CTA
```

Live meter transitions must respect `prefers-reduced-motion`.

### 6.5 `CombatLog.jsx`

Props interface:
```ts
{
  history: TurnResult[],
  isResolving: boolean,
}
```

Scrolling terminal of past turns. Each `TurnResult.narrativeLog` entry is one line. Color-coded:
- `GODLIKE` → aurora gradient text
- `CRITICAL` → school-color bright
- `SOLID HIT` → school-color muted
- `GLANCING` → text-secondary
- `NULLIFIED` → red-muted
- `BLOCKED` → zinc

Auto-scrolls to bottom on new entry. `isResolving` shows a subtle spinner/pulse at the bottom.

```
.combat-log
  .log-entries
    .log-entry[data-outcome="GODLIKE"]
    .log-entry[data-outcome="NULLIFIED"]
    ...
  .log-resolving-indicator       ← pulsing when isResolving
```

### 6.6 `ScoreResolutionPanel.jsx`

Slides up from the bottom after each turn resolves. Displays `TurnResult` breakdown. Dismisses automatically after 4 seconds or on next keystroke.

Props interface:
```ts
{
  result: TurnResult | null,
  onDismiss: () => void,
}
```

Visual structure:
```
.resolution-panel               ← AnimatePresence, slides up from y:100%
  .resolution-outcome-label     ← large: "CRITICAL HIT" in school color, font-size var(--text-2xl)
  .resolution-damage-number     ← "−38 HP" on opponent, counter-animates (count up)
  .resolution-scores
    .score-column.player-score
      .score-value
      .score-label "YOUR VERSE"
      .heuristic-bars           ← mini bars for each ScoreTrace contribution
    .score-column.opponent-score
      .score-value
      .score-label "COUNTER VERSE"
      .heuristic-bars
  .resolution-narrative         ← TurnResult.narrativeLog, Georgia italic
```

### 6.7 `TurnTimer.jsx`

Displays 20-second countdown. Thin arc that depletes clockwise. When <5 seconds: pulses red.

Props interface:
```ts
{
  timeRemaining: number,    // 0–20 seconds
  isActive: boolean,
}
```

CSS arc via `stroke-dashoffset` on an SVG circle. Framer Motion drives the dashoffset interpolation.

### 6.8 `BattleChrome.jsx`

Top 48px bar. Mirrors `IDEChrome.jsx` pattern but battle-specific.

```
.battle-chrome
  .chrome-left
    .school-glyph-badge
    .battle-title "SONIC THAUMATURGY ARENA"
  .chrome-center
    .round-counter "ROUND 3"
    TurnTimer (compact inline variant)
  .chrome-right
    .flee-button "FLEE"         ← always accessible, triggers fleeBattle()
```

---

## 7. Phaser Integration

### 7.1 Philosophy

Phaser is a **visual effects layer only**. It owns zero game state. It receives events from React via a simple event emitter interface. React calls Phaser. Phaser never calls React.

This means:
- No Phaser game objects hold state that affects gameplay
- Phaser scenes are purely cosmetic
- If Phaser fails to load, the game is fully playable without it (graceful degradation)

### 7.2 Dependency

```bash
npm install phaser
```

Phaser is a large package (~1MB). It must be dynamically imported so it doesn't bloat the initial bundle:

```js
// In PhaserLayer.jsx
const Phaser = await import('phaser');
```

### 7.3 `PhaserLayer.jsx`

Mounts a `<canvas>` element covering the full viewport behind React UI.

```jsx
// Skeleton
export default function PhaserLayer({ school, onReady }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    // Dynamically import Phaser, init game, pass school to scene
    // Store game instance in gameRef
    // Call onReady(gameAPI) where gameAPI is the event interface
    return () => gameRef.current?.destroy(true);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="phaser-canvas-layer"
      aria-hidden="true"
    />
  );
}
```

The parent `BattlePage` receives `gameAPI` from `onReady` and stores it in a ref. When combat events occur, it calls `gameAPI.emit(eventName, payload)`.

### 7.4 Phaser Scene: `BattleScene`

One scene, three systems:

**System 1: Ambient Aurora**
- Continuous particle emitter using school HSL values
- Emits soft, slow-moving glow particles from screen edges
- Intensity driven by school `auroraIntensity` setting from `SCHOOLS` data
- School change triggers a tween to new color targets

**System 2: Scroll Impact Effect**
- Triggered by event: `"scroll_impact"` with payload `{ outcome, school, x, y }`
- `GODLIKE`: Full-screen shockwave + dense particle burst in school color, screen flash at 15% opacity
- `CRITICAL`: Medium burst, screen edge flash
- `SOLID HIT`: Focused particle spray from center
- `GLANCING`: Small spark burst
- `NULLIFIED`: Inward particle implosion, brief desaturation
- `BLOCKED`: Dark shield ripple

**System 3: Damage Number Float**
- Triggered by event: `"damage_number"` with payload `{ amount, x, y, isPlayer }`
- Floating text that arcs up and fades: `-38` in school color for opponent damage, red for player damage
- Phaser's built-in text objects, tweened on `alpha` and `y`

### 7.5 Phaser Game Config

```js
const config = {
  type: Phaser.CANVAS,
  canvas: canvasRef.current,
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,           // React UI shows through
  backgroundColor: 'rgba(0,0,0,0)',
  scene: BattleScene,
  fps: { target: 30, forceSetTimeOut: true },  // 30fps sufficient for ambient effects
  disableVisibilityChange: true,
};
```

### 7.6 React → Phaser Event Interface

```js
// gameAPI object returned via onReady
const gameAPI = {
  emit: (event, payload) => {
    game.events.emit(event, payload);
  },
  setSchool: (school) => {
    game.events.emit('school_change', { school });
  },
  destroy: () => game.destroy(true),
};
```

Usage in `BattlePage.jsx`:
```js
// After turn resolves:
phaserRef.current?.emit('scroll_impact', {
  outcome: result.outcomeLabel,
  school: battleState.opponent.school,
});
phaserRef.current?.emit('damage_number', {
  amount: result.playerDamage,
  x: window.innerWidth * 0.3,
  y: window.innerHeight * 0.4,
  isPlayer: false,
});
```

---

## 8. CSS Scaffolding — `BattlePage.css`

Claude writes this file. The following is the complete architectural specification that Claude must implement.

### 8.1 Design Token Extensions

These are battle-specific tokens that extend `src/index.css`. All inherit from the existing token system.

```css
/* Add to BattlePage.css */
.battle-page-root {
  /* Arena atmosphere — overrides body aurora with deeper, sharper version */
  --battle-bg-primary: #02020a;
  --battle-bg-panel:   rgba(6, 6, 18, 0.85);
  --battle-bg-glass:   rgba(12, 12, 30, 0.7);

  /* HP bar colors */
  --hp-color-full:     var(--school-color, #651fff);
  --hp-color-mid:      #f59e0b;
  --hp-color-critical: #ef4444;

  /* Outcome label colors */
  --outcome-godlike:   transparent; /* aurora gradient — see below */
  --outcome-critical:  var(--school-color, #651fff);
  --outcome-solid:     var(--text-primary);
  --outcome-glancing:  var(--text-secondary);
  --outcome-nullified: #ef4444;

  /* Timer colors */
  --timer-normal:      var(--school-color, #651fff);
  --timer-urgent:      #ef4444;

  /* Panel borders */
  --battle-border:     rgba(255, 255, 255, 0.08);
  --battle-border-glow: rgba(var(--active-school-h), 60%, 50%, 0.3);

  /* Input focus glow */
  --battle-input-glow: 0 0 0 2px rgba(var(--active-school-h), 60%, 50%, 0.5),
                       0 0 20px rgba(var(--active-school-h), 60%, 50%, 0.2);

  /* Typography — battle-specific */
  --battle-outcome-font-size: clamp(2rem, 4vw, 3.5rem);
  --battle-damage-font-size:  clamp(1.5rem, 3vw, 2.5rem);
  --battle-label-font-size:   0.65rem;
  --battle-scroll-font-size:  clamp(1rem, 1.2vw, 1.1rem);
  --battle-scroll-line-height: 1.85;
}
```

### 8.2 Layout Classes

```css
/* Full-screen immersive wrapper — suppresses navigation chrome */
.battle-immersive-mode {
  position: fixed;
  inset: 0;
  z-index: 40;                    /* above nav (z-index varies) */
  display: flex;
  flex-direction: column;
  background: var(--battle-bg-primary);
  overflow: hidden;
}

/* Phaser canvas sits behind everything */
.phaser-canvas-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  width: 100vw;
  height: 100vh;
}

/* Chrome bar */
.battle-chrome {
  position: relative;
  z-index: 20;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: rgba(4, 4, 12, 0.9);
  border-bottom: 1px solid var(--battle-border);
  backdrop-filter: blur(12px);
}

/* Main arena grid */
.arena-grid {
  position: relative;
  z-index: 10;
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 280px;
  grid-template-rows: 1fr;
  gap: 0;
  overflow: hidden;
}

/* Lower combat input section */
.battle-lower {
  position: relative;
  z-index: 10;
  height: 220px;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--battle-border);
  background: rgba(4, 4, 12, 0.95);
  backdrop-filter: blur(16px);
}
```

### 8.3 Panel Styles

```css
/* Shared panel base */
.battle-panel {
  background: var(--battle-bg-panel);
  border: 1px solid var(--battle-border);
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}

/* Panel inner glow on active turn */
.battle-panel.is-active-turn {
  border-color: var(--school-color, #651fff);
  box-shadow: inset 0 0 30px rgba(var(--active-school-h), 60%, 50%, 0.08),
              0 0 20px rgba(var(--active-school-h), 60%, 50%, 0.15);
}

/* Opponent and player panels */
.opponent-display,
.player-display {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-right: 1px solid var(--battle-border);
  border-left: 1px solid var(--battle-border);
}

/* Glyph portrait frame */
.opponent-portrait-frame {
  width: 96px;
  height: 96px;
  margin: 0 auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  /* Geometric clip-path: octagon */
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
  background: var(--battle-bg-glass);
  border: 1px solid var(--school-color, #651fff);
}

.opponent-glyph {
  font-size: 2.5rem;
  line-height: 1;
  color: var(--school-color, #651fff);
  filter: drop-shadow(0 0 12px var(--school-color, #651fff));
}

/* School ring animation */
.opponent-school-ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid transparent;
  border-top-color: var(--school-color, #651fff);
  animation: school-ring-spin 3s linear infinite;
  clip-path: inherit;
}

@keyframes school-ring-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .opponent-school-ring { animation: none; border-color: var(--school-color, #651fff); }
}
```

### 8.4 HP Bar

```css
.hp-bar-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.hp-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--hp-color-full);
  box-shadow: 0 0 8px var(--hp-color-full);
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1),
              background 400ms ease;
}

/* HP thresholds — computed via inline style `--hp-pct` from JSX */
.hp-bar-fill[style*="--hp-pct"] {
  width: calc(var(--hp-pct, 1) * 100%);
}

/* Color shifts at thresholds */
.hp-bar-fill.hp-mid   { background: var(--hp-color-mid);      box-shadow: 0 0 8px var(--hp-color-mid); }
.hp-bar-fill.hp-critical { background: var(--hp-color-critical); box-shadow: 0 0 8px var(--hp-color-critical); animation: hp-pulse 1s ease-in-out infinite; }

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
@media (prefers-reduced-motion: reduce) {
  .hp-bar-fill.hp-critical { animation: none; }
}
```

### 8.5 Combat Log

```css
.combat-log {
  padding: var(--space-4);
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.log-entry {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  line-height: 1.5;
  opacity: 0.85;
  transition: opacity 200ms ease;
}
.log-entry:hover { opacity: 1; }

/* Outcome color mapping */
.log-entry[data-outcome="GODLIKE"] {
  background: linear-gradient(90deg,
    hsla(var(--active-school-h), 80%, 60%, 0.15),
    transparent
  );
  color: var(--school-color, #651fff);
  font-weight: 600;
  border-left: 2px solid var(--school-color, #651fff);
}
.log-entry[data-outcome="CRITICAL"] {
  color: var(--text-primary);
  border-left: 2px solid var(--school-color, #651fff);
}
.log-entry[data-outcome="SOLID_HIT"]  { color: var(--text-secondary); }
.log-entry[data-outcome="GLANCING"]   { color: var(--text-tertiary); }
.log-entry[data-outcome="NULLIFIED"]  { color: var(--hp-color-critical); opacity: 0.7; }
.log-entry[data-outcome="BLOCKED"]    { color: var(--text-muted); font-style: italic; }

/* Resolving indicator */
.log-resolving-indicator {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  align-items: center;
}
.resolving-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--school-color, #651fff);
  animation: resolving-bounce 1.2s ease-in-out infinite;
}
.resolving-dot:nth-child(2) { animation-delay: 0.2s; }
.resolving-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes resolving-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40%           { transform: translateY(-4px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .resolving-dot { animation: none; opacity: 0.6; }
}
```

### 8.6 Battle Scroll Input

```css
.battle-scroll-input-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-5);
  gap: var(--space-2);
}

.scroll-label {
  font-family: var(--font-sans);
  font-size: var(--battle-label-font-size);
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--school-color, #651fff);
}

.scroll-textarea-container {
  position: relative;
  flex: 1;
}

.battle-scroll-textarea {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: "Georgia", serif;
  font-size: var(--battle-scroll-font-size);
  line-height: var(--battle-scroll-line-height);
  color: var(--text-primary);
  caret-color: var(--school-color, #651fff);
  white-space: pre-wrap;
  padding: 0;
}

.battle-scroll-textarea:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Live scoring meter */
.live-meter {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--space-1);
}

.meter-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 200ms ease, background 300ms ease;
}
.meter-fill[data-rating="NEOPHYTE"] { background: var(--text-muted);     width: 15%; }
.meter-fill[data-rating="ADEPT"]    { background: #7c3aed;                width: 45%; box-shadow: 0 0 6px #7c3aed; }
.meter-fill[data-rating="MASTER"]   { background: #fbbf24;                width: 75%; box-shadow: 0 0 8px #fbbf24; }
.meter-fill[data-rating="GODLIKE"]  {
  background: linear-gradient(90deg, var(--school-color, #651fff), #00e5ff, var(--school-color, #651fff));
  background-size: 200% 100%;
  width: 100%;
  box-shadow: 0 0 12px var(--school-color, #651fff);
  animation: godlike-shimmer 2s linear infinite;
}
@keyframes godlike-shimmer {
  to { background-position: -200% center; }
}
@media (prefers-reduced-motion: reduce) {
  .meter-fill { transition: none; }
  .meter-fill[data-rating="GODLIKE"] { animation: none; }
}

/* Rating label */
.rating-label {
  font-family: var(--font-mono);
  font-size: var(--battle-label-font-size);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: color 300ms ease;
}
.rating-label[data-rating="NEOPHYTE"] { color: var(--text-muted); }
.rating-label[data-rating="ADEPT"]    { color: #7c3aed; }
.rating-label[data-rating="MASTER"]   { color: #fbbf24; }
.rating-label[data-rating="GODLIKE"]  { color: var(--school-color, #651fff); }

/* Submit bar */
.submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-2);
}

.submit-button {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: var(--space-2) var(--space-6);
  border-radius: var(--radius-sm);
  border: 1px solid var(--school-color, #651fff);
  background: transparent;
  color: var(--school-color, #651fff);
  cursor: pointer;
  transition: background 200ms ease, box-shadow 200ms ease, color 200ms ease;
}
.submit-button:hover:not(:disabled) {
  background: var(--school-color, #651fff);
  color: #fff;
  box-shadow: 0 0 20px rgba(var(--active-school-h), 60%, 50%, 0.4);
}
.submit-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

### 8.7 Resolution Panel

```css
.resolution-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  background: rgba(4, 4, 14, 0.97);
  border-top: 1px solid var(--school-color, #651fff);
  backdrop-filter: blur(20px);
  padding: var(--space-5) var(--space-8);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto;
  gap: var(--space-4);
  box-shadow: 0 -20px 60px rgba(var(--active-school-h), 60%, 50%, 0.15);
}

/* Outcome label — center top */
.resolution-outcome-label {
  grid-column: 1 / -1;
  text-align: center;
  font-family: var(--font-sans);
  font-size: var(--battle-outcome-font-size);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.resolution-outcome-label[data-outcome="GODLIKE"] {
  background: linear-gradient(90deg, var(--school-color, #651fff), #00e5ff, var(--school-color, #651fff));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: godlike-shimmer 2s linear infinite;
}
.resolution-outcome-label[data-outcome="CRITICAL"]  { color: var(--school-color, #651fff); }
.resolution-outcome-label[data-outcome="SOLID_HIT"] { color: var(--text-primary); }
.resolution-outcome-label[data-outcome="GLANCING"]  { color: var(--text-secondary); }
.resolution-outcome-label[data-outcome="NULLIFIED"] { color: var(--hp-color-critical); }

/* Score columns */
.score-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.score-value {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}
.score-label {
  font-family: var(--font-sans);
  font-size: var(--battle-label-font-size);
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Heuristic mini-bars */
.heuristic-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.heuristic-bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.heuristic-bar-name {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 80px;
  flex-shrink: 0;
}
.heuristic-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.heuristic-bar-fill {
  height: 100%;
  background: var(--school-color, #651fff);
  border-radius: var(--radius-full);
  opacity: 0.7;
}
.heuristic-bar-value {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-tertiary);
  width: 28px;
  text-align: right;
}

/* Resolution narrative */
.resolution-narrative {
  grid-column: 1 / -1;
  text-align: center;
  font-family: "Georgia", serif;
  font-style: italic;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  padding-top: var(--space-2);
  border-top: 1px solid var(--battle-border);
}
```

### 8.8 Turn Timer

```css
.turn-timer-arc {
  width: 40px;
  height: 40px;
  transform: rotate(-90deg);            /* Start from top */
}
.timer-track {
  fill: none;
  stroke: rgba(255,255,255,0.08);
  stroke-width: 3;
}
.timer-fill {
  fill: none;
  stroke: var(--timer-normal);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke 300ms ease;
  /* stroke-dasharray and stroke-dashoffset driven by inline style from JSX */
}
.turn-timer-arc.is-urgent .timer-fill {
  stroke: var(--timer-urgent);
  filter: drop-shadow(0 0 4px var(--timer-urgent));
}
```

### 8.9 Opponent "Thinking" State

```css
.opponent-thinking {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--active-school-h), 40%, 20%, 0.15);
  border: 1px solid rgba(var(--active-school-h), 60%, 50%, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}
.thinking-dots span {
  animation: thinking-blink 1.4s ease-in-out infinite;
  opacity: 0;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes thinking-blink {
  0%, 60%, 100% { opacity: 0; }
  30%           { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .thinking-dots span { animation: none; opacity: 1; }
}
```

### 8.10 Responsive Overrides

```css
@media (max-width: 1024px) {
  .arena-grid {
    grid-template-columns: 220px 1fr 220px;
  }
}

@media (max-width: 640px) {
  .arena-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    overflow-y: auto;
  }
  .opponent-display { border-bottom: 1px solid var(--battle-border); }
  .player-display   { border-top: 1px solid var(--battle-border); }
  .resolution-panel {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
  .battle-lower { height: auto; min-height: 180px; }
}
```

---

## 9. Navigation Suppression Pattern

The battle page must suppress the standard Navigation component during combat. This is a UI contract with `App.jsx`.

**Approach:** Pass a `hideNav` prop through context or use a `data-layout` attribute on the root element that CSS targets:

```css
/* In src/index.css — Claude adds this */
body:has(.battle-immersive-mode) .navigation-root {
  display: none;
}
```

This CSS-only approach requires no changes to `Navigation.jsx` or `App.jsx`. It fires purely from the presence of `.battle-immersive-mode` in the DOM.

If `body:has()` selector support is insufficient for target browsers, the fallback is a React context flag — but prefer the CSS approach.

---

## 10. Animation Choreography

### Turn resolution sequence (in order, with timing):

| t=0ms    | Player submits scroll → textarea disables, `isResolving: true` |
| t=0ms    | CombatLog shows resolving dots |
| t=0ms    | Phaser fires: ambient aurora intensity increases |
| t=200ms  | TurnTimer stops |
| t=800ms  | (Server responds with TurnResult) |
| t=900ms  | Phaser fires: `scroll_impact` event with outcome |
| t=1000ms | ScoreResolutionPanel slides up (Framer Motion: y: '100%' → y: 0, spring) |
| t=1000ms | Resolution outcome label fades in |
| t=1200ms | HP bars animate to new values |
| t=1200ms | Phaser fires: `damage_number` float |
| t=1400ms | Heuristic bars fill in staggered (100ms between each) |
| t=1600ms | CombatLog adds new entry, auto-scrolls |
| t=5000ms | ScoreResolutionPanel auto-dismisses (slides back down) |
| t=5200ms | Textarea re-enables if battle continues |

All Framer Motion animations must check `usePrefersReducedMotion` and skip to final state if true.

---

## 11. Accessibility

- `battle-scroll-textarea` must have `aria-label="Write your scroll verse"`
- `TurnTimer` must have `aria-live="polite"` with text like "15 seconds remaining"
- `CombatLog` must have `role="log"` and `aria-live="polite"`
- `ScoreResolutionPanel` must have `role="status"` and `aria-live="assertive"`
- `flee-button` must always be focusable, even during resolution
- All color-coded outcomes must have text labels (never color alone)
- Skip link from `BattleChrome` to the scroll input: `#battle-scroll-input`
- Keyboard: `Shift+Enter` submits scroll (mirrors IDE pattern)

---

## 12. Package Dependencies

New dependencies required:

```bash
npm install phaser
```

Phaser must be dynamically imported (code-split) in `PhaserLayer.jsx` — not statically imported at module level. This prevents it from entering the main bundle.

No other new dependencies required. All other libraries (`framer-motion`, `react-resizable-panels` if needed, existing hooks) are already in `package.json`.

---

## 13. What Claude Will NOT Do

Claude does not implement:
- `useBattleSession.js` — Gemini owns
- `useBattleScoring.js` — Gemini owns
- `battle.schemas.js` — Gemini owns
- The actual CODEx combat engine multi-line fix — Gemini owns
- Ollama integration — Gemini owns
- Any backend routes for battle session management

Claude will block on these. Do not begin React component implementation until the hook interfaces in Section 4.2 and 4.3 are finalized and exported.

---

## 14. Implementation Order

1. **Gemini delivers** `battle.schemas.js`, `useBattleSession.js`, `useBattleScoring.js` with stub implementations
2. **Claude implements** `BattlePage.css` (complete)
3. **Claude implements** `BattleChrome.jsx`, `TurnTimer.jsx` (no hook dependencies)
4. **Claude implements** `OpponentDisplay.jsx`, `PlayerDisplay.jsx` with stub props
5. **Claude implements** `CombatLog.jsx`
6. **Claude implements** `BattleScrollInput.jsx` (depends on `useBattleScoring` interface)
7. **Claude implements** `PhaserLayer.jsx` with `BattleScene`
8. **Claude implements** `ScoreResolutionPanel.jsx`
9. **Claude implements** `BattleArena.jsx` (assembles above)
10. **Claude implements** `BattlePage.jsx` (root, assembles all)
11. **Gemini registers route** in `src/main.jsx`
12. **Minimax writes tests** for hook contracts and component rendering

---

*Document version: 1.0 | Author: Claude (UI) | Target agents: Gemini, Codex*
