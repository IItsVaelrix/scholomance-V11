# PDR: The Lexical Atrium Redesign

## Summary

**Change class:** Architectural + Structural + Behavioral  
**Goal:** Redesign **The Lexical Atrium** into a deterministic, performance-safe, lore-faithful home-surface system that renders a user’s historical combat resonance as a living environmental state without requiring full heavy VerseIR recomputation on page mount.

This redesign preserves the original world-law premise while reducing coupling between combat analytics, VerseIR amplification, Animation AMP routing, and rendering. The Atrium becomes a **precompiled resonance environment** rather than a live analytical sink.

---

## Why

The original concept is strong, but it currently mixes four concerns too tightly:

1. **Lore / world-law meaning**  
2. **Historical combat interpretation**  
3. **Animation intent generation**  
4. **Runtime rendering execution**

That coupling creates avoidable risk:

- expensive mount-time computation
- blurred ownership between VerseIR, Heuristic Engine, AMP, and PixelBrain
- unstable animation behavior if the historical payload grows too large
- increased regression surface across UI, combat exit hooks, backend cache generation, and rendering adapters

The redesign treats the Atrium as a **compiled reflection chamber**.
The combat system produces resonance history.
The VerseIR pipeline interprets that history.
The backend compiles a normalized **AtriumState artifact**.
The home page consumes that artifact through a stable rendering contract.

This reduces runtime load, narrows failure modes, and makes the system easier to test, cache, theme, and evolve.

---

# 1. Product Intent

## 1.1 Name

**The Lexical Atrium**

## 1.2 Role in the world

The Lexical Atrium is the physical manifestation of the weaver’s accumulated linguistic resonance before combat. It is not a combat scene, not a dashboard in ordinary UI terms, and not merely an animation wrapper. It is a **threshold chamber**: a living environmental summary of who the user has been in language.

## 1.3 Redesign principle

The Atrium should feel:

- alive
- interpretive
- deterministic
- legible
- performance-bounded
- impossible to exploit for motion-farming or metric spoofing

It should not feel like a conventional stats panel with decorative particles pasted on top.

---

# 2. Redesign Thesis

## 2.1 Core shift

**Old model:**
Home page mount triggers heavy VerseIR-derived interpretation and AMP decisions directly from historical combat data.

**New model:**
Combat history is interpreted *before* home page mount into a compact, signed, normalized artifact called **AtriumState**. The home page only reads and renders that artifact.

## 2.2 Why this is better

This reduces risk in four ways:

### Performance risk reduced
The home page no longer depends on full `runVerseIRAmplifiers()` execution at mount.

### Architectural risk reduced
VerseIR interpretation becomes an upstream compilation step, while the renderer remains a downstream consumer.

### Behavioral risk reduced
The UI behaves consistently because it consumes normalized outputs rather than raw historical data.

### QA risk reduced
Each stage can be tested independently:
- combat history aggregation
- VerseIR amplification
- AtriumState compilation
- AMP preset resolution
- renderer adapter output

---

# 3. Canonical System Model

## 3.1 High-level pipeline

```txt
Combat Sessions
→ Historical Resonance Aggregation
→ VerseIR Simulation Payload
→ VerseIR Amplifier Pass
→ AtriumState Compiler
→ Cached AtriumState Artifact
→ Home Mount
→ AnimationIntent Dispatch
→ Animation AMP Resolution
→ Renderer Adapter
→ Lexical Atrium Surface
```

## 3.2 Contract boundary

The Lexical Atrium must **never** pull raw combat history directly from the client and interpret it in full at render time.

Instead, it consumes this boundary object:

```ts
interface AtriumState {
  version: string;
  generatedAt: string;
  userId: string;
  sourceWindow: {
    combatSessions: number;
    tokenWindow: number;
    sampledFrom: string;
    sampledTo: string;
  };
  resonance: {
    noveltySignal: number;
    archetypeResonance: number;
    phoneticLuminosity: number;
    lexicalTension: number;
    entropicDecay: number;
    latencyMultiplier: number;
    precisionScalar: number;
  };
  environmentPreset: {
    intentId: string;
    preset: string;
    mode: 'idle' | 'degraded' | 'radiant' | 'stabilized' | 'throttled';
  };
  visualBytecode: {
    scriptWell: string[];
    zLayers: string[];
    particleFields: string[];
    glyphActivity: string[];
  };
  ampModifiers: {
    glowScalar: number;
    opacityScalar: number;
    durationScalar: number;
    translateScalar: number;
    phaseComplexity: number;
    staggerScalar: number;
  };
  constraints: {
    reducedMotionSafe: boolean;
    performanceCapped: boolean;
    interactionThrottleEligible: boolean;
  };
  trace: string[];
}
```

---

# 4. User Experience Requirements

## 4.1 Narrative experience

When a user lands on the home page, the Atrium should immediately communicate their current state of linguistic resonance without requiring explicit reading.

The environment should answer these questions visually:

- Is the user creatively alive or in repetition decay?
- Is their recent combat history sharp, luminous, and novel?
- Are they arriving as a stable architect, a frayed spellcaster, or an exhausted repeater?
- Is the chamber welcoming, haunted, slow, brilliant, fractured, or dimmed?

## 4.2 Behavioral experience

The Atrium should:

- mount quickly
- animate within performance budget
- respond to reduced-motion constraints gracefully
- visually differentiate novelty from entropy
- never stutter because of large history payloads
- never allow rapid toggling to become a metric farm

## 4.3 Visual experience

The chamber is a living architectural organism composed of:

- a **script-well** that emits lexical ink or dim residue
- **suspended token strata** across z-depth layers
- **phonetic bloom fields** tied to resonance quality
- **archetype glyph wakes** that surface according to resonance dominance
- **ambient phase rhythms** that make the room feel historically aware

---

# 5. Functional Requirements

## 5.1 Input model

### Old
Input was defined as a VerseIR object containing rolling average combat history.

### New
Input is split into two stages:

#### Stage A: compiler input
A backend or post-combat system receives:
- rolling combat history
- HeuristicWeight summaries
- recent token traces
- novelty and repetition metrics

#### Stage B: UI input
The UI receives **only the compiled `AtriumState`**.

## 5.2 Required data sources

AtriumState compilation may draw from:

- historical HeuristicWeight aggregates
- recent combat token windows
- lexicalResonanceAmplifier output
- phoneticColorAmplifier output
- pixelBrainPhase1BridgeAmplifier output
- anti-exploit telemetry summaries

## 5.3 Mount behavior

On home mount:

1. read cached `AtriumState`
2. validate version compatibility
3. dispatch `AnimationIntent` using `environmentPreset`
4. feed `ampModifiers` and `constraints` into AMP resolution
5. render `visualBytecode` through PixelBrain / trueVision adapters
6. mount interactive nodes with throttle rules if required

Home mount must **not** call full historical VerseIR recomputation except as emergency fallback.

---

# 6. World-Law Mapping

## 6.1 Canonical metaphor

The Lexical Atrium is the threshold chamber where language congeals into architecture.
Historical combat is not shown as numbers first. It condenses into environmental truth.

## 6.2 Metaphor-to-system mapping

| World-law concept | System meaning |
|---|---|
| Historical resonance | Aggregated combat-derived language state |
| Script-well brightness | Novelty and lexical vitality |
| Ink dissolution | Repetition decay / entropy |
| Glyph wake density | Archetype dominance |
| Chamber drag | Latency multiplier / interaction throttle |
| Phase richness | AMP phase complexity |
| Faded structure | Suppressed glow, opacity, translation |

## 6.3 Critical lore rule

The Atrium reflects accumulated resonance. It does **not** fabricate grandeur. If novelty is low, the chamber must visibly decay.

This is important because it keeps the world-law honest.

---

# 7. Deterministic Runtime Architecture

## 7.1 System ownership

### Historical aggregation layer
Owns combat summary generation.

### VerseIR amplifier layer
Owns interpretive transformation of the simulated resonance payload.

### AtriumState compiler
Owns normalization, capping, scalar derivation, preset assignment, and trace assembly.

### Animation AMP
Owns motion resolution from intent + modifiers + constraints.

### Renderer adapters
Own trueVision / PixelBrain / Framer-compatible execution.

## 7.2 Non-goals

The Atrium runtime does **not**:

- compute full VerseIR history on every mount
- invent its own motion semantics outside AMP
- bypass constraints for visual flourish
- attach custom Framer Motion variants per feature
- directly interpret raw combat logs in the client

---

# 8. State Compilation Rules

## 8.1 Required compilation step

A dedicated compiler function should exist:

```ts
compileAtriumState(input: HistoricalResonanceInput): AtriumState
```

## 8.2 Compiler responsibilities

The compiler must:

- run the approved VerseIR amplifier subset
- normalize scalar outputs into safe UI ranges
- choose a canonical Atrium preset mode
- produce renderer-ready visualBytecode
- enforce exploit and performance caps
- emit a human-readable trace for QA and debugging

## 8.3 Scalar normalization examples

### noveltySignal
Expected raw range may vary.
Compiler must normalize to `[0,1]`.

### durationScalar
Must be clamped to prevent absurd slowdowns.
Suggested safe range:
`1.0 → 2.5`

### glowScalar
Suggested safe range:
`0.0 → 1.25`

### translateScalar
Suggested safe range:
`0.0 → 1.0`

### phaseComplexity
Suggested safe range:
integer bucket or stepped scalar, not arbitrary float chaos.

---

# 9. Preset Routing

## 9.1 Canonical presets

The redesign replaces the single overloaded `atrium-idle` assumption with a preset family.

### Required preset family

- `atrium-idle-stabilized`
- `atrium-idle-radiant`
- `atrium-idle-degraded`
- `atrium-idle-throttled`
- `atrium-idle-reduced-motion`

## 9.2 Routing logic

Preset selection should derive from compiled state, not ad hoc UI branching.

Example:

```ts
function resolveAtriumPreset(state: AtriumState): string {
  if (state.constraints.reducedMotionSafe) return 'atrium-idle-reduced-motion';
  if (state.environmentPreset.mode === 'throttled') return 'atrium-idle-throttled';
  if (state.resonance.entropicDecay >= 0.75) return 'atrium-idle-degraded';
  if (state.resonance.noveltySignal >= 0.7) return 'atrium-idle-radiant';
  return 'atrium-idle-stabilized';
}
```

## 9.3 Why this reduces risk

This prevents one preset from carrying too many contradictory responsibilities.
It also improves testing, tuning, and future expansion.

---

# 10. Entropic Decay Redesign

## 10.1 Original concept preserved

Low novelty should physically slow and dim the UI.
That idea is excellent and should remain.

## 10.2 Redesign rule

Entropic Decay must affect the environment through **bounded degradations**, not uncontrolled suppression.

## 10.3 Required degradation channels

Low novelty may reduce:

- glow intensity
- particle density
- phase richness
- opacity of high-energy glyph layers
- movement amplitude

Low novelty may increase:

- duration
- drag sensation
- dissolve noise
- chamber stillness

## 10.4 Forbidden degradation

Decay must not:

- make the interface unreadable
- disable navigation clarity
n- suppress all motion so hard that the chamber feels broken
- destroy interaction affordances

## 10.5 Example mapping

| noveltySignal | visual result |
|---|---|
| 0.85 | radiant chamber, strong bloom, active strata |
| 0.55 | stable chamber, moderate glow, measured motion |
| 0.25 | dim chamber, low particle activity, extended timing |
| 0.10 | darkened ink residue, low translation, sparse script wake |

---

# 11. Anti-Exploit and Integrity Rules

## 11.1 Principle

The Atrium is representational, so it must not become an interaction farming vector.

## 11.2 Required exploit protections

### Motion throttle
If macro-scripting or rapid UI switching is detected upstream, `latencyMultiplier` may increase interactive delay on eligible non-critical nodes.

### Animation cap
Complexity must be capped under `mp.constraint.performance-cap`.

### Historical authenticity
Only compiler-approved resonance history may influence AtriumState.
Client-side mutation attempts must be ignored.

### No instant refresh abuse
AtriumState should update on meaningful lifecycle boundaries such as:
- combat exit
- checkpoint commit
- session sync

Not on every hover, tab focus, or route churn.

## 11.3 Safe throttle scope

Throttle must never block:

- essential navigation
- accessibility actions
- core home-page entry

It may affect:

- ornamental nodes
- optional chamber responses
- nonessential glyph interactions

---

# 12. Accessibility Requirements

## 12.1 Reduced motion

If `constraints.reducedMotion = true`, the system must:

- strip or heavily suppress translate-based motion
- suppress stagger where appropriate
- preserve state legibility via opacity, scale, layering, and static glow states
- avoid converting the Atrium into a blank dead screen

## 12.2 Readability floor

Even in maximal decay mode, the surface must preserve:

- readable labels
- visible navigation hierarchy
- stable contrast for key UI regions
- coherent focus states

## 12.3 Deterministic accessibility

Accessibility behavior must be preset-driven and compiler-compatible, not implemented as per-component improvisation.

---

# 13. Performance Requirements

## 13.1 Core requirement

The Atrium must mount within home-page performance budget using cached compiled state.

## 13.2 Runtime budget policy

The UI should treat the Atrium as a **render-only consumer** of a precompiled artifact in normal operation.

## 13.3 Forbidden mount-time behavior

Do not:

- run unbounded `runVerseIRAmplifiers()` over long historical payloads on login
- regenerate token-derived visual bytecode from scratch on every home entry
- build custom Framer variants per subnode
- allow particle density to scale linearly with raw history length

## 13.4 Safe scaling strategy

Scale by normalized buckets, not raw counts.

Example:

- 5 combat sessions and 500 combat sessions should both compile into bounded scalar ranges
- visual richness should reflect quality and normalized history windows, not brute historical volume

---

# 14. Rendering Architecture

## 14.1 Required renderer inputs

Renderer adapters consume:

- resolved AMP output
- z-layer bytecode
- token-derived visual payloads
- reduced-motion-safe constraints

## 14.2 Layer model

Recommended z-axis layer separation:

1. chamber shell
2. script-well base
3. suspended token strata
4. phonetic bloom field
5. archetype glyph wake
6. foreground atmospheric residue
7. UI affordance layer

## 14.3 Critical rendering rule

Specific token visual bytecode must be rendered as authored layers, not flattened into one decorative particle cloud.

This matters because the Atrium is meant to feel historically encoded, not generically pretty.

---

# 15. Implementation Spec

## 15.1 New canonical files

### Data / compiler
- `src/codex/atrium/compileAtriumState.ts`
- `src/codex/atrium/normalizeAtriumScalars.ts`
- `src/codex/atrium/resolveAtriumPreset.ts`
- `src/codex/atrium/types.ts`

### Animation presets
- `src/codex/animation/presets/atrium-idle-stabilized.ts`
- `src/codex/animation/presets/atrium-idle-radiant.ts`
- `src/codex/animation/presets/atrium-idle-degraded.ts`
- `src/codex/animation/presets/atrium-idle-throttled.ts`
- `src/codex/animation/presets/atrium-idle-reduced-motion.ts`

### UI surface
- `src/features/home/lexical-atrium/LexicalAtriumRoot.tsx`
- `src/features/home/lexical-atrium/useLexicalAtriumState.ts`
- `src/features/home/lexical-atrium/renderers/`

### Adapters
- `src/codex/animation/adapters/motionToFramerProps.ts`
- `src/codex/animation/adapters/motionToLatticeProps.ts`
- `src/codex/pixelbrain/adapters/atrumVisualBytecodeAdapter.ts`

## 15.2 Integration flow

```txt
Combat Exit Hook
→ aggregateHistoricalResonance()
→ enhanceVerseIR()
→ compileAtriumState()
→ cacheAtriumState()
→ home page fetch/useLexicalAtriumState()
→ dispatch AnimationIntent(trigger='mount', preset=resolvedPreset)
→ resolve motion via AMP
→ render z-layers + bytecode
```

## 15.3 Assumption

Assumes backend or session-layer support exists for state caching.

If backend caching does not yet exist, a session-local persisted cache may be used temporarily, but that is an interim path, not the long-term target.

---

# 16. Handoff Requirements

## 16.1 Codex handoff

### Required work

1. create `AtriumState` type and compiler pipeline  
2. bind historical HeuristicWeight data into a simulated VerseIR payload  
3. run only the approved amplifier subset  
4. normalize outputs into safe UI scalar bands  
5. compile visualBytecode for z-layer rendering  
6. register preset family, not just one preset  
7. emit trace metadata for QA and replay analysis

### Do not

- pass raw combat history directly into the home-page component
- let presets infer meaning from arbitrary unsanitized amplifier outputs

## 16.2 Claude handoff

### Required work

1. implement `useAnimationIntent` on the Atrium root container  
2. consume `ResolvedMotionOutput` via `motionToFramerProps` or lattice adapter  
3. do not write bespoke Framer Motion variants  
4. render token bytecode by explicit z-layer group  
5. preserve reduced-motion branching through the existing AMP constraint path  
6. isolate ornamental throttles from essential navigation controls

---

# 17. QA Specification

## 17.1 Core QA philosophy

Test the Atrium as a deterministic compiled environment, not as an ad hoc animation toy.

## 17.2 Required tests

### Test A: reduced motion stripping
Inject an `AnimationIntent` with `constraints.reducedMotion = true`.
Assert that AMP resolution strips or suppresses:
- `mp.transform.translate`
- `mp.sequence.stagger`

Assert that readability-preserving alternatives remain.

### Test B: novelty budget overflow damping
Mock a VerseIR amplifier payload where claimedWeight exceeds `VERSEIR_AMPLIFIER_NOVELTY_BUDGET`.
Assert that `precisionScalar` dampens derived visual variables before AMP resolution.

### Test C: trace completeness
Request an Atrium preset resolution and assert that `ResolvedMotionOutput.trace` includes the governing motion variables, including:
- `mp.visual.glow`
- `mp.time.curve`

### Test D: preset routing determinism
Feed identical `AtriumState` inputs twice.
Assert that preset routing returns the exact same preset both times.

### Test E: capped richness
Feed a massively oversized historical payload and a moderately large one that normalize into the same capped bucket.
Assert that visual density does not scale beyond the cap.

### Test F: throttled node isolation
Mock macro-scripting detection.
Assert that ornamental nodes slow while critical navigation remains fully usable.

### Test G: degraded-state legibility
Feed `noveltySignal = 0.1` and high `entropicDecay`.
Assert that the Atrium visibly degrades without losing navigation clarity.

---

# 18. Risks

## 18.1 Primary risks

### Risk: Compiler drift
If VerseIR amplifier semantics evolve and Atrium normalization is not updated, visual meaning may become inaccurate.

### Risk: Over-decorative rendering
The chamber may become visually beautiful but semantically vague.

### Risk: Cache staleness
Users may see an Atrium that reflects yesterday’s state if invalidation is weak.

### Risk: Adapter fragmentation
If Framer, lattice, and PixelBrain adapters interpret the same output differently, the chamber loses deterministic identity.

## 18.2 Mitigations

- version `AtriumState` aggressively
- centralize scalar normalization
- treat preset routing as canonical logic, not duplicated UI logic
- define cache invalidation points explicitly
- snapshot test adapter parity where possible

---

# 19. Success Criteria

The redesign is successful if:

- the Atrium mounts without heavy client-side VerseIR computation
- visual state clearly communicates resonance quality
- novelty and entropy are perceptible but bounded
- reduced-motion users receive a coherent equivalent state
- anti-exploit throttles affect ornamental behavior only
- AMP consumes normalized intent cleanly
- PixelBrain and trueVision rendering stay deterministic across sessions

---

# 20. Final Recommendation

Do **not** treat The Lexical Atrium as a live analytics scene.
Treat it as a **compiled resonance chamber**.

That single shift makes the concept stronger in every dimension:

- better lore integrity
- better system separation
- better performance
- better QA
- better renderer portability
- better future scalability for PixelBrain, trueVision, and VerseIR growth

The concept itself is excellent. The redesign simply turns it from a beautiful spell into an executable law.