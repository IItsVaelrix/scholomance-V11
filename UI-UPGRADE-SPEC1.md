# UI Upgrade Spec 1 — Professional Polish Pass

> **Status**: In Progress
> **Branch**: `claude/elegant-greider`
> **Scope**: CSS/layout fixes only — no architecture changes

---

## Summary

A professional design audit identified 6 specific areas of layout discipline, visual hierarchy, and cross-page consistency that prevent the Scholomance UI from reaching production-grade polish. The token architecture, accessibility, animation system, and dark theme are already excellent. These fixes address the last mile.

---

## Issue 1: No Unified Layout Grid System

**Severity**: Critical
**Effort**: Medium
**Impact**: Very High

### Problem

Each page decides its own width, padding, and alignment rules independently. The eye detects this inconsistency subconsciously — things don't "line up" across navigation transitions.

### Evidence

| Page | Current Approach |
|------|-----------------|
| `index.css` `.container` | `min()` width + `--space-4` inline padding |
| `NexusPage.css` | `max-width: 1200px; margin: 0 auto; padding: 40px 20px;` — hardcoded, ignores `.container` |
| `ProfilePage.css` | No container, `padding-top: 80px` hardcoded |
| `ListenPage.css` | Custom `.listen-shell` with `clamp()` padding |
| `AuthPage.css` | Custom `.auth-container max-width: 480px` |
| `CombatPage.css` | Full-bleed (correct) |
| `ReadPage (IDE)` | Full-bleed (correct) |

### Fix

1. Add `--page-gutter: clamp(1rem, 3vw, 2rem)` token
2. Update `.container` to use `--page-gutter` for `padding-inline`
3. Define two page archetypes:
   - **Full-bleed** (Read, Combat): no container, fills viewport
   - **Contained** (Listen, Watch, Nexus, Profile, Auth): uses `.container` with consistent gutter
4. Migrate NexusPage to use container pattern with design tokens

---

## Issue 2: Inconsistent Vertical Rhythm & Spacing Scale

**Severity**: Critical
**Effort**: Medium
**Impact**: High

### Problem

45+ non-standard font sizes scattered across IDE.css and CombatPage.css. Values like `0.6rem`, `0.62rem`, `0.63rem`, `0.65rem`, `0.67rem`, `0.68rem`, `0.7rem`, `0.72rem`, `0.8rem`, `0.82rem`. 25+ hardcoded pixel padding/gaps instead of `--space-*` tokens.

### Evidence

**IDE.css** — 20+ bespoke font sizes:
- `.progression-label`: `0.67rem`
- `.progression-xp`: `0.63rem`
- `.ide-atmos-btn`: `0.6rem`
- `.ide-statusbar`: `0.68rem`
- `.phoneme-chip`: `0.62rem`
- `.phoneme-chip-label`: `0.68rem`
- `.analysis-section-label`: `0.68rem`
- `.heuristic-item-label`: `0.65rem`
- `.panel-label`: `0.6rem`
- `.word-tooltip`: `0.7rem`

**CombatPage.css** — 15+ bespoke font sizes:
- `.combat-doctrine-tag`: `0.52rem`
- `.combat-doctrine-banner-label`: `0.5rem`
- `.combat-doctrine-banner-text`: `0.82rem`
- `.combat-doctrine-inline-card`: `0.76rem`, `0.56rem`

**Magic pixel values**: `4px`, `6px`, `7px`, `8px`, `14px` — instead of `--space-*` tokens.

### Fix

1. Add `--text-2xs: 0.625rem` to the type scale (covers the 0.5–0.68rem range)
2. Map all ad-hoc font sizes to tokens:
   - `0.46rem–0.68rem` → `var(--text-2xs)`
   - `0.69rem–0.78rem` → `var(--text-xs)`
   - `0.79rem–0.90rem` → `var(--text-sm)`
3. Replace all hardcoded pixel gaps/padding with nearest `--space-*` token

---

## Issue 3: Emoji Icons Instead of Proper Icon System

**Severity**: Important
**Effort**: Low
**Impact**: High

### Problem

Emoji rendering is uncontrollable across platforms. On Windows they render as colorful blobs. On macOS they render differently. They break visual consistency with the gold-on-dark palette.

### Evidence

- `Navigation.jsx` line 38: Theme toggle uses `☀️` / `🌙` emoji
- Sidebar tabs already use inline SVG (correct pattern in `ToolsSidebar.jsx`)
- Combat uses Unicode glyphs (`✦`, `∅`, `▶`) — world-law appropriate, not emoji

### Fix

Replace the sun/moon emoji in Navigation.jsx with inline SVG icons that:
- Respond to `currentColor`
- Match the `rgba(201, 168, 64, ...)` gold color system
- Follow the pattern already established in `ToolsSidebar.jsx` and `MobileTabBar`

---

## Issue 4: No Visual Hierarchy Between Page Types

**Severity**: Important
**Effort**: Medium
**Impact**: High

### Problem

Every page is its own unique snowflake. When navigating between pages, each one feels like a different application.

### Evidence

| Page | Header Pattern |
|------|---------------|
| Watch | `.section-header` with kicker/title/subtitle |
| Listen | Custom header with kicker/title/subtitle |
| Nexus | Minimal h1 + subtitle |
| Profile | No header |
| Auth | Header inside card |

### Fix

1. Fix `SectionHeader.jsx` class mismatch (`sectionHeader` → `section-header`)
2. Standardize dashboard pages (Listen, Nexus, Watch) to use consistent header pattern
3. Define 3 page archetypes:
   - **Immersive full-bleed**: Read (IDE), Combat — own chrome
   - **Dashboard/console**: Listen, Nexus, Profile, Watch — shared header skeleton
   - **Auth/modal**: Auth — centered narrow form

---

## Issue 5: Mixed Utility/Semantic CSS

**Severity**: Important
**Effort**: Medium
**Impact**: Medium

### Problem

Half the components use semantic BEM-style classes. The other half use Tailwind-style utility-class composition. This inconsistency signals a codebase that evolved organically rather than being designed.

### Evidence

- `Navigation.jsx`: `"nav-inner flex items-center justify-between"`
- `AuthPage.jsx`: `"auth-error text-xs font-mono mt-4 text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50"`
- IDE components use pure semantic CSS classes

### Fix

1. Migrate Navigation.jsx to semantic classes (CSS already defines the layout)
2. Migrate AuthPage.jsx worst offenders to semantic classes
3. Keep utility classes in `index.css` as internal building blocks but don't use directly in JSX

---

## Issue 6: Light Mode Is Undercooked

**Severity**: Important
**Effort**: Medium
**Impact**: Medium

### Problem

Dark mode is lovingly crafted with aurora layers, scanlines, vignettes, and depth shadows. Light mode is flat white with minimal treatment. Users who toggle see a completely different (and far less polished) application.

### Evidence

- Light mode body: just `background: #ffffff`
- Aurora AND vignette are `display: none` in light mode
- Duplicate `.glass` light-mode overrides (lines 269-273 AND 293-302)
- IDE.css light mode topbar uses `!important`

### Fix

1. Light mode base: warm parchment `#faf6ee` with subtle paper gradient
2. Remove duplicate `.glass` overrides (keep the dark-tint-on-white approach)
3. Remove duplicate aurora hide rule
4. Fix `!important` overrides by correcting CSS specificity
5. Apply warm parchment consistently across all IDE light-mode overrides

---

## What's Already Right

For the record, these are genuinely professional-grade already:

- Design token system — comprehensive, well-organized, fluid type scale
- 3D depth shadow system — multi-layer shadows creating real perceived depth
- Aurora parallax — 3-layer depth animation with translateZ and preserve-3d
- Accessibility layer — skip links, ARIA labels, reduced motion, forced colors, high contrast
- Dark theme palette — indigo-void → gold-parchment contrast
- IDE overlay sync technique — textarea/overlay mirror is technically precise
- Mobile responsiveness — bottom sheet, tab bar, safe areas, hamburger transitions
- Combat page architecture — Phaser + MUD terminal split
- Listen page — "radio station" metaphor is clever and well-implemented
- Framer Motion usage — page transitions, AnimatePresence, spring physics
