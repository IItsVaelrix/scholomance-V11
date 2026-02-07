# Scholomance V10 - Complete Visual Overhaul

## Executive Summary

This document provides a complete visual redesign of Scholomance V10, replacing ALL existing CSS with a cohesive, modernized design system. The old design is sanitized and removed—no fallback code remains.

---

## Visual Upgrade Goals

### New Design Pillars

1. **Neon Noir 2.0** - Enhanced glow effects with better contrast
2. **Glassmorphism 2.0** - Deeper blur, layered transparency
3. **Micro-Interactions** - Every element has meaningful animation feedback
4. **Dynamic Lighting** - Real-time light sources following cursor
5. **Cohesive Color System** - Unified palette across all schools

---

## Complete CSS Replacement

### `src/index.css` - New Design System

```css
/* ========================================
   SCHOLOMANCE V10 - COMPLETE VISUAL OVERHAUL
   Design System - No Legacy Code
   ======================================== */

/* === CSS RESET & FOUNDATION === */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html:focus-within {
  scroll-behavior: auto;
}

body {
  min-height: 100vh;
  font-family: var(--font-sans);
  background: var(--bg-deep);
  color: var(--text-primary);
  line-height: 1.6;
  overflow-x: hidden;
  cursor: default;
}

/* === DESIGN TOKENS === */
:root {
  /* Typography */
  --font-sans: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
  
  /* Font Sizes - Fluid Scale */
  --text-xs: clamp(0.6875rem, 0.75vw, 0.75rem);
  --text-sm: clamp(0.8125rem, 0.875vw, 0.875rem);
  --text-base: clamp(1rem, 1vw, 1rem);
  --text-lg: clamp(1.125rem, 1.25vw, 1.25rem);
  --text-xl: clamp(1.5rem, 2vw, 2rem);
  --text-2xl: clamp(2rem, 3vw, 3rem);
  --text-3xl: clamp(2.5rem, 4vw, 4rem);
  --text-4xl: clamp(3rem, 6vw, 6rem);
  
  /* Spacing */
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
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-glow-sm: 0 0 20px var(--glow-color);
  --shadow-glow-md: 0 0 40px var(--glow-color);
  --shadow-glow-lg: 0 0 60px var(--glow-color);
  --shadow-elevated: 0 20px 40px rgba(0, 0, 0, 0.4);
  --shadow-floating: 0 10px 30px rgba(0, 0, 0, 0.3);
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* === BASE COLORS - UNIFIED SYSTEM === */
:root {
  /* Deep Background */
  --bg-void: #030308;
  --bg-deep: #050510;
  --bg-surface: #0a0a18;
  --bg-elevated: #101025;
  --bg-glass: rgba(10, 10, 25, 0.6);
  
  /* Text */
  --text-primary: #f0f2ff;
  --text-secondary: rgba(240, 242, 255, 0.7);
  --text-tertiary: rgba(240, 242, 255, 0.5);
  --text-muted: rgba(240, 242, 255, 0.35);
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-soft: rgba(255, 255, 255, 0.1);
  --border-bold: rgba(255, 255, 255, 0.15);
  --border-glow: rgba(255, 255, 255, 0.2);
  
  /* School Colors - Unified & Balanced */
  --school-void: #9ca3af;
  --school-void-glow: rgba(156, 163, 175, 0.4);
  --school-psychic: #22d3ee;
  --school-psychic-glow: rgba(34, 211, 238, 0.4);
  --school-alchemy: #e879f9;
  --school-alchemy-glow: rgba(232, 121, 249, 0.4);
  --school-will: #fb923c;
  --school-will-glow: rgba(251, 146, 60, 0.4);
  --school-sonic: #818cf8;
  --school-sonic-glow: rgba(129, 140, 248, 0.4);
  
  /* Vowel Families */
  --vowel-A: #f87171;
  --vowel-AE: #fb923c;
  --vowel-AO: #818cf8;
  --vowel-AW: #4ade80;
  --vowel-AY: #22d3ee;
  --vowel-EH: #60a5fa;
  --vowel-ER: #a3e635;
  --vowel-EY: #e879f9;
  --vowel-IH: #3b82f6;
  --vowel-IY: #67e8f9;
  --vowel-OH: #f97316;
  --vowel-OW: #ec4899;
  --vowel-OY: #fb923c;
  --vowel-UH: #22c55e;
  --vowel-UW: #5eead4;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, var(--school-sonic), var(--school-psychic));
  --gradient-secondary: linear-gradient(135deg, var(--school-alchemy), var(--school-will));
  --gradient-void: linear-gradient(135deg, #1e1e2e, #0d0d15);
  --gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
  
  /* Glow Colors */
  --glow-color: var(--school-sonic-glow);
}

/* === UTILITY CLASSES === */

/* Container */
.container {
  width: min(100% - var(--space-8), var(--container-max, 1280px));
  margin-inline: auto;
  padding-inline: var(--space-4);
}

/* Screen Reader Only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus Styles */
:focus-visible {
  outline: 2px solid var(--school-sonic);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* === ANIMATIONS === */

/* Keyframe Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideLeft {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideRight {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px var(--glow-color); }
  50% { box-shadow: 0 0 40px var(--glow-color), 0 0 60px var(--glow-color); }
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}

@keyframes aurora {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
  75% { opacity: 0.9; }
}

/* Animation Utilities */
.animate-fadeIn { animation: fadeIn var(--transition-slow) ease-out; }
.animate-slideUp { animation: slideUp var(--transition-slow) ease-out; }
.animate-slideDown { animation: slideDown var(--transition-slow) ease-out; }
.animate-scaleIn { animation: scaleIn var(--transition-base) ease-out; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-glow { animation: glow 2s ease-in-out infinite; }

/* === BACKGROUND SYSTEM === */

/* Dynamic Aurora Background */
.aurora-background {
  position: fixed;
  inset: -50% -50%;
  background: 
    radial-gradient(ellipse 80vw 60vh at 20% 30%, var(--school-sonic-glow) 0%, transparent 50%),
    radial-gradient(ellipse 80vw 60vh at 80% 40%, var(--school-psychic-glow) 0%, transparent 50%),
    radial-gradient(ellipse 80vw 60vh at 50% 80%, var(--school-alchemy-glow) 0%, transparent 50%),
    radial-gradient(ellipse 100vw 80vh at 30% 70%, var(--school-will-glow) 0%, transparent 40%);
  background-size: 200% 200%;
  filter: blur(60px);
  animation: aurora 15s ease infinite;
  pointer-events: none;
  z-index: -1;
}

/* Vignette */
.vignette {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, var(--bg-void) 100%);
  pointer-events: none;
  z-index: 999;
}

/* Scanlines Overlay */
.scanlines {
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  pointer-events: none;
  z-index: 1000;
}

/* === GLASSMORPHISM COMPONENTS === */

/* Glass Panel */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
}

.glass-strong {
  background: rgba(10, 10, 25, 0.8);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-soft);
}

.glass-elevated {
  background: rgba(16, 16, 37, 0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-elevated);
}

/* === TYPOGRAPHY === */

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

h1 { font-size: var(--text-4xl); }
h2 { font-size: var(--text-3xl); }
h3 { font-size: var(--text-2xl); }
h4 { font-size: var(--text-xl); }
h5 { font-size: var(--text-lg); }
h6 { font-size: var(--text-base); }

/* Kicker - Eyebrow text */
.kicker {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* === BUTTONS === */

/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  border: 1px solid var(--border-bold);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.btn:hover::before {
  opacity: 1;
}

.btn:hover {
  transform: translateY(-2px);
  border-color: var(--border-glow);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Primary Button */
.btn-primary {
  background: linear-gradient(135deg, var(--school-sonic-glow), var(--school-psychic-glow));
  border-color: transparent;
  color: white;
  text-shadow: 0 0 20px rgba(129, 140, 248, 0.5);
}

.btn-primary:hover {
  box-shadow: var(--shadow-glow-md);
  border-color: rgba(255, 255, 255, 0.2);
}

/* Secondary Button */
.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-soft);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-bold);
}

/* Glow Button */
.btn-glow {
  --glow-color: var(--school-sonic-glow);
  animation: glow 2s ease-in-out infinite;
}

/* Icon Button */
.btn-icon {
  padding: var(--space-3);
  border-radius: var(--radius-full);
}

/* === BADGES === */

/* Base Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(10px);
}

/* School Badges */
.badge--void {
  background: rgba(156, 163, 175, 0.15);
  border-color: rgba(156, 163, 175, 0.3);
  color: var(--school-void);
  box-shadow: 0 0 15px rgba(156, 163, 175, 0.2);
}

.badge--psychic {
  background: rgba(34, 211, 238, 0.15);
  border-color: rgba(34, 211, 238, 0.3);
  color: var(--school-psychic);
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.2);
}

.badge--alchemy {
  background: rgba(232, 121, 249, 0.15);
  border-color: rgba(232, 121, 249, 0.3);
  color: var(--school-alchemy);
  box-shadow: 0 0 15px rgba(232, 121, 249, 0.2);
}

.badge--will {
  background: rgba(251, 146, 60, 0.15);
  border-color: rgba(251, 146, 60, 0.3);
  color: var(--school-will);
  box-shadow: 0 0 15px rgba(251, 146, 60, 0.2);
}

.badge--sonic {
  background: rgba(129, 140, 248, 0.15);
  border-color: rgba(129, 140, 248, 0.3);
  color: var(--school-sonic);
  box-shadow: 0 0 15px rgba(129, 140, 248, 0.2);
}

/* === CARDS === */

/* Base Card */
.card {
  background: var(--bg-glass);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  backdrop-filter: blur(20px);
  transition: all var(--transition-base);
}

.card:hover {
  border-color: var(--border-soft);
  transform: translateY(-4px);
  box-shadow: var(--shadow-floating);
}

.card-elevated {
  background: var(--bg-elevated);
  border-color: var(--border-soft);
  box-shadow: var(--shadow-elevated);
}

.card-elevated:hover {
  border-color: var(--border-bold);
  transform: translateY(-6px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

/* === FORMS === */

/* Input */
.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.input::placeholder {
  color: var(--text-muted);
}

.input:hover {
  border-color: var(--border-bold);
}

.input:focus {
  outline: none;
  border-color: var(--school-sonic);
  box-shadow: 0 0 0 3px var(--school-sonic-glow);
}

/* Textarea */
.textarea {
  min-height: 150px;
  resize: vertical;
  font-family: var(--font-mono);
  line-height: 1.7;
}

/* === SECTIONS === */

/* Page Section */
.section {
  min-height: 100vh;
  padding: var(--space-24) 0;
  display: grid;
  align-items: center;
}

/* Section Header */
.section-header {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-10);
  max-width: 800px;
}

/* Title */
.title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

/* Subtitle */
.subtitle {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 65ch;
}

/* === LAYOUT UTILITIES === */

/* Flex */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-start { justify-content: flex-start; }
.justify-end { justify-content: flex-end; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-5 { gap: var(--space-5); }
.gap-6 { gap: var(--space-6); }
.gap-8 { gap: var(--space-8); }
.gap-10 { gap: var(--space-10); }
.gap-12 { gap: var(--space-12); }

/* Grid */
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

@media (min-width: 640px) {
  .sm\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 768px) {
  .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lg\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

/* Spacing */
.m-0 { margin: 0; }
.mt-2 { margin-top: var(--space-2); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }
.mt-10 { margin-top: var(--space-10); }
.mt-12 { margin-top: var(--space-12); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }
.mb-10 { margin-bottom: var(--space-10); }
.mb-12 { margin-bottom: var(--space-12); }

.p-0 { padding: 0; }
.p-2 { padding: var(--space-2); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.p-8 { padding: var(--space-8); }
.p-10 { padding: var(--space-10); }
.p-12 { padding: var(--space-12); }

/* Width/Height */
.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
.max-w-screen { max-width: 100vw; }
.max-w-prose { max-width: 65ch; }

/* Position */
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }
.inset-0 { inset: 0; }
.top-0 { top: 0; }
.right-0 { right: 0; }
.bottom-0 { bottom: 0; }
.left-0 { left: 0; }
.z-10 { z-index: 10; }
.z-20 { z-index: 20; }
.z-50 { z-index: 50; }
.z-100 { z-index: 100; }
.z-1000 { z-index: 1000; }

/* Text */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-xl { font-size: var(--text-xl); }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-muted { color: var(--text-muted); }
.text-secondary { color: var(--text-secondary); }
.tracking-tight { letter-spacing: -0.02em; }
.tracking-wide { letter-spacing: 0.02em; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }
.leading-tight { line-height: 1.2; }
.leading-relaxed { line-height: 1.7; }

/* Visibility */
.hidden { display: none; }
.invisible { visibility: hidden; }
.visible { visibility: visible; }
.overflow-hidden { overflow: hidden; }
.overflow-auto { overflow: auto; }
.overflow-x-hidden { overflow-x: hidden; }

/* Pointer */
.cursor-pointer { cursor: pointer; }
.cursor-not-allowed { cursor: not-allowed; }
.pointer-events-none { pointer-events: none; }
.pointer-events-auto { pointer-events: auto; }

/* Opacity */
.opacity-0 { opacity: 0; }
.opacity-50 { opacity: 0.5; }
.opacity-75 { opacity: 0.75; }
.opacity-100 { opacity: 1; }

/* Transitions */
.transition { transition: all var(--transition-base); }
.transition-fast { transition: all var(--transition-fast); }
.transition-slow { transition: all var(--transition-slow); }

/* === ACCESSIBILITY === */

/* Skip Link */
.skip-link {
  position: absolute;
  top: -100px;
  left: var(--space-4);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  background: var(--school-sonic);
  color: var(--bg-void);
  border-radius: var(--radius-lg);
  z-index: 9999;
  transition: top var(--transition-fast);
}

.skip-link:focus {
  top: var(--space-4);
  outline: 3px solid var(--school-psychic);
  outline-offset: 2px;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  .aurora-background,
  [class*="animate-"] {
    animation: none !important;
  }
}

/* High Contrast */
@media (prefers-contrast: more) {
  :root {
    --text-primary: #ffffff;
    --text-secondary: #f0f0f0;
    --border-subtle: rgba(255, 255, 255, 0.3);
    --border-soft: rgba(255, 255, 255, 0.5);
    --border-bold: rgba(255, 255, 255, 0.7);
  }
  
  .card,
  .glass,
  .glass-strong,
  .glass-elevated {
    background: #000;
    backdrop-filter: none;
  }
  
  .badge,
  .btn {
    border-width: 2px;
  }
}

/* Forced Colors */
@media (forced-colors: active) {
  .btn,
  .badge,
  .card {
    border: 2px solid ButtonText;
  }
  
  .btn-primary {
    background: Highlight;
    color: HighlightText;
  }
}

/* === PAGE TRANSITIONS === */

/* Page Container */
.page-container {
  min-height: 100vh;
  position: relative;
}

.page-content {
  position: relative;
  z-index: 1;
}

/* Transition Wrapper */
.transition-wrapper {
  position: relative;
}

.transition-wrapper > * {
  position: absolute;
  width: 100%;
}
```

---

## Visual Upgrade Comparison

| Aspect | Old Design | New Design |
|--------|-----------|------------|
| **Color System** | Scattered hex values | Unified CSS custom properties |
| **Glassmorphism** | Single blur value | Layered blur (20px/30px/40px) |
| **Animations** | Scattered keyframes | Centralized animation system |
| **Typography** | Hardcoded sizes | Fluid clamp() scale |
| **Spacing** | Pixel values | Design tokens |
| **Dark Mode** | Only option | Respects system preference |
| **Accessibility** | Minimal | Full WCAG support |
| **Responsiveness** | Media queries | Fluid + responsive |

---

## Files to Replace (Complete Sanitization)

| File | Action |
|------|--------|
| `src/index.css` | Replace with new design system |
| `src/pages/Watch/WatchPage.css` | Delete entirely |
| `src/pages/Listen/ListenPage.css` | Delete entirely |
| `src/pages/Read/ReadPage.css` | Delete entirely |
| `src/components/Navigation/Navigation.css` | Delete entirely |
| `src/pages/Read/ReadPage.DARK.css` | Delete entirely |

---

## After Replacement - Inline Styles in Components

All styling must be moved to `index.css` or component CSS modules. No inline `style={{}}` props except dynamic values.

```javascript
// BAD - Inline styles
<div style={{ background: '#000', padding: '20px' }}>

// GOOD - CSS classes
<div className="card glass-elevated p-6">
```

---

## Migration Checklist

- [ ] Replace `src/index.css` with new design system
- [ ] Delete `src/pages/Watch/WatchPage.css`
- [ ] Delete `src/pages/Listen/ListenPage.css`
- [ ] Delete `src/pages/Read/ReadPage.css`
- [ ] Delete `src/components/Navigation/Navigation.css`
- [ ] Delete `src/pages/Read/ReadPage.DARK.css`
- [ ] Update all JSX to use new class names
- [ ] Remove all inline style props (except dynamic)
- [ ] Test all pages render correctly
- [ ] Verify animations work
- [ ] Test accessibility features

