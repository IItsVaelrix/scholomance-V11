# Arcane Laboratory — Bytecode Blueprint Collection

**PDR Reference:** Arcane Laboratory Aesthetic PDR Blueprint  
**Target:** PixelBrain V2 First True Stress Test  
**Status:** Ready for Compilation  
**Date:** April 1, 2026

---

## Collection Overview

This document contains **17 bytecode blueprints** that collectively define the Arcane Laboratory environment:

| Blueprint ID | Category | Target System | Priority |
|--------------|----------|---------------|----------|
| `lab-core-reactor` | Anchor | Central Orb | P0 |
| `lab-reactor-pulse` | Anchor | Reactor Glow | P0 |
| `lab-floor-glyph` | Anchor | Floor Channels | P1 |
| `lab-workbench-lamp` | Support | Left Zone Light | P1 |
| `lab-vial-cluster` | Support | Reagent Shelf | P1 |
| `lab-rune-wall` | Support | Background | P1 |
| `lab-particle-motes` | Accent | Ambient Floaters | P2 |
| `lab-steam-vent` | Accent | Atmospheric | P2 |
| `lab-hanging-chain` | Accent | Foreground | P2 |
| `lab-gear-rotation` | Mechanical | Device Wall | P2 |
| `lab-crystal-hum` | Mechanical | Crystal Cluster | P2 |
| `lab-tube-drift` | Mechanical | Alchemy Tubes | P2 |
| `lab-glyph-hover` | Event | Interactive | P3 |
| `lab-catalyst-burst` | Event | Reaction | P3 |
| `lab-beam-transfer` | Event | Power Arc | P3 |
| `lab-diagnostic-altar` | AMP Test | Complex Object | P0 |
| `lab-ambient-bed` | Environment | Global Mood | P1 |

**Color Palette:** Violet + Gold (primary), Cyan (micro-accent)  
**Motion Discipline:** Anchor (2) + Support (4) + Accent (4) + Event (3)  
**Total Blueprints:** 17

---

## P0 — Anchor Blueprints

### BLUEPRINT 1: Core Reactor Orb

```text
ANIM_START
ID lab-core-reactor
NAME Arcane Core Reactor — Primary Anchor
TARGET id lab-reactor-orb
DESCRIPTION Central alchemical apparatus — rotating orb with gyre motion and reactive glow

DURATION 4000
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP infinite
PHASE 0

ROTATE
  BASE 0
  PEAK 360
  ENV constant
  VALUE 1

SCALE
  BASE 1.0
  PEAK 1.04
  ENV sine
  AMPLITUDE 0.02
  PERIOD 4000

GLOW
  BASE 0.3
  PEAK 0.7
  ENV pulse
  PEAK_VALUE 0.8
  DURATION 2000
  DECAY 0.002

OPACITY
  BASE 1.0
  PEAK 1.0

SYMMETRY
  TYPE radial
  ORDER 8
  ORIGIN 0.5 0.5
  SPACE local

GRID
  MODE lattice
  LATTICE reactor-lattice
  SNAP true

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 100

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8
CONSTRAINT MAX_PROPERTY_COUNT 6

QA INVARIANT radial-symmetry-preserved
QA INVARIANT scale-remains-within-bounds
QA INVARIANT deterministic-output

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG anchor
METADATA TAG reactor
METADATA TAG central

ANIM_END
```

**Compiled Output Preview:**
```json
{
  "formula": "rotate(t) = 360 * (t / 4000); scale(t) = 1.0 + 0.02 * sin(2 * PI * t / 4000); glow(t) = 0.3 + 0.5 * pulse(t, 2000, 0.002)",
  "coordinates": [{ "x": 0.5, "y": 0.5, "space": "lattice" }],
  "symmetry": { "type": "radial", "order": 8 },
  "grid": { "mode": "lattice", "snap": true }
}
```

---

### BLUEPRINT 2: Reactor Pulse Glow

```text
ANIM_START
ID lab-reactor-pulse
NAME Reactor Glow Pulse — Secondary Anchor
TARGET id lab-reactor-glow
DESCRIPTION Emissive halo that breathes with reactor — tight radius, pixel-perfect

DURATION 2400
DELAY 200
EASE TOKEN IN_OUT_ARC
LOOP infinite
PHASE 0.25

GLOW
  BASE 0.2
  PEAK 0.6
  ENV expDecay
  START 0.6
  HALFLIFE 800

SCALE
  BASE 1.0
  PEAK 1.08
  ENV sine
  AMPLITUDE 0.04
  PERIOD 2400

OPACITY
  BASE 0.6
  PEAK 0.9
  ENV triangle
  AMPLITUDE 0.15
  PERIOD 2400

SYMMETRY
  TYPE radial
  ORDER 4
  ORIGIN 0.5 0.5
  SPACE local

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 95

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8

QA INVARIANT radial-symmetry-preserved
QA INVARIANT glow-decays-monotonically

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG anchor
METADATA TAG glow
METADATA TAG halo

ANIM_END
```

---

### BLUEPRINT 3: Floor Glyph Channels

```text
ANIM_START
ID lab-floor-glyph
NAME Floor Ritual Channels — Light Flow
TARGET id lab-floor-glyphs
DESCRIPTION Arcane tile inlay with traveling light — guides focus to reactor

DURATION 3000
DELAY 0
EASE TOKEN LINEAR
LOOP infinite
PHASE 0

GLOW
  BASE 0.1
  PEAK 0.5
  ENV keyed
  KEYFRAMES 0,0.1,0.5,0.2,0.1

OPACITY
  BASE 0.4
  PEAK 0.8
  ENV sine
  AMPLITUDE 0.2
  PERIOD 3000

TRANSLATE_Y
  BASE 0
  PEAK 2
  ENV triangle
  AMPLITUDE 1
  PERIOD 3000

GRID
  MODE cell-space
  SNAP true
  CELL_WIDTH 64
  CELL_HEIGHT 64

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 5

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT grid-snap-stable
QA INVARIANT envelope-bounds-respected

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG anchor
METADATA TAG floor
METADATA TAG channels

ANIM_END
```

---

## P1 — Support Blueprints

### BLUEPRINT 4: Workbench Lamp

```text
ANIM_START
ID lab-workbench-lamp
NAME Workbench Arcane Lamp — Left Zone
TARGET id lab-workbench-lamp
DESCRIPTION Small animated candle — warm flicker, practical light source

DURATION 1800
DELAY 0
EASE TOKEN SPRING_GENTLE
LOOP infinite
PHASE 0

GLOW
  BASE 0.4
  PEAK 0.7
  ENV pulse
  PEAK_VALUE 0.75
  DURATION 600
  DECAY 0.003

SCALE
  BASE 1.0
  PEAK 1.02
  ENV sine
  AMPLITUDE 0.01
  PERIOD 1800

OPACITY
  BASE 0.8
  PEAK 1.0
  ENV triangle
  AMPLITUDE 0.1
  PERIOD 900

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 50

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT scale-remains-within-bounds

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG support
METADATA TAG lamp
METADATA TAG workbench

ANIM_END
```

---

### BLUEPRINT 5: Vial Cluster

```text
ANIM_START
ID lab-vial-cluster
NAME Reagent Vial Cluster — Shelf Glow
TARGET id lab-vial-shelf
DESCRIPTION Multiple glowing containers — staggered pulse, color variation

DURATION 2200
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP infinite
PHASE 0

GLOW
  BASE 0.2
  PEAK 0.5
  ENV sine
  AMPLITUDE 0.15
  PERIOD 2200

OPACITY
  BASE 0.6
  PEAK 0.9
  ENV triangle
  AMPLITUDE 0.15
  PERIOD 2200

SYMMETRY
  TYPE mirror-y
  ORDER 2
  ORIGIN 0.5 0.3
  SPACE local

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 45

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT scale-remains-within-bounds

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG support
METADATA TAG vials
METADATA TAG shelf

ANIM_END
```

---

### BLUEPRINT 6: Rune Wall

```text
ANIM_START
ID lab-rune-wall
NAME Background Rune Wall — Ambient Shimmer
TARGET id lab-rune-wall
DESCRIPTION Embedded stone runes with subtle activation pattern

DURATION 5000
DELAY 0
EASE TOKEN LINEAR
LOOP infinite
PHASE 0

GLOW
  BASE 0.05
  PEAK 0.25
  ENV keyed
  KEYFRAMES 0,0.05,0.15,0.25,0.1,0.05

OPACITY
  BASE 0.3
  PEAK 0.5
  ENV sine
  AMPLITUDE 0.1
  PERIOD 5000

GRID
  MODE lattice
  LATTICE rune-lattice
  SNAP true

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 10

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT grid-snap-stable
QA INVARIANT deterministic-output

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG support
METADATA TAG runes
METADATA TAG background

ANIM_END
```

---

### BLUEPRINT 7: Ambient Particle Motes

```text
ANIM_START
ID lab-particle-motes
NAME Floating Arcane Motes — Atmospheric
TARGET id lab-particle-system
DESCRIPTION Suspended dust/pollen particles — slow drift, additive blend

DURATION 6000
DELAY 0
EASE TOKEN LINEAR
LOOP infinite
PHASE 0

TRANSLATE_X
  BASE 0
  PEAK 10
  ENV sine
  AMPLITUDE 5
  PERIOD 6000

TRANSLATE_Y
  BASE 0
  PEAK -8
  ENV sine
  AMPLITUDE 4
  PERIOD 4000

OPACITY
  BASE 0.2
  PEAK 0.5
  ENV triangle
  AMPLITUDE 0.15
  PERIOD 3000

SCALE
  BASE 0.8
  PEAK 1.2
  ENV sine
  AMPLITUDE 0.2
  PERIOD 2000

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 200

CONSTRAINT DETERMINISTIC false
CONSTRAINT MAX_FRAME_MS 8
CONSTRAINT MAX_PROPERTY_COUNT 8

QA INVARIANT envelope-bounds-respected

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG accent
METADATA TAG particles
METADATA TAG atmosphere

ANIM_END
```

---

### BLUEPRINT 8: Steam Vent

```text
ANIM_START
ID lab-steam-vent
NAME Alchemical Steam Vent — Atmospheric
TARGET id lab-steam-vent-left
DESCRIPTION Luminous vapor release — intermittent, upward drift

DURATION 4000
DELAY 500
EASE TOKEN OUT_ARC
LOOP infinite
PHASE 0

TRANSLATE_Y
  BASE 0
  PEAK -40
  ENV expDecay
  START 0
  HALFLIFE 2000

OPACITY
  BASE 0
  PEAK 0.4
  ENV pulse
  PEAK_VALUE 0.4
  DURATION 1500
  DECAY 0.001

SCALE
  BASE 0.5
  PEAK 1.5
  ENV expDecay
  START 0.5
  HALFLIFE 1500

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 150

CONSTRAINT DETERMINISTIC false
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT glow-decays-monotonically

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG accent
METADATA TAG steam
METADATA TAG atmosphere

ANIM_END
```

---

### BLUEPRINT 9: Hanging Chain

```text
ANIM_START
ID lab-hanging-chain
NAME Foreground Chain Sway — Depth Framing
TARGET id lab-chain-foreground
DESCRIPTION Subtle pendulum motion — sparse foreground dressing

DURATION 3500
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP infinite
PHASE 0

ROTATE
  BASE 0
  PEAK 3
  ENV sine
  AMPLITUDE 1.5
  PERIOD 3500

TRANSLATE_X
  BASE 0
  PEAK 4
  ENV sine
  AMPLITUDE 2
  PERIOD 3500

OPACITY
  BASE 0.6
  PEAK 0.8
  ENV constant
  VALUE 0.7

COMPOSITE PASS pixelbrain
  BLEND normal
  Z_LAYER 250

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT phase-offset-correct

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG accent
METADATA TAG chain
METADATA TAG foreground

ANIM_END
```

---

### BLUEPRINT 11: Crystal Hum

```text
ANIM_START
ID lab-crystal-hum
NAME Crystal Cluster Resonance — Device Wall
TARGET id lab-crystal-cluster
DESCRIPTION Vibrating crystal formation — internal light pulse

DURATION 1600
DELAY 0
EASE TOKEN SPRING
LOOP infinite
PHASE 0

SCALE
  BASE 1.0
  PEAK 1.03
  ENV triangle
  AMPLITUDE 0.015
  PERIOD 1600

GLOW
  BASE 0.3
  PEAK 0.6
  ENV sine
  AMPLITUDE 0.15
  PERIOD 800

OPACITY
  BASE 0.7
  PEAK 0.95
  ENV triangle
  AMPLITUDE 0.125
  PERIOD 1600

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 42

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8

QA INVARIANT scale-remains-within-bounds

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG mechanical
METADATA TAG crystal
METADATA TAG resonance

ANIM_END
```

---

### BLUEPRINT 12: Tube Liquid Drift

```text
ANIM_START
ID lab-tube-drift
NAME Alchemical Tube Flow — Glass Apparatus
TARGET id lab-tube-assembly
DESCRIPTION Colored liquid with slow internal drift — peristaltic motion

DURATION 5000
DELAY 0
EASE TOKEN LINEAR
LOOP infinite
PHASE 0

TRANSLATE_Y
  BASE 0
  PEAK 3
  ENV sine
  AMPLITUDE 1.5
  PERIOD 5000

GLOW
  BASE 0.2
  PEAK 0.4
  ENV keyed
  KEYFRAMES 0,0.2,0.3,0.4,0.3,0.2

OPACITY
  BASE 0.6
  PEAK 0.8
  ENV sine
  AMPLITUDE 0.1
  PERIOD 2500

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 38

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16

QA INVARIANT envelope-bounds-respected

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG mechanical
METADATA TAG tubes
METADATA TAG alchemy

ANIM_END
```

---

## P3 — Event Blueprints

### BLUEPRINT 13: Glyph Hover Activation

```text
ANIM_START
ID lab-glyph-hover
NAME Interactive Glyph Hover — Response
TARGET id lab-glyph-interactive
DESCRIPTION Hover state activation — bright flare, fast response

DURATION 400
DELAY 0
EASE TOKEN OUT_ARC
LOOP 1
PHASE 0

GLOW
  BASE 0.1
  PEAK 0.9
  ENV pulse
  PEAK_VALUE 0.9
  DURATION 200
  DECAY 0.005

SCALE
  BASE 1.0
  PEAK 1.08
  ENV expDecay
  START 1.08
  HALFLIFE 150

OPACITY
  BASE 0.5
  PEAK 1.0
  ENV expDecay
  START 1.0
  HALFLIFE 200

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 120

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8

QA INVARIANT scale-remains-within-bounds
QA INVARIANT glow-decays-monotonically

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG event
METADATA TAG hover
METADATA TAG interactive

ANIM_END
```

---

### BLUEPRINT 14: Catalyst Burst

```text
ANIM_START
ID lab-catalyst-burst
NAME Alchemical Catalyst Ignition — Reaction Event
TARGET id lab-catalyst-chamber
DESCRIPTION Sudden energy release — particle burst, light flash

DURATION 800
DELAY 0
EASE TOKEN SPRING_SNAPPY
LOOP 1
PHASE 0

GLOW
  BASE 0.1
  PEAK 1.0
  ENV expDecay
  START 1.0
  HALFLIFE 300

SCALE
  BASE 1.0
  PEAK 1.25
  ENV expDecay
  START 1.25
  HALFLIFE 400

OPACITY
  BASE 0.4
  PEAK 1.0
  ENV expDecay
  START 1.0
  HALFLIFE 350

SYMMETRY
  TYPE radial
  ORDER 4
  ORIGIN 0.5 0.5
  SPACE local

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 180

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8

QA INVARIANT radial-symmetry-preserved
QA INVARIANT glow-decays-monotonically

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG event
METADATA TAG catalyst
METADATA TAG burst

ANIM_END
```

---

### BLUEPRINT 15: Beam Transfer

```text
ANIM_START
ID lab-beam-transfer
NAME Power Beam Arc — Energy Transfer
TARGET id lab-beam-emitter
DESCRIPTION Arcane energy traveling between nodes — fast, bright

DURATION 600
DELAY 100
EASE TOKEN IN_OUT_ARC
LOOP 1
PHASE 0

TRANSLATE_X
  BASE 0
  PEAK 120
  ENV sine
  AMPLITUDE 60
  PERIOD 600

GLOW
  BASE 0
  PEAK 0.9
  ENV pulse
  PEAK_VALUE 0.9
  DURATION 400
  DECAY 0.004

OPACITY
  BASE 0
  PEAK 0.8
  ENV triangle
  AMPLITUDE 0.4
  PERIOD 600

SCALE
  BASE 0.5
  PEAK 1.0
  ENV triangle
  AMPLITUDE 0.25
  PERIOD 600

COMPOSITE PASS pixelbrain
  BLEND additive
  Z_LAYER 160

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8

QA INVARIANT envelope-bounds-respected

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG event
METADATA TAG beam
METADATA TAG transfer

ANIM_END
```

---

## P0 — AMP Diagnostic

### BLUEPRINT 16: Diagnostic Altar (Complex)

```text
ANIM_START
ID lab-diagnostic-altar
NAME AMP Diagnostic Altar — Complex Test Object
TARGET id lab-diagnostic-device
DESCRIPTION Deliberately complex — multiple loops, reactive lights, debug state

DURATION 3200
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP infinite
PHASE 0

ROTATE
  BASE 0
  PEAK 180
  ENV sine
  AMPLITUDE 90
  PERIOD 3200

SCALE
  BASE 1.0
  PEAK 1.06
  ENV sine
  AMPLITUDE 0.03
  PERIOD 1600

GLOW
  BASE 0.2
  PEAK 0.7
  ENV keyed
  KEYFRAMES 0,0.2,0.5,0.7,0.5,0.3,0.2

OPACITY
  BASE 0.8
  PEAK 1.0
  ENV triangle
  AMPLITUDE 0.1
  PERIOD 1600

TRANSLATE_Y
  BASE 0
  PEAK -6
  ENV sine
  AMPLITUDE 3
  PERIOD 3200

SYMMETRY
  TYPE radial
  ORDER 4
  ORIGIN 0.5 0.5
  SPACE local

GRID
  MODE lattice
  LATTICE diagnostic-lattice
  SNAP true

COMPOSITE PASS hybrid
  BLEND additive
  Z_LAYER 110

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 8
CONSTRAINT MAX_PROPERTY_COUNT 10

QA INVARIANT radial-symmetry-preserved
QA INVARIANT scale-remains-within-bounds
QA INVARIANT glow-decays-monotonically
QA INVARIANT deterministic-output

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG diagnostic
METADATA TAG AMP-test
METADATA TAG complex

ANIM_END
```

---

## P1 — Environment Bed

### BLUEPRINT 17: Ambient Light Bed

```text
ANIM_START
ID lab-ambient-bed
NAME Global Ambient Mood — Environmental Base
TARGET id lab-ambient-layer
DESCRIPTION Very low intensity cool shadow wash — depth without flatten

DURATION 8000
DELAY 0
EASE TOKEN LINEAR
LOOP infinite
PHASE 0

OPACITY
  BASE 0.15
  PEAK 0.25
  ENV sine
  AMPLITUDE 0.05
  PERIOD 8000

GLOW
  BASE 0.05
  PEAK 0.12
  ENV sine
  AMPLITUDE 0.035
  PERIOD 4000

COMPOSITE PASS pixelbrain
  BLEND normal
  Z_LAYER 1

CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 32

QA INVARIANT envelope-bounds-respected

METADATA AUTHOR vaelrix
METADATA FEATURE arcane-laboratory
METADATA TAG environment
METADATA TAG ambient
METADATA TAG bed

ANIM_END
```

---

## Execution Order

For optimal visual coherence, execute blueprints in this order:

```
1. lab-ambient-bed (environment foundation)
2. lab-floor-glyph (floor layer)
3. lab-rune-wall (background)
4. lab-gear-rotation (device wall base)
5. lab-tube-drift (apparatus)
6. lab-crystal-hum (crystal cluster)
7. lab-vial-cluster (shelf)
8. lab-workbench-lamp (workbench)
9. lab-core-reactor (central anchor)
10. lab-reactor-pulse (reactor halo)
11. lab-diagnostic-altar (complex object)
12. lab-particle-motes (atmosphere)
13. lab-steam-vent (atmosphere)
14. lab-hanging-chain (foreground)
15. [EVENT] lab-glyph-hover (on hover)
16. [EVENT] lab-catalyst-burst (on trigger)
17. [EVENT] lab-beam-transfer (on trigger)
```

---

## Color Encoding Notes

All blueprints assume the following color mapping via PixelBrain school palette:

| Token | Hex | Usage |
|-------|-----|-------|
| `VOID_PURPLE` | `#6B4C9A` | Primary glow (reactor, runes) |
| `SONIC_GOLD` | `#D4AF37` | Secondary accent (brass, gears) |
| `ALCHEMY_CYAN` | `#00CFC8` | Micro-accent (tubes, crystals) |
| `NEAR_BLACK` | `#0A0A0F` | Base materials |
| `CHARCOAL` | `#1A1A24` | Secondary surfaces |

---

## QA Validation Commands

```bash
# Validate all blueprints parse correctly
npm run blueprint:validate --all

# Compile to PixelBrain target
npm run blueprint:compile --target=pixelbrain --output=dist/lab-blueprints/

# Run QA invariant checks
npm run blueprint:qa --invariants=all

# Generate parity report (CSS vs Phaser vs PixelBrain)
npm run blueprint:parity --blueprints=lab-core-reactor,lab-diagnostic-altar
```

---

## Integration Checklist

- [ ] All 17 blueprints parse without errors
- [ ] All blueprints pass semantic validation
- [ ] PixelBrain adapter wired to existing symmetry/lattice engines
- [ ] Execution order respected in scene assembly
- [ ] Color palette mapped to school colors
- [ ] Event blueprints triggered by correct interactions
- [ ] Performance budget maintained (<16ms frame time)
- [ ] Visual QA: screenshot regression baselines captured
- [ ] Interaction QA: hover states pixel-perfect
- [ ] AMP QA: no motion conflicts or desync

---

**Status:** Ready for compilation and execution  
**Next:** Wire PixelBrain adapter, execute in scene, capture baselines

*Generated from Arcane Laboratory Aesthetic PDR — April 1, 2026*
te parity report (CSS vs Phaser vs PixelBrain)
npm run blueprint:parity --blueprints=lab-core-reactor,lab-diagnostic-altar
```

---

## Integration Checklist

- [ ] All 17 blueprints parse without errors
- [ ] All blueprints pass semantic validation
- [ ] PixelBrain adapter wired to existing symmetry/lattice engines
- [ ] Execution order respected in scene assembly
- [ ] Color palette mapped to school colors
- [ ] Event blueprints triggered by correct interactions
- [ ] Performance budget maintained (<16ms frame time)
- [ ] Visual QA: screenshot regression baselines captured
- [ ] Interaction QA: hover states pixel-perfect
- [ ] AMP QA: no motion conflicts or desync

---

**Status:** Ready for compilation and execution  
**Next:** Wire PixelBrain adapter, execute in scene, capture baselines

*Generated from Arcane Laboratory Aesthetic PDR — April 1, 2026*
