# PDR: Lexicon Oracle — Aesthetic Refinement & Data Visualization Overhaul

**Subtitle:** Transform the Lexicon Oracle from functional terminal into a living grimoire surface

**Status:** Draft
**Classification:** UI + Data Visualization + Animation
**Priority:** High
**Primary Goal:** Refine the Lexicon Oracle's data analytical visualization into an aesthetically compelling grimoire surface with cinematic submit animation, while maintaining functional correctness.

---

## 1. Executive Summary

The Lexicon Oracle (`src/pages/Read/SearchPanel.jsx`) is functionally complete — it queries words, streams definitions, shows rhyme families, scroll resonance, and astrology traces. But its data visualization is a flat terminal readout: stacked sections with monospace labels and basic grids. This PDR defines a visual overhaul that transforms the Oracle into a **living grimoire surface** — where data breathes, glyphs pulse, and the submit action feels like casting a spell.

---

## 2. Problem Statement

**Current state:**
- Data is displayed as flat text blocks in stacked sections (01–06)
- Summary grids are basic 2×2 or 4-column layouts with no visual hierarchy
- Channel groups (rhyme families, echoes) are plain token banks with no differentiation
- No visual encoding of data relationships (phoneme similarity, school affinity, resonance strength)
- Submit animation is a simple boot-line reveal — functional but not memorable
- No school-themed theming — the Oracle looks the same regardless of which school is active
- Scroll resonance occurrences are just clickable links — no visual map of where the word lives in the scroll

**Impact:**
- The Oracle feels like a debug console, not a ritual instrument
- Data relationships are invisible — users must read text to understand connections
- The submit action lacks the "word as weapon" feeling central to Scholomance's identity
- School theming is absent — the Oracle doesn't respond to the living syntax universe

---

## 3. Product Goal

Transform the Lexicon Oracle into a **visually rich data grimoire** where:
1. **Submit animation** — A cinematic sequence: word dissolves into phonemes, phonemes scatter into school-colored glyphs, glyphs converge into the result surface
2. **Data visualization** — Phonetic relationships encoded visually: vowel families as color, consonant clusters as shape, resonance strength as opacity/size
3. **School theming** — The Oracle's surface responds to the active school's CSS variables
4. **Scroll resonance map** — A visual representation of where the word appears in the scroll, not just a list of line numbers
5. **Channel encoding** — Rhyme families, slant echoes, and assonance links visually differentiated by tone, shape, and motion

---

## 4. Non-Goals

- **Not** changing the data sources or API contracts — the lexicon, rhyme, and astrology data shapes remain unchanged
- **Not** adding new data fields — we visualize what already exists
- **Not** modifying the search/query logic — functional correctness is preserved
- **Not** a new component — this is a visual refinement of the existing Oracle

---

## 5. Core Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Data is glyph** | Every data point should feel like a carved rune — not a table cell. Phonetic families get color, resonance gets pulse, definitions get weight. |
| **Motion reveals** | Animation doesn't decorate — it reveals structure. Phonemes scatter to show decomposition. Glyphs converge to show synthesis. |
| **School is surface** | The Oracle's visual language responds to the active school's CSS variables. SONIC = purple aurora, PSYCHIC = cyan scanlines, etc. |
| **Hierarchy through light** | Important data glows. Secondary data dims. Tertiary data is implied, not shown. |
| **Terminal is sacred** | The monospace terminal aesthetic is preserved but elevated — scanlines become aurora, boot lines become incantations. |

---

## 6. Feature Overview

### 6.1 Submit Animation — "Word Dissolution Sequence"

When the user presses Enter or clicks "resolve":

**Phase 1: Dissolution (300ms)**
- The query word fractures into individual letters
- Each letter lifts off the input line with slight random offset
- Letters dissolve into their phoneme components (e.g., "dusk" → /d/ /ʌ/ /s/ /k/)

**Phase 2: Scattering (400ms)**
- Phonemes scatter outward in a radial burst
- Vowel phonemes take the active school's color
- Consonant phonemes take a neutral silver tone
- Each phoneme leaves a fading trail

**Phase 3: Convergence (500ms)**
- Scattered phonemes spiral inward toward the center
- They converge into the Oracle's result surface
- The surface "ignites" with a radial glow pulse
- Boot lines stream in as the result loads

**Phase 4: Reveal (200ms)**
- The result sections stream in with staggered timing
- Each section header (01–06) pulses with a gold accent
- The word appears in the summary cell with a final glow

**Reduced motion:** Collapses to a simple fade-in (0.3s).

### 6.2 Data Visualization — Section by Section

#### Section 01: Capability Truth (Summary)
**Current:** 4-cell grid with word/class/ipa/echo key
**Proposed:**
- Word displayed as a **large glyph** with school-colored underline
- IPA rendered as **phoneme chips** — each phoneme is a colored button (vowel = school color, consonant = silver)
- Echo key displayed as a **rune badge** with subtle glow
- Class displayed as a **textured label** (noun = solid, verb = dashed, adj = dotted border)

#### Section 02: Archive Stack (Definitions)
**Current:** Numbered list of definition strings
**Proposed:**
- Each definition gets a **weight indicator** — primary definition glows gold, secondary dims
- Definitions with multiple senses get **branch indicators** (├─ └─) showing semantic tree
- Hover reveals the **etymology trace** as a tooltip

#### Section 03: Measured Reality (Scroll Context)
**Current:** 4-cell grid + list of line links
**Proposed:**
- **Resonance map** — A horizontal bar showing the scroll's length, with markers at each occurrence position
- Markers pulse with intensity based on occurrence count
- Vowel family displayed as a **color swatch** with school glyph overlay
- School displayed as a **badge** with the school's actual visual identity (not just text)
- Occurrences displayed as **position cards** — mini previews of the surrounding text context

#### Section 04: Signal Channels (Rhyme Families)
**Current:** Grouped token banks with tone labels
**Proposed:**
- Each channel gets a **visual identity**:
  - Perfect rhyme: solid border, gold glow
  - Slant rhyme: dashed border, amber glow
  - Assonance: dotted border, school-color glow
  - Consonance: double border, silver glow
- Tokens within each channel sized by **phoneme similarity score**
- Channel headers get **waveform indicators** — mini SVG waves showing the phoneme pattern match
- Tokens arranged in a **constellation layout** — closer tokens are more similar

#### Section 05: Astrology Trace
**Current:** 2-cell grid + token bank with scores
**Proposed:**
- Sign displayed as a **zodiac glyph** with animated rotation
- Cluster count displayed as a **star field** — each cluster is a star, sized by match count
- Top matches displayed as a **radar chart** — each match positioned by its score dimensions
- Scores displayed as **progress arcs** instead of percentages

#### Section 06: Live Resonance
**Current:** Interactive list of resonance links with type/line/score
**Proposed:**
- Resonance links displayed as a **frequency spectrum** — bars sized by score, colored by type
- Each bar is clickable — clicking jumps to the line
- Type labels (perfect/slant/assonance) displayed as **colored indicators** on each bar
- Hover reveals the **full context line** as a tooltip

### 6.3 School Theming

The Oracle's surface responds to the active school:

| School | Aurora Color | Scanline Pattern | Glyph Accent |
|--------|-------------|------------------|--------------|
| SONIC | Purple (#a855f7) | Vertical wave | ♪ |
| PSYCHIC | Cyan (#06b6d4) | Diagonal cross | ◈ |
| ALCHEMY | Magenta (#d946ef) | Hexagonal grid | ⬡ |
| WILL | Orange (#f97316) | Radial burst | ◎ |
| VOID | Zinc (#71717a) | Static noise | ✦ |

Applied to:
- Background gradient overlay
- Phoneme chip colors
- Channel glow colors
- Submit animation particle colors
- Section header accent colors

---

## 7. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Lexicon Oracle (SearchPanel.jsx)                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Submit Animation Controller                          │  │
│  │  - WordDissolve (letters → phonemes)                  │  │
│  │  - PhonemeScatter (radial burst)                      │  │
│  │  - GlyphConverge (spiral inward)                      │  │
│  │  - SurfaceIgnite (radial glow)                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ 01 Summary  │ │ 02 Archive  │ │ 03 Measured Reality │   │
│  │ - Glyph     │ │ - Weight    │ │ - Resonance map     │   │
│  │ - Phonemes  │ │ - Branch    │ │ - Position cards    │   │
│  │ - Rune      │ │ - Etymology │ │ - School badge      │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ 04 Channels │ │ 05 Astro    │ │ 06 Live Resonance   │   │
│  │ - Constell. │ │ - Zodiac    │ │ - Freq. spectrum    │   │
│  │ - Waveform  │ │ - Star field│ │ - Score bars        │   │
│  │ - Tone      │ │ - Radar     │ │ - Context tooltip   │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  School Theme Engine                                  │  │
│  │  - CSS variable consumer                              │  │
│  │  - Aurora overlay generator                           │  │
│  │  - Scanline pattern selector                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Module Breakdown

### 8.1 New: Submit Animation Controller

**File:** `src/pages/Read/OracleSubmitAnimation.jsx`

- `WordDissolve` — Framer Motion sequence: word → letters → phonemes
- `PhonemeScatter` — Radial burst with school-colored particles
- `GlyphConverge` — Spiral convergence animation
- `SurfaceIgnite` — Radial glow pulse on result surface
- Respects `prefers-reduced-motion`

### 8.2 New: Data Visualization Components

**File:** `src/pages/Read/OracleVisualizations.jsx`

- `PhonemeChip` — Colored phoneme button (vowel = school color, consonant = silver)
- `ResonanceMap` — Horizontal scroll position bar with occurrence markers
- `ChannelConstellation` — Token layout sized by phoneme similarity
- `WaveformIndicator` — Mini SVG wave showing phoneme pattern match
- `FrequencySpectrum` — Bar chart for resonance scores
- `ScoreArc` — Circular progress for astrology scores
- `StarField` — Cluster count visualization
- `PositionCard` — Mini scroll context preview

### 8.3 New: School Theme Consumer

**File:** `src/pages/Read/OracleSchoolTheme.jsx`

- Consumes school CSS variables
- Generates aurora overlay gradient
- Selects scanline pattern based on school
- Provides glyph accent character

### 8.4 Modified: SearchPanel.jsx

- Replace current section rendering with new visualization components
- Integrate submit animation controller
- Wire up school theme consumer
- Preserve all existing data flow and API contracts

### 8.5 Modified: IDE.css

- Add new CSS classes for visualization components
- Add school-themed aurora and scanline patterns
- Add submit animation keyframes
- Add phoneme chip styles, constellation layout, frequency spectrum bars

---

## 9. Implementation Phases

### Phase 1: Submit Animation
- `OracleSubmitAnimation.jsx` — Word dissolution sequence
- CSS keyframes for scatter, converge, ignite
- Reduced motion fallback
- **QA:** Animation plays correctly, respects reduced motion, no layout shift

### Phase 2: Data Visualization — Core Sections
- `PhonemeChip`, `ResonanceMap`, `ChannelConstellation`
- Refactor Sections 01, 03, 04
- **QA:** All existing data renders correctly, new visuals don't break functionality

### Phase 3: Data Visualization — Extended Sections
- `WaveformIndicator`, `FrequencySpectrum`, `ScoreArc`, `StarField`
- Refactor Sections 02, 05, 06
- **QA:** All sections render correctly, hover tooltips work, click handlers preserved

### Phase 4: School Theming
- `OracleSchoolTheme.jsx` — Aurora, scanlines, glyph accents
- CSS variables consumed across all components
- **QA:** Each school produces distinct visual output, defaults gracefully when no school active

---

## 10. QA Requirements

| Test | Type | Pass Criteria |
|------|------|---------------|
| Submit animation plays | Visual | Word → phonemes → scatter → converge → reveal sequence completes in ~1.4s |
| Reduced motion respected | Accessibility | Animation collapses to 0.3s fade when `prefers-reduced-motion` is set |
| Phoneme chips colored correctly | Visual | Vowels match school color, consonants are silver |
| Resonance map positions accurate | Data | Markers appear at correct scroll positions |
| Channel tokens sized by similarity | Data | Token size correlates with phoneme similarity score |
| Frequency spectrum bars proportional | Data | Bar height matches resonance score |
| School theme changes surface | Visual | Each school produces distinct background/glow pattern |
| All click handlers preserved | Functional | Token clicks, line jumps, suggestion selects all work |
| No layout shift during animation | Performance | Content area doesn't jump or resize during submit sequence |
| Animation doesn't block interaction | Performance | User can cancel or interact during animation |

---

## 11. Success Criteria

1. **Submit feels magical** — The word dissolution sequence is visually compelling and completes in under 1.5s
2. **Data relationships are visible** — Users can see phoneme similarity, resonance strength, and school affinity without reading text
3. **School theming is distinct** — Each school produces a recognizably different Oracle surface
4. **Functional parity** — All existing features work identically — no data is lost, no handlers break
5. **Performance budget** — Animation adds <50ms to total load time, no jank during reveal
6. **Accessibility** — Reduced motion collapses animation, all interactive elements have ARIA labels

---

## 12. Technical Constraints

- **No new dependencies** — Use existing Framer Motion, CSS custom properties, and SVG
- **Preserve data contracts** — All existing props and data shapes remain unchanged
- **Respect `prefers-reduced-motion`** — All animations must have a non-animated fallback
- **School variables from `src/data/schools.js`** — No hardcoded colors, consume the existing palette
- **CSS scoped to Oracle** — No global style leakage

---

## 13. Files Affected

| File | Change Type | Scope |
|------|-------------|-------|
| `src/pages/Read/SearchPanel.jsx` | Refactor | Section rendering, submit handler |
| `src/pages/Read/OracleSubmitAnimation.jsx` | New | Submit animation controller |
| `src/pages/Read/OracleVisualizations.jsx` | New | Data viz components |
| `src/pages/Read/OracleSchoolTheme.jsx` | New | School theme consumer |
| `src/pages/Read/IDE.css` | Extend | New CSS classes, animations, school patterns |

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Animation causes jank | Medium | High | Use `will-change`, GPU-accelerated transforms, test on low-end devices |
| New components break existing data | Low | Critical | Preserve all existing props, add visual layer on top of data |
| School theming conflicts with existing styles | Medium | Medium | Scope all CSS to `.oracle-*` namespace, use CSS variables |
| Reduced motion not respected | Low | High | Wrap all animation in `usePrefersReducedMotion` hook |
| Performance regression | Medium | Medium | Benchmark before/after, set 50ms animation budget |

---

*PDR Author: qwen-code*
*Date: 2026-04-03*
*Classification: UI + Data Visualization + Animation*
