# Scholomance V11 — QA Methodology

> **World-Law Connection:** In a world where Syntax is Physics, a UI freeze is not a bug — it is a **linguistic law violation**. The QA methodology treats each stasis event as a broken spell, encoded in bytecode for AI-parsable diagnosis.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Bytecode Error System Integration](#bytecode-error-system-integration)
3. [UI Stasis Detection Framework](#ui-stasis-detection-framework)
4. [Test Categories](#test-categories)
5. [Edge Case Matrix](#edge-case-matrix)
6. [Recovery Invariants](#recovery-invariants)
7. [Visual Regression Strategy](#visual-regression-strategy)
8. [Performance Benchmarks](#performance-benchmarks)
9. [Accessibility QA](#accessibility-qa)
10. [Reporting & Triage](#reporting--triage)

---

## Philosophy

### The Three Laws of UI Physics

1. **The Law of Response:** Every touch must be answered within one frame (16.67ms at 60fps).
2. **The Law of Lifecycle:** No animation may outlive its vessel. No listener may hear after the ear is gone.
3. **The Law of State:** State transitions must be atomic. No touch may land in the between-state.

### QA as Linguistic Forensics

Traditional QA asks: "Does it work?"

Scholomance QA asks: **"Does the syntax hold? Does the glyph answer touch? Does the animation complete its utterance?"**

When UI freezes, we do not file a bug — we **encode the violation in bytecode** and let the AI diagnose the broken law.

---

## Bytecode Error System Integration

### Error Encoding Format

```
PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}-{CONTEXT_B64}-{CHECKSUM}
```

### UI Stasis Categories

| Category | Code Range | Domain |
|----------|------------|--------|
| `UI_STASIS` | 0x0E00–0x0EFF | Click handlers, animations, event leaks, pointer capture |
| `STATE` | 0x0300–0x03FF | Race conditions, invalid transitions |
| `RANGE` | 0x0200–0x02FF | Timeout violations, exceeded thresholds |
| `LINGUISTIC` | 0x0C00–0x0CFF | Phonemic saturation, resonance mismatches, meter degradation |
| `COMBAT` | 0x0D00–0x0DFF | Force dissipation, entropic repetition, mana voids |

### Severity Levels & UI Expression

| Severity | Numeric | UI Expression (Scholomance) |
|----------|---------|-----------------------------|
| FATAL | 4 | **The Void Unfurls** — UI collapses to VOID glyph, aurora stops |
| CRIT | 3 | **Syntactic Glitch** — School color vibrates with scanline noise |
| WARN | 2 | **Phonemic Static** — Ink bleed effect, border-glow pulses out of sync |
| INFO | 1 | **Echo Trace** — Faint bytecode shadow in status bar |

### Example: Click Handler Stall

```javascript
// Test detects stall
try {
  await clickWithStasisDetection(button, 'save-scroll', 5000);
} catch (error) {
  const errorData = parseErrorForAI(error);
  
  // Bytecode: PB-ERR-v1-RANGE-CRIT-UISTAS-0202-...
  console.log(errorData.bytecode);
  
  // AI-readable diagnosis
  console.log(errorData.recoveryHints.invariants);
  // → ["handlerDuration < MAX_HANDLER_DURATION_MS"]
}
```

---

## UI Stasis Detection Framework

### Stasis Detection Patterns

| Pattern | Detection Method | Threshold |
|---------|-----------------|-----------|
| Click handler stall | Timeout race | 5000ms |
| Animation lifecycle hang | Cleanup flag check | Immediate on unmount |
| RAF loop orphan | `loopRunning` flag after unmount | Immediate |
| Interval leak | Listener count after unmount | Immediate |
| Pointer capture failure | `lostpointercapture` event | Immediate |
| Focus trap escape | Escape key test | Immediate |
| State race condition | Concurrent operation tracking | Per-operation |

### Detection Utility: `clickWithStasisDetection`

```javascript
async function clickWithStasisDetection(element, operationName, timeoutMs = 5000) {
  const startTime = Date.now();
  let clickResolved = false;
  
  const clickPromise = (async () => {
    await fireEvent.click(element);
    clickResolved = true;
  })();
  
  await Promise.race([
    clickPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(createTimeoutError(operationName, timeoutMs)), timeoutMs)
    ),
  ]);
  
  return { duration: Date.now() - startTime, clickResolved };
}
```

### Detection Utility: `monitorAnimationFrames`

```javascript
function monitorAnimationFrames(callback, maxFrames = 60) {
  let frameCount = 0;
  let animationId = null;
  
  const observeFrame = (timestamp) => {
    if (frameCount >= maxFrames) return;
    frameCount++;
    callback(timestamp, frameCount);
    animationId = requestAnimationFrame(observeFrame);
  };
  
  animationId = requestAnimationFrame(observeFrame);
  
  return {
    stop: () => {
      if (animationId) cancelAnimationFrame(animationId);
      return { frameCount };
    },
  };
}
```

---

## Test Categories

### 1. Clickable Elements (`tests/qa/ui-stasis-bytecode.test.js`)

**Coverage:**
- Buttons (primary actions, toggles, icon buttons)
- Links (navigation, in-text, breadcrumb)
- Form inputs (text, checkbox, radio, select)
- Custom interactive elements (drag handles, resize grips)

**Test Cases:**
- [x] Rapid consecutive clicks (10 clicks, <500ms each)
- [x] Async click handlers (non-blocking)
- [x] Error recovery (handler throws, button recovers)
- [x] Loading state transitions (disabled → loading → enabled)
- [x] Disabled state enforcement (clicks ignored)
- [x] Bytecode error emission on stall

**Edge Cases:**
- Click during component unmount
- Click during navigation transition
- Click while aria-busy="true"
- Click while pointer-events="none"

---

### 2. Animation Lifecycle

**Coverage:**
- Framer Motion animations (mount, update, exit)
- CSS animations (@keyframes)
- RequestAnimationFrame loops
- setInterval/setTimeout timers

**Test Cases:**
- [x] Cleanup on unmount
- [x] Animation interrupt (new animation supersedes old)
- [x] Multiple concurrent RAF loops
- [x] Interval clearance on unmount
- [x] Timeout cancellation on unmount
- [x] Bytecode error on cleanup failure

**Edge Cases:**
- Component unmounts mid-animation
- Animation depends on async data that never arrives
- Parent hides element (display: none) mid-animation
- Navigation away from animating component

---

### 3. Race Conditions

**Coverage:**
- Concurrent click handlers
- State updates from multiple sources
- Async operations completing out of order
- Event handler deduplication

**Test Cases:**
- [x] Concurrent clicks (5 simultaneous)
- [x] Request deduplication (identical requests merge)
- [x] Race condition bytecode emission
- [x] Rapid state updates (10 updates, final state correct)

**Edge Cases:**
- Two components update same state simultaneously
- Async operation A starts before B, but completes after
- Click triggers navigation, but component tries to update state post-nav

---

### 4. Pointer Capture & Drag Operations

**Coverage:**
- WordTooltip drag-to-pin
- FloatingPanel drag
- Resize handles (8 directions)
- Slider inputs (parameter controls)

**Test Cases:**
- [x] Pointer capture release on unmount
- [x] Lost pointer capture handling
- [x] Drag-click distinction (<5px = click, >5px = drag)
- [x] Multi-touch scenarios (2+ pointers)

**Edge Cases:**
- Element unmounts while capturing pointer
- User presses Escape mid-drag (should cancel)
- Pointer leaves viewport mid-drag
- Browser intervenes (e.g., native gesture recognition)

---

### 5. Focus Traps & Modals

**Coverage:**
- FloatingPanel (dialog role)
- MobileBottomSheet
- IntelliSense popup
- WordTooltip (when pinned)

**Test Cases:**
- [x] Escape key dismisses modal
- [x] Focus trap releases on unmount
- [x] Focus returns to trigger element on close
- [x] Bytecode error on unescapable trap

**Edge Cases:**
- Modal unmounts while focused
- Trigger element unmounts while modal open
- Nested modals (should not occur, but test anyway)
- Screen reader focus announcement

---

### 6. Event Listener Leaks

**Coverage:**
- Document-level listeners (scroll, keydown)
- Window listeners (resize, popstate)
- Custom event bus subscriptions

**Test Cases:**
- [x] Listener count before/after unmount
- [x] Bytecode error on leak detection
- [x] Multiple mounts/unmounts (no accumulation)

**Edge Cases:**
- Component adds listener in useEffect, removes in different useEffect
- Listener added conditionally, not removed conditionally
- Event bus subscription without unsubscribe

---

### 7. Accessibility Interactions

**Coverage:**
- Keyboard navigation (Tab, Shift+Tab, Arrow keys)
- Screen reader announcements (aria-live)
- Focus management
- Reduced motion compliance

**Test Cases:**
- [x] Rapid keyboard navigation (no stasis)
- [x] Escape key for modal dismissal
- [x] aria-live updates (non-blocking)
- [x] Focus visible on keyboard nav
- [x] Skip links functional

**Edge Cases:**
- Focus lost during component unmount
- aria-live region updates during navigation
- Keyboard trap (focus cannot escape)
- Reduced motion preference ignored

---

### 8. Real Component Integration

**Coverage:**
- ScrollEditor (textarea + overlay sync)
- Truesight toggle (color: transparent switch)
- Combat Spellbook (MP bar, cast button)
- WordTooltip (drag, click, history navigation)

**Test Cases:**
- [x] Scroll sync (textarea.scrollTop → overlay.scrollTop)
- [x] Truesight toggle (instant, no flash)
- [x] Rapid text input (no lag)
- [x] Drag-click distinction on tooltip

**Edge Cases:**
- Truesight toggle during scroll
- Text input during async save
- Tooltip unmounts mid-drag
- Combat spell cast during navigation

---

## Edge Case Matrix

| Component | Edge Case | Test Status | Bytecode Error |
|-----------|-----------|-------------|----------------|
| **Button** | Click during unmount | ✅ Covered | `UI_STASIS-0E01` |
| **Button** | Async handler never resolves | ✅ Covered | `RANGE-0202` |
| **Button** | Disabled state flicker | ✅ Covered | Manual check |
| **Modal** | Escape during animation | ✅ Covered | Manual check |
| **Modal** | Trigger unmounts while open | ✅ Covered | Manual check |
| **Drag** | Element unmounts mid-drag | ✅ Covered | `UI_STASIS-0E05` |
| **Drag** | Pointer capture fails silently | ✅ Covered | `UI_STASIS-0E05` |
| **RAF** | Loop continues after unmount | ✅ Covered | `UI_STASIS-0E06` |
| **Interval** | Not cleared on unmount | ✅ Covered | `UI_STASIS-0E07` |
| **Focus** | Trap ignores Escape | ✅ Covered | `UI_STASIS-0E04` |
| **Event** | Listener leak | ✅ Covered | `UI_STASIS-0E03` |
| **Animation** | Exit animation interrupted | ✅ Covered | `UI_STASIS-0E02` |
| **State** | Concurrent updates race | ✅ Covered | `STATE-0303` |
| **Navigation** | Click during transition | ✅ Covered | Manual check |
| **Textarea** | Scroll sync desync | ✅ Covered | Manual check |
| **Truesight** | Toggle during input | ✅ Covered | Manual check |

---

## Recovery Invariants

### Click Handler Invariants

```javascript
// Invariant: Handler completes within timeout
handlerDuration < MAX_HANDLER_DURATION_MS

// Invariant: Button recovers to clickable state
button.disabled === false after handler completes

// Invariant: Loading state is transient
loadingStateDuration < LOADING_TIMEOUT_MS
```

### Animation Invariants

```javascript
// Invariant: Cleanup called on unmount
animationCleanupCalled === true

// Invariant: RAF loop stops on unmount
rafLoopRunning === false after unmount

// Invariant: Interval cleared on unmount
intervalCleared === true
```

### State Invariants

```javascript
// Invariant: State updates are atomic
intermediateStates are not observable

// Invariant: Final state is correct
finalState === expectedState after all updates

// Invariant: No state updates after unmount
stateUpdateCount === 0 after unmount
```

### Pointer Capture Invariants

```javascript
// Invariant: Pointer released on unmount
pointerCaptured === false after unmount

// Invariant: Lost capture handled gracefully
dragCancelled === true on lostpointercapture
```

---

## Visual Regression Strategy

### Baseline Images

Location: `tests/visual/baselines/`

| File | Component | State |
|------|-----------|-------|
| `button-default.png` | Button | Default |
| `button-loading.png` | Button | Loading (aria-busy) |
| `button-disabled.png` | Button | Disabled |
| `modal-open.png` | FloatingPanel | Open |
| `tooltip-pinned.png` | WordTooltip | Pinned |
| `truesight-active.png` | ScrollEditor | Truesight ON |
| `combat-spellbook.png` | Spellbook | Open |
| `combat-score-reveal.png` | ScoreReveal | Mid-reveal |

### Regression Detection

```bash
# Run visual regression tests
npm run test:visual

# Update baselines (after intentional changes)
npm run test:visual:update
```

### Stasis-Specific Baselines

| File | Description |
|------|-------------|
| `stasis-button-frozen.png` | Button stuck in loading state |
| `stasis-modal-escape.png` | Modal ignoring Escape key |
| `stasis-animation-orphan.png` | Animation continuing after unmount |
| `stasis-focus-trap.png` | Focus trap without escape |

---

## Performance Benchmarks

| Metric | Threshold | Test |
|--------|-----------|------|
| Click handler duration | <16ms (1 frame) | `tests/qa/ui-stasis-bytecode.test.js` |
| 100 clicks total | <1000ms | `tests/qa/ui-stasis-bytecode.test.js` |
| RAF callback duration | <4ms (1/4 frame) | `tests/qa/ui-stasis-bytecode.test.js` |
| Animation frame rate | ≥58fps | Manual (DevTools Performance) |
| Time to interactive | <3000ms | Lighthouse |
| First contentful paint | <1500ms | Lighthouse |

---

## Accessibility QA

### ARIA Compliance Checklist

- [ ] All icon-only buttons have `aria-label`
- [ ] Toggle buttons have `aria-pressed`
- [ ] Modals have `role="dialog"` and `aria-modal="true"`
- [ ] Loading states have `aria-busy="true"`
- [ ] Live regions use `aria-live="polite"` or `aria-live="assertive"`
- [ ] Focus traps trap focus correctly (Tab cycles)
- [ ] Escape key dismisses modals
- [ ] Focus returns to trigger on modal close
- [ ] All interactive elements are keyboard accessible
- [ ] Focus visible indicator present

### Screen Reader Testing

**Tools:** NVDA (Windows), VoiceOver (macOS)

**Test Scenarios:**
1. Navigate to Read page, enable Truesight
2. Open WordTooltip, pin it, navigate history
3. Cast spell in Combat, view score reveal
4. Open FloatingPanel, drag it, close it

**Announcements to Verify:**
- "Truesight enabled" / "Truesight disabled"
- "Word lookup: [word]"
- "Spell cast: [spell name]"
- "Score: [score]"
- "Panel opened" / "Panel closed"

### Reduced Motion Testing

```javascript
// Hook usage
const prefersReducedMotion = usePrefersReducedMotion();

// Animation conditional
const transition = prefersReducedMotion
  ? { duration: 0 }
  : { duration: 0.26, ease: "easeOut" };
```

**Test:** Enable "Reduce Motion" in OS settings, verify:
- [ ] No CSS animations play
- [ ] Framer Motion transitions are instant
- [ ] No parallax effects
- [ ] No aurora animation (or static fallback)

---

## Reporting & Triage

### Bytecode Error Report Template

```markdown
## UI Stasis Incident Report

**Bytecode:** `PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E01-...`

**Category:** UI_STASIS
**Severity:** CRIT
**Module:** UISTAS
**Error Code:** 0x0E01 (CLICK_HANDLER_STALL)

**Context:**
```json
{
  "elementId": "save-scroll-btn",
  "elementType": "button",
  "expectedState": "clickable",
  "actualState": "loading",
  "operation": "click-handler",
  "timeoutMs": 5000,
  "actualDuration": 8234
}
```

**Recovery Invariants:**
- `handlerDuration < MAX_HANDLER_DURATION_MS`
- `button.disabled === false after handler completes`

**Thematic Translation:**
> "The glyph refuses to answer touch. The word hangs suspended in the air."

**Steps to Reproduce:**
1. Navigate to Read page
2. Edit scroll text
3. Click Save button
4. Observe: Button remains in loading state indefinitely

**Expected:** Button recovers to clickable state after save completes (or error)
**Actual:** Button frozen in loading state, unresponsive to further clicks

**Fix:** Add timeout handling to save handler, ensure loading state clears on error
```

### Triage Priority Matrix

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| FATAL | Immediate | Angel + All Agents |
| CRIT | <4 hours | Claude + Codex |
| WARN | <24 hours | Claude |
| INFO | Next sprint | Blackbox (for test addition) |

### Blackbox Handoff

When a stasis bug is confirmed:

1. **File issue** with bytecode error in title
2. **Tag:** `ui-stasis`, `bytecode-error`, severity label
3. **Assign:** Claude (UI fix) or Codex (logic fix)
4. **Blackbox adds:** Regression test to prevent recurrence

**Example Issue Title:**
```
[CRIT] PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E01 — Save button freezes after network error
```

---

## Continuous Integration

### CI Pipeline

```yaml
# .github/workflows/qa.yml
name: QA Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test          # Unit tests
      - run: npm run test:qa       # QA stasis tests
      - run: npm run test:visual   # Visual regression
      - run: npm run lint          # ESLint
      - run: npm run build         # Verify build
```

### QA Test Command

```bash
# Run UI stasis tests specifically
npm run test:qa -- tests/qa/ui-stasis-bytecode.test.js
```

---

## Appendix A: Bytecode Error Quick Reference

| Code | Name | Severity | Description |
|------|------|----------|-------------|
| `0E01` | CLICK_HANDLER_STALL | CRIT | Click handler exceeds timeout |
| `0E02` | ANIMATION_LIFECYCLE_HANG | CRIT | Animation outlives component |
| `0E03` | EVENT_LISTENER_LEAK | CRIT | Listeners not cleaned up |
| `0E04` | FOCUS_TRAP_ESCAPE | WARN | Focus trap cannot be escaped |
| `0E05` | POINTER_CAPTURE_FAILURE | CRIT | Pointer capture lost mid-operation |
| `0E06` | RAF_LOOP_ORPHAN | CRIT | RAF loop continues after unmount |
| `0E07` | INTERVAL_TIMER_LEAK | CRIT | Interval not cleared on unmount |
| `0E08` | TRANSITION_INTERRUPT | WARN | Transition interrupted |

---

## Appendix B: Test File Index

| File | Purpose | Coverage |
|------|---------|----------|
| `tests/qa/ui-stasis-bytecode.test.js` | Main stasis test suite | Clickable, animations, race conditions, edge cases |
| `tests/visual/` | Visual regression baselines | Screenshot comparisons |
| `tests/a11y/` | Accessibility tests | ARIA, keyboard nav, screen reader |
| `tests/performance/` | Performance benchmarks | Click speed, animation frame budget |

---

## Appendix C: World-Law Thematic Translations

| Technical Error | Thematic Translation |
|-----------------|---------------------|
| `CLICK_HANDLER_STALL` | "The glyph refuses to answer touch." |
| `ANIMATION_LIFECYCLE_HANG` | "The spell continues casting after the mage has fallen." |
| `EVENT_LISTENER_LEAK` | "An ear floating in the void, still hearing." |
| `FOCUS_TRAP_ESCAPE` | "A prison without a key." |
| `POINTER_CAPTURE_FAILURE` | "The quill dropped mid-word." |
| `RAF_LOOP_ORPHAN` | "A zombie pulse, beating for no heart." |
| `INTERVAL_TIMER_LEAK` | "A clock ticking in an empty room." |
| `RACE_CONDITION` | "Two spells cast upon the same glyph." |

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-01  
**Owner:** Claude (UI Agent) + Blackbox (QA Agent)  
**Status:** Active
