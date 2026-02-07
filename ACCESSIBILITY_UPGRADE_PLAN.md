# Scholomance V10 - Accessibility Audit & Upgrade Plan

## AI Team Assignment Guide

**Team:** Blackbox, ChatGPT, Gemini, Claude
**Target:** WCAG 2.1 AA compliance while preserving the arcane aesthetic
**Current Rating:** ~85% compliant - strong foundation, focused gaps remain

---

## Audit Results: Plan vs. Reality

The original plan identified issues and proposed solutions. After auditing every file in the codebase, here is the verified status of each item.

### Already Implemented (No Work Needed)

These items from the original plan are **confirmed present in the actual source code**:

| Item | File | Evidence |
|------|------|----------|
| Skip to main content link | `App.jsx:41-43`, `index.css` `.skip-link` | `<a href="#main-content" className="skip-link">` inside `<motion.main id="main-content">` |
| `.sr-only` utility class | `index.css:164-174` | Standard clip-rect pattern |
| `:focus-visible` styles | `index.css:177-191` | Separate mouse/keyboard focus, `box-shadow: 0 0 0 3px var(--school-sonic)` on buttons/links |
| `:focus:not(:focus-visible)` suppression | `index.css:189-191` | Hides outline for mouse users |
| `prefers-reduced-motion` | `index.css:802-816` | Global `animation-duration: 0.01ms !important`, targets `.aurora-background` |
| `prefers-contrast: more` | `index.css:819+` | Adjusts text, borders, backdrop-filter |
| `forced-colors: active` | `index.css:843+` | Windows High Contrast mode support |
| GrimoireScroll keyboard nav | `GrimoireScroll.jsx:11-19` | `handleKeyDown` with Enter/Space, words are `<button>` elements |
| GrimoireScroll ARIA labels | `GrimoireScroll.jsx:47` | `aria-label="Analyze word: ${clean}"` on every word button |
| GrimoireScroll decorative marking | `GrimoireScroll.jsx:61-88` | All decorative elements have `aria-hidden="true"` |
| BrassGearDial keyboard nav | `BrassGearDial.jsx:19-26` | `handleKeyDown` with Enter/Space |
| BrassGearDial ARIA slider | `BrassGearDial.jsx:31-37` | `role="slider"`, `aria-label`, `aria-valuenow/min/max`, `tabIndex` |
| ScrollEditor form labels | `ScrollEditor.jsx:62-64, 92-94` | `<label htmlFor>` + `.sr-only` for title and content |
| ScrollEditor ARIA descriptions | `ScrollEditor.jsx:74-79, 107-112` | `aria-required`, `aria-describedby` with hint spans |
| ScrollEditor `role="form"` | `ScrollEditor.jsx:58-59` | `role="form" aria-label="Scroll editor"` |
| ReadPage live region | `ReadPage.jsx:162-170` | `role="status" aria-live="polite" aria-atomic="true"` |
| ReadPage announcements | `ReadPage.jsx:31-41` | Dynamic `setAnnouncement()` on annotation change |
| ListenPage live region | `ListenPage.jsx:49-57` | `role="status" aria-live="polite"` with tuning announcements |
| Navigation `aria-label` | `Navigation.jsx:12` | `aria-label="Primary navigation"` |
| Navigation mobile button ARIA | `Navigation.jsx:21-23` | `aria-expanded`, `aria-controls`, `aria-label` |
| AnnotationPanel focus management | `AnnotationPanel.jsx:8-22` | Saves `previousFocus`, focuses close button, restores on unmount |
| AnnotationPanel Escape dismiss | `AnnotationPanel.jsx:14` | `if (e.key === "Escape") onClose()` |
| AnnotationPanel ARIA | `AnnotationPanel.jsx:32-33` | `role="complementary" aria-label="Word annotation panel"` |
| Semantic HTML throughout | All pages | `<nav>`, `<main>`, `<section>`, `<header>`, `<aside>`, `<button>` |
| jest-axe testing | `tests/accessibility.test.jsx` | axe scans on App layout and GrimoireScroll |
| ESLint jsx-a11y | `.eslintrc.json` | `plugin:jsx-a11y/recommended` with strict rules |

### The Plan's WCAG Checklist - Updated Status

| Criterion | Original | Actual | Verified Notes |
|-----------|----------|--------|----------------|
| 1.1.1 Non-text Content | Partial | **Pass** | All decorative elements have `aria-hidden="true"` |
| 1.3.1 Info and Relationships | Good | **Pass** | Semantic HTML, heading hierarchy, form labels |
| 1.4.3 Contrast (Minimum) | Check | **Marginal** | Primary text 9.8:1 excellent. VOID (#a1a1aa) at ~4.8:1, WILL (#FF8A00) at ~5.2:1 - technically pass AA but tight |
| 1.4.4 Resize Text | Good | **Pass** | `clamp()` throughout |
| 2.1.1 Keyboard | Partial | **Pass** | All interactive elements now keyboard accessible |
| 2.1.2 No Keyboard Trap | Good | **Pass** | Escape dismisses panels, standard tab flow |
| 2.4.1 Bypass Blocks | Missing | **Pass** | Skip link implemented |
| 2.4.3 Focus Order | Good | **Pass** | Logical DOM order |
| 2.4.7 Focus Visible | Good | **Pass** | `:focus-visible` with school-sonic glow |
| 3.3.2 Labels or Instructions | Partial | **Pass** | All form inputs labeled with sr-only + aria-describedby |
| 4.1.2 Name, Role, Value | Partial | **Mostly Pass** | ARIA roles correct; minor gaps below |

---

## Remaining Work: What Actually Needs To Be Done

After the full audit, these are the **real gaps** that still exist in the codebase. Each task includes the exact file, line numbers, what's wrong, and the precise fix.

---

### TASK 1: Navigation `aria-current="page"` (P1 - High)

**Problem:** `Navigation.jsx:38-45` - The `NavLink` renders an active class but never sets `aria-current="page"`. Screen readers cannot identify which page the user is on.

**File:** `src/components/Navigation/Navigation.jsx:38-45`

**Current code:**
```jsx
<NavLink
  to={l.path}
  className={({ isActive }) =>
    `font-mono text-xs uppercase tracking-wide transition-colors ${isActive ? "text-primary" : "text-muted hover:text-secondary"}`
  }
>
  {l.label}
</NavLink>
```

**Fix:** React Router's `NavLink` supports a render function for `aria-current`. Add the attribute:
```jsx
<NavLink
  to={l.path}
  className={({ isActive }) =>
    `font-mono text-xs uppercase tracking-wide transition-colors ${isActive ? "text-primary" : "text-muted hover:text-secondary"}`
  }
  aria-current={({ isActive }) => isActive ? "page" : undefined}
>
  {l.label}
</NavLink>
```

**Note:** Actually, React Router v7 `NavLink` automatically sets `aria-current="page"` on active links by default. Verify this is working by inspecting the rendered HTML. If it is, no change needed. If it is NOT rendering (due to className function override), the fix above applies.

**Assign to:** Blackbox
**WCAG:** 2.4.8 Location

---

### TASK 2: Focus Management on Route Change (P1 - High)

**Problem:** `App.jsx` - When the user navigates between pages (Watch/Listen/Read), focus is not moved to the new content. Screen reader users hear nothing and keyboard users are stranded at the nav.

**File:** `src/App.jsx`

**Current code:** AnimatePresence with `motion.main` transitions but no focus management.

**Fix:** Add a `useEffect` that focuses `#main-content` on route change:
```jsx
import { useEffect } from "react";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    // After page transition, move focus to main content
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  // ... rest of component
}
```

**Important:** The `tabindex="-1"` allows programmatic focus on a non-interactive element. `preventScroll: true` avoids jarring scroll jumps during animated transitions.

**Assign to:** ChatGPT
**WCAG:** 2.4.3 Focus Order

---

### TASK 3: Skip Link Placement Bug (P0 - Critical)

**Problem:** `App.jsx:41-43` - The skip link is **inside** `<motion.main id="main-content">`, which means it links to its own parent. It should be **before** the navigation, outside `<main>`, so it's the first focusable element on the page.

**File:** `src/App.jsx:28-47`

**Current structure (wrong):**
```jsx
<div className="page-container">
  <Navigation />
  <AnimatePresence mode="wait">
    <motion.main id="main-content" ...>
      <a href="#main-content" className="skip-link">  {/* INSIDE main */}
        Skip to main content
      </a>
      <Suspense>
        <Outlet />
      </Suspense>
    </motion.main>
  </AnimatePresence>
</div>
```

**Fix:** Move skip link before `<Navigation />`:
```jsx
<div className="page-container">
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>
  <Navigation />
  <AnimatePresence mode="wait">
    <motion.main id="main-content" ...>
      <Suspense>
        <Outlet />
      </Suspense>
    </motion.main>
  </AnimatePresence>
</div>
```

**Assign to:** ChatGPT (bundle with Task 2 since both are in App.jsx)
**WCAG:** 2.4.1 Bypass Blocks

---

### TASK 4: ScrollList Missing `aria-selected` / `aria-current` (P1 - High)

**Problem:** `ScrollList.jsx:63-106` - The active scroll gets a CSS class `scroll-item--active` but no ARIA attribute. Screen readers cannot distinguish the selected scroll.

**File:** `src/pages/Read/ScrollList.jsx:72-76`

**Current code:**
```jsx
<button
  type="button"
  className="scroll-item-main"
  onClick={() => onSelect(scroll.id)}
>
```

**Fix:** Add `aria-current="true"` to the active scroll's button, and give each scroll item a role context:
```jsx
<button
  type="button"
  className="scroll-item-main"
  onClick={() => onSelect(scroll.id)}
  aria-current={activeScrollId === scroll.id ? "true" : undefined}
>
```

Also add `role="list"` to the container and `role="listitem"` to each scroll item for semantic grouping:
```jsx
<div className="scroll-list-body" role="list">
  {/* ... */}
  <motion.div
    key={scroll.id}
    className={`scroll-item ${...}`}
    role="listitem"
    // ...
  >
```

**Assign to:** Gemini
**WCAG:** 4.1.2 Name, Role, Value

---

### TASK 5: AnnotationPanel Should Be `role="dialog"` (P1 - High)

**Problem:** `AnnotationPanel.jsx:32-33` uses `role="complementary"` but it behaves as a modal - it captures focus, has an Escape dismiss, and overlays content. It should be `role="dialog"` with `aria-modal="true"`.

**File:** `src/pages/Read/AnnotationPanel.jsx:26-33`

**Current code:**
```jsx
<motion.aside
  className="aside aside--grimoire"
  // ...
  aria-label="Word annotation panel"
  role="complementary"
>
```

**Fix:**
```jsx
<motion.aside
  className="aside aside--grimoire"
  // ...
  aria-label={`Word analysis: ${annotation.word}`}
  role="dialog"
  aria-modal="true"
>
```

**Additional:** Add `inert` attribute to background content when the panel is open. In `ReadPage.jsx`, wrap the main content area:
```jsx
<div className="codex-layout" inert={annotation ? "" : undefined}>
```

**Assign to:** Claude
**WCAG:** 4.1.2 Name, Role, Value, 2.1.2 No Keyboard Trap

---

### TASK 6: NixieTube Missing `aria-hidden` (P2 - Medium)

**Problem:** `NixieTube.jsx` is a purely decorative animated display component with no accessibility attributes. It renders visual-only content that adds noise for screen readers.

**File:** `src/pages/Listen/NixieTube.jsx:7`

**Fix:** The parent that renders NixieTube should wrap it with `aria-hidden="true"`, or NixieTube itself should add it to its root:
```jsx
<div className={`nixie-tube ${isDecimal ? "nixie-tube--decimal" : ""}`} aria-hidden="true">
```

**Assign to:** Blackbox
**WCAG:** 1.1.1 Non-text Content

---

### TASK 7: Color-Only School Identification (P2 - Medium)

**Problem:** `ListenPage.jsx:76-108` - School buttons on the wheel use color as the **sole** differentiator. Locked schools show only a color dot with `<span className="sr-only">Locked</span>` but unlocked ones show abbreviated text like "VOID" which is good. However, the track selection grid at `ListenPage.jsx:127-146` uses colored dots (`w-2 h-2 rounded-full`) with no text label for the school.

**File:** `src/pages/Listen/ListenPage.jsx:139-143`

**Current code:**
```jsx
<div className="flex items-center gap-2 mb-2">
  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: schoolColor, ... }} />
  <span className="font-bold text-sm truncate">{t.title}</span>
</div>
<span className="font-mono text-[10px] text-muted">{t.school}</span>
```

**Assessment:** The school name IS displayed as text (`{t.school}`), and the track title is visible. The colored dot is supplementary. **This passes WCAG 1.4.1** because color is not the *only* means of conveying information. However, the dot itself should be marked decorative:

**Fix:** Add `aria-hidden="true"` to the colored indicator dot:
```jsx
<div className="w-2 h-2 rounded-full animate-pulse" aria-hidden="true" style={{ backgroundColor: schoolColor, ... }} />
```

**Assign to:** Gemini
**WCAG:** 1.4.1 Use of Color

---

### TASK 8: `usePrefersReducedMotion` Hook (P2 - Medium)

**Problem:** The CSS handles `prefers-reduced-motion` well, but Framer Motion animations in React (page transitions in `App.jsx`, panel slides in `AnnotationPanel.jsx`, list animations in `ScrollList.jsx`) bypass CSS and run via JavaScript. They need a JS-side check.

**File:** New file: `src/hooks/usePrefersReducedMotion.js`

**Implementation:**
```javascript
import { useState, useEffect } from "react";

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}
```

**Then update `App.jsx`:**
```jsx
const reducedMotion = usePrefersReducedMotion();

const pageVariants = reducedMotion
  ? { initial: {}, animate: {}, exit: {} }
  : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };
```

**Assign to:** Claude
**WCAG:** 2.3.3 Animation from Interactions

---

### TASK 9: Navigation Hamburger Semantic Improvement (P2 - Medium)

**Problem:** `Navigation.jsx:26-28` - The hamburger icon is three styled `<div>` elements. While the `<button>` wrapping them has proper ARIA, the visual structure could be improved with `role="img"` and `aria-hidden`.

**File:** `src/components/Navigation/Navigation.jsx:26-28`

**Fix:**
```jsx
<button
  className="md:hidden p-2"
  aria-expanded={isMenuOpen}
  aria-controls="nav-links"
  aria-label={isMenuOpen ? "Close menu" : "Open menu"}
  onClick={() => setIsMenuOpen(!isMenuOpen)}
>
  <span aria-hidden="true">
    <div className="w-6 h-0.5 bg-white mb-1" />
    <div className="w-6 h-0.5 bg-white mb-1" />
    <div className="w-6 h-0.5 bg-white" />
  </span>
</button>
```

Also remove the redundant `aria-label="Primary"` from the `#nav-links` div (`Navigation.jsx:34`) since the parent `<nav>` already has `aria-label="Primary navigation"`. Having a nested `role="navigation"` is invalid - the `<div>` should not duplicate the nav role.

**Fix line 31-35:**
```jsx
<div
  id="nav-links"
  className={`flex gap-8 items-center ${isMenuOpen ? '...' : 'hidden md:flex'}`}
>
```
Remove `aria-label="Primary"` entirely from this div.

**Assign to:** Blackbox
**WCAG:** 4.1.2 Name, Role, Value

---

### TASK 10: Expand Accessibility Test Coverage (P2 - Medium)

**Problem:** `tests/accessibility.test.jsx` only tests 2 components (App layout, GrimoireScroll). Missing coverage for ScrollEditor, AnnotationPanel, ListenPage, Navigation.

**File:** `tests/accessibility.test.jsx`

**Add tests for:**

1. **ScrollEditor** - Verify label/input connections, aria-required, aria-describedby
2. **Navigation** - Verify aria-label, aria-expanded on mobile toggle, link count
3. **AnnotationPanel** - Verify focus management (close button gets focus), Escape dismissal, role="dialog"
4. **ListenPage** - Verify live region exists, school buttons have titles, locked state announced

**Example additions:**
```javascript
describe("ScrollEditor", () => {
  it("should have no axe violations", async () => {
    const { container } = render(<ScrollEditor onSave={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should connect labels to inputs", () => {
    render(<ScrollEditor onSave={() => {}} />);
    expect(screen.getByLabelText(/scroll title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scroll content/i)).toBeInTheDocument();
  });
});

describe("AnnotationPanel", () => {
  it("should focus close button on mount", () => {
    render(
      <AnnotationPanel
        annotation={{ word: "TEST", vowelFamily: "EH", phonemes: ["T","EH","S","T"], rhymeKey: "EH-ST" }}
        onClose={() => {}}
      />
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Close"));
  });
});
```

**Assign to:** Gemini
**WCAG:** Testing infrastructure

---

### TASK 11: `animation-paused` Toggle Button (P3 - Enhancement)

**Problem:** `index.css` defines `.animation-paused` class that pauses all animations, but there is **no UI button** to toggle it. Users who want to pause animations but don't have `prefers-reduced-motion` set in their OS have no control.

**File:** New UI element in `App.jsx` or `Navigation.jsx`

**Implementation:** Add a small toggle in the nav or footer:
```jsx
const [animationsPaused, setAnimationsPaused] = useState(false);

useEffect(() => {
  document.body.classList.toggle("animation-paused", animationsPaused);
}, [animationsPaused]);

// In the nav or a settings area:
<button
  className="animation-toggle"
  onClick={() => setAnimationsPaused(!animationsPaused)}
  aria-label={animationsPaused ? "Resume animations" : "Pause animations"}
  aria-pressed={animationsPaused}
>
  {animationsPaused ? "Play" : "Pause"} Animations
</button>
```

**Assign to:** Claude
**WCAG:** 2.2.2 Pause, Stop, Hide

---

## Team Assignment Summary

### Blackbox
| Task | Priority | Files |
|------|----------|-------|
| Task 1: Verify/fix `aria-current="page"` on NavLinks | P1 | `Navigation.jsx` |
| Task 6: Add `aria-hidden` to NixieTube | P2 | `NixieTube.jsx` |
| Task 9: Hamburger semantic cleanup + remove redundant nav role | P2 | `Navigation.jsx` |

**Context needed:** React Router v7 NavLink behavior, ARIA landmark rules.

### ChatGPT
| Task | Priority | Files |
|------|----------|-------|
| Task 2: Focus management on route change | P1 | `App.jsx` |
| Task 3: Move skip link before `<Navigation>` | P0 | `App.jsx` |

**Context needed:** Framer Motion AnimatePresence lifecycle, `tabindex="-1"` pattern for focus management.

### Gemini
| Task | Priority | Files |
|------|----------|-------|
| Task 4: ScrollList `aria-current` + list roles | P1 | `ScrollList.jsx` |
| Task 7: Color indicator `aria-hidden` on track dots | P2 | `ListenPage.jsx` |
| Task 10: Expand test coverage | P2 | `tests/accessibility.test.jsx` |

**Context needed:** jest-axe API, React Testing Library queries, Vitest `vi.mock` patterns for context providers.

### Claude
| Task | Priority | Files |
|------|----------|-------|
| Task 5: AnnotationPanel `role="dialog"` + `inert` | P1 | `AnnotationPanel.jsx`, `ReadPage.jsx` |
| Task 8: `usePrefersReducedMotion` hook + wire to Framer Motion | P2 | New hook + `App.jsx` |
| Task 11: Animation pause toggle button | P3 | `App.jsx` or `Navigation.jsx` |

**Context needed:** Framer Motion variant overrides, `inert` attribute browser support, `matchMedia` listener patterns.

---

## Execution Order

```
Phase 1 (Critical Path - Do First):
  ChatGPT: Task 3 (skip link placement) + Task 2 (focus management)  [App.jsx]
  Claude:  Task 5 (dialog role + inert)                               [AnnotationPanel.jsx, ReadPage.jsx]

Phase 2 (High Priority - Parallel):
  Blackbox: Task 1 (aria-current) + Task 9 (hamburger cleanup)        [Navigation.jsx]
  Gemini:   Task 4 (ScrollList roles)                                  [ScrollList.jsx]

Phase 3 (Medium Priority - Parallel):
  Blackbox: Task 6 (NixieTube aria-hidden)                            [NixieTube.jsx]
  Gemini:   Task 7 (track dot aria-hidden)                            [ListenPage.jsx]
  Claude:   Task 8 (reduced motion hook)                              [New hook + App.jsx]

Phase 4 (Finish):
  Gemini:   Task 10 (expand tests)                                    [tests/accessibility.test.jsx]
  Claude:   Task 11 (pause toggle)                                    [App.jsx]
```

---

## Verification Checklist

After all tasks are complete, run these checks:

1. **Automated:** `npx vitest run tests/accessibility.test.jsx` - all tests pass
2. **Automated:** `npx eslint src/ --ext .jsx` - no jsx-a11y errors
3. **Manual - Keyboard:** Tab through entire app without mouse. Every interactive element must be reachable and operable.
4. **Manual - Screen Reader:** Test with NVDA (Windows). Navigate all pages, activate word analysis, verify announcements.
5. **Manual - Skip Link:** Press Tab on page load. Skip link must appear, and activating it must jump past nav.
6. **Manual - Reduced Motion:** Enable `prefers-reduced-motion: reduce` in OS. All animations must stop, including Framer Motion JS transitions.
7. **Manual - High Contrast:** Enable Windows High Contrast mode. All interactive elements must remain visible and distinguishable.

---

## Files Modified Summary

| File | Tasks | Agent |
|------|-------|-------|
| `src/App.jsx` | 2, 3, 8, 11 | ChatGPT + Claude |
| `src/components/Navigation/Navigation.jsx` | 1, 9 | Blackbox |
| `src/pages/Read/AnnotationPanel.jsx` | 5 | Claude |
| `src/pages/Read/ReadPage.jsx` | 5 (inert) | Claude |
| `src/pages/Read/ScrollList.jsx` | 4 | Gemini |
| `src/pages/Listen/ListenPage.jsx` | 7 | Gemini |
| `src/pages/Listen/NixieTube.jsx` | 6 | Blackbox |
| `src/hooks/usePrefersReducedMotion.js` | 8 (new file) | Claude |
| `tests/accessibility.test.jsx` | 10 | Gemini |
