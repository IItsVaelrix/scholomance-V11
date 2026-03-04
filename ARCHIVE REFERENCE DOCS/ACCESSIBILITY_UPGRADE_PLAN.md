# Scholomance Accessibility Upgrade Plan (Reality-Based)

## Objective

Reach and maintain WCAG 2.1 AA-aligned behavior in active runtime surfaces by:

1. Auditing against current source of truth (not stale task lists).
2. Fixing real accessibility defects.
3. Enforcing an automated accessibility gate in CI.

---

## Verified Baseline

Verified on: **February 12, 2026**

Commands:

```bash
npx vitest run tests/accessibility.test.jsx
npm run lint
npm test -- --run
```

Result:

- `tests/accessibility.test.jsx`: **11/11 passing**
- Lint: **pass**
- Full test suite: **225/225 passing**

---

## Audit Outcome (Current Code Reality)

### Implemented and Present

- Skip link exists and is placed before navigation in `src/App.jsx`.
- Route-change focus management exists in `src/App.jsx` (`#main-content` receives focus).
- Reduced motion hook exists in `src/hooks/usePrefersReducedMotion.js` and is wired in `src/App.jsx`.
- Scroll list exposes selection semantics in `src/pages/Read/ScrollList.jsx` (`role="list"`, `role="listitem"`, active `aria-current`).
- Decorative Nixie tube is hidden from AT in `src/pages/Listen/NixieTube.jsx` (`aria-hidden="true"`).
- Listen station decorative indicators are hidden from AT in `src/pages/Listen/ListenPage.jsx`.

### Stale or Non-Applicable Items from Prior Plan

- References to `src/pages/Read/AnnotationPanel.jsx` are stale for current runtime. Active floating analysis UI is implemented via `src/components/shared/FloatingPanel.jsx`.
- Several “remaining tasks” in the previous plan were already complete in source and no longer actionable.

---

## Remediation Implemented in This Pass

### 1) Runtime hardening: avoid undefined dynamic station lists

**File:** `src/pages/Listen/ListenPage.jsx`

- Added safe defaults in ambient player destructuring:
  - `playableSchools = []`
  - `dynamicSchools = []`

Why:

- Prevents runtime and test crashes when hook payloads are partial.

### 2) Dialog semantics + keyboard dismissal for floating panels

**File:** `src/components/shared/FloatingPanel.jsx`

- Added explicit accessibility semantics to panel root:
  - `role` (default `"dialog"`)
  - `aria-labelledby` (panel title)
  - optional `aria-label`
  - optional `aria-modal`
- Added Escape-key close behavior when `onClose` is provided.
- Added prop typing for new accessibility props.

Why:

- Floating analysis panels are interactive overlays and need consistent role/name/keyboard behavior.

### 3) Accessibility test suite stabilization and expansion

**File:** `tests/accessibility.test.jsx`

- Replaced brittle provider/network-dependent setup with deterministic mocked hooks.
- Added stable checks for:
  - App shell axe scan
  - Grimoire keyboard semantics
  - ScrollEditor axe + labeled controls
  - Navigation landmark + active-link `aria-current`
  - ListenPage axe + live region
  - FloatingPanel dialog semantics + Escape dismissal

Why:

- Prior failures were dominated by harness/provider mismatches, not accessibility regressions.

### 4) Strict CI accessibility gate

**File:** `.github/workflows/test.yml`

- Added dedicated step:

```yaml
- name: Run accessibility test suite
  run: npx vitest run tests/accessibility.test.jsx
```

Why:

- Accessibility regressions now fail CI explicitly before broader tests complete.

### 5) Documentation alignment

**File:** `README.md`

- Added explicit accessibility verification command in testing strategy.
- Added accessibility test run to pre-push checklist.

Why:

- Local workflow now matches CI policy.

---

## Accessibility Gate (Required for Merge)

1. `npx vitest run tests/accessibility.test.jsx` passes.
2. `npm run lint` passes (includes `jsx-a11y` rules).
3. `npm test -- --run` passes.

---

## Remaining Work (Manual QA Track)

Automated checks are passing, but these remain manual acceptance checks:

1. Keyboard-only navigation through Watch, Listen, Read, Auth, and Collab pages.
2. Screen-reader pass (NVDA on Windows): route changes, status announcements, panel interactions.
3. Reduced-motion behavior validation with OS-level `prefers-reduced-motion: reduce`.
4. High-contrast mode verification on Windows (`forced-colors: active`).

These are tracked as manual QA and should be executed for release candidates.

---

## Change Log

- 2026-02-12: Replaced stale accessibility plan with reality-based baseline and enforced CI gate.
