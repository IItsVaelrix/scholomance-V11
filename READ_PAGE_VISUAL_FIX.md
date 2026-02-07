# Scholomance V10 - Read Page Visual Emergency Fix

## Problem Summary

The ReadPage currently fails as a tool because:

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| Text invisible | Low contrast gray on dark | WCAG failure |
| Layout crushed | No grid/flex system | Wasted space |
| No hierarchy | Equal-weight competing elements | Cognitive overload |
| No affordances | Flat design, no glow | Users can't find actions |
| Background banding | Gradient rendering artifact | Cheapens aesthetic |
| Passive feel | Manuscript display, not spell engine | Wrong emotional tone |

---

## Immediate Visual Fixes

### 1. Contrast Fix - Keep Dark Theme, Increase Visibility

```css
/* Replace current muted colors with higher contrast versions */

:root {
  /* Current (problematic) */
  --text: #eef0ff;           /* Actually okay */
  --muted: rgba(238, 240, 255, 0.70); /* TOO LOW CONTRAST */
  
  /* Fixed - maintain arcane feel but visible */
  --text-primary: #f8f9ff;   /* Near-white */
  --text-secondary: #c8cce8; /* Medium contrast - PASSES WCAG */
  --text-tertiary: #9aa4c0;  /* Lower hierarchy - for labels only */
  --text-muted: #6b7699;     /* Disabled/inactive only */
}

/* Apply semantic mapping */
.readPage .subtitle,
.readPage .page-title,
.readPage .scroll-item-preview {
  color: var(--text-secondary);
}

.readPage .editor-hint,
.readPage .stat-badge,
.readPage .page-number {
  color: var(--text-tertiary);
}

/* Disabled state only */
.readPage .editor-textarea:disabled,
.readPage .editor-title-input:disabled {
  color: var(--text-muted);
}
```

### 2. Layout Fix - Proper Content Zones

```css
/* Code layout - create distinct zones */
.codex-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-8);
  align-items: start;
  height: calc(100vh - 140px);
  max-height: calc(100vh - 140px);
  overflow: hidden;
}

.codex-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

.codex-main {
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

/* Editor needs to expand */
.scroll-editor,
.scroll-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.editor-textarea {
  flex: 1;
  min-height: 0;
}
```

### 3. Visual Hierarchy Fix - Clear Primary/Secondary

```css
/* Hierarchy tokens */
.readPage .title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.readPage .kicker {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--school-sonic); /* Accent color */
  margin-bottom: var(--space-1);
}

.readPage .subtitle {
  font-size: var(--text-base);
  font-weight: 400;
  color: var(--text-secondary);
  max-width: 50ch;
  line-height: 1.6;
}

/* Section headers in sidebar */
.scroll-list-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Instructions - smaller and clearly subordinate */
.scroll-empty p {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.scroll-empty span {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
```

### 4. Affordance Fix - Make Actions Visible

```css
/* Primary button - GLOWING and clear */
.btn-primary,
.grimoire-button,
.editor-btn--primary {
  background: linear-gradient(135deg, 
    var(--school-sonic-glow), 
    var(--school-psychic-glow));
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-weight: 600;
  text-shadow: 0 0 20px var(--school-sonic-glow);
  box-shadow: 
    0 4px 20px var(--school-sonic-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all var(--transition-base);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 8px 30px var(--school-sonic-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 
    0 4px 15px var(--school-sonic-glow);
}

/* Editor area - clearly interactive */
.editor-textarea {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  line-height: 1.8;
  transition: all var(--transition-base);
}

.editor-textarea:focus {
  outline: none;
  border-color: var(--school-sonic);
  box-shadow: 
    0 0 0 3px var(--school-sonic-glow),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.5);
}

.editor-textarea::placeholder {
  color: var(--text-tertiary);
  font-style: italic;
}

/* New scroll button - CLEAR CALL TO ACTION */
.new-scroll-btn {
  background: var(--bg-elevated);
  border: 2px solid var(--school-sonic-glow);
  color: var(--school-sonic);
  font-weight: 600;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all var(--transition-base);
}

.new-scroll-btn:hover {
  background: var(--school-sonic-glow);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px var(--school-sonic-glow);
}
```

### 5. Input/Editor Visibility Fix

```css
/* Editor container - elevated, glowing */
.scroll-editor {
  background: linear-gradient(180deg, 
    var(--bg-elevated) 0%, 
    var(--bg-surface) 100%);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Title input - looks active */
.editor-title-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--text-primary);
  transition: all var(--transition-base);
}

.editor-title-input:focus {
  outline: none;
  border-color: var(--school-sonic);
  box-shadow: 0 0 0 3px var(--school-sonic-glow);
  background: rgba(0, 0, 0, 0.5);
}

.editor-title-input::placeholder {
  color: var(--text-tertiary);
}

/* Stats badges - visible but subordinate */
.stat-badge {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
```

### 6. Background Banding Fix

```css
/* Current problematic gradient */
body {
  background: 
    radial-gradient(1200px 800px at 20% 10%, rgba(101, 31, 255, 0.20), transparent 60%),
    radial-gradient(1000px 700px at 80% 20%, rgba(0, 229, 255, 0.16), transparent 55%),
    radial-gradient(900px 700px at 60% 90%, rgba(255, 138, 0, 0.10), transparent 60%),
    linear-gradient(180deg, var(--bg-0), var(--bg-1));
}

/* Fixed - smoother gradients, no banding */
body {
  background: 
    radial-gradient(ellipse 80vw 60vh at 25% 15%, rgba(101, 31, 255, 0.25) 0%, transparent 50%),
    radial-gradient(ellipse 60vw 50vh at 75% 25%, rgba(0, 229, 255, 0.2) 0%, transparent 45%),
    radial-gradient(ellipse 70vw 40vh at 50% 85%, rgba(232, 121, 249, 0.15) 0%, transparent 40%),
    linear-gradient(180deg, var(--bg-void) 0%, var(--bg-deep) 50%, var(--bg-void) 100%);
  background-attachment: fixed;
}

/* Add subtle noise texture to break up gradient banding */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: -1;
}

/* Fix aurora - smoother animation */
.aurora-background {
  filter: blur(80px); /* Increased from 60px */
  animation: aurora-smooth 20s ease-in-out infinite alternate;
}

@keyframes aurora-smooth {
  0% { 
    transform: translate(-5%, -5%) scale(1.05);
    opacity: 0.6;
  }
  100% { 
    transform: translate(5%, 5%) scale(1.1);
    opacity: 0.8;
  }
}
```

### 7. Scroll List - Make Active State Clear

```css
/* Active scroll - clearly selected */
.scroll-item--active {
  background: rgba(129, 140, 248, 0.15);
  border: 1px solid var(--school-sonic-glow);
  box-shadow: 
    0 0 20px var(--school-sonic-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.scroll-item--active .scroll-item-title {
  color: var(--school-sonic);
}

/* Hover state - shows interactivity */
.scroll-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-soft);
  transform: translateX(4px);
}

/* Scroll list container */
.scroll-list {
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
}
```

---

## Complete CSS Override

Replace the relevant sections in `src/pages/Read/ReadPage.css` with this complete override:

```css
/* ========================================
   READ PAGE - VISUAL EMERGENCY FIX
   Applied: High contrast, clear hierarchy, strong affordances
   ======================================== */

.page-theme--read {
  /* Keep thematic colors but increase visibility */
  --parchment-light: #f8f9ff;
  --parchment-mid: #d8dcef;
  --parchment-dark: #a8b0c8;
  --leather-dark: #0a0a15;
  --leather-mid: #12122a;
  --leather-light: #1a1a3a;
  --gold-bright: #ffd700;
  --gold-dark: #b8860b;
  --ink-black: #f8f9ff;
  --ink-sepia: #c8cce8;
  --ink-faded: #8a96b8;
}

/* Layout - Full height with proper zones */
.readPage {
  min-height: 100vh;
  padding: var(--space-24) 0;
  display: grid;
  align-items: start;
  position: relative;
}

/* Header - Clear hierarchy */
.grimoire-header {
  margin-bottom: var(--space-8);
}

.grimoire-title {
  color: var(--text-primary);
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.grimoire-subtitle {
  color: var(--text-secondary);
  font-size: var(--text-base);
  max-width: 55ch;
  line-height: 1.6;
}

.illuminated-letter {
  color: var(--gold-bright);
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

/* Code Layout - Two distinct zones */
.codex-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-8);
  height: calc(100vh - 200px);
  max-height: calc(100vh - 200px);
  min-height: 600px;
}

.codex-sidebar {
  position: sticky;
  top: var(--space-24);
  height: fit-content;
  max-height: calc(100vh - 280px);
}

.codex-main {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Scroll List - Clear active state */
.scroll-list {
  background: rgba(10, 10, 25, 0.6);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(20px);
  max-height: 100%;
  overflow: hidden;
}

.scroll-list-header {
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid var(--border-subtle);
  padding: var(--space-4);
}

.scroll-list-title {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.scroll-count {
  background: var(--school-sonic-glow);
  color: white;
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
}

.new-scroll-btn {
  background: linear-gradient(135deg, var(--school-sonic-glow), var(--school-psychic-glow));
  border: none;
  color: white;
  font-weight: 600;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.new-scroll-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px var(--school-sonic-glow);
}

.scroll-item {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid transparent;
  margin: var(--space-2);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.scroll-item:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(4px);
}

.scroll-item--active {
  background: rgba(129, 140, 248, 0.15);
  border-color: var(--school-sonic-glow);
  box-shadow: 0 0 20px var(--school-sonic-glow);
}

.scroll-item-title {
  color: var(--text-primary);
  font-weight: 500;
}

.scroll-item-preview {
  color: var(--text-tertiary);
}

.scroll-empty {
  text-align: center;
  padding: var(--space-8);
}

.scroll-empty p {
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

/* Editor - Clearly interactive */
.scroll-editor {
  background: linear-gradient(180deg, 
    rgba(16, 16, 35, 0.95) 0%, 
    rgba(8, 8, 20, 0.98) 100%);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.editor-title-input {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-size: var(--text-lg);
  color: var(--text-primary);
  transition: all var(--transition-base);
}

.editor-title-input:focus {
  outline: none;
  border-color: var(--school-sonic);
  box-shadow: 0 0 0 3px var(--school-sonic-glow);
}

.editor-textarea {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  color: var(--text-primary);
  line-height: 1.8;
  min-height: 300px;
  transition: all var(--transition-base);
}

.editor-textarea:focus {
  outline: none;
  border-color: var(--school-sonic);
  box-shadow: 
    0 0 0 3px var(--school-sonic-glow),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.editor-footer {
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid var(--border-subtle);
  padding: var(--space-4);
  margin-top: var(--space-4);
  border-radius: var(--radius-lg);
}

.editor-btn--primary {
  background: linear-gradient(135deg, var(--school-sonic-glow), var(--school-psychic-glow));
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.editor-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px var(--school-sonic-glow);
}

.editor-hint {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

/* Grimoire Scroll - Active, not passive */
.grimoire-cover {
  background: linear-gradient(180deg, 
    var(--leather-light) 0%, 
    var(--leather-mid) 40%, 
    var(--leather-dark) 100%);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: 
    inset 8px 0 30px rgba(0, 0, 0, 0.5),
    0 25px 80px rgba(0, 0, 0, 0.7),
    0 0 60px rgba(139, 112, 53, 0.1);
}

.grimoire-text {
  font-family: Georgia, serif;
  font-size: var(--text-xl);
  color: var(--ink-black);
  line-height: 1.9;
}

.grimoire-word {
  color: var(--ink-black);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.grimoire-word:hover {
  background: rgba(212, 168, 75, 0.2);
  color: var(--gold-dark);
  box-shadow: 0 0 15px rgba(212, 168, 75, 0.3);
}

.grimoire-word:focus {
  outline: 2px solid var(--gold-dark);
  outline-offset: 2px;
}

/* Annotation Panel */
.aside--grimoire {
  background: linear-gradient(180deg, 
    var(--leather-dark) 0%, 
    var(--leather-mid) 100%);
  border-left: 3px solid var(--gold-dark);
}

.asideTitle {
  color: var(--text-primary);
  font-size: var(--text-2xl);
}

.statLabel {
  color: var(--gold-dark);
  font-weight: 600;
}

.statValue {
  color: var(--text-primary);
  font-size: var(--text-lg);
}

.phoneme-chip {
  background: rgba(212, 168, 75, 0.2);
  border: 1px solid rgba(212, 168, 75, 0.3);
  color: var(--gold-bright);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
}

.rhyme-key {
  color: var(--text-primary);
  font-weight: 600;
}

/* Placeholder */
.scroll-placeholder {
  background: linear-gradient(180deg, 
    var(--leather-light) 0%, 
    var(--leather-mid) 50%, 
    var(--leather-dark) 100%);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(212, 168, 75, 0.2);
  padding: var(--space-10);
  text-align: center;
}

.placeholder-sigil {
  font-size: var(--text-4xl);
  margin-bottom: var(--space-4);
  opacity: 0.6;
}

.scroll-placeholder h3 {
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.scroll-placeholder p {
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}
```

---

## Summary of Changes

| Issue | Before | After |
|-------|--------|-------|
| **Contrast** | Gray on dark (WCAG fail) | Secondary white (passes) |
| **Layout** | Crushed left, wasted space | 300px sidebar + expanding editor |
| **Hierarchy** | "Saved Scrolls" competes with title | Clear: Title → Subtitle → Actions |
| **Affordance** | Flat inputs, invisible buttons | Glowing buttons, bordered inputs |
| **Background** | Gradient banding | Smooth ellipses + noise texture |
| **Feel** | Passive manuscript display | Active spell engine |

---

## Quick Test Checklist

After applying these fixes:

- [ ] All text is readable without squinting
- [ ] Primary action (new scroll/editor) is immediately obvious
- [ ] Active scroll is clearly different from inactive
- [ ] No visible gradient banding
- [ ] Editor area looks like something you can type in
- [ ] Buttons look clickable with hover feedback
- [ ] Visual hierarchy guides eye: Title → Instructions → Editor → Controls

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Add new color tokens (text-secondary, text-tertiary), fix aurora animation |
| `src/pages/Read/ReadPage.css` | Replace with complete override above |
| `src/pages/Read/GrimoireScroll.jsx` | Update class names to match new CSS |
| `src/pages/Read/ScrollEditor.jsx` | May need minor class name updates |
| `src/pages/Read/ScrollList.jsx` | May need minor class name updates |

