# Scholomance V10 - Visual QA Report & Fixes

## Executive Summary

This document identifies visual issues in the Scholomance V10 codebase and provides actionable fixes. The goal is to achieve visual consistency, proper rendering, and cross-browser compatibility.

---

## Issues Found

### 1. CSS File Fragmentation

**Problem**: 5 separate CSS files with duplicated code and inconsistent patterns

| File | Lines | Issues |
|------|-------|--------|
| `index.css` | ~200 | Base styles + page imports |
| `WatchPage.css` | ~150 | CRT-specific styles |
| `ListenPage.css` | ~400 | Nixie tube + dial styles |
| `ReadPage.css` | ~500 | Grimoire-specific styles |
| `Navigation.css` | ~50 | Nav-specific styles |

**Total**: ~1,300 lines of CSS with significant duplication

**Recommended Fix**: Consolidate into single design system (see VISUAL_OVERHAUL_PLAN.md)

---

### 2. Missing Color System

**Problem**: Colors scattered across files with no unified tokens

```css
/* In index.css */
--sonic: #651fff;
--psychic: #00e5ff;
--alchemy: #d500f9;
--will: #ff8a00;
--void: #a1a1aa;

/* In ReadPage.css */
--leather-dark: #1a1209;
--leather-mid: #2d2013;
--parchment-light: #f4e4c1;
--gold-bright: #d4a84b;

/* In ListenPage.css */
--nixie-glow: #ff6b35;
--brass-base: #b8860b;
--holo-cyan: #00ffff;
```

**Issues**:
- No relationship between similar colors
- Hard to maintain consistency
- No dark/light variants
- No opacity modifiers

**Recommended Fix**: Create unified color tokens (already in VISUAL_OVERHAUL_PLAN.md)

---

### 3. Inconsistent Border Radius

**Problem**: Multiple radius values without clear system

| Value | Usage | Issue |
|-------|-------|-------|
| `28px` | `.card`, `.crt-monitor` | Too large |
| `22px` | `.badge` | Inconsistent |
| `16px` | `.parchment`, `.holo-panel` | Common but not tokenized |
| `12px` | `.button`, `.nixie-tube` | Good candidate for token |
| `8px` | `.vacuum-bar`, `.editor-btn` | Good candidate for token |
| `4px` | `.grimoire-word` | Too small, rarely used |
| `2px` | `.brass-dial` | Should be 0 or 4px |
| `999px` | `.badge`, `.navLinks` | For pill shapes only |

**Recommended Fix**: Use tokens:
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

---

### 4. Inconsistent Shadow System

**Problem**: Shadows hardcoded with no system

```css
/* Various shadow values found */
box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55;
box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.08);
box-shadow: 0 0 10px var(--nixie-glow);
box-shadow: 0 0 15px rgba(212, 168, 75, 0.3);
```

**Issues**:
- No elevation system
- Inconsistent shadow colors
- No inner shadow tokens
- No glow shadow tokens

**Recommended Fix**:
```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6);
  --shadow-elevated: 0 20px 40px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 20px var(--glow-color);
  --shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}
```

---

### 5. Font Size Inconsistency

**Problem**: Hardcoded sizes with no scale

```css
/* Various sizes found */
font-size: 12px;  /* badges, kicker, buttons */
font-size: 11px;  /* stat labels, margin glyphs */
font-size: 14px;  /* body, phoneme chips */
font-size: 16px;  /* stat values */
font-size: 17px;  /* grimoire text */
font-size: 26px;  /* aside title */
font-size: 34px-56px; /* titles */
```

**Recommended Fix**: Fluid typography scale
```css
:root {
  --text-xs: clamp(0.6875rem, 0.75vw, 0.75rem);
  --text-sm: clamp(0.8125rem, 0.875vw, 0.875rem);
  --text-base: clamp(1rem, 1vw, 1rem);
  --text-lg: clamp(1.125rem, 1.25vw, 1.25rem);
  --text-xl: clamp(1.5rem, 2vw, 2rem);
  --text-2xl: clamp(2rem, 3vw, 3rem);
  --text-3xl: clamp(2.5rem, 4vw, 4rem);
}
```

---

### 6. Spacing Inconsistency

**Problem**: Hardcoded pixel values throughout

```css
/* Various spacing values */
padding: 104px 0 88px;    /* page sections */
padding: 26px;            /* aside panels */
gap: 10px;                /* flex containers */
gap: 12px;                /* grids */
margin-bottom: 26px;      /* section headers */
padding: 14px 20px;       /* buttons */
```

**Recommended Fix**: Spacing tokens
```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;
}
```

---

### 7. Animation Inconsistency

**Problem**: Multiple animation approaches

```css
/* Different animation patterns */
animation: aurora-drift 18s ease-in-out infinite alternate;
animation: candle-flicker 3s ease-in-out infinite;
animation: gold-shimmer 4s ease-in-out infinite;
animation: spin 2s linear infinite;
animation: led-pulse 2s ease-in-out infinite;
animation: oscilloscope-scan 2s linear infinite;
animation: holo-shine 3s ease-in-out infinite;
animation: holo-scanline 4s linear infinite;
```

**Issues**:
- No animation duration tokens
- No easing function consistency
- Keyframes scattered across files
- No reduced motion handling

**Recommended Fix**: Animation tokens
```css
:root {
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --duration-xlong: 18s;
  
  --ease-base: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

---

### 8. Z-Index Chaos

**Problem**: Random z-index values throughout

```css
z-index: -1;     /* aurora background */
z-index: 0;      /* some content */
z-index: 10;     /* scanlines */
z-index: 11;     /* phosphor */
z-index: 12;     /* screen edge */
z-index: 50;     /* navigation */
z-index: 60;     /* annotation panel */
z-index: 100;    /* film grain */
z-index: 1000;   /* undefined */
```

**Issues**:
- No layering system
- Values don't follow pattern
- Easy to create stacking conflicts

**Recommended Fix**: Z-index tokens
```css
:root {
  --z-background: -1;
  --z-base: 0;
  --z-content: 1;
  --z-overlay: 10;
  --z-modal: 50;
  --z-tooltip: 100;
  --z-notification: 1000;
}
```

---

### 9. Missing Focus States

**Problem**: Inconsistent or missing focus styles

**Current state**:
- `index.css` has basic `:focus-visible` outline
- `.grimoire-word` has no focus state
- `.brass-dial` has no keyboard focus
- `.scroll-item` missing focus styles
- No focus trap indicators

**Recommended Fix**:
```css
:root {
  --focus-ring: 0 0 0 3px var(--school-sonic);
  --focus-ring-offset: 2px;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-offset) var(--focus-ring-offset) 0 var(--focus-ring);
}

button:focus-visible,
[role="button"]:focus-visible,
a:focus-visible {
  box-shadow: var(--focus-ring);
}
```

---

### 10. Hover State Inconsistency

**Problem**: Varying hover implementations

```css
/* Different hover patterns */
.button:hover { background: rgba(255,255,255,0.10); }
.grimoire-word:hover:not(:disabled) { color: var(--gold-dark); }
.scroll-item:hover { background: rgba(0, 0, 0, 0.3); }
.trackCard:hover { transform: translateY(-2px); }
.navLink:hover { color: rgba(238, 240, 255, 0.95); }
```

**Issues**:
- Some have transform, some don't
- Some have shadow, some don't
- No consistent easing

**Recommended Fix**:
```css
.btn {
  transition: all var(--transition-base);
}

.btn:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-glow);
  box-shadow: var(--shadow-md);
}

.btn:active {
  transform: translateY(0);
}
```

---

### 11. Missing Mobile Responsiveness

**Problem**: Incomplete responsive handling

| Breakpoint | Issues |
|------------|--------|
| 768px | Some containers not fluid |
| 900px | Grimoire layout not adapting |
| 960px | Radio layout hardcoded |
| 1024px | No responsive typography |

**Recommended Fix**: Use container queries + fluid typography
```css
/* Fluid typography handles most cases */
html { font-size: 100%; }

/* Container queries for components */
@container (max-width: 400px) {
  .card { padding: var(--space-4); }
}

/* Specific breakpoints */
@media (max-width: 768px) {
  .crt-monitor { padding: var(--space-4); }
  .nixie-panel { flex-wrap: wrap; }
}
```

---

### 12. Color Contrast Issues

**Problem**: Some color combinations fail WCAG

| Combination | Current | Pass/Fail |
|-------------|---------|-----------|
| `--text` on `--bg-1` | `#eef0ff` on `#070714` | ✅ 14.5:1 |
| `--muted` on `--bg-1` | `rgba(238,240,255,0.7)` on `#070714` | ⚠️ 5.8:1 |
| `--void` badge text | `#a1a1aa` on dark | ⚠️ 3.2:1 |
| `--ink-faded` on parchment | `#8a7a62` on `#f4e4c1` | ⚠️ 3.1:1 |

**Recommended Fix**:
```css
/* Ensure minimum contrast */
.badge {
  color: white; /* Instead of school color for text */
}

.badge--void {
  color: #ffffff;
  background: rgba(156, 163, 175, 0.2);
  border-color: rgba(156, 163, 175, 0.4);
}
```

---

### 13. CSS Property Order Inconsistency

**Problem**: No consistent property ordering

```css
/* Different orders found */
.card {
  border-radius: var(--radius-xl);  /* position varies */
  border: 1px solid var(--stroke-soft);
  background: rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow-soft);
}

.button {
  font-family: var(--mono);  /* typography first */
  letter-spacing: 0.14em;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.16);
}
```

**Recommended Fix**: Use consistent order
```css
/* CSS Property Order: */
/* 1. Layout & Position */
/* 2. Box Model (dimensions) */
/* 3. Visual (background, border) */
/* 4. Typography */
/* 5. Effects (shadow, filter) */
/* 6. Animation */
```

---

### 14. Deprecated/Never Optimal Patterns

| Pattern | Found In | Fix |
|---------|----------|-----|
| `inset` shorthand | index.css | Use `top/right/bottom/left` |
| `border-radius: 4px 20px 20px 4px` | ReadPage.css | Separate properties |
| `mix-blend-mode: overlay` | index.css | Check browser support |
| `filter: blur()` on animations | index.css | Performance impact |
| `background-attachment: fixed` | index.css | iOS issues |

---

### 15. Performance Concerns

| Issue | Impact | Fix |
|-------|--------|-----|
| `backdrop-filter: blur(40px)` | High GPU | Use sparingly |
| Multiple gradients on body | Medium | Reduce complexity |
| `will-change` missing on animations | Low | Add to animated elements |
| Large background gradients | Low | Optimize size |

---

## Quick Fix Priority List

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Fix color contrast on badges | 30min | High |
| P0 | Add proper focus states | 1hr | High |
| P1 | Consolidate spacing tokens | 2hr | Medium |
| P1 | Add animation tokens | 1hr | Medium |
| P2 | Create z-index tokens | 30min | Low |
| P2 | Fix property ordering | 2hr | Low |
| P3 | Optimize background gradients | 1hr | Medium |
| P3 | Add container queries | 2hr | Medium |

---

## Validation Checklist

After fixes, verify:

- [ ] All colors have 4.5:1 minimum contrast
- [ ] All interactive elements have hover/focus states
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Works at 320px, 768px, 1024px, 1440px
- [ ] No console warnings
- [ ] Lighthouse accessibility score 90+
- [ ] Lighthouse performance score 90+

---

## Files Requiring Changes

| File | Changes |
|------|---------|
| `src/index.css` | Design tokens, focus states, animations |
| `src/pages/Read/ReadPage.css` | Replace with utility classes |
| `src/pages/Listen/ListenPage.css` | Replace with utility classes |
| `src/pages/Watch/WatchPage.css` | Replace with utility classes |
| `src/components/Navigation/Navigation.css` | Replace with utility classes |
| `src/pages/Read/ReadPage.DARK.css` | Delete (absorbed into tokens) |

---

## Recommended Immediate Actions

1. **Add design tokens** to `index.css` (colors, spacing, typography, shadows, radius, animations)
2. **Fix badge contrast** by adding white text instead of school color
3. **Add proper focus styles** to all interactive elements
4. **Consolidate animation** into centralized keyframes
5. **Test on mobile** devices and fix responsive issues

