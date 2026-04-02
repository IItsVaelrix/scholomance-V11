# Product Design Requirements
## Bytecode Blueprint Bridge
### Bridging PDR Source Specs to Deterministic Animation Execution in Scholomance / PixelBrain

**Status:** Draft for implementation  
**Classification:** Architectural  
**Priority:** Critical  
**Primary Goal:** Close the gap between human-authored animation design intent and deterministic, testable, backend-portable execution across CSS, Phaser, and PixelBrain.

---

# 1. Executive Summary

Scholomance currently contains multiple partial systems that each solve part of the motion problem:

- motion bytecode and related motion execution concepts
- CSS translation infrastructure via variable-based output
- PixelBrain coordinate/formula execution primitives
- bytecode-oriented error handling and deterministic QA philosophy
- symmetry, lattice, and coordinate transformation infrastructure

These systems are individually powerful, but there is currently **no canonical bridge layer** that turns design intent into a validated, portable, executable animation program.

This creates a critical architectural gap:

1. Design intent can be described, but is not yet formalized as compile-ready source.
2. Motion can be executed, but lacks a stable contract between author intent and backend execution.
3. QA can validate output details, but cannot yet validate animation semantics from a single canonical source artifact.
4. PixelBrain can represent mathematical motion, but there is no first-class compiler path from PDR blueprint to execution payload.

This PDR defines that bridge.

The solution is a new architecture in which:

- **PDRs become the human-authored source layer**
- **Bytecode Blueprint Blocks become the formal design syntax**
- **A Canonical Animation Schema becomes the intermediate representation (IR)**
- **Validators enforce correctness before execution**
- **Compilers generate backend-specific payloads**
- **Execution engines consume deterministic outputs**
- **QA asserts semantic intent, not only screenshots**

This system converts animation from loosely described UI polish into a deterministic, compile-tested subsystem.

---

# 2. Problem Statement

## 2.1 Current State

Scholomance has already established several motion-adjacent primitives:

- bytecode-driven motion concepts
- CSS variable translation
- render-layer math infrastructure
- symmetry-aware coordinate systems
- formula-based spatial execution
- deterministic QA philosophy

Despite that progress, motion design is still fragmented across representation layers. Human intent is not yet encoded in a single, canonical format that can be:

- parsed
- validated
- compiled
- diffed
- tested
- versioned
- executed across multiple render targets

## 2.2 Core Gap

The missing layer is the bridge between:

**design intent** and **deterministic runtime execution**

Without this bridge:

- motion specs remain partly prose and partly implementation
- backend execution semantics can drift
- QA must infer intent from output artifacts
- AI-generated or human-generated design documents cannot serve as source code
- PixelBrain cannot act as a generalized animation execution backend for authored motion blueprints

## 2.3 Why This Is Critical

This gap limits the architecture in five major ways:

### A. No canonical source of truth
Animation intent is distributed across documents, code, and runtime assumptions.

### B. No portable semantic contract
The same animation concept cannot yet be guaranteed equivalent across CSS, Phaser, and PixelBrain outputs.

### C. No deterministic authoring pipeline
Designers and AI collaborators cannot write a blueprint that compiles directly into motion artifacts.

### D. No semantic QA surface
Tests cannot yet assert “the orb pulse is a radial 4-symmetry decay pulse with 800ms envelope” as a first-class truth.

### E. No motion compiler layer
Without a compiler stage, motion remains implementation-specific rather than language-driven.

---

# 3. Vision

## 3.1 End-State Vision

Animation in Scholomance should function like a compiled subsystem.

Instead of authoring motion directly in CSS, Framer props, Phaser timelines, or bespoke runtime objects, authors define motion in a structured blueprint language embedded inside PDRs or dedicated spec files.

That blueprint is then:

1. parsed into a canonical schema
2. validated for correctness and supportability
3. compiled into backend outputs
4. executed deterministically
5. tested semantically and visually

## 3.2 Key Principle

**Animation is semantic behavior, not presentation trivia.**

The authored source should describe:

- what the motion means
- what transforms are intended
- how timing behaves
- what symmetry or lattice rules apply
- what constraints must hold
- what tolerances are acceptable

Backend adapters should decide how that intent is rendered.

## 3.3 Design Philosophy

This architecture must be:

- deterministic
- explicit
- portable
- schema-first
- validator-enforced
- backend-agnostic at the source level
- bytecode-friendly
- QA-addressable
- diffable in version control

---

# 4. Goals

## 4.1 Primary Goals

### G1. Create a canonical bridge layer
Introduce a formal path from authored blueprint spec to runtime execution.

### G2. Make PDRs compile-adjacent
Enable design docs to contain structured animation source blocks that can be machine-read.

### G3. Establish a Canonical Animation Schema
Create one IR that all motion blueprints normalize into.

### G4. Enable multi-backend compilation
Support compilation into:

- CSS variable motion payloads
- Phaser-compatible execution payloads
- PixelBrain formula/coordinate execution payloads
- motion bytecode artifacts

### G5. Enable semantic QA
Allow tests to assert animation meaning and invariants directly.

### G6. Preserve deterministic reproducibility
Given the same source blueprint and versioned compiler, outputs should be identical.

---

# 5. Non-Goals

The following are explicitly out of scope for V1 unless noted:

- full shader language support
- arbitrary freeform symbolic calculus in the source syntax
- direct authoring of backend-specific CSS implementation details as required fields
- machine-learning-based motion inference at compile time
- replacing all existing runtime animation code in one pass
- supporting every animation archetype from day one
- real-time user-authored formula sandboxing in production

V1 is a bridge, not the final empire.

---

# 6. User and System Actors

## 6.1 Human Designers
Need a structured way to describe motion without binding directly to implementation.

## 6.2 AI Collaborators
Need a strict, parseable source format for generating reliable motion specs.

## 6.3 Frontend Runtime
Needs compiled payloads that are safe, deterministic, and backend-compatible.

## 6.4 PixelBrain Engine
Needs canonical animation/motion inputs that can be expressed mathematically and spatially.

## 6.5 QA / Heuristic Systems
Need stable IR and output contracts to validate behavior.

## 6.6 Future Tooling
Will need a structured format for visualization, linting, preview, generation, and version diffing.

---

# 7. Core Requirements

## 7.1 Authoring Requirement
Authors must be able to define an animation blueprint in a structured syntax block within a PDR or a dedicated source file.

## 7.2 Parsing Requirement
The system must parse blueprint syntax into a canonical schema object.

## 7.3 Validation Requirement
All source blueprints must pass schema validation before compilation.

## 7.4 Compilation Requirement
The canonical schema must compile into backend-specific payloads.

## 7.5 Execution Requirement
Compiled payloads must be executable by the relevant runtime or engine.

## 7.6 QA Requirement
The system must support tests at multiple layers:

- parse correctness
- schema validity
- compiler correctness
- backend parity
- semantic invariant checks
- performance constraint checks

## 7.7 Error Requirement
All failures must produce structured, bytecode-grade diagnostics.

## 7.8 Versioning Requirement
Blueprint syntax and canonical schema must be versioned.

---

# 8. Proposed Architecture

## 8.1 Pipeline Overview

```text
Human Authored PDR / Spec
        ↓
Bytecode Blueprint Block Parser
        ↓
Canonical Animation Schema (IR)
        ↓
Validator / Linter / Constraint Engine
        ↓
Compiler Layer
   ├── CSS Motion Output
   ├── Phaser Motion Output
   ├── PixelBrain Formula Output
   └── Motion Bytecode Output
        ↓
Execution Engines
        ↓
QA + Diagnostics + Telemetry
```

## 8.2 Bridge Layer Definition

The “bridge” is not a single file or class. It is the coordinated subsystem containing:

1. **Blueprint grammar**
2. **Parser**
3. **Canonical schema**
4. **Validator**
5. **Compiler(s)**
6. **Backend adapter contracts**
7. **QA assertion utilities**
8. **Diagnostics format**

## 8.3 Architectural Principle

The source language must remain semantic-first.

Example:

Good source intent:
- pulse
- radial symmetry
- decay glow
- lattice alignment
- bounded scale envelope

Bad source intent:
- set transform: scale(1.05)
- set box-shadow css string
- use exact browser animation syntax as primary truth

Implementation details belong in adapters, not in authored truth.

---

# 9. Canonical Animation Schema (IR)

## 9.1 Purpose

The Canonical Animation Schema is the single most important missing component.

It acts as:

- normalization target
- validator surface
- compiler input
- QA surface
- tooling contract

## 9.2 Schema Design Principles

The schema must be:

- explicit
- typed
- serializable
- diff-friendly
- stable across backends
- tolerant of future extension through additive evolution

## 9.3 Proposed Schema

```ts
export type AnimationBlueprintV1 = {
  version: "1.0";
  id: string;
  name?: string;
  description?: string;
  target: TargetSpec;
  preset?: string;
  durationMs: number;
  delayMs?: number;
  loop: number | "infinite";
  easing: EasingSpec;
  phase?: number;
  transforms?: TransformSpec;
  envelopes?: EnvelopeMap;
  symmetry?: SymmetrySpec;
  grid?: GridSpec;
  anchors?: AnchorSpec;
  compositing?: CompositingSpec;
  backendHints?: BackendHints;
  constraints?: ConstraintSpec;
  qa?: QASpec;
  metadata?: MetadataSpec;
};

export type TargetSpec = {
  selectorType: "id" | "class" | "role" | "symbolic" | "engine-target";
  value: string;
};

export type EasingSpec = {
  type: "token" | "cubic" | "spring" | "custom";
  value: string | number[] | Record<string, number>;
};

export type TransformSpec = {
  scale?: ScalarTransformSpec;
  rotate?: ScalarTransformSpec;
  translateX?: ScalarTransformSpec;
  translateY?: ScalarTransformSpec;
  opacity?: ScalarTransformSpec;
  glow?: ScalarTransformSpec;
  blur?: ScalarTransformSpec;
};

export type ScalarTransformSpec = {
  base?: number;
  peak?: number;
  min?: number;
  max?: number;
  unit?: string;
  envelope?: EnvelopeSpec;
};

export type EnvelopeSpec = {
  kind: "constant" | "sine" | "triangle" | "expDecay" | "pulse" | "bezier" | "keyed";
  params: Record<string, number | string | boolean>;
};

export type EnvelopeMap = Record<string, EnvelopeSpec>;

export type SymmetrySpec = {
  type: "none" | "mirror-x" | "mirror-y" | "radial" | "diagonal";
  order?: number;
  origin?: { x: number; y: number; space?: "local" | "grid" | "world" };
};

export type GridSpec = {
  mode: "free" | "cell-space" | "lattice";
  latticeId?: string;
  snap?: boolean;
  cellWidth?: number;
  cellHeight?: number;
};

export type AnchorSpec = {
  pivotX?: number;
  pivotY?: number;
  originSpace?: "local" | "grid" | "world";
};

export type CompositingSpec = {
  blendMode?: string;
  zLayer?: string | number;
  pass?: "css" | "phaser" | "pixelbrain" | "hybrid";
};

export type BackendHints = {
  css?: Record<string, string | number | boolean>;
  phaser?: Record<string, string | number | boolean>;
  pixelbrain?: Record<string, string | number | boolean>;
};

export type ConstraintSpec = {
  deterministic?: boolean;
  maxFrameMs?: number;
  maxPropertyCount?: number;
  allowBackendDegradation?: boolean;
  requireParityAcrossBackends?: boolean;
};

export type QASpec = {
  invariants?: string[];
  parityMode?: "strict" | "tolerant" | "backend-specific";
  screenshotRequired?: boolean;
};

export type MetadataSpec = {
  author?: string;
  createdAt?: string;
  tags?: string[];
  feature?: string;
};
```

## 9.4 IR Rules

The IR must not depend on any one render backend for validity.

The IR must allow:

- preset expansion
- explicit override fields
- envelope serialization
- diagnostic references to source line numbers
- backward-compatible schema evolution

---

# 10. Bytecode Blueprint Source Syntax

## 10.1 Purpose

The source syntax is the human-authored form used inside PDRs or source files. It should be readable, constrained, and easy to parse.

## 10.2 V1 Design Constraints

The syntax should be:

- line-based
- low-ambiguity
- easy for AI to emit consistently
- easy for humans to read in diffs
- easy to annotate in docs

## 10.3 Example Syntax

```text
ANIM_START
ID orb-transmission-pulse
TARGET id player-orb
PRESET transmission-pulse
DURATION 800
DELAY 0
EASE TOKEN IN_OUT_ARC
LOOP 1
PHASE 0.125
SCALE BASE 1.0 PEAK 1.05 ENV sine PERIOD 800
GLOW BASE 0.0 PEAK 0.5 ENV expDecay HALF_LIFE 400
SYMMETRY TYPE radial ORDER 4 ORIGIN 0.5 0.5 SPACE local
GRID MODE cell-space SNAP true
COMPOSITE PASS hybrid
CONSTRAINT DETERMINISTIC true
CONSTRAINT MAX_FRAME_MS 16
QA INVARIANT radial-symmetry-preserved
QA INVARIANT scale-remains-within-bounds
ANIM_END
```

## 10.4 Syntax Requirements

The grammar must support:

- unique identifiers
- target selectors
- preset references
- timing
- easing
- transforms
- envelope declarations
- symmetry configuration
- grid/lattice alignment
- backend hints
- constraints
- QA invariants

## 10.5 Syntax Non-Requirements for V1

The syntax does not need to support:

- inline arithmetic expressions beyond controlled envelope params
- nested blocks beyond bounded sections
- arbitrary scripting
- freeform executable code

---

# 11. Parser Requirements

## 11.1 Responsibilities

The parser must:

- locate blueprint blocks in source documents
- tokenize valid lines
- preserve line mapping for diagnostics
- parse all supported directives
- normalize values into canonical schema
- reject malformed or unsupported syntax

## 11.2 Parser Output

Output must include:

- parsed canonical schema object
- warnings
- errors
- source map to original blueprint lines

## 11.3 Parser Failure Modes

The parser must fail clearly when:

- a required directive is missing
- a token is malformed
- a numeric field is invalid
- a directive is duplicated illegally
- an unsupported directive is encountered
- a nested field is syntactically inconsistent

## 11.4 Parser Diagnostics Example

```json
{
  "code": "ANIM_PARSE_INVALID_SYMMETRY_ORDER",
  "severity": "error",
  "line": 11,
  "directive": "SYMMETRY",
  "message": "Radial symmetry requires ORDER >= 2.",
  "hint": "Use ORDER 4 for quadrant pulse behavior or TYPE none if symmetry is not required."
}
```

---

# 12. Validation Layer Requirements

## 12.1 Purpose

Validation is separate from parsing.

Parsing answers: “Can this be read?”  
Validation answers: “Is this structurally and semantically legal?”

## 12.2 Validation Categories

### Structural validation
- required fields present
- no illegal duplicates
- type correctness

### Semantic validation
- transform constraints are coherent
- symmetry config is valid
- grid config is compatible with target mode
- envelopes use valid params

### Backend capability validation
- requested features are supported by selected backend(s)
- degrade path exists if allowed

### Performance validation
- property count within threshold
- expected runtime complexity acceptable
- frame budget constraints realistic

### QA validation
- invariant names valid
- parity requirements executable

## 12.3 Validation Examples

### Example 1
A `radial` symmetry declaration without `order`
- parse: success
- validate: fail

### Example 2
A blur transform requested for a PixelBrain backend with no blur adapter
- validate: warning or error depending on degradation rules

### Example 3
`maxFrameMs` set to 2 while requesting hybrid composite on a heavy lattice target
- validate: warning for unrealistic budget

---

# 13. Compiler Layer Requirements

## 13.1 Purpose

The compiler transforms canonical animation schema into execution artifacts.

## 13.2 Compiler Targets

V1 compiler targets:

1. CSS Motion Payload
2. Phaser Motion Payload
3. PixelBrain Formula Payload
4. Motion Bytecode Artifact

## 13.3 Compilation Rules

Compilation must be:

- deterministic
- versioned
- pure from the same inputs
- diagnostic-aware
- source-mapped where feasible

## 13.4 CSS Compiler

### Responsibilities
- convert transforms and envelopes into CSS variable payloads and/or compatible animation tokens
- preserve timing and easing semantics
- honor constraints where possible

### Output Example
- CSS vars object
- animation token config
- metadata for runtime application

## 13.5 Phaser Compiler

### Responsibilities
- convert canonical transforms into Phaser-friendly tween/timeline or frame-step payloads
- preserve execution order and timing
- surface unsupported features cleanly

## 13.6 PixelBrain Compiler

### Responsibilities
- convert envelopes into mathematical representation
- map symmetry and grid configs into coordinate-transform-aware execution
- generate formula payloads compatible with lattice/coordinate pipelines

This is one of the most important compilers in the bridge.

### PixelBrain-Specific Requirements
- preserve symmetry intent
- support lattice-aware execution
- express envelopes numerically
- allow deterministic reproduction from blueprint + compiler version

## 13.7 Motion Bytecode Compiler

### Responsibilities
- generate a compact symbolic execution artifact
- provide a canonical, diffable machine-readable form
- support future optimizations, caching, and replay

---

# 14. Backend Adapters

## 14.1 Role

Adapters are the final layer that apply compiled output to actual execution environments.

They must not redefine semantics. They must implement them.

## 14.2 Adapter Contract Requirements

Each adapter must declare:

- supported transform families
- supported easing families
- supported envelope types
- support for symmetry-aware behavior
- performance caveats
- degradation behavior

## 14.3 Degradation Policy

If a backend cannot support a feature:

- fail if constraints forbid degradation
- warn and compile fallback if degradation is permitted
- always surface this in diagnostics

---

# 15. Preset System

## 15.1 Purpose

Presets allow human-friendly shorthand without sacrificing determinism.

## 15.2 Example Presets

- `transmission-pulse`
- `orb-breath`
- `lattice-ripple`
- `sigil-flare`
- `phased-hover`

## 15.3 Preset Rules

Presets must expand into explicit canonical fields before validation finalization.

Preset expansion must be:

- deterministic
- versioned
- diffable
- override-aware

## 15.4 Override Precedence

1. explicit blueprint field
2. expanded preset field
3. system default

---

# 16. Mathematical Envelope Language

## 16.1 Purpose

The envelope layer describes how values evolve over time in backend-agnostic terms.

## 16.2 V1 Recommendation

Do **not** launch with fully freeform symbolic math.

Instead, support a bounded set of envelope kinds:

- constant
- sine
- triangle
- pulse
- exponential decay
- bezier
- keyed sequence

## 16.3 Why Bounded Envelopes First

This avoids:

- overly complex parsing
- unsafe or ambiguous formulas
- optimizer instability
- author confusion

while still covering the majority of motion design needs.

## 16.4 Future Extension Path

After V1 proves stable, optional advanced envelope syntax can be introduced for expert workflows.

---

# 17. QA and Testing Requirements

## 17.1 QA Philosophy

QA must move from “does it look close enough?” toward “does it faithfully implement the authored semantics?”

## 17.2 Test Layers

### Parser tests
- directive parsing
- line mapping
- invalid syntax rejection

### Validator tests
- required field enforcement
- semantic legality
- capability checks

### Compiler tests
- same input yields same output
- backend outputs structurally correct
- preset expansion stable

### Parity tests
- CSS and Phaser outputs preserve agreed timing/easing semantics
- PixelBrain outputs preserve symmetry and envelope meaning

### Invariant tests
Examples:
- radial symmetry preserved
- scale remains within [1.0, 1.05]
- glow decays monotonically after pulse peak
- grid snap remains stable under transforms

### Performance tests
- frame budget assertions
- compile latency thresholds
- payload size checks

### Visual spot tests
Still useful, but secondary to semantic assertions.

## 17.3 QA Assertion API

A utility layer should allow tests like:

```ts
expectBlueprintInvariant(output, "radial-symmetry-preserved");
expectEnvelopeBound(output, "scale", { min: 1.0, max: 1.05 });
expectDeterministicCompile(source, version);
```

## 17.4 Regression Strategy

Every compiler bug should produce:

- one failing source fixture
- one diagnostic fixture where relevant
- one golden compiled output fixture if deterministic

---

# 18. Diagnostics and Error System

## 18.1 Requirements

Errors must be:

- structured
- source-mapped
- machine-readable
- human-readable
- specific
- actionable

## 18.2 Severity Levels

- info
- warning
- error
- fatal

## 18.3 Diagnostic Categories

- parse
- validation
- capability
- compile
- execution
- parity
- performance

## 18.4 Example Error Codes

- `ANIM_PARSE_UNKNOWN_DIRECTIVE`
- `ANIM_VALIDATE_MISSING_TARGET`
- `ANIM_VALIDATE_INVALID_ENVELOPE_PARAM`
- `ANIM_COMPILE_UNSUPPORTED_BACKEND_FEATURE`
- `ANIM_PARITY_BACKEND_DRIFT`
- `ANIM_PERF_BUDGET_EXCEEDED`

---

# 19. Runtime and Execution Requirements

## 19.1 Runtime Requirements

Execution engines must accept only validated, compiled payloads in strict mode.

## 19.2 Execution Modes

- strict deterministic mode
- permissive dev mode with warnings
- preview mode for tooling/editor support

## 19.3 Caching

Compiled artifacts should be cacheable by:

- source hash
- compiler version
- preset version
- backend target

## 19.4 Telemetry

Optional telemetry should track:

- compile success/failure
- runtime degradation events
- parity drift detections
- frame budget violations

---

# 20. Tooling Requirements

## 20.1 Authoring Tooling

Needed tools:

- blueprint block linter
- schema validator CLI
- preview compiler output inspector
- source-to-IR viewer

## 20.2 Dev Tooling

Useful additions:

- pretty-printer for blueprint blocks
- compiler explain mode
- preset expansion viewer
- parity diff viewer

## 20.3 AI Workflow Support

The syntax must be stable enough for AI tools to generate without constant malformed output.

That means:

- limited ambiguity
- line-based structure
- explicit keywords
- clear examples
- validation feedback that is corrective rather than vague

---

# 21. Rollout Plan

## Phase 0: Foundation Audit

### Deliverables
- inventory current motion bytecode and translation layers
- inventory PixelBrain formula interfaces
- document all current easing and transform support
- identify overlap and conflicts

### Risk Reduced
Prevents schema design from contradicting existing live contracts.

## Phase 1: Canonical Schema

### Deliverables
- versioned TS schema
- JSON serialization format
- unit tests for schema fixtures

### Risk Reduced
Creates stable IR before syntax or compiler complexity explodes.

## Phase 2: Blueprint Grammar + Parser

### Deliverables
- grammar spec
- parser implementation
- diagnostic mapping
- blueprint fixture suite

### Risk Reduced
Turns PDR blocks into machine-readable source.

## Phase 3: Validator

### Deliverables
- structural validator
- semantic validator
- backend capability validator
- diagnostic code catalog

### Risk Reduced
Stops invalid or backend-impossible designs before runtime.

## Phase 4: CSS Compiler

### Deliverables
- canonical schema to CSS payload compiler
- translator integration
- golden output tests

### Risk Reduced
Hooks the new bridge into the easiest existing backend first.

## Phase 5: PixelBrain Compiler

### Deliverables
- schema to formula compiler
- lattice/symmetry integration
- deterministic output fixtures

### Risk Reduced
Realizes the biggest architectural payoff.

## Phase 6: Phaser Compiler

### Deliverables
- schema to Phaser motion payload compiler
- parity checks versus CSS baseline

### Risk Reduced
Ensures portability rather than CSS lock-in.

## Phase 7: QA Harness

### Deliverables
- invariant assertion utilities
- parity checker
- performance checks
- visual spot-test integration

### Risk Reduced
Makes semantic QA real rather than theoretical.

## Phase 8: Editor / Tooling Integration

### Deliverables
- preview panel
- linting support
- preset explorer
- source block authoring helpers

---

# 22. Risks

## 22.1 DSL Overreach

Risk: The source language becomes too expressive too early.

Mitigation:
- schema-first
- bounded syntax
- bounded envelopes
- additive expansion only after V1 stability

## 22.2 Backend Leakage

Risk: CSS or Phaser implementation details pollute source semantics.

Mitigation:
- semantic source rules
- backend hints optional only
- adapter contracts explicit

## 22.3 Parity Illusion

Risk: “Compiled to multiple backends” appears correct but drifts subtly.

Mitigation:
- parity checks
- invariants
- backend-specific tolerance policies

## 22.4 Performance Drift

Risk: Powerful source blueprints compile into expensive runtime artifacts.

Mitigation:
- constraint validation
- frame budget diagnostics
- payload size checks

## 22.5 Preset Instability

Risk: Preset expansion changes alter old animations unexpectedly.

Mitigation:
- versioned presets
- locked expansion snapshots where required

## 22.6 Ambiguous Ownership

Risk: Motion behavior spans multiple subsystems with unclear authority.

Mitigation:
- define ownership per layer:
  - schema: canonical truth
  - parser: source ingestion
  - validator: legality
  - compiler: backend generation
  - adapter: execution only

---

# 23. Success Criteria

This bridge is successful when the following become true:

## SC1
A designer or AI can write a blueprint block inside a PDR and it compiles without hand-translation.

## SC2
The blueprint becomes a canonical schema artifact with stable diagnostics.

## SC3
The same blueprint can compile into at least CSS and PixelBrain outputs in V1.

## SC4
QA can assert semantic invariants directly from source and compiled artifacts.

## SC5
The compiler produces deterministic outputs for identical inputs.

## SC6
Backends declare supported features explicitly and degrade predictably.

## SC7
Animation changes become diffable as source, not only visible as runtime behavior.

---

# 24. Recommended First Pilot

## Pilot Candidate
**Orb Transmission Pulse**

Why this is a good pilot:

- bounded scope
- visually important
- timing-sensitive
- symmetry-friendly
- glow + scale covers multiple transform families
- can be tested across CSS and PixelBrain

## Pilot Acceptance Criteria

- source blueprint compiles into canonical schema
- CSS payload renders correctly
- PixelBrain payload preserves radial symmetry and envelope timing
- diagnostics surface unsupported changes clearly
- semantic QA passes without relying only on screenshots

---

# 25. Open Questions

These should be resolved during foundation audit and schema design, not deferred indefinitely:

1. What existing motion bytecode format should be considered the long-term machine artifact target?
2. Should blueprint source live only in PDR markdown, or also in `.anim.md`, `.anim`, or `.blueprint` files?
3. What current easing tokens are already standardized in Scholomance?
4. Which PixelBrain execution interfaces are stable enough to target now?
5. How much backend drift is acceptable in parity mode?
6. Should presets be compiled inline at build time or resolved at runtime in dev only?
7. What is the canonical target addressing system for non-DOM entities?

---

# 26. Recommended Implementation Decision

## Immediate Recommendation

Build V1 in this exact order:

1. Canonical Animation Schema
2. Blueprint grammar
3. Parser with diagnostics
4. Validator
5. CSS compiler
6. PixelBrain compiler
7. QA invariant harness
8. Phaser compiler

This order minimizes architectural risk and maximizes early usefulness.

---

# 27. Final Statement

The missing bridge is not “animation support.”
It is **compiled semantic motion architecture**.

Scholomance already contains much of the machinery needed to support this vision. What it lacks is the formal connective tissue that transforms authored animation intent into deterministic, validated, backend-portable execution.

This PDR defines that connective tissue.

Once implemented, PDRs cease being passive design notes and become an executable specification layer. PixelBrain ceases being only a rendering/math engine and becomes part of a unified compilation target architecture. QA ceases relying primarily on visual approximation and gains semantic authority.

That is the bridge.

