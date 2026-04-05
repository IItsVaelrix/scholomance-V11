# PDR: Adaptive Chromatic Palette

**Subtitle:** The color scheme should be discovered, not assigned — palette emerges from the phonemic gravity of the text itself

**Status:** Draft
**Classification:** UI + Color Engine + Codex Contract
**Priority:** High
**Primary Goal:** Replace the static school-assigned palette with a dynamic one that computes itself from the live phoneme distribution of the analyzed text, so colors are always a true reflection of what the player is writing.

---

## 1. Executive Summary

The current color system is static. A school is passed in from outside, its `colorHsl` anchors the PCA projection, and every word gets colored relative to that fixed anchor. The player sees SONIC purple because they selected SONIC — not because their writing earned it.

This violates the core world-law of Scholomance: nothing is assigned, everything is discovered. School affinity, spell effects, and Source cost all emerge from what you write. Color should too.

The infrastructure for this already exists in pieces:
- `pcaChroma.js` already projects vowel formants through PCA into HSL color space per phoneme
- `pixelBrainBridge.js` already computes `schoolWeights` from token hints
- `analyzeText` already produces per-word phoneme data including vowel family

The missing wire: school weights are never routed to the palette. `schoolPalettes.js` builds with no school specified at all, and `SCHOOL_SKINS` returns the same default palette for every school. The palette is not listening to the text.

This PDR defines a two-layer fix: Codex surfaces `schoolWeights` and `vowelFamilyDistribution` from the analysis output, and the UI consumes them to blend a palette that breathes with the text.

---

## 2. Problem Statement

**Current flow:**
```
static schoolId (external) → resolveVerseIrColor(family, schoolId) → fixed anchor HSL → PCA delta → hex
```

**What's wrong:**
- `buildUniversalVowelPalette()` in `schoolPalettes.js` calls `resolveVerseIrColor(family)` with no school — the palette has no school affinity at all
- `SCHOOL_SKINS` maps every school to the same `DEFAULT_VOWEL_COLORS` — school selection has zero effect on word colors
- `pixelBrainBridge.js` computes `schoolWeights` but only uses the dominant school to pick a texture type string (`'energy'`, `'crystalline'`) — the weights are discarded
- The player's writing profile is computed and immediately thrown away before it can affect the visual surface

**Impact in the game:**
- A player who writes exclusively VOID phonemes sees the same word colors as one writing SONIC
- Truesight mode renders a palette that doesn't reflect the text's acoustic character
- The visual feedback loop that would teach players about their own phonemic fingerprint doesn't exist

---

## 3. Product Goal

1. **Palette is a function of text** — the color scheme at any moment reflects the phoneme distribution of what's currently written, not a static selection
2. **Smooth transitions** — as the text shifts phonemically, the palette breathes toward the new distribution, not snaps
3. **Always visually coherent** — because colors are derived from real acoustic data through the existing PCA math, the output is always internally consistent — no arbitrary or clashing combinations
4. **World-law correct** — a player discovers their school affinity through play. Their palette reveals it to them in real time. They didn't choose purple. They *wrote* purple.

---

## 4. Non-Goals

- Not changing the PCA math in `pcaChroma.js` — `resolveVerseIrColor` stays intact, we feed it better inputs
- Not adding new school definitions or color anchors
- Not affecting combat result rendering — adaptive palette is a scroll editor concern
- Not changing how school affinity is formally computed for scoring — this is display only
- Not a real-time per-keystroke recompute — palette updates on analysis tick, not on every character

---

## 5. Core Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Color is earned** | The palette reflects what you wrote, same as school affinity and Source cost |
| **Blend, don't snap** | Multi-school text produces a blend, not a winner-takes-all switch |
| **Physics-grounded** | Colors come from real formant acoustics through PCA — never arbitrary |
| **Proportional weight** | A text 70% SONIC / 30% WILL produces a palette closer to SONIC but carrying WILL's warmth |
| **Graceful default** | When no phoneme data is available, fall back to the existing default palette — no broken states |

---

## 6. Feature Overview

### 6.1 The Blended HSL Base

The key insight: instead of anchoring the PCA projection to a single school's `colorHsl`, compute a **weighted average HSL** across all schools present in the text, proportional to their weight in the distribution.

```
schoolWeights = { SONIC: 0.55, WILL: 0.30, VOID: 0.15 }

blendedH = (265 * 0.55) + (30 * 0.30) + (240 * 0.15) = 191.75
blendedS = (48 * 0.55) + (65 * 0.30) + (15 * 0.15) = 48.9
blendedL = (50 * 0.55) + (55 * 0.30) + (35 * 0.15) = 49.25
```

This blended HSL replaces the static `school.colorHsl` as the base for every `resolveVerseIrColor` call. The PCA delta math stays identical — only the anchor shifts.

Hue blending must use circular averaging (angular mean) to handle the 0°/360° wraparound correctly.

### 6.2 Vowel Family Distribution

In addition to school weights, expose the raw vowel family counts from the analyzed text. This allows the palette to weight individual phoneme colors by how frequently they appear — high-frequency families get their full color expression, rare families get subtle treatment.

```
vowelFamilyDistribution = { IY: 8, AE: 5, AH: 3, UW: 1 }
```

This feeds an optional `frequencyWeight` modifier into `resolveVerseIrColor` — words using the dominant phoneme family of the text get slightly increased saturation. The most-used vowel sound in the scroll becomes the palette's loudest voice.

### 6.3 Transition Smoothing

Palette updates are not applied instantly. When the school weights shift (e.g., the player writes a new line with different phoneme character), the blended HSL transitions over 600ms using CSS custom property animation or a lerp applied on each analysis tick.

This creates the "breathing" quality — the palette doesn't snap, it inhales.

Respects `prefers-reduced-motion`: if set, transitions collapse to immediate swap.

### 6.4 Truesight Integration

In Truesight mode, every analyzed word already gets colored by `resolveVerseIrColor`. The adaptive palette change means:
- The overall tone of the overlay shifts as the text's phonemic character shifts
- Words from different school families remain visually distinct within the blended space
- The player can see their phonemic fingerprint directly in the colors surrounding their text

---

## 7. Architecture

```
analyzeText(scrollText)
        │
        ▼
AnalyzedDocument
        │
        ├── words[].vowelFamily  ──→  vowelFamilyDistribution
        │                                     │
        └── (via VerseIR amplifier)            │
                    │                          │
              schoolWeights ◄─────────────────┘
                    │
                    ▼
          computeBlendedHsl(schoolWeights, SCHOOLS)
                    │
                    ▼
              blendedHsl  { h, s, l }
                    │
                    ▼
    resolveVerseIrColor(family, null, { baseHsl: blendedHsl })
                    │
                    ▼
              adaptive hex color per phoneme family
                    │
                    ▼
         useAdaptivePalette() hook
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
    Truesight overlay    CSS custom props
    word colors          (aurora, glow, border)
```

---

## 8. Module Breakdown

### 8.1 Codex — Analysis Output Schema Extension

**File:** `codex/core/schemas.js` (or wherever `AnalyzedDocument` is defined)

Add to `AnalyzedDocument`:
```js
/**
 * Distribution of vowel families found in the text.
 * Keys are ARPAbet vowel family codes, values are occurrence counts.
 * @type {Record<string, number>}
 */
vowelFamilyDistribution: {},

/**
 * Normalized school weights derived from vowel family distribution.
 * Keys are school IDs, values are weights in [0, 1] summing to 1.
 * @type {Record<string, number>}
 */
schoolWeights: {},

/**
 * The school with the highest weight. Null if no phoneme data available.
 * @type {string|null}
 */
dominantSchool: null,
```

**File:** `codex/core/analysis.pipeline.js`

After analyzing all words, compute and attach `vowelFamilyDistribution` and `schoolWeights` to the document output. Use `VOWEL_FAMILY_TO_SCHOOL` for the mapping. Normalize weights to sum to 1.

### 8.2 Codex — VerseIR Amplifier surfacing

**File:** `codex/core/verseir-amplifier/plugins/pixelBrainBridge.js`

The existing `resolveTextureType` already computes `schoolWeights` from token hints. Extract this computation into a shared `computeSchoolWeights(tokenHints)` utility and re-export it so the analysis pipeline and UI can use the same logic.

### 8.3 UI — `computeBlendedHsl` utility

**File:** `src/lib/truesight/color/pcaChroma.js`

Add `computeBlendedHsl(schoolWeights, schools)`:
- Takes normalized school weights and the SCHOOLS map
- Computes circular mean of hue values (angular averaging)
- Computes linear weighted average of saturation and lightness
- Returns `{ h, s, l }`
- Falls back to `DEFAULT_SCHOOL_HSL` if weights are empty

```js
export function computeBlendedHsl(schoolWeights, schools) {
  const entries = Object.entries(schoolWeights)
    .filter(([id]) => schools[id]?.colorHsl)
    .map(([id, weight]) => ({ hsl: schools[id].colorHsl, weight }));

  if (!entries.length) return DEFAULT_SCHOOL_HSL;

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0) || 1;

  // Circular mean for hue
  let sinSum = 0, cosSum = 0;
  let s = 0, l = 0;
  for (const { hsl, weight } of entries) {
    const norm = weight / totalWeight;
    const rad = (hsl.h * Math.PI) / 180;
    sinSum += Math.sin(rad) * norm;
    cosSum += Math.cos(rad) * norm;
    s += hsl.s * norm;
    l += hsl.l * norm;
  }

  const h = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}
```

Extend `resolveVerseIrColor` to accept `options.baseHsl` — if provided, use it instead of resolving from schoolId. This keeps the existing API intact while enabling the adaptive path.

### 8.4 UI — `useAdaptivePalette` hook

**File:** `src/hooks/useAdaptivePalette.js` *(new)*

```js
/**
 * Consumes school weights from the live analysis output and produces
 * a dynamically blended color palette that reflects the text's phonemic character.
 *
 * @param {object} analysisOutput - AnalyzedDocument from CODEx
 * @returns {{ palette: Record<string, string>, blendedHsl: object, dominantSchool: string|null }}
 */
export function useAdaptivePalette(analysisOutput) { ... }
```

- Watches `analysisOutput.schoolWeights` — when it changes, recomputes `blendedHsl` via `computeBlendedHsl`
- Rebuilds the palette by calling `resolveVerseIrColor(family, null, { baseHsl: blendedHsl })` for each vowel family
- Applies transition smoothing via lerp on each RAF tick (600ms), or instant if `prefers-reduced-motion`
- Returns stable references — palette object only changes when weights meaningfully shift (>5% delta threshold to avoid visual noise)

### 8.5 UI — CSS Custom Property Bridge

**File:** `src/hooks/useAtmosphere.js`

Update to consume `useAdaptivePalette` output and push `blendedHsl` into the school CSS variables (`--school-primary`, `--school-glow`, etc.) so the aurora, borders, and chrome also breathe with the text. The atmosphere is already driven by school HSL — this makes it responsive to the same adaptive signal.

### 8.6 UI — `schoolPalettes.js` update

**File:** `src/data/schoolPalettes.js`

Add `buildAdaptivePalette(schoolWeights)` alongside the existing `buildUniversalVowelPalette`. The existing function stays as the fallback/default. `SCHOOL_SKINS` can remain for contexts where a static palette is needed (menus, settings screens).

---

## 9. Implementation Phases

### Phase 1 — Codex: Schema + Analysis Extension
- Add `vowelFamilyDistribution`, `schoolWeights`, `dominantSchool` to `AnalyzedDocument`
- Compute them at the end of `analyzeText`
- Extract shared `computeSchoolWeights` from `pixelBrainBridge.js`
- **Gate:** Schema contract updated in `SCHEMA_CONTRACT.md`

### Phase 2 — UI: Color Math
- Add `computeBlendedHsl` to `pcaChroma.js`
- Extend `resolveVerseIrColor` to accept `options.baseHsl`
- Unit test: blended HSL of equal SONIC + WILL weights produces hue midpoint
- Unit test: circular averaging handles 350° + 10° → 0° correctly, not 180°

### Phase 3 — UI: Hook + Integration
- Implement `useAdaptivePalette`
- Wire into Truesight overlay (replaces static palette call)
- Wire into `useAtmosphere` (CSS custom property bridge)
- Transition smoothing with `prefers-reduced-motion` support

### Phase 4 — QA
- Visual regression baselines: SONIC-heavy text, WILL-heavy text, balanced mixed text
- Functional: palette updates within one analysis tick of text change
- Functional: transition duration ~600ms on capable devices, instant on reduced motion
- Functional: fallback to default palette when `schoolWeights` is empty

---

## 10. QA Requirements

| Test | Type | Pass Criteria |
|------|------|---------------|
| `computeBlendedHsl` circular mean | Unit | 350° + 10° at equal weight → ~0°, not 180° |
| Blended palette shifts on text change | Integration | Color values differ between SONIC-heavy and WILL-heavy inputs |
| Dominant school matches visual tone | Visual | Purple-heavy text produces purple-toned palette |
| Mixed text produces coherent blend | Visual | No jarring color combinations — blend is harmonious |
| Transition respects reduced motion | Accessibility | Instant swap when `prefers-reduced-motion: reduce` |
| Empty weights falls back gracefully | Unit | `computeBlendedHsl({})` returns `DEFAULT_SCHOOL_HSL` |
| Existing static palette unaffected | Regression | `buildUniversalVowelPalette()` output unchanged |
| Delta threshold prevents flicker | Integration | Palette does not update on <5% weight delta |

---

## 11. Success Criteria

1. **Writing SONIC phonemes produces a visibly purple-shifted palette** — observable without being told
2. **Mixed phoneme text produces a blended palette** — neither school dominates visually, both are present
3. **Palette transitions feel like breathing** — smooth, 600ms, not a snap
4. **Existing static contexts unaffected** — menus, settings, non-Truesight views unchanged
5. **Zero extra computation cost** — `schoolWeights` is computed by the existing analysis pipeline, not a new pass
6. **A player can read their school affinity from the colors** — the display teaches without explaining

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Circular hue averaging produces unexpected midpoints | Medium | Medium | Comprehensive unit tests for edge cases (cross-0°, monochrome input) |
| Rapid text changes cause palette flicker | Medium | Low | Delta threshold: only update when weight shift >5% |
| Blended palette loses per-phoneme distinctiveness | Low | Medium | PCA delta math still differentiates families within the blended space |
| `useAtmosphere` transition conflicts with palette transition | Low | Low | Single transition authority — palette drives atmosphere, not vice versa |
| Schema change breaks existing analysis consumers | Medium | High | Additive only — new fields default to `{}` / `null`, no existing fields changed |

---

## 13. World-Law Connection

The adaptive palette is not a UI feature. It's the world showing the player who they are becoming.

In Scholomance, you don't choose your school. You write, and the Scholomance reads you. The color system, properly implemented, is the first place a player sees this truth — their scroll glows in colors they earned, not colors they selected. A new player writing instinctively will see their palette emerge over their first session. By the time they understand why it looks the way it does, they've already learned the first law of the school.

That's the discovery loop made visible.

---

*PDR Author: claude-ui*
*Date: 2026-04-05*
*Classification: UI + Color Engine + Codex Contract*
*Owner: Phase 1 → Codex / Phases 2–4 → Claude / QA → Minimax*
