# PDR: PixelBrain Font Audit Oracle
## ByteCode-Driven Cross-Browser Font Support, Runtime Measurement, and Glyph Atlas Verification

**Status:** Draft for implementation  
**Classification:** Architectural + Rendering Systems + Measurement Infrastructure  
**Priority:** Critical  
**Primary Goal:** Enable PixelBrain to accept a specific font request, determine whether the font is supported and resolvable on a given browser/platform, measure its real rendered pixel metrics, verify glyph geometry through PixelBrain atlas analysis, and return a deterministic environment-stamped font specification payload.

---

# 1. Executive Summary

PixelBrain currently treats visual layout, animation, and geometry as deterministic bytecode-executable systems. Typography remains one of the last major rendering domains where silent fallbacks, browser-specific metrics, operating-system rasterization differences, and font-loading ambiguity can introduce non-deterministic drift.

This PDR formalizes a **Font Audit Oracle** subsystem that turns font handling into a measurable, bytecode-governed rendering discipline.

The system does **not** attempt to claim that a font has one eternal universal pixel truth across all devices. Instead, it introduces a two-layer truth model:

1. **Capability Truth**  
   What the environment says it supports.
2. **Measured Reality**  
   What PixelBrain actually loads, renders, measures, and verifies.

The result is a deterministic pipeline that can answer questions such as:

- Is this font supported in Chrome, Firefox, Edge, and Opera?
- Is it actually available here locally, web-loadable, or falling back?
- What are its measured width, ascent, descent, side bearings, and bounding-box metrics for a canonical probe set?
- Do the measured glyph shapes match the expected atlas fingerprint for this font family/version?
- Can PixelBrain use the measured result safely for overlay alignment, verse editor geometry, and precision text rendering?

This feature is especially important for:

- ScrollEditor text alignment
- TrueSight overlays
- Pixel-perfect verse positioning
- responsive text geometry calibration
- browser-specific typography normalization
- deterministic QA for text drift and fallback detection

---

# 2. Problem Statement

## 2.1 Existing Problem

PixelBrain can currently express geometry, motion, visual intent, and layout through mathematical bytecode. Fonts remain fragile because browsers introduce several layers of ambiguity:

- a requested font may not exist locally
- a font may be declared but fail to load
- a browser may silently substitute a fallback font
- font metrics differ across rendering engines
- OS-specific rasterization and hinting alter perceived geometry
- variable font axes can change dimensions without changing the family name
- line-height and bounding-box values may vary by API support level

This creates a precision failure for any system relying on:

- overlayed clickable word positioning
- symmetry alignment in text interfaces
- deterministic browser QA
- reproducible typographic layouts
- exact measured editor rendering

## 2.2 Why This Matters in Scholomance / PixelBrain

Scholomance is not a generic website. It is a rendering world where typography participates in:

- mystical UI composition
- clickable text overlays
- phoneme and syntax visualization
- metric-aware spell UI and codex displays
- deterministic pixel and symmetry laws

If PixelBrain cannot measure and verify fonts, then one of the most central materials in the world remains probabilistic.

---

# 3. Product Goal

Build a **ByteCode Font Audit Oracle** that allows PixelBrain to:

1. Accept a formal font request.
2. Detect browser and platform capability support.
3. Resolve whether the font is loaded from local, web, or fallback source.
4. Measure real text metrics through runtime rendering.
5. Render and analyze glyph atlases for pixel-level verification.
6. Encode results into a deterministic ByteCode-backed FontSpec payload.
7. Cache and reuse environment-stamped measurements.
8. Drive QA assertions for layout safety and browser parity.

---

# 4. Non-Goals

This feature does **not** attempt to:

- guarantee universal identical typography across all operating systems
- replace browser text rendering with a custom full text rasterizer
- treat browser-reported metrics as infallible truth without verification
- assume local font inspection is always available
- define font support purely through static hard-coded tables

---

# 5. Core Design Principle

## 5.1 Dual-Truth Model

The Font Audit Oracle must separate:

### A. Capability Registry
What this environment appears capable of doing.

### B. Measured Render Reality
What PixelBrain actually rendered and verified.

This distinction is mandatory.

A browser may claim support for web fonts and still fail a specific font request because:

- the network asset is missing
- the local font name differs
- the browser falls back silently
- the installed font version is different
- the glyph behavior does not match expected atlas signatures

Therefore:

> **Capability is advisory. Measurement is authoritative.**

---

# 6. Feature Overview

The subsystem consists of six major layers:

1. **Environment Detection Layer**
2. **Font Capability Registry**
3. **Font Resolution Engine**
4. **Runtime Measurement Engine**
5. **Glyph Atlas Verification Engine**
6. **ByteCode FontSpec Compiler / Cache Layer**

---

# 7. Architecture

## 7.1 High-Level Pipeline

```txt
FontRequest
→ Environment Probe
→ Capability Registry Snapshot
→ Font Resolution Attempt
→ Runtime Font Load Barrier
→ Probe String Measurement
→ Glyph Atlas Render + Analysis
→ Fallback / Mismatch Detection
→ ByteCode FontSpec Payload
→ Cache / QA / Layout Consumers
```

## 7.2 Key Inputs

A font request must support the following logical fields:

```ts
export type PixelBrainFontRequest = {
  family: string;
  weight?: number | string;
  style?: 'normal' | 'italic' | 'oblique';
  stretch?: string;
  sizePx: number;
  lineHeightPx?: number;
  axes?: Record<string, number>;
  sourcePreference?: 'local-first' | 'web-only' | 'local-only' | 'auto';
  probeStrings?: string[];
  glyphSetPreset?: 'latin-core' | 'editor-core' | 'lyrics-core' | 'extended';
};
```

## 7.3 Key Outputs

```ts
export type PixelBrainFontAuditResult = {
  request: PixelBrainFontRequest;
  environment: PixelBrainEnvironmentStamp;
  capability: BrowserFontCapabilitySnapshot;
  resolution: FontResolutionResult;
  measurement: ProbeMeasurementBundle;
  atlasVerification: GlyphAtlasVerificationResult;
  supportVerdict: FontSupportVerdict;
  safetyFlags: FontSafetyFlags;
  bytecodeSpec: CompiledFontSpecBytecode;
  cacheKey: string;
};
```

---

# 8. Module Breakdown

## 8.1 Environment Detection Layer

This layer captures all environment context required to interpret typographic measurements.

### Responsibilities
- determine browser family
- determine browser major version
- determine OS/platform
- determine device pixel ratio
- determine canvas measurement support
- determine CSS Font Loading support
- determine local font inspection support if available
- determine whether font bounding-box metrics are supported

### Environment Stamp

```ts
export type PixelBrainEnvironmentStamp = {
  browser: 'chrome' | 'firefox' | 'edge' | 'opera' | 'unknown';
  browserVersion: string;
  os: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
  platformLabel: string;
  devicePixelRatio: number;
  locale?: string;
  measurementMode: 'canvas2d';
  timestamp: number;
};
```

### Why It Exists
A measurement without environment metadata is not deterministic. It is only a floating number with no provenance.

---

## 8.2 Font Capability Registry

This registry records what the current browser environment can do.

### Responsibilities
- check support for CSS `FontFace`
- check `document.fonts`
- check canvas `measureText`
- check support for `actualBoundingBox*` values
- check optional local font access availability
- expose normalized support data to the rest of PixelBrain

### Type

```ts
export type BrowserFontCapabilitySnapshot = {
  supportsFontFace: boolean;
  supportsDocumentFonts: boolean;
  supportsMeasureText: boolean;
  supportsBoundingBoxMetrics: boolean;
  supportsLocalFontInspection: boolean;
  supportsVariableFontAxes: boolean;
};
```

### Design Rule
This registry must be **feature-detected first**, not just inferred from browser names.

---

## 8.3 Font Resolution Engine

The Font Resolution Engine attempts to resolve the requested font from one of several sources.

### Allowed Sources
- local installed font
- declared webfont asset
- browser fallback chain

### Responsibilities
- normalize request descriptors
- construct font face descriptors
- attempt load barriers
- track whether the resolved face is local, web, or fallback
- expose a confidence score for whether the requested font is truly active

### Type

```ts
export type FontResolutionResult = {
  requestedFamily: string;
  resolvedFamily: string;
  source: 'local' | 'webfont' | 'fallback' | 'unknown';
  loaded: boolean;
  loadDurationMs?: number;
  confidence: number;
  fallbackSuspected: boolean;
  notes: string[];
};
```

### Resolution Rule
The engine must never simply say “supported” because a font family string was accepted. It must pass through runtime load and/or measured comparison logic.

---

## 8.4 Runtime Measurement Engine

This module measures actual text metrics after font resolution.

### Responsibilities
- wait for font load completion where applicable
- render canonical probe strings using the exact requested descriptors
- measure width
- measure ascent/descent where supported
- measure left/right ink bounds where supported
- optionally estimate line metrics through multi-line test canvases
- produce deterministic probe bundles

### Canonical Probe Set
At minimum the system must support these canonical probes:

```txt
Hamburgefonstiv
ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789
.,;:!?\"'()[]{}<>/\\|@#$%^&*+-_=
The quick brown fox jumps over the lazy dog
```

### PixelBrain Extended Probe Set
A second probe layer should include:
- lyric punctuation commonly used in verse writing
- apostrophes and quotation variants
- common overlay strings from ScrollEditor
- glyphs used in mystical UI chrome if relevant

### Types

```ts
export type SingleProbeMeasurement = {
  text: string;
  width: number;
  actualBoundingBoxLeft?: number;
  actualBoundingBoxRight?: number;
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
};

export type ProbeMeasurementBundle = {
  fontCssShorthand: string;
  sizePx: number;
  measurements: SingleProbeMeasurement[];
};
```

---

## 8.5 Glyph Atlas Verification Engine

This is the critical B-mode feature and the main reason this PDR exists.

Browser metrics alone are not sufficient. PixelBrain must also verify glyph shape reality.

### Core Idea
Render a known glyph set into a controlled atlas, then analyze:

- pixel ink bounds per glyph
- advance approximation
- visible left/right side-bearing behavior
- cap-height approximation
- x-height approximation
- overshoot behavior
- shape fingerprint differences from fallback fonts

### Minimum Glyph Atlas Sets

#### latin-core
- A-Z
- a-z
- 0-9

#### editor-core
- latin-core
- punctuation
- brackets
- symbols commonly used in code and lyrics

#### lyrics-core
- editor-core
- apostrophes, quotes, commas, periods, dashes, slash, colon, semicolon
- any common typographic marks used in song text and overlays

### Atlas Verification Output

```ts
export type GlyphMetric = {
  glyph: string;
  inkWidthPx: number;
  inkHeightPx: number;
  inkOffsetLeftPx: number;
  inkOffsetTopPx: number;
  occupiedPixelCount: number;
};

export type GlyphAtlasVerificationResult = {
  glyphSet: string[];
  glyphMetrics: GlyphMetric[];
  atlasWidthPx: number;
  atlasHeightPx: number;
  fingerprintHash: string;
  fallbackSimilarityScore: number;
  expectedFingerprintMatch?: boolean;
  mismatchFlags: string[];
};
```

### Design Rule
The atlas verification engine is the authoritative fallback detector when runtime support exists.

If a requested font and a fallback font produce a near-identical fingerprint, PixelBrain must downgrade confidence and mark the result as unresolved or fallback-suspect.

---

## 8.6 ByteCode FontSpec Compiler

This layer converts the final measured audit into a deterministic, cacheable, portable payload.

### Purpose
Transform runtime measurement and atlas verification into a machine-readable ByteCode-backed IR that other PixelBrain systems can consume.

### Why ByteCode
PixelBrain’s world model already treats rendering truth as executable mathematical instructions. Typography must be normalized into the same ecosystem so that:

- layout engines can consume measured truth
- QA can compare against expected truth
- browser drift can be stored and replayed
- responsive systems can avoid guesswork

### Example Logical Fields

```ts
export type CompiledFontSpecBytecode = {
  version: 1;
  family: string;
  resolvedFamily: string;
  source: 'local' | 'webfont' | 'fallback' | 'unknown';
  environmentKey: string;
  supportVerdict: 'supported' | 'supported-with-risk' | 'fallback' | 'unsupported' | 'unknown';
  measurementHash: string;
  atlasFingerprintHash: string;
  probeMetrics: Array<{
    probeId: string;
    width: number;
    ascent?: number;
    descent?: number;
    left?: number;
    right?: number;
  }>;
  glyphSummary: {
    avgInkWidthPx: number;
    avgInkHeightPx: number;
    totalOccupiedPixels: number;
  };
};
```

---

# 9. ByteCode IR Design

## 9.1 Why a Font ByteCode IR Exists

A measured font result should be portable across:
- QA runs
- browser audit snapshots
- layout debugging sessions
- editor geometry calibration
- future PixelBrain deterministic rendering subsystems

## 9.2 Canonical ByteCode Sections

A compiled FontSpec bytecode document should contain sections conceptually equivalent to:

```txt
FONT_SPEC_HEADER
ENVIRONMENT_STAMP
CAPABILITY_FLAGS
RESOLUTION_RESULT
PROBE_METRIC_BLOCK
ATLAS_VERIFICATION_BLOCK
SUPPORT_VERDICT
SAFETY_FLAGS
HASH_BLOCK
```

## 9.3 Example Pseudo-ByteCode

```txt
PBFS/1
FONT "Fira Code"
RESOLVED "Fira Code"
SOURCE WEBFONT
ENV BROWSER=FIREFOX VERSION=145 OS=WINDOWS DPR=1.25
CAP FONTFACE=1 DOCFONTS=1 MEASURE=1 BBOX=1 LOCALINSPECT=0 VARAXIS=1
PROBE HAMBURGEFONSTIV WIDTH=126.42 ASC=12.14 DESC=3.88 LEFT=1.00 RIGHT=125.78
PROBE ALPHA_UPPER WIDTH=166.12
PROBE ALPHA_LOWER WIDTH=143.51
PROBE NUMERIC WIDTH=97.18
ATLAS HASH=0x74aab19d FALLBACKSIM=0.07 EXPECTED=1
VERDICT SUPPORTED
FLAGS SAFE_FOR_OVERLAY=1 SAFE_FOR_EDITOR=1 SAFE_FOR_PARITY=1
END
```

This pseudo-format is conceptual. Actual storage may be JSON-backed IR, binary-packed bytecode, or a hybrid textual IR compiled into a runtime structure.

---

# 10. Support Verdict Model

The system must not reduce results to a simplistic boolean.

## Allowed Verdicts

```ts
export type FontSupportVerdict =
  | 'supported'
  | 'supported-with-risk'
  | 'fallback'
  | 'unsupported'
  | 'unknown';
```

### supported
The font resolved, loaded, measured, and passed atlas verification confidently.

### supported-with-risk
The font loaded and measured, but one or more safety conditions exist, such as:
- incomplete bounding-box metric support
- atlas mismatch uncertainty
- environment lacks certain verification APIs
- measured variation exceeds tolerance thresholds

### fallback
The request likely rendered with a fallback font, even if the family name was accepted.

### unsupported
The environment cannot load or measure the requested font in any valid way.

### unknown
The engine lacks enough information to produce a reliable verdict.

---

# 11. Safety Flags

This feature exists partly to inform other systems whether the font is safe to use in precision contexts.

```ts
export type FontSafetyFlags = {
  safeForOverlayAlignment: boolean;
  safeForScrollEditorGeometry: boolean;
  safeForSymmetryQA: boolean;
  safeForCrossBrowserParity: boolean;
  safeForInteractiveTextHitboxes: boolean;
};
```

### Rules
A font may be acceptable for decorative use while unsafe for:
- word hitbox overlays
- exact line wrapping
- deterministic text QA
- pixel-anchored editor interaction

---

# 12. Consumer Systems

## 12.1 ScrollEditor
Use measured font specs to stabilize:
- line alignment
- overlay positioning
- per-word clickable regions
- exact editor geometry

## 12.2 TrueSight Overlay
Use measured bounds and glyph widths to maintain clickable precision when text containers resize.

## 12.3 Browser QA
Use cached font bytecode specs to detect:
- unexpected fallback
- browser drift
- version-specific rendering changes
- environment mismatches

## 12.4 Responsive Layout Engine
Use audited metrics instead of assumed CSS-only dimensions when exact typography matters.

---

# 13. Caching Strategy

## 13.1 Cache Key
The cache key must include enough entropy to prevent false reuse.

```txt
family + weight + style + stretch + sizePx + axes + browser + browserVersion + os + dpr + measurementMode
```

## 13.2 Cache Levels

### session cache
For rapid repeated measurements in a single session.

### persistent local cache
For reusing font audit results across sessions where appropriate.

### canonical known-results store
Optional future layer for trusted browser/font combinations with verified fingerprints.

---

# 14. Fallback Detection Strategy

## 14.1 Why It Is Needed
Browsers can silently substitute fallback fonts without making the failure obvious.

## 14.2 Detection Layers

### Layer 1: Width Comparison
Compare requested font probe widths against known fallback probes.

### Layer 2: Bounding Box Comparison
Compare ascent/descent/ink bounds where available.

### Layer 3: Glyph Atlas Fingerprint
Compare rendered glyph pixel signatures against known fallback families or prior canonical fingerprints.

### Layer 4: Confidence Scoring
Aggregate all evidence into a confidence score.

---

# 15. Confidence Model

```ts
export type FontConfidenceBreakdown = {
  loadConfidence: number;
  metricConfidence: number;
  atlasConfidence: number;
  fallbackRisk: number;
  overallConfidence: number;
};
```

### Suggested Interpretation
- `0.90 - 1.00`: strong confidence
- `0.70 - 0.89`: usable but risky
- `0.40 - 0.69`: likely ambiguous
- `< 0.40`: unsafe / fallback-suspect

---

# 16. Tolerance Rules

Because typography is not perfectly uniform across engines, PixelBrain must define tolerance windows.

## Suggested Tolerances

### width tolerance
Allow minor width variance within defined thresholds for a given font-size and browser family.

### bounding-box tolerance
Allow subpixel differences where the measured structure still passes layout safety thresholds.

### atlas tolerance
Allow minor rasterization differences while still catching fallback substitution.

These tolerance values must be centralized in config, not hard-coded inside analysis functions.

---

# 17. Browser Scope

Initial browser support target:
- Firefox
- Chrome
- Edge
- Opera

Initial OS target priority:
1. Windows
2. Linux
3. macOS

The system must still function on unsupported or unknown combinations, but may return downgraded verdicts.

---

# 18. Implementation Phases

## Phase 1: Capability + Measurement Foundation

Deliver:
- environment stamp
- capability registry
- font resolution attempt model
- runtime probe measurement
- initial support verdict

Result:
PixelBrain can already answer support and basic metric questions per browser/platform.

## Phase 2: Glyph Atlas Verification

Deliver:
- glyph atlas render pipeline
- ink-bounds extraction
- fingerprint hashing
- fallback similarity scoring

Result:
PixelBrain can verify actual glyph identity beyond browser-reported metrics.

## Phase 3: ByteCode FontSpec Compiler

Deliver:
- canonical FontSpec IR
- persistent environment-stamped cache
- QA integration
- layout consumer APIs

Result:
Font truth becomes portable and reusable across PixelBrain.

## Phase 4: Canonical Fingerprint Library

Deliver:
- known-good font fingerprints
- browser-family delta heuristics
- confidence tuning over time

Result:
PixelBrain becomes increasingly accurate at identifying fallback and version drift.

---

# 19. QA Requirements

## 19.1 Unit Tests

- capability detection returns normalized flags
- resolution result correctly marks loaded vs fallback-suspect
- measurement bundle includes canonical probes
- cache keys differ when environment differs
- verdict logic maps confidence ranges correctly

## 19.2 Integration Tests

- same font request on different browsers produces environment-stamped distinct results
- failed font load produces fallback or unsupported verdict
- atlas mismatch downgrades confidence
- verified font passes overlay safety flags

## 19.3 Visual / Measurement QA

- inspect atlas render output for canonical fonts
- compare probe widths against expected tolerances
- ensure PixelBrain text overlay systems consume audited metrics correctly

## 19.4 Regression QA

- browser updates must not silently invalidate existing cached assumptions
- changing font asset versions must invalidate prior fingerprint trust where necessary

---

# 20. Risks

## 20.1 Operating System Variance
The same browser family can render differently on different operating systems.

## 20.2 Local Font Version Drift
Users may have different installed versions of nominally identical fonts.

## 20.3 Variable Font Complexity
Metrics may shift when axis values change.

## 20.4 API Availability Limits
Certain introspection capabilities are not available everywhere.

## 20.5 False Atlas Similarity
Very similar fonts may still require additional probe logic to distinguish safely.

---

# 21. Mitigations

- always stamp environment metadata
- never trust family-name resolution alone
- combine metric comparison with atlas verification
- use cache invalidation keyed by environment and font descriptors
- centralize tolerances and confidence thresholds
- allow systems to opt into strict vs relaxed measurement safety modes

---

# 22. Success Criteria

This feature is successful when PixelBrain can:

1. accept a specific font request
2. audit it on Chrome, Firefox, Edge, and Opera
3. determine whether it is truly supported and loaded
4. return measured pixel metrics per environment
5. verify glyph identity through atlas analysis
6. compile the result into ByteCode FontSpec payloads
7. expose safe/unsafe guidance for exact layout consumers

---

# 23. Final Product Statement

This feature converts typography from an assumed browser service into a **PixelBrain-measured rendering material**.

Once implemented, fonts stop being vague CSS wishes and become auditable visual geometry. That means ScrollEditor, TrueSight, and all future text-bound systems can operate on environment-stamped measured truth instead of typographic superstition.

In PixelBrain terms, this is the moment the alphabet stops being fog and becomes terrain.

