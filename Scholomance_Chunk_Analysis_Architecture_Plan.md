# Scholomance Architecture Plan
## Chunk-First Truesight Analysis Fabric

**Document Purpose:** Define a backend-first architectural plan for migrating Scholomance from repeated word-by-word linguistic inspection to a chunk-first compiled analysis model with parallel specialist pipelines.

**Backend Owner:** Codex  
**UI Owner:** Claude  
**Primary Goal:** Compile a verse once into a canonical intermediate representation, then run reusable analysis pipes in parallel for rhyme, assonance, slant, multis, heuristics, and future linguistic systems.

---

# 1. Executive Summary

The current conceptual direction is to move Truesight away from a repeated per-word inspection model and toward a **chunk-first analysis architecture**.

Instead of re-parsing the same verse for each analytical concern, Scholomance should:

1. ingest an entire verse or chunk,
2. compile it into a dense canonical representation,
3. expose that representation to multiple specialist analysis pipes,
4. run those pipes in parallel,
5. fuse their outputs into a final Truesight result for overlays, metrics, and UI projection.

This architecture improves:

- performance,
- determinism,
- modularity,
- explainability,
- future extensibility,
- UI consistency.

This is not a cosmetic optimization. It is a structural and architectural change in the **unit of analysis**.

---

# 2. Problem Statement

## Current pain pattern

A traditional word-first analyzer often does some variation of the following:

- tokenize the text,
- inspect each word,
- derive phonetic data,
- scan for rhyme,
- scan again for assonance,
- scan again for slant rhyme,
- scan again for multis,
- scan again for heuristics,
- repeatedly traverse similar structures for different outputs.

This creates several costs:

### 2.1 Duplicate parsing work
Multiple systems repeatedly inspect the same tokens and phonetic structures.

### 2.2 Feature drift
Different analyzers may normalize or interpret the same text differently.

### 2.3 Weak abstraction boundary
The verse is not treated as a first-class analysis object.

### 2.4 Difficulty scaling
As more linguistic systems are added, each new feature risks becoming another pass over the same text.

### 2.5 UI inconsistency risk
If analyzers produce divergent shapes or positions, overlays become harder to trust and maintain.

---

# 3. Core Architectural Shift

## Old model

```text
verse -> tokenize -> inspect words repeatedly per feature
```

## New model

```text
verse -> compile once -> VerseIR -> run parallel pipes -> fuse -> UI projection
```

The key shift is this:

> The verse, not the individual word, becomes the primary analyzable object.

Words still matter, but as **indexed evidence inside a compiled verse representation**, not as the only unit of truth.

---

# 4. Design Principles

The new Truesight architecture should follow these rules.

## 4.1 Canonical representation first
All analysis pipes should consume the same compiled intermediate representation.

## 4.2 Single compile pass
Phonetic normalization and structural indexing should happen once per verse update, not once per pipe.

## 4.3 Pure or near-pure analysis pipes
Each pipe should read from shared immutable data and return a predictable result shape.

## 4.4 Evidence-preserving compression
Compression must not destroy traceability. The system must still be able to explain why a result exists.

## 4.5 UI-safe offsets
Character spans, token positions, and line positions must remain stable for overlays.

## 4.6 Pipe modularity
New linguistic systems should be addable without refactoring the compiler or unrelated pipes.

## 4.7 Backend/UI contract clarity
Codex should own the compiler, pipes, schemas, caching, and fusion contracts. Claude should own display, interactions, overlays, controls, and UX translation of backend outputs.

---

# 5. Ownership Split

## 5.1 Codex owns backend
Codex is responsible for:

- verse compilation,
- normalization,
- phonetic derivation,
- canonical schemas,
- feature tables,
- indexing,
- analysis pipes,
- result fusion,
- cache keys,
- performance measurement hooks,
- worker orchestration if introduced,
- regression harnesses for linguistic correctness.

### Codex deliverables
- `VerseIR` schema
- compiler pipeline
- phonetic utilities
- signature builders
- analysis pipe implementations
- fusion engine
- backend test suite
- benchmark suite
- versioned result contracts

## 5.2 Claude owns UI
Claude is responsible for:

- line overlays,
- token highlighting,
- cluster visualization,
- hover cards,
- inspector panels,
- legend and confidence displays,
- toggles between analysis modes,
- verse-level summaries,
- evidence presentation,
- progressive disclosure of detail,
- animation and interaction behaviors,
- failure-state rendering.

### Claude deliverables
- Truesight UI mapping layer
- overlay components
- analysis inspector components
- legend/key for linguistic classes
- confidence presentation rules
- filtering controls
- cluster navigation UX
- accessibility handling for color and hover interactions

## 5.3 Boundary rule
Claude should **not** derive core linguistic truth in the UI. Claude may interpret and present backend outputs, but the authoritative analytical truth must come from Codex contracts.

---

# 6. Proposed Core Object: VerseIR

## 6.1 Purpose
`VerseIR` is the canonical intermediate representation for a single verse or chunk.

It should be generated once from raw text and then reused by every analysis pipe.

## 6.2 Responsibilities of VerseIR
`VerseIR` should preserve:

- raw verse text,
- line segmentation,
- token segmentation,
- normalized tokens,
- phonetic data,
- syllable groupings,
- position offsets,
- adjacency relationships,
- searchable signatures,
- compact reusable feature tables.

## 6.2.1 Whitespace fidelity corollary
`VerseIR.rawText` and all downstream offsets must preserve the authored surface exactly:

- leading whitespace,
- internal repeated spaces,
- trailing spaces,
- blank lines,
- `\n`,
- `\r\n`,
- terminal newline state.

If the compiler trims or normalizes those characters before offsets are finalized, the Truesight overlay contract is broken.

## 6.3 Suggested shape

```ts
export type VerseIR = {
  version: string;
  rawText: string;
  normalizedText: string;
  lines: LineIR[];
  tokens: TokenIR[];
  syllableWindows: SyllableWindowIR[];
  indexes: VerseIndexes;
  featureTables: FeatureTables;
  metadata: VerseIRMetadata;
};
```

## 6.4 Suggested supporting types

```ts
export type LineIR = {
  lineIndex: number;
  text: string;
  normalizedText: string;
  tokenIds: number[];
  charStart: number;
  charEnd: number;
  lineBreak: string;
  lineBreakStart: number;
  lineBreakEnd: number;
  rawSlice: string;
  isTerminalLine: boolean;
};

export type TokenIR = {
  id: number;
  text: string;
  normalized: string;
  lineIndex: number;
  tokenIndexInLine: number;
  globalTokenIndex: number;
  charStart: number;
  charEnd: number;
  syllableCount: number;
  phonemes: string[];
  stressPattern: string[];
  onset: string[];
  nucleus: string[];
  coda: string[];
  vowelFamily: string[];
  rhymeTailSignature: string;
  consonantSkeleton: string;
  flags: {
    isLineEnd: boolean;
    isLineStart: boolean;
    isStopWordLike?: boolean;
    unknownPhonetics?: boolean;
  };
};

export type SyllableWindowIR = {
  id: number;
  tokenSpan: [number, number];
  lineSpan: [number, number];
  syllableLength: number;
  phonemeSpan: string[];
  vowelSequence: string[];
  stressContour: string;
  codaContour: string;
  signature: string;
};
```

---

# 7. Compiler Pipeline

## 7.1 Overview
Codex should implement a single compiler pass that transforms raw verse text into `VerseIR`.

## 7.2 Compiler stages

### Stage A: Raw ingestion
Input raw verse string exactly as authored, including trailing spaces and original newline style.

### Stage B: Line segmentation
Split into lines while preserving exact character offsets and explicit line-break spans.

### Stage C: Tokenization
Tokenize by words/punctuation strategy that remains compatible with Truesight UI needs without mutating the source surface used for offsets.

### Stage D: Normalization
Normalize tokens for lookup while preserving original display text.

### Stage E: Phonetic derivation
For each token, derive:

- phoneme sequence,
- stress pattern,
- onset,
- nucleus,
- coda,
- syllable count,
- fallback flags if unknown.

### Stage F: Signature generation
Build reusable compact signatures such as:

- rhyme-tail signature,
- vowel-family signature,
- consonant skeleton,
- stress contour code,
- syllabic length class.

### Stage G: Window generation
Generate multi-token syllable windows for cross-word pattern analysis.

### Stage H: Index building
Construct maps and lookup tables for efficient downstream analysis.

### Stage I: Feature table construction
Build affinity tables and similarity matrices for reuse by multiple pipes.

### Stage J: IR freeze/finalize
Return an immutable or treated-as-immutable `VerseIR` object.

---

# 8. Compression Strategy

## 8.1 What compression should mean here
Compression should mean:

- minimizing repeated work,
- transforming raw structures into reusable signatures,
- indexing for fast lookups,
- preserving evidence relationships.

## 8.2 What compression should not mean
Compression should not mean:

- flattening the verse so far that evidence disappears,
- losing token offsets,
- discarding phonetic provenance,
- making results impossible to explain.

## 8.3 Preferred compression layers

### Layer 1: Structural
- line boundaries
- token boundaries
- char offsets

### Layer 2: Phonetic
- phonemes
- syllables
- stress
- onset/nucleus/coda

### Layer 3: Signature
- rhyme tails
- vowel families
- consonant skeletons
- stress contours

### Layer 4: Indexed search
- tokens by line
- tokens by rhyme tail
- tokens by vowel family
- windows by signature
- line-end tokens

### Layer 5: Affinity tables
- rhyme affinity
- assonance affinity
- slant proximity
- stress alignment

---

# 9. Analysis Pipes

Each pipe consumes `VerseIR`. Pipes should not independently re-tokenize or re-derive phonetic structures.

## 9.1 Pipe contract

```ts
export interface AnalysisPipe<T> {
  id: string;
  run(ir: VerseIR): Promise<T> | T;
}
```

## 9.2 Pipe list

### 9.2.1 AssonancePipe
Purpose: detect repeated vowel resonance across nearby or structurally important spans.

Consumes:
- vowel-family signatures
- syllable windows
- adjacency windows
- line structure

Returns:
- assonance clusters
- token evidence spans
- line intensity metrics
- confidence scores

### 9.2.2 EndRhymePipe
Purpose: detect end-rhyme relationships and scheme structures.

Consumes:
- line-end token set
- rhyme-tail signatures
- stress pattern support

Returns:
- rhyme families
- scheme labels
- strength metrics
- ambiguous scheme cases

### 9.2.3 InternalRhymePipe
Purpose: detect same-line and cross-line internal rhyme structures.

Consumes:
- token adjacency groups
- line-local spans
- phonetic similarity tables

Returns:
- internal rhyme pairings
- chain clusters
- density stats

### 9.2.4 MultiSyllabicPipe
Purpose: detect multisyllabic rhyme relationships across one or more tokens.

Consumes:
- `SyllableWindowIR[]`
- phonetic similarity buckets
- stress contour alignment
- coda contour support

Returns:
- multi chains
- line-to-line multi links
- dominant multi lengths
- confidence and match strength

### 9.2.5 SlantRhymePipe
Purpose: detect near-rhyme families that diverge from exact rhyme.

Consumes:
- consonant skeletons
- vowel drift tolerances
- coda similarity
- substitution heuristics

Returns:
- slant clusters
- match rationale
- ambiguity classes

### 9.2.6 HeuristicPipe
Purpose: produce larger evaluative metrics over the verse.

Consumes:
- outputs from VerseIR and optionally other fused structures

Returns:
- complexity metrics
- density metrics
- sonic repetition metrics
- stress volatility metrics
- cadence-related heuristics
- verse-level resonance score if desired

### 9.2.7 Future pipes
Future expansion candidates:

- CadencePipe
- FlowContourPipe
- RepetitionStructurePipe
- SemanticEchoPipe
- MotifPipe
- PunchlinePressurePipe
- EmotionalTensionPipe

---

# 10. Parallel Execution Model

## 10.1 Execution philosophy
The compiler should run once. Pipes should run in parallel over shared compiled data.

## 10.2 Baseline execution

```ts
const ir = compileVerseToIR(text);

const [
  assonance,
  endRhymes,
  internalRhymes,
  multis,
  slant,
  heuristics,
] = await Promise.all([
  runAssonancePipe(ir),
  runEndRhymePipe(ir),
  runInternalRhymePipe(ir),
  runMultiSyllabicPipe(ir),
  runSlantRhymePipe(ir),
  runHeuristicPipe(ir),
]);
```

## 10.3 Threading note
Initial implementation should prioritize **logical parallelism** over true worker-thread complexity.

Recommended order:

1. build shared compiler,
2. validate pipe contracts,
3. benchmark,
4. only move heavy pipes to workers if profiling justifies it.

## 10.4 Candidate workerized pipes later
- MultiSyllabicPipe
- SlantRhymePipe
- large affinity matrix generation

---

# 11. Fusion Layer

## 11.1 Purpose
The fusion layer is responsible for combining pipe outputs into a coherent final Truesight result.

## 11.2 Fusion responsibilities
- merge token-level evidence,
- merge line-level structures,
- build verse-level summary,
- resolve overlap collisions,
- project confidence,
- expose UI-ready but backend-authored result schemas.

## 11.3 Suggested fused result

```ts
export type TruesightAnalysis = {
  version: string;
  verseMetrics: VerseMetrics;
  tokenOverlays: TokenOverlay[];
  lineOverlays: LineOverlay[];
  clusters: AnalysisCluster[];
  evidence: EvidenceGraph;
  summaries: AnalysisSummary[];
};
```

## 11.4 Boundary rule
Codex owns the fused analytical truth. Claude consumes and renders it.

---

# 12. Suggested Repository Division

## 12.1 Codex-owned backend directories

```text
src/
  codex/
    truesight/
      compiler/
        compileVerseToIR.ts
        splitLines.ts
        tokenizeVerse.ts
        normalizeToken.ts
        derivePhonetics.ts
        buildSignatures.ts
        buildSyllableWindows.ts
        buildIndexes.ts
        buildAffinityTables.ts
      contracts/
        verse-ir.types.ts
        pipe.types.ts
        result.types.ts
        metrics.types.ts
      pipes/
        runAssonancePipe.ts
        runEndRhymePipe.ts
        runInternalRhymePipe.ts
        runMultiSyllabicPipe.ts
        runSlantRhymePipe.ts
        runHeuristicPipe.ts
      fusion/
        fuseAnalysis.ts
        mergeClusters.ts
        buildEvidenceGraph.ts
      cache/
        analysisCache.ts
        makeVerseCacheKey.ts
      benchmarks/
        benchmarkTruesight.ts
      tests/
        compiler.spec.ts
        rhyme.spec.ts
        assonance.spec.ts
        multis.spec.ts
        slant.spec.ts
        regression.spec.ts
```

## 12.2 Claude-owned UI directories

```text
src/
  ui/
    truesight/
      components/
        TruesightPanel.tsx
        VerseOverlay.tsx
        TokenOverlayLayer.tsx
        LineOverlayLayer.tsx
        ClusterLegend.tsx
        AnalysisInspector.tsx
        ConfidenceBadge.tsx
      hooks/
        useTruesightAnalysis.ts
        useOverlayFilters.ts
        useClusterNavigation.ts
      adapters/
        mapAnalysisToOverlayModel.ts
        mapMetricsToDisplay.ts
      styles/
        truesight.tokens.ts
        truesight.colors.ts
      tests/
        TruesightPanel.spec.tsx
        VerseOverlay.spec.tsx
        AnalysisInspector.spec.tsx
```

---

# 13. VerseIR Index Design

Codex should provide fast indexes for the most common pattern queries.

## 13.1 Required indexes
- tokens by line index
- line-end token ids
- tokens by rhyme-tail signature
- tokens by vowel family
- tokens by consonant skeleton
- windows by syllable length
- windows by signature
- tokens by stress contour

## 13.2 Optional indexes
- n-gram phoneme clusters
- token neighborhood maps
- repeated token family maps
- punctuation and pause markers for cadence systems

---

# 14. Resonance Window System

## 14.1 Purpose
Many important rhyme structures do not live cleanly inside single-token boundaries. Multis and compound sonic matches often span multiple words.

## 14.2 Proposal
Generate syllable-based windows of configurable sizes, for example:

- 1 syllable
- 2 syllables
- 3 syllables
- 4 syllables
- optionally 5+ for advanced analysis modes

## 14.3 Window features
Each window should carry:

- token span
- phoneme span
- vowel sequence
- consonant contour
- stress contour
- ending contour
- compact signature

## 14.4 Benefits
This unlocks stronger detection for:

- multisyllabic rhyme,
- cross-token rhyme,
- staggered line echoes,
- slant multi patterns,
- hidden internal chain behavior.

---

# 15. Affinity Tables

## 15.1 Purpose
Affinity tables reduce repeated pairwise computations.

## 15.2 Candidate tables
- token-to-token rhyme affinity
- token-to-token assonance affinity
- window-to-window phonetic similarity
- coda similarity matrix
- stress contour similarity matrix

## 15.3 Storage caution
Not every matrix should be eagerly computed for every verse size. Codex should profile memory and CPU tradeoffs.

## 15.4 Suggested strategy
- eager compute for small verses,
- partial lazy compute for large verses,
- cache by verse hash and IR version.

---

# 16. Caching Strategy

## 16.1 Cache goals
- avoid recompiling identical verses,
- avoid recomputing identical pipes when inputs are unchanged,
- support responsive UI interactions.

## 16.2 Cache layers

### Layer A: VerseIR cache
Keyed by normalized verse hash + compiler version.

### Layer B: Pipe result cache
Keyed by verse hash + pipe id + pipe version.

### Layer C: Fused result cache
Keyed by verse hash + enabled-pipe set + fusion version.

## 16.3 Invalidation triggers
- text changed,
- phonetic logic changed,
- signature builder changed,
- pipe scoring changed,
- schema version bumped.

---

# 17. Error Handling and Fallbacks

## 17.1 Unknown token phonetics
If a token is unknown:

- preserve token position,
- mark fallback status,
- attempt heuristic phonetic approximation if acceptable,
- surface reduced confidence rather than silently failing.

## 17.2 Partial pipe failure
If one pipe fails:

- preserve successful pipe outputs,
- surface pipe-specific error metadata,
- allow UI to show degraded mode instead of blanking the whole analysis.

## 17.3 Contract corruption
If result shapes do not validate, fail early in development and log contract mismatch clearly.

---

# 18. Performance Strategy

## 18.1 Primary performance wins
- compile once,
- reuse signatures,
- reuse indexes,
- parallelize pipes,
- prune impossible comparisons early.

## 18.2 Important pruning rules
For multi/slant comparison systems:

- compare only windows of same syllable length where relevant,
- bucket by rough phonetic family first,
- skip impossible coda mismatches early,
- cap long-distance search if mode requires proximity,
- optionally downshift analysis depth in live typing mode.

## 18.3 Mode suggestion
Codex may expose different analysis modes:

- `live_fast`
- `balanced`
- `deep_truesight`

Claude can present these as UX toggles, but Codex defines their computational meaning.

### Delivery note
Even when Codex completes analysis quickly, fused result delivery should support UI-friendly scheduling so React does not reconcile a full Truesight tree on every keystroke. Backend contracts should therefore remain stable enough for deferred or transition-based consumption on the UI side.

---

# 19. UI Contract Expectations for Claude

Claude should assume backend output is authoritative and focus on rendering clarity.

## 19.1 Required UI features
- token highlighting by class
- line overlays
- cluster hover or tap reveal
- per-pipe filters
- confidence display
- summary cards
- evidence drilldown

## 19.2 Suggested UX patterns
- layered overlays with independent toggles
- color plus shape/pattern redundancy for accessibility
- hover panel for evidence details
- click-through from verse summary to exact line/token spans
- compact summary mode and expanded forensic mode

## 19.3 Important rule
Claude should not reconstruct rhyme logic in component code. Mapping is allowed. Re-analysis is not.

## 19.4 Security rendering rule
Overlay token rendering should use standard text-node rendering for token text. The Truesight contract should not assume or require `dangerouslySetInnerHTML`.

---

# 20. Migration Plan

## Phase 0: Audit current Truesight
**Owner:** Codex  
Document existing analysis paths, duplicated phonetic logic, UI dependencies, and current result shapes.

### Deliverables
- current-flow map
- duplication map
- UI dependency inventory
- regression corpus selection

## Phase 1: Define contracts
**Owner:** Codex  
Create stable schemas for `VerseIR`, pipe results, and fused outputs.

### Deliverables
- type definitions
- version policy
- schema validation strategy

## Phase 2: Build compiler foundation
**Owner:** Codex  
Implement line splitting, tokenization, phonetic derivation, offsets, and signatures.

### Deliverables
- `compileVerseToIR`
- compiler tests
- offset fidelity checks

## Phase 3: Migrate one low-risk pipe
**Owner:** Codex  
Port either EndRhymePipe or AssonancePipe first.

### Deliverables
- first pipe implementation
- before/after comparison tests
- performance baseline

## Phase 4: Build fusion layer
**Owner:** Codex  
Create a fused output contract that Claude can consume.

### Deliverables
- `fuseAnalysis`
- token overlay schema
- line overlay schema
- summary schema

## Phase 5: UI adaptation
**Owner:** Claude  
Adapt Truesight UI to consume fused backend results.

### Deliverables
- overlay renderers
- legends
- inspector UI
- degraded mode handling

## Phase 6: Port advanced pipes
**Owner:** Codex  
Port InternalRhymePipe, MultiSyllabicPipe, SlantRhymePipe, HeuristicPipe.

### Deliverables
- pipe implementations
- performance guardrails
- richer evidence graph

## Phase 7: Optimize and benchmark
**Owner:** Codex  
Profile heavy paths, add caching, optionally introduce workers.

### Deliverables
- benchmark report
- profiling report
- workerization decision memo

## Phase 8: UX refinement
**Owner:** Claude  
Improve readability, navigation, filtering, and evidence comprehension.

### Deliverables
- overlay polish
- clarity improvements
- visual density controls

---

# 21. Regression Strategy

## 21.1 Regression corpus
Build a verse corpus containing:

- clean end rhymes,
- heavy internal rhyme,
- dense multis,
- slant-heavy material,
- punctuation-heavy lines,
- broken line-edge cases,
- unknown word cases,
- high-entropy experimental verse.

## 21.2 Comparison goals
Compare old engine vs new engine for:

- rhyme detection,
- offset accuracy,
- confidence stability,
- highlight projection,
- runtime,
- false positive/negative shifts.

## 21.3 Required output
Any drift should be logged as:
- intentional improvement,
- acceptable difference,
- regression.

---

# 22. QA Checklist

## 22.1 Backend QA for Codex
- compiler preserves exact character offsets
- line boundaries are stable
- token normalization is deterministic
- phonetic derivation matches expected rules
- unknown tokens degrade gracefully
- no pipe re-tokenizes raw text
- pipe results conform to schema
- fused outputs remain versioned and stable

## 22.2 UI QA for Claude
- overlays map to exact spans
- hover/click details match backend evidence
- filters do not mutate source truth
- confidence displays are clear
- multiple overlay layers remain readable
- degraded mode is understandable
- accessibility support remains intact

## 22.3 Integration QA
- typing responsiveness remains acceptable
- live analysis mode does not stutter excessively
- cached results update correctly after edits
- schema version mismatches fail loudly in dev

---

# 23. Risks

## 23.1 Overcompression risk
If the IR becomes too abstract, the system may lose explainability.

**Mitigation:** preserve raw evidence links and offsets.

## 23.2 Window explosion risk
Multi-window comparisons can grow too large.

**Mitigation:** pruning, bucketing, mode-based limits, lazy evaluation.

## 23.3 Contract drift risk
Pipes may evolve inconsistent result shapes.

**Mitigation:** versioned schemas and validation.

## 23.4 UI truth leakage risk
Claude may be tempted to infer analytical truth in the interface.

**Mitigation:** keep backend authoritative and strict.

## 23.5 Premature worker complexity
Worker orchestration can introduce serialization overhead and debugging burden.

**Mitigation:** benchmark first, workerize second.

---

# 24. Acceptance Criteria

The migration should be considered successful when all of the following are true:

## Backend acceptance
- a verse compiles once into `VerseIR`
- at least 4 major pipes consume the same IR
- fused outputs are versioned and validated
- compiler and pipes outperform or match old runtime under normal workloads
- regression corpus passes agreed thresholds

## UI acceptance
- Truesight overlays render from fused outputs only
- users can inspect clusters and evidence clearly
- filters and confidence displays are usable
- no UI logic re-derives rhyme or phonetic truth

## Architecture acceptance
- adding a new analysis pipe does not require rewriting the compiler
- adding a new UI panel does not require redefining backend truth
- shared contracts are stable and documented

---

# 25. Final Recommendation

Proceed with the chunk-first model.

The smartest path is not to rewrite everything at once, but to establish the new backbone and then migrate pipe by pipe.

## Immediate next action
Codex should implement:

1. `VerseIR` contract,
2. compiler scaffold,
3. one migrated pipe,
4. fused output contract.

Claude should then:

1. adapt Truesight UI to the fused contract,
2. render overlays and evidence cleanly,
3. avoid embedding analytical logic in the interface.

This preserves coherence, minimizes regression risk, and builds a durable foundation for Scholomance’s future linguistic systems.

---

# 26. Short Directive Summary

## Codex
Own the backend truth:
- compile,
- index,
- analyze,
- fuse,
- cache,
- validate.

## Claude
Own the interface truthfulness:
- render,
- explain,
- navigate,
- filter,
- visualize,
- respect backend authority.

## Shared rule
One verse. One canonical IR. Many parallel pipes. One fused analytical truth.
