# PARAEQ -- Parametric EQ Specification
## "The Resonance Codex" -- Scholomance-Native Audio Shaping
## Spec Version: 3.0 -- 2026-03-10

> The DAW is Scholomance. This is not a plugin targeting external hosts.
> It is a first-class citizen of the Scholomance audio runtime.

---

## Honest State of the Codebase (Read Before Building)

The v2 spec overstated what is ready. This section is the ground truth.

### What exists and is usable today

| Signal | Location | What it gives us |
|--------|----------|-----------------|
| Vowel family breakdown | `usePanelAnalysis.js:379` `buildVowelSummaryFromAnalysis` | `{families: [{id, count, percent}]}` keyed by ARPAbet vowel family |
| School-to-vowel mapping | `src/data/schools.js:15` `VOWEL_FAMILY_TO_SCHOOL` | Canonical ARPAbet -> school lookup. Single source of truth. |
| School colors / glyphs | `src/data/schools.js` `SCHOOLS` | Color, glyph, atmosphere per school |
| Audio node (analyzable) | `ambientPlayer.service.js` | `capabilities.canAnalyze = true` when NOT on Suno fallback |
| School atmosphere | `useAtmosphere.js` | Current school ID, transition state |

### What does NOT exist yet

| Claim in v2 spec | Reality |
|-----------------|---------|
| "usePhonemeEngine drives EQ" | `usePhonemeEngine.jsx:1` returns `{engine: null}`. Pure stub. |
| "Consonant / fricative school mapping" | `VOWEL_FAMILY_TO_SCHOOL` maps vowels only. No consonant tracking in scoring. |
| "Lock mode -- the EQ listens to writing" | Not possible until consonant phoneme analysis is implemented (Gemini/Codex domain). |
| "Universal audio analysis" | Suno iframe fallback sets `capabilities.canAnalyze = false` at line 496-500. PARAEQ spectrum display goes dark on Suno tracks. |
| "Natural Phase, Zero Phase" | No offline render pipeline. Audio R&D work with no foundation here yet. |

### The one mapping that matters for v1

`vowelSummary.families` -> `VOWEL_FAMILY_TO_SCHOOL` -> school density vector -> EQ suggestion.

That chain is completable today with no new analysis work.

---

## Architecture

```
Scholomance AudioContext
    |
    +-- AnalyserNode (input -- pre-EQ)   [only when canAnalyze=true]
    |
    +-- AudioWorkletNode "paraeq-processor"
    |       |
    |       +-- 8x BiquadChain (IIR SOS, minimum phase, up to 48 dB/oct)
    |       +-- MessagePort  <-- band params from React (k-rate, smoothed)
    |
    +-- AnalyserNode (output -- post-EQ)  [only when canAnalyze=true]
    |
    +-- Destination / downstream nodes

React Component Tree
    |
    +-- <ParaEQ />                    [Claude owns: src/components/ParaEQ/]
        +-- <SpectrumCanvas />        [WebAudio AnalyserNode -> Canvas 2D]
        +-- <BandNode x8 />           [Draggable glyph handles]
        +-- <BandStrip />             [Lower control rows]
        +-- <PresetBrowser />
        +-- <SunoNotice />            [Shown when canAnalyze=false]

useParaEQ()                           [Gemini/Codex owns: src/hooks/]
    +-- AudioWorkletNode lifecycle
    +-- Band parameter state + dispatch
    +-- AnalyserNode -> Float32Array feed (60fps rAF, gated on canAnalyze)
    +-- vowelSummary -> school density -> EQ suggestion vector
    +-- CODEx preset CRUD
```

### Agent Ownership

| Layer | Owner | Path |
|-------|-------|------|
| EQ component UI, canvas, glyph nodes | Claude | `src/components/ParaEQ/` |
| AudioWorklet DSP, useParaEQ hook | Gemini/Codex | `src/hooks/useParaEQ.js`, `src/worklets/paraeq.worklet.js` |
| Preset schema, CODEx persistence | Gemini/Codex | `src/data/` |
| Tests | Minimax | `tests/` |

---

## School-to-Frequency Mapping (Canonical Derivation)

The mapping must be derived from the canonical `VOWEL_FAMILY_TO_SCHOOL` in
`src/data/schools.js`. The frequency ranges come from the acoustic phonetics
of those vowels -- specifically their first (F1) and second (F2) formant
frequencies. This is not arbitrary: the vowels the schools own literally
resonate at these frequencies in human speech.

Do not invent a parallel mapping. Import `VOWEL_FAMILY_TO_SCHOOL` and derive.

| School | Owned Vowels (ARPAbet) | Formant Character | EQ Zone | Freq Range |
|--------|----------------------|-------------------|---------|------------|
| VOID | UW, UH, OO | Dark, back, low F2 (~870 Hz) | Sub / Bass | 20--200 Hz |
| SONIC | IH, AO, ER, UR | Mid-range F2 (~920--1990 Hz) | Bass / Low-mid | 80--800 Hz |
| WILL | AE, AA, AH, AX, AW, EH | Open, high F1 (~600--800 Hz) | Mid | 200--800 Hz |
| ALCHEMY | EY, OW, OY, OH | Diphthong F2 transitions | Upper-mid | 800 Hz--3 kHz |
| PSYCHIC | IY, AY | High front, high F2 (~2300 Hz) | Presence / Air | 2--16 kHz |

The center frequency for a suggestion band is the geometric mean of the zone.
Gain is proportional to that school's density in `vowelSummary.families`.

---

## 8-Band Configuration

Bands are unordered -- any band can be any type at any frequency. Defaults
are school-aligned for a useful starting position.

| Band | Default School | Default Type | Default Freq | Default Gain | Default Q |
|------|---------------|-------------|-------------|-------------|----------|
| 1 | VOID | High Pass | 22 Hz | -- | 0.707 |
| 2 | VOID | Peak | 60 Hz | 0 dB | 1.0 |
| 3 | SONIC | Peak | 200 Hz | 0 dB | 0.9 |
| 4 | WILL | Peak | 500 Hz | 0 dB | 0.9 |
| 5 | WILL | Peak | 1.5 kHz | 0 dB | 1.0 |
| 6 | ALCHEMY | Peak | 3 kHz | 0 dB | 1.2 |
| 7 | PSYCHIC | Peak | 8 kHz | 0 dB | 1.0 |
| 8 | PSYCHIC | High Shelf | 12 kHz | 0 dB | 0.707 |

### Per-Band Parameters

| Parameter | Range | Notes |
|-----------|-------|-------|
| Frequency | 10 Hz -- 40 kHz | Log-scale |
| Gain | -30 -> +30 dB | N/A for LP/HP/Notch |
| Q | 0.025 -> 40.0 | Constant-Q bell |
| Filter Type | Enum (see below) | |
| Slope | 6 / 12 / 24 / 36 / 48 dB/oct | LP, HP, Shelf |
| Enabled | bool | Per-band bypass |
| Solo | bool | Hear this band only |
| Suggestion Lock | bool | v3+ only -- see phasing |

### Filter Types

| ID | Type | Notes |
|----|------|-------|
| PEAK | Bell / Peak | |
| LOW_SHELF | Low Shelf | |
| HIGH_SHELF | High Shelf | |
| LOW_PASS | Low Pass | |
| HIGH_PASS | High Pass | |
| BAND_PASS | Band Pass | |
| NOTCH | Notch / Band Reject | |
| ALL_PASS | All Pass | Phase rotation, 0 dB magnitude |
| TILT | Tilt Shelf | LS + HS mirrored, pivot at freq |

---

## DSP Engine (AudioWorkletProcessor)

### V1 Scope: Minimum Phase IIR Only

Cascaded biquad second-order sections (SOS). This is the only phase mode
shipping in v1. It is the right default -- zero latency, well understood,
and sufficient to validate the entire UX and phoneme suggestion loop.

- Up to 4 biquad sections per band (48 dB/oct at 8th order)
- Transposed Direct Form II -- numerically stable at high Q and low freq
- 64-bit coefficient precision internally, 32-bit I/O at worklet boundary
- Coefficient smoothing via per-sample linear interpolation over 50ms ramp
  (eliminates zipper noise on automation and suggestion-driven changes)
- RBJ Audio EQ Cookbook coefficients throughout

### Phase Modes (Post-V1 Roadmap)

Do not build these in v1. Add only when the minimum-phase path is validated
in production with real audio.

| Mode | What it needs before building |
|------|-------------------------------|
| Linear Phase | Partitioned convolution engine, IR generation, PDC plumbing |
| Natural Phase | All-pass group delay correction -- audio R&D work |
| Zero Phase | Offline render pipeline -- does not exist in this repo |

### Spectrum Analysis

- Input `AnalyserNode`: FFT size 2048, Hann window, 50% overlap
- Output `AnalyserNode`: same
- `useParaEQ` calls `getFloatFrequencyData()` in `requestAnimationFrame`
- Passed to `<SpectrumCanvas />` as `inputSpectrum` / `outputSpectrum` props
- 8x exponential averaging to reduce noise flutter
- Both nodes are NO-OP when `capabilities.canAnalyze === false` (Suno fallback)
- `<SunoNotice />` displayed in canvas area explaining the limitation

---

## Build Phases

Ship in this order. Do not skip phases.

### Phase 1 -- Manual EQ in Listen Console

Deliverables:
- `<ParaEQ />` component in Listen page
- `useParaEQ` hook managing AudioWorkletNode lifecycle
- `paraeq.worklet.js` implementing 8-band minimum-phase IIR
- Draggable band nodes on spectrum canvas
- Per-band mute / solo
- A/B compare
- Suno fallback notice
- No phoneme integration yet

Done when: A user can open Listen, drag band nodes, hear the EQ on the audio
that is currently playing, and mute/solo bands.

### Phase 2 -- Studio Presets

Deliverables:
- `<PresetBrowser />` with built-in studio presets (see list below)
- CODEx-persisted user presets (save / load / delete)
- Output gain trim control
- Auto-gain compensation toggle

Done when: A user can load "Broadcast Voice", hear a difference, save their
own preset, and reload it in a new session.

### Phase 3 -- Vowel-Driven Suggestion Overlay

Deliverables:
- `useParaEQ` consumes `vowelSummary` from `usePanelAnalysis`
- School density vector derived via `VOWEL_FAMILY_TO_SCHOOL` (the canonical import)
- Ghost suggestion curve rendered on canvas (dashed, school-hued, 40% opacity)
- Accept button: applies suggestion to active bands
- No auto-driving of bands yet -- user action required

Done when: A user writing a PSYCHIC-heavy scroll sees a suggestion curve lift
above 2kHz. Clicking Accept applies it.

Signal path for Phase 3:
```
usePanelAnalysis.buildVowelSummaryFromAnalysis()
    -> vowelSummary.families (ARPAbet -> percent)
    -> VOWEL_FAMILY_TO_SCHOOL (canonical lookup)
    -> { VOID: 0.05, SONIC: 0.30, WILL: 0.35, ALCHEMY: 0.15, PSYCHIC: 0.15 }
    -> map each school density to suggestion gain at that school's center freq
    -> render ghost curve on SpectrumCanvas
```

### Phase 4 -- Suggestion Lock (Evaluate First)

Before building: run Phase 3 in production and answer:
- Do users find the suggestion musically useful, or is it noise?
- Does the density signal change fast enough to be meaningful?
- Is the vowel signal strong enough without consonant tracking?

If yes to the above: implement per-band lock toggle that continuously drives
gain from the school density vector in real-time.

If no: lock mode is a feature for after `usePhonemeEngine` is real (Gemini/Codex
domain). Note in a comment referencing `usePhonemeEngine.jsx:1`.

---

## Built-in Presets

### Studio Presets

| Name | Band Setup |
|------|-----------|
| Clean Slate | All bands bypassed |
| Broadcast Voice | HP 80Hz 24dB, Peak 200Hz -3dB Q1, Peak 3kHz +2dB Q2, HS 12kHz +1.5dB |
| Air and Presence | Peak 5kHz +1.5dB Q2, HS 15kHz +3dB |
| Vocal Warmth | LS 250Hz +2dB, Peak 400Hz +1dB Q0.9 |
| De-Harsh | Notch 3.5kHz -3dB Q3, Peak 8kHz -1.5dB |
| Kick Drum | HP 40Hz, Peak 60Hz +4dB Q3, Peak 100Hz -3dB, Peak 5kHz +3dB Q4 |
| Snare Snap | HP 80Hz, Peak 200Hz +2dB, Peak 800Hz -2dB, Peak 5kHz +4dB Q2 |
| Bass Guitar | HP 40Hz, Peak 80Hz +3dB, Peak 800Hz +1dB, Peak 2kHz +1.5dB |
| Acoustic Guitar | HP 80Hz, Peak 300Hz -2dB, Peak 2kHz +1dB, HS 10kHz +1.5dB |
| Surgical Notch | Single notch at 1kHz, Q10, user-positioned |

### School Ritual Presets (Phase 3+, requires suggestion overlay)

| Name | School | Description |
|------|--------|-------------|
| Void Rite | VOID | Sub shelf, hollowed mids |
| Sonic Inscription | SONIC | Bass resonance lifted, upper-mid pulled |
| Will Surge | WILL | Forward mid push |
| Alchemic Transmutation | ALCHEMY | Upper-mid shimmer |
| Psychic Veil | PSYCHIC | Air lifted, low body reduced |

---

## UI Specification

### Visual Language

| Element | Value |
|---------|-------|
| Canvas bg | #0d0b06 |
| Input spectrum | rgba(201,162,39,0.08) |
| Output spectrum | rgba(201,162,39,0.22) |
| EQ curve | #c9a227 + drop-shadow glow |
| Suggestion ghost | dashed, school color, 40% opacity |
| Grid lines | rgba(201,162,39,0.10) |
| UI chrome | Leather texture, gold inlay, embossed panels |
| Fonts | Space Grotesk (UI), JetBrains Mono (values) |

### School Colors (from SCHOOLS in schools.js -- do not redefine)

| School | Color |
|--------|-------|
| SONIC | #651fff |
| PSYCHIC | #00E5FF |
| VOID | #a1a1aa |
| ALCHEMY | #D500F9 |
| WILL | #FF8A00 |

Import directly from `src/data/schools.js`. Do not hardcode these in ParaEQ.

### School Glyphs (from SCHOOLS.glyph -- do not redefine)

| School | Glyph |
|--------|-------|
| SONIC | note symbol (see schools.js) |
| PSYCHIC | triangle (see schools.js) |
| VOID | empty set (see schools.js) |
| ALCHEMY | alembic (see schools.js) |
| WILL | lightning (see schools.js) |

### Layout (ASCII)

```
+------------------------------------------------------------------+
| PARAEQ  [Phase v]  [Preset v]  [A | B]  [AUTO-GAIN]  [BYPASS]   |
| ---------------------------------------------------------------- |
| +18dB |                                                           |
|       |     spectrum canvas (Canvas 2D, 60fps)                   |
|       |   ....... input FFT (dim gold)                           |
|  0    |---------------------------------------------------       |
|       |   ####### output FFT (bright gold)                       |
|       |      /\            suggestion ghost (dashed)             |
| -18dB |                                                           |
|    10Hz   100Hz    1kHz   10kHz  40kHz                          |
|                                                                   |
|  [glyph] [glyph] [glyph] [glyph] [glyph] [glyph] [glyph] [glyph]|
| ---------------------------------------------------------------- |
|  1 VOID  HP    22Hz  --         24dB  [M][S]                    |
|  2 VOID  Peak  60Hz  +0.0dB  Q:1.0   [M][S]                    |
|  ...                                                              |
|  [Output --------o--------] -0.0dB   [MORPH A=======o=====B]   |
+------------------------------------------------------------------+
```

### Suno Fallback Notice (shown when canAnalyze=false)

```
+------------------------------------------------------------------+
|  [!] Spectrum display unavailable -- Suno embed active           |
|      EQ processing is still applied to the audio chain.          |
+------------------------------------------------------------------+
```

### Interaction Model

| Action | Result |
|--------|--------|
| Click empty canvas | Create band node at cursor freq x gain |
| Drag node horizontal | Frequency |
| Drag node vertical | Gain |
| Scroll on node | Q adjust |
| Shift+drag | Fine mode (1/10x sensitivity) |
| Right-click node | Context: type, slope, school color, solo, mute, delete |
| Double-click node | Precision popover with numeric inputs |
| Alt+click band label | Solo |
| Hover node | Highlight that band's individual curve contribution |

---

## File Structure

```
src/
    components/
        ParaEQ/                       [Claude owns]
            index.jsx                 Root, layout, props surface
            SpectrumCanvas.jsx        Canvas 2D, dual FFT, suggestion ghost
            BandNode.jsx              Draggable glyph node
            EQCurve.jsx               Summed + per-band SVG paths
            BandStrip.jsx             Lower parameter rows
            PresetBrowser.jsx         Dropdown + search
            SunoNotice.jsx            canAnalyze=false message
            MorphSlider.jsx           A/B morph
            ParaEQ.css                Grimoire tokens

    hooks/
        useParaEQ.js                  [Gemini/Codex owns]
                                      AudioWorkletNode lifecycle
                                      Band state management
                                      vowelSummary -> school density (Phase 3)
                                      AnalyserNode -> spectrum feed
                                      CODEx preset CRUD

    worklets/
        paraeq.worklet.js             [Gemini/Codex owns]
                                      AudioWorkletProcessor
                                      IIR biquad SOS chains x8
                                      MessagePort param receive
                                      Coefficient smoothing

    data/
        presets.paraeq.schema.js      [Gemini/Codex owns]
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| AudioWorklet CPU | < 2% at 44.1kHz, 128-sample quantum, 8 bands |
| Canvas render | 60 fps, no main-thread blocking |
| Param -> worklet latency | < 5ms |
| Vowel summary -> suggestion update | < 100ms from text change |
| Coefficient ramp | 50ms, inaudible |

---

## Key Constraints

1. Import school colors and glyphs from `src/data/schools.js` -- never redefine.
2. Derive EQ-school frequency mapping from `VOWEL_FAMILY_TO_SCHOOL` -- not
   from consonant classes, which are not tracked in the scoring system.
3. Gate all AnalyserNode reads on `capabilities.canAnalyze`. Show `<SunoNotice />`
   when false. EQ processing continues regardless.
4. `usePhonemeEngine` is a stub. Do not design Phase 3 around it. Use
   `buildVowelSummaryFromAnalysis` from `usePanelAnalysis.js:379` instead.
5. Do not implement Natural Phase or Zero Phase in v1. They have no foundation
   in the current codebase.
6. Minimum Phase IIR is not a compromise -- it is the correct default for a
   real-time EQ. Validate it fully before expanding phase mode scope.

---

## The Long Game

The phoneme-driven EQ remains the most novel feature -- writing style as
sonic signature -- but it depends on `usePhonemeEngine` becoming real.
That is Gemini/Codex work. Until then, the vowel summary gives us a
meaningful but partial signal (vowels only, no consonants).

The full loop:
    Player writes -> phonemes analyzed -> school density -> EQ shapes the audio
    -> player hears their school -> writes deeper into it -> school identity deepens

...is architecturally sound. It just needs the phoneme stub to be filled.
Build the EQ correctly now so it is ready to receive that signal when it arrives.

---

*Supersedes PARAEQ_PLUGIN.md v1 (JUCE plugin) and v2 (overclaimed phoneme integration).*
*Architecture: Scholomance-Native WebAudio AudioWorklet.*
*Encoding: UTF-8.*
