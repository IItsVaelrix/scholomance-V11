# Product Design Requirements
## Animation AMP + Microprocessor Fabric for Scholomance / PixelBrain

**Document Purpose:** Define a codebase-aligned product and engineering requirements document for migrating motion behavior into an AMP-routable, microprocessor-driven animation architecture across the Scholomance / PixelBrain surface.

**Classification:** Architectural with behavioral impact

**Status:** Proposed

**Primary Goal:** Ensure every animation in the application is AMP-aware and microprocessor-transformable, while preserving performance, debuggability, determinism, and UI maintainability.

---

# 1. Executive Summary

The current architecture direction across the codebase already favors:

- authoritative backend-authored truth,
- stable contracts,
- modular processing pipelines,
- bytecode persistence,
- thin UI projection layers,
- QA-visible deterministic outputs.

This is visible in the existing Symmetry AMP, which detects symmetry and can apply it to lattice cells, and in the broader Scholomance architecture direction where one canonical representation feeds many specialist pipes before a fused output is rendered.

This PDR proposes applying the same architectural philosophy to motion.

## Core decision

All animation should pass through a shared **Animation AMP layer** with specialized **motion microprocessors**.

However:

- not every animation should become a custom monolithic AMP,
- not every motion effect should require bespoke orchestration,
- and the AMP must remain thin enough to route, normalize, and validate rather than becoming a god-object.

The correct implementation is:

```text
Animation Intent -> Animation AMP -> Motion Microprocessors -> Fused Motion Output -> Renderer
```

This architecture allows the codebase to treat animation as a first-class, inspectable system rather than a scattered field of ad hoc CSS, Framer Motion props, inline transforms, and page-local timing assumptions.

---

# 2. Why This Fits the Existing Codebase

This proposal is not a foreign transplant. It matches patterns already present in the codebase.

## 2.1 Symmetry pipeline precedent

The current Symmetry AMP already:

- analyzes uploaded image data for structural truth,
- selects a best-fit symmetry model,
- emits structured metadata such as `type`, `confidence`, `axis`, `scores`, `suggestions`, and `significant`,
- applies symmetry to lattice cells,
- and generates overlay instructions for rendering.

That establishes a pattern of:

1. detect truth,
2. normalize into contract,
3. transform through bounded logic,
4. render from structured output.

## 2.2 Bytecode-first precedent

The recent architectural direction in Scholomance has already shifted important rendering truth to authoritative backend or processor-authored formats, including bytecode-backed output and versioned payloads.

## 2.3 Compiler / pipe / fusion precedent

The VerseIR plan establishes a durable design pattern:

- compile once,
- run specialized pipes in parallel,
- fuse into one authoritative output,
- keep UI consumer-thin.

Animation can use the same principle:

- normalize animation request once,
- run motion transforms through specialized microprocessors,
- fuse into a motion output contract,
- let the renderer consume it without re-deriving truth.

## 2.4 Existing performance awareness

The codebase already includes attention to:

- RAF budget violations,
- Phaser frame caps,
- visual-noise suppression,
- deterministic overlays,
- z-index coordination,
- and stability under concurrent systems.

Animation centralization must preserve and improve these concerns, not bulldoze them.

---

# 3. Problem Statement

## 3.1 Current motion risk pattern

Without a centralized motion architecture, a growing UI tends to accumulate animation behavior across:

- Framer Motion component props,
- CSS transitions and keyframes,
- ad hoc `requestAnimationFrame` loops,
- page-local interaction handlers,
- Phaser scene logic,
- conditional React state transitions,
- audio-reactive logic,
- and visual overlays.

This creates several problems.

### 3.1.1 Inconsistent motion laws
Different parts of the app may use different:

- durations,
- easing assumptions,
- spring characteristics,
- interruption behavior,
- reduced-motion behavior,
- and viewport scaling rules.

### 3.1.2 Weak debuggability
When motion truth lives inside many components, it becomes harder to answer:

- why an element drifted,
- why a sequence desynced,
- why a hover transition snapped,
- why overlay alignment broke,
- or which system owns a transform at a given moment.

### 3.1.3 Hard-to-test animation behavior
Without contracts, animation becomes difficult to QA beyond visual intuition.

### 3.1.4 State collisions
Hover, scroll, route transition, audio pulse, focus state, and symmetry-informed motion can all fight each other unless precedence rules exist.

### 3.1.5 Performance unpredictability
Motion logic scattered across multiple systems makes it easier to create redundant calculations and unnecessary rerender-triggered animation churn.

---

# 4. Product Goals

## 4.1 Primary goals

The Animation AMP system must:

1. make every animation AMP-routable,
2. support motion microprocessors for reusable transformation logic,
3. centralize motion contracts without over-centralizing implementation,
4. preserve deterministic behavior across rerenders,
5. support QA inspection and debug traceability,
6. support bytecode or bytecode-like persistence where valuable,
7. keep the renderer layer thin,
8. allow progressive migration from existing animation mechanisms.

## 4.2 Secondary goals

The system should also:

- support animation presets,
- support audio-reactive motion,
- support symmetry-aware or layout-aware motion,
- support device and mode constraints,
- support reduced-motion accessibility,
- support future workerization or batching if profiling justifies it.

---

# 5. Non-Goals

The system should not:

- replace every CSS transition on day one,
- force every single opacity fade into a bespoke processor chain,
- make the UI wait on a heavy orchestration layer for trivial micro-interactions,
- duplicate Phaser’s native responsibilities where scene-local motion is more appropriate,
- or become a total abstraction prison where common motion becomes harder to ship than before.

---

# 6. Core Architectural Decision

## 6.1 Decision statement

Every animation should flow through a shared **Animation AMP**.

The Animation AMP should:

- accept normalized animation intent,
- apply schema validation,
- route through relevant motion microprocessors,
- fuse outputs,
- emit a resolved motion contract,
- and expose diagnostics for inspection and QA.

It should **not** directly encode every effect by hand.

## 6.2 Conceptual flow

```text
Component / Scene / System
    -> animation intent
    -> Animation AMP
    -> selected motion microprocessors
    -> motion fusion layer
    -> renderer adapter
    -> DOM / Canvas / Phaser execution
```

## 6.3 Design rule

**Everything should be AMP-aware. Not everything should be custom-authored as a unique AMP.**

---

# 7. Requirements

## 7.1 Functional requirements

### FR-1 Animation intent entry point
All new animation requests must be able to enter the system through a shared API.

### FR-2 Processor-based transformation
The system must support a modular chain of motion microprocessors.

### FR-3 Contracted output
The system must emit a resolved motion output contract suitable for renderer adapters.

### FR-4 Deterministic precedence
The system must define how competing motion sources resolve.

### FR-5 Interrupt/resume behavior
The system must support interruption rules for hover, click, route changes, state changes, and audio-driven adjustments.

### FR-6 Accessibility support
The system must support reduced-motion and motion-limiting modes.

### FR-7 Diagnostics
The system must surface a readable trace of which processors contributed to final motion.

### FR-8 Presets
The system must support preset-driven animation intents.

### FR-9 Progressive adoption
The system must allow wrapping legacy animation implementations behind adapters during migration.

### FR-10 Cross-renderer support
The system must be usable by:

- React DOM surfaces,
- Framer Motion-backed surfaces,
- CSS-backed surfaces,
- Phaser-backed surfaces,
- and future renderer targets if needed.

## 7.2 Non-functional requirements

### NFR-1 Performance
The system must not introduce visible latency for standard UI interactions.

### NFR-2 Traceability
Motion outputs must remain inspectable and attributable.

### NFR-3 Stability
Resolved motion contracts must remain versioned and schema-stable.

### NFR-4 Maintainability
Microprocessors must remain small, focused, and composable.

### NFR-5 Testability
The system must support unit, integration, and regression testing.

---

# 8. Proposed Repository Shape

## 8.1 Backend / processor-oriented ownership

```text
src/
  codex/
    animation/
      amp/
        runAnimationAmp.ts
        normalizeAnimationIntent.ts
        selectProcessors.ts
        fuseMotionOutput.ts
      contracts/
        animation-intent.types.ts
        motion-output.types.ts
        processor.types.ts
        diagnostics.types.ts
      processors/
        time/
          runTimeCurveProcessor.ts
        transform/
          runTranslateProcessor.ts
          runScaleProcessor.ts
          runRotateProcessor.ts
        visual/
          runOpacityProcessor.ts
          runGlowProcessor.ts
        sequencing/
          runPhaseProcessor.ts
          runStaggerProcessor.ts
        input/
          runInteractionProcessor.ts
          runScrollProcessor.ts
        reactive/
          runAudioReactiveProcessor.ts
        constraints/
          runBoundsConstraintProcessor.ts
          runReducedMotionProcessor.ts
          runDeviceConstraintProcessor.ts
        symmetry/
          runMotionSymmetryProcessor.ts
      presets/
        hover-resonance.ts
        ritual-panel-enter.ts
        glyph-breathe.ts
        orb-idle.ts
        transmission-pulse.ts
      bytecode/
        encodeMotionBytecode.ts
        decodeMotionBytecode.ts
      diagnostics/
        buildMotionTrace.ts
      tests/
        animation-amp.spec.ts
        processor-precedence.spec.ts
        reduced-motion.spec.ts
        audio-reactive.spec.ts
        regression.spec.ts
```

## 8.2 UI ownership

```text
src/
  ui/
    animation/
      hooks/
        useAnimationIntent.ts
        useResolvedMotion.ts
      adapters/
        motionToFramerProps.ts
        motionToCssVars.ts
        motionToPhaserTween.ts
      components/
        MotionInspector.tsx
        MotionDebugBadge.tsx
      tests/
        MotionInspector.spec.tsx
        adapter.spec.ts
```

---

# 9. Core Contracts

## 9.1 Animation intent

The input shape should be explicit and stable.

```ts
export type AnimationIntent = {
  version: string;
  targetId: string;
  targetType?: 'dom' | 'phaser' | 'canvas' | 'overlay';
  preset?: string;
  trigger:
    | 'mount'
    | 'unmount'
    | 'hover'
    | 'focus'
    | 'click'
    | 'scroll'
    | 'route-change'
    | 'audio'
    | 'state-change'
    | 'idle';
  state?: Record<string, unknown>;
  constraints?: {
    reducedMotion?: boolean;
    deviceClass?: 'mobile' | 'desktop' | 'tablet';
    maxDurationMs?: number;
    disableLoop?: boolean;
  };
  requestedProcessors?: string[];
  metadata?: {
    source?: string;
    feature?: string;
    scene?: string;
  };
};
```

## 9.2 Motion processor contract

```ts
export interface MotionProcessor {
  id: string;
  stage:
    | 'normalize'
    | 'timing'
    | 'transform'
    | 'visual'
    | 'sequence'
    | 'reactive'
    | 'constraint'
    | 'finalize';
  supports(intent: AnimationIntent): boolean;
  run(input: MotionWorkingState): MotionWorkingState;
}
```

## 9.3 Working state

```ts
export type MotionWorkingState = {
  intent: AnimationIntent;
  values: {
    durationMs?: number;
    delayMs?: number;
    easing?: string;
    translateX?: number;
    translateY?: number;
    scale?: number;
    rotateDeg?: number;
    opacity?: number;
    glow?: number;
    loop?: boolean;
    phaseOffset?: number;
    staggerIndex?: number;
  };
  flags: {
    interruptible?: boolean;
    reduced?: boolean;
    constrained?: boolean;
  };
  diagnostics: string[];
  trace: Array<{
    processorId: string;
    changed: string[];
  }>;
};
```

## 9.4 Motion output

```ts
export type ResolvedMotionOutput = {
  version: string;
  targetId: string;
  ok: boolean;
  renderer: 'framer' | 'css' | 'phaser' | 'custom';
  values: {
    durationMs: number;
    delayMs: number;
    easing: string;
    translateX: number;
    translateY: number;
    scale: number;
    rotateDeg: number;
    opacity: number;
    glow?: number;
    loop: boolean;
    phaseOffset?: number;
  };
  bytecode?: string[];
  diagnostics: string[];
  trace: Array<{
    processorId: string;
    changed: string[];
  }>;
};
```

---

# 10. Required Microprocessor Classes

## 10.1 Time processors
Responsible for:

- duration,
- delay,
- easing,
- loop cadence,
- spring or pseudo-spring profile normalization.

Examples:

- `mp.time.curve`
- `mp.time.loop`
- `mp.time.interrupt-window`

## 10.2 Transform processors
Responsible for:

- translation,
- scale,
- rotation,
- anchor adjustments,
- transform clamping.

Examples:

- `mp.transform.translate`
- `mp.transform.scale`
- `mp.transform.rotate`
- `mp.transform.anchor`

## 10.3 Visual processors
Responsible for:

- opacity,
- glow,
- blur if permitted,
- highlight pulses,
- perceptual intensity.

Examples:

- `mp.visual.opacity`
- `mp.visual.glow`
- `mp.visual.fade`

## 10.4 Sequence processors
Responsible for:

- phase offset,
- staggering,
- chain timing,
- entrance / exit choreography.

Examples:

- `mp.sequence.phase`
- `mp.sequence.stagger`
- `mp.sequence.chain`

## 10.5 Input / state processors
Responsible for:

- hover,
- click,
- focus,
- scroll,
- route transitions,
- local component state.

Examples:

- `mp.input.hover`
- `mp.input.scroll`
- `mp.input.route`

## 10.6 Reactive processors
Responsible for:

- audio-reactive intensity,
- live signal modulation,
- beat or spectral response.

Examples:

- `mp.reactive.audio-amplitude`
- `mp.reactive.spectral-band`

## 10.7 Constraint processors
Responsible for:

- reduced-motion adaptation,
- mobile caps,
- FPS safety,
- transform bounds,
- accessibility overrides.

Examples:

- `mp.constraint.reduced-motion`
- `mp.constraint.device-profile`
- `mp.constraint.bounds`
- `mp.constraint.performance-cap`

## 10.8 Symmetry-aware motion processors
Because your current codebase already includes symmetry detection and lattice transformation, motion can optionally respect symmetry-aware rules for mirrored or radial motion behaviors.

Examples:

- `mp.motion.symmetry-mirror`
- `mp.motion.symmetry-radial`

This is particularly relevant for PixelBrain, grid overlays, and any future visually mirrored asset tooling.

---

# 11. Precedence Rules

The system must define deterministic resolution rules.

## 11.1 Recommended precedence order

```text
Accessibility constraints
  > hard device/performance constraints
  > route/state-level transitions
  > direct interaction states
  > preset defaults
  > renderer defaults
```

## 11.2 Example

If a preset requests:

- loop: true,
- duration: 1200,
- scale pulse: 1.06,

but reduced-motion is enabled and mobile performance cap is active, the final output may be:

- loop: false,
- duration: 180,
- scale pulse: 1.01,

The output must preserve traceability of why the motion was changed.

---

# 12. Preset System

## 12.1 Rationale

Most application motion should not be authored from scratch every time.

Presets should provide reusable intent bundles for common behaviors.

## 12.2 Example presets

- `orb-idle`
- `glyph-breathe`
- `ritual-panel-enter`
- `sidebar-expand`
- `hover-resonance`
- `transmission-pulse`
- `truesight-highlight`
- `station-select`
- `modal-summon`
- `console-awaken`

## 12.3 Rule

Presets provide defaults. Processors and constraints still retain authority.

---

# 13. Bytecode Support

## 13.1 Why bytecode support matters

Your architecture already values authoritative, persistent, inspectable render logic.

Motion bytecode support would allow:

- replayable motion state,
- deterministic export/import,
- debug snapshots,
- motion diffing,
- QA assertions against emitted motion instructions.

## 13.2 Example motion bytecode

```text
ANIM_START
TARGET player-orb
PRESET hover-resonance
DURATION 420
EASE OUT_ARC
TRANSLATE_Y -6
SCALE 1.04
GLOW 0.22
LOOP 0
PHASE 0.125
ANIM_END
```

## 13.3 Scope rule

Bytecode is recommended for:

- debug,
- persistence,
- export,
- reproducibility,
- and complex orchestration.

It is not required for every trivial one-shot animation at first.

---

# 14. Renderer Adapters

The AMP should emit resolved motion in a renderer-neutral way. Adapters should handle renderer-specific translation.

## 14.1 Framer Motion adapter
Convert motion values into:

- `initial`,
- `animate`,
- `exit`,
- `transition`.

## 14.2 CSS adapter
Convert motion into:

- CSS variables,
- class toggles,
- or inline style objects.

## 14.3 Phaser adapter
Convert motion into:

- tween configs,
- timeline sequences,
- scene-local animation commands.

## 14.4 Custom adapter
Handle:

- overlay systems,
- lattice visualization layers,
- future bytecode visualizers.

---

# 15. Migration Strategy

## 15.1 Phase 1: Shared entrypoint
Create the Animation AMP public API and route all newly authored animation through it.

### Acceptance
- new motion uses the shared entrypoint,
- legacy motion may remain behind adapters.

## 15.2 Phase 2: Core processors
Implement minimal processor classes:

- time,
- transform,
- opacity,
- reduced motion,
- interaction,
- output fusion.

### Acceptance
- basic hover, mount, and panel transitions run through AMP.

## 15.3 Phase 3: High-value surface migration
Prioritize migration of:

- orb idle and interaction motion,
- sidebar expansion,
- panel transitions,
- truesight overlay highlights,
- listen page console motion,
- audio-reactive visual elements.

## 15.4 Phase 4: Diagnostics and QA tooling
Add motion inspector, traces, and regression fixtures.

## 15.5 Phase 5: Optional bytecode + advanced reactive motion
Introduce persisted motion bytecode and deeper reactive processors once baseline stability is proven.

---

# 16. Risks

## 16.1 God-object risk
If the Animation AMP becomes too smart, every motion change will funnel into one unstable center.

**Mitigation:** keep AMP thin, keep processors narrow, keep presets declarative.

## 16.2 Performance regression risk
If every animation goes through too many processors synchronously, interaction latency may rise.

**Mitigation:** short-circuit trivial presets, benchmark, cache normalized presets, only run relevant processors.

## 16.3 Debug opacity risk
Too much abstraction can make motion harder to reason about.

**Mitigation:** mandatory traces, processor diagnostics, motion inspector, stable contracts.

## 16.4 State collision risk
Hover, audio, route, and scroll signals can compound unpredictably.

**Mitigation:** explicit precedence rules and per-trigger conflict policy.

## 16.5 Renderer mismatch risk
Different renderers may not support identical motion semantics.

**Mitigation:** renderer-neutral contract plus adapter-level capability maps.

---

# 17. QA Requirements

## 17.1 Unit QA
- preset normalization is deterministic
- processor selection is correct
- reduced-motion constraints clamp appropriately
- precedence rules resolve consistently
- emitted contracts remain schema-valid

## 17.2 Integration QA
- hover start/stop does not snap incorrectly
- panel transitions remain stable across rerenders
- audio-reactive motion does not jitter uncontrollably
- route transitions do not conflict with local hover states
- overlay motion preserves alignment with rendered text and UI anchors

## 17.3 Performance QA
- no significant interaction lag introduced
- no avoidable RAF budget violations
- no runaway loops on hidden or unmounted surfaces
- mobile motion remains within safe bounds

## 17.4 Regression QA
- animation contracts remain version-stable
- trace output remains readable
- migrated legacy surfaces preserve experiential intent

## 17.5 Suggested Scholomance-specific QA probes
- orb remains visually centered during multi-state motion
- truesight overlays do not drift relative to text surfaces
- listen console motion does not desync from transport controls
- animated UI layers do not leak z-index or pointer-hitbox mismatches
- mirrored or radial motion remains mathematically symmetrical when symmetry mode is enabled

---

# 18. Acceptance Criteria

The migration is successful when all of the following are true:

## Architecture acceptance
- every new animation enters through the Animation AMP API
- at least 5 key processor classes exist and are in active use
- resolved motion output is versioned and schema-validated
- UI layers do not re-derive motion truth independently

## Product acceptance
- major app surfaces feel more coherent in timing and responsiveness
- motion can be tuned centrally without fragile hunt-and-replace refactors
- reduced-motion behavior is consistent across key surfaces
- debug traces can explain why a motion output occurred

## Technical acceptance
- migration does not introduce unacceptable frame budget regressions
- adapter-based support works for at least React/Framer and one non-DOM renderer
- QA can assert motion outcomes through structured outputs rather than pure eyeballing

---

# 19. Immediate Recommendation

Proceed with the Animation AMP architecture.

But do it in the same disciplined pattern your codebase already rewards:

- canonical input contract,
- small specialist processors,
- fused authoritative output,
- renderer-thin adapters,
- visible diagnostics,
- staged migration,
- benchmark before complexity.

The smart version of this idea is not “make every animation complicated.”

The smart version is:

**make every animation governable.**

That is the difference between a haunted carnival of motion and a true motion engine.

---

# 20. Short Directive Summary

## Codex / processor layer
Own:

- animation intent normalization,
- processor routing,
- motion fusion,
- precedence rules,
- bytecode support,
- diagnostics,
- schema stability.

## UI / renderer layer
Own:

- intent submission,
- adapter translation,
- renderer execution,
- debug surface display,
- experiential polish without redefining motion truth.

## Shared rule
One animation request. One routed AMP path. Many small processors. One resolved motion truth.

