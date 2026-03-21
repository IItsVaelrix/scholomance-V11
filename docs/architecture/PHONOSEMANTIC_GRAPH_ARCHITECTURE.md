# Phonosemantic Graph Architecture

## Executive Summary

Scholomance should stop treating syntax, prediction, and judiciary as isolated layers competing in a flat vote. The stronger model is a deterministic graph:

- tokens are nodes
- phonetic, semantic, syntactic, school, and memory relations are weighted edges
- prediction is bounded graph traversal from the current context
- syntax constrains which paths are legal
- judiciary arbitrates candidate paths, not just layer confidence totals

This document formalizes that shift without discarding the systems already built.

---

## Diagnosis of the Current Model

The current implementation already contains several graph primitives, but they are split across disconnected systems:

- [codex/core/predictor.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/predictor.js) still behaves like trie and bigram lookup
- [codex/core/judiciary.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/judiciary.js) is a weighted voting reducer over isolated candidates
- [src/lib/syntax.layer.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/lib/syntax.layer.js) classifies token roles and rhyme legality, but does not model relations
- [codex/core/spellweave.engine.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/spellweave.engine.js) uses semantic token detection plus scalar bonuses
- [codex/core/rhyme-astrology/types.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/rhyme-astrology/types.js) already defines `LexiconNode`, `SimilarityEdge`, and `ConstellationCluster`
- [codex/services/rhyme-astrology/indexRepo.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/services/rhyme-astrology/indexRepo.js) already exposes hot edges from a stored phonetic network
- [codex/core/semantics.registry.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/semantics.registry.js) and [codex/core/nexus.registry.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/nexus.registry.js) already describe semantic and mastery relations

The gap is not missing raw ingredients. The gap is that the runtime does not yet compose them into one authoritative relation model.

---

## Correct Mental Model

Use this split:

- Semantics gives direction.
- Phonetics gives resonance.
- Syntax gives legality.
- Judiciary gives policy.

In other words:

- `syntax` is not the meaning engine
- `prediction` is not prefix completion
- `judiciary` is not "which layer wins"

Instead:

- syntax defines which moves are structurally valid in the current slot
- prediction walks the weighted neighborhood around the active context
- judiciary scores and selects the strongest valid path through that neighborhood

---

## Proposed Core Model

### Node Classes

```ts
interface TokenGraphNode {
  id: string;
  token: string;
  normalized: string;
  nodeType: "LEXEME" | "SCROLL_TOKEN" | "SCHOOL_ANCHOR" | "SEMANTIC_ANCHOR";
  schoolBias: Partial<Record<School, number>>;
  phoneticSignature?: PhoneticSignature;
  semanticTags?: string[];
  frequencyScore?: number;
}
```

### Edge Classes

```ts
interface TokenGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation:
    | "PHONETIC_SIMILARITY"
    | "SEMANTIC_ASSOCIATION"
    | "SYNTACTIC_COMPATIBILITY"
    | "SCHOOL_RESONANCE"
    | "MEMORY_AFFINITY"
    | "SEQUENTIAL_LIKELIHOOD";
  weight: number; // 0..1
  evidence: string[];
  dimensions?: Record<string, number>;
}
```

### Context State

```ts
interface ContextActivation {
  anchorNodeIds: string[];
  currentSchool: School | null;
  syntaxContext: {
    role?: string;
    lineRole?: string;
    stressRole?: string;
    rhymePolicy?: string;
  } | null;
  decay: number;
  maxDepth: number;
  maxFanout: number;
}
```

### Candidate Output

```ts
interface GraphCandidate {
  nodeId: string;
  token: string;
  activationScore: number;
  legalityScore: number;
  semanticScore: number;
  phoneticScore: number;
  schoolScore: number;
  noveltyScore: number;
  totalScore: number;
  trace: ScoreTrace[];
}
```

These are proposed implementation shapes, not live shared schema yet. When implemented, publish them through `SCHEMA_CONTRACT.md`.

---

## How the Existing Systems Map In

### 1. Phonetic Backbone

Use RhymeAstrology as the initial graph backbone, not as a side feature.

- `lexicon_node` becomes the canonical `LEXEME` node source
- `hot_edge` becomes `PHONETIC_SIMILARITY` edges
- `constellation_cluster` becomes higher-order neighborhood summaries, not just response decoration

This is already available through:

- [codex/services/rhyme-astrology/lexiconRepo.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/services/rhyme-astrology/lexiconRepo.js)
- [codex/services/rhyme-astrology/indexRepo.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/services/rhyme-astrology/indexRepo.js)

### 2. Semantic Direction

Expand the current registry model from token lookup into relation lookup.

- `PREDICATES` and `OBJECTS` become seed semantic anchors
- synonym, antonym, etymology, and lexical family data become `SEMANTIC_ASSOCIATION` edges
- word mastery and synergy become `MEMORY_AFFINITY` overlays

The current registries stay useful, but they should stop being terminal lookup tables.

### 3. Syntax as Constraint Engine

The syntax layer should produce legality modifiers, not semantic truth.

From [src/lib/syntax.layer.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/lib/syntax.layer.js):

- `role`
- `lineRole`
- `stressRole`
- `rhymePolicy`

These should reweight or suppress graph edges at query time:

- suppress rhyme-heavy branches for mid-line function positions
- boost phonetic and school resonance for terminal stressed content slots
- suppress semantically loud but syntactically illegal candidates

### 4. Prediction as Traversal

The current predictor has two useful signals:

- prefix fit
- sequential likelihood

Keep both, but represent them as graph signals:

- trie prefix match remains a local candidate filter
- bigram memory becomes `SEQUENTIAL_LIKELIHOOD` edges
- graph traversal merges sequential, phonetic, semantic, and school signals into one frontier

### 5. Judiciary as Path Arbitration

The judiciary should evolve from flat candidate voting into path scoring.

Current model:

- each layer submits a confidence
- judiciary multiplies by layer weights

Target model:

- each candidate carries a path and evidence trail
- judiciary scores path coherence, legality, resonance, and intent alignment
- ties are broken by better connected paths, not just phoneme favoritism

---

## Proposed Module Layout

### Core

Add these modules under `codex/core/`:

- `token-graph/types.js`
- `token-graph/build.js`
- `token-graph/activation.js`
- `token-graph/traverse.js`
- `token-graph/score.js`
- `token-graph/judiciary.js`

Responsibilities:

- `build.js`: normalize nodes and edges from phonetic, semantic, and sequence sources
- `activation.js`: create bounded context activation from current text position
- `traverse.js`: explore nearby candidates with deterministic fanout and depth limits
- `score.js`: compute weighted candidate and path scores with `ScoreTrace[]`
- `judiciary.js`: arbitrate graph candidates and preserve backward-compatible adapters

### Services

Add service adapters under `codex/services/`:

- `token-graph/phonetic.repo.js`
- `token-graph/semantic.repo.js`
- `token-graph/sequence.repo.js`

Responsibilities:

- phonetic repo wraps RhymeAstrology node and edge stores
- semantic repo resolves dictionary and registry relations into deterministic edges
- sequence repo exposes corpus and usage-memory transitions

### Bridge / Migration Zone

Existing bridges that should be updated incrementally:

- [src/hooks/usePredictor.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/hooks/usePredictor.js)
- [src/lib/pls/providers/democracyProvider.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/lib/pls/providers/democracyProvider.js)
- [codex/server/services/wordLookup.service.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/server/services/wordLookup.service.js)
- [codex/core/spellweave.engine.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/spellweave.engine.js)

---

## Query Pipeline

For a single prediction or suggestion request:

1. Analyze the current document slot.
2. Resolve anchor nodes from the current token, previous token, line-end token, and active school.
3. Build `ContextActivation` from syntax and school state.
4. Traverse the graph with fixed depth and fanout.
5. Score each reachable candidate.
6. Run judiciary arbitration on scored paths.
7. Return candidates with trace output.

This preserves determinism and explanation traces.

---

## Determinism and Latency Rules

This graph must obey CODEx invariants:

- same input must produce the same output
- no stochastic walks
- bounded traversal only
- stable sort order on equal scores
- every final candidate returns a trace

Recommended hard limits:

- max depth: `2`
- max fanout per node: `24`
- final candidate count before arbitration: `64`

These keep the graph useful without turning prediction into an unbounded search problem.

---

## Migration Plan

### Phase 1: Graph Adapters, No Product Behavior Change

- wrap RhymeAstrology nodes and hot edges in a token-graph adapter
- add semantic-edge builders from current registries and dictionary surfaces
- add sequence-edge builder from trie and corpus bigrams
- keep existing predictor and judiciary public APIs unchanged

### Phase 2: Judiciary Learns Graph Candidates

- introduce `GraphCandidate` scoring in a new `token-graph/judiciary.js`
- keep [codex/core/judiciary.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/judiciary.js) as a backward-compatible facade
- let flat vote candidates be converted into one-hop graph candidates first

### Phase 3: Prediction Moves from Lookup to Traversal

- update [src/hooks/usePredictor.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/hooks/usePredictor.js) to request graph-ranked candidates
- update [src/lib/pls/providers/democracyProvider.js](C:/Users/Vaelrix/Desktop/scholomance-V11/src/lib/pls/providers/democracyProvider.js) to consume path-aware scores instead of isolated endorsements
- keep trie prefix lookup as a prefilter for active typing performance

### Phase 4: Spellweave Becomes Subgraph Alignment

- replace scalar `predicate/object` matching in [codex/core/spellweave.engine.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/core/spellweave.engine.js)
- score the relationship between verse and weave as graph alignment:
  - semantic alignment
  - school resonance
  - phonetic harmony
  - syntactic legality

### Phase 5: Server and Combat Consumers

- use graph scoring for ranked lexical suggestions in [codex/server/services/wordLookup.service.js](C:/Users/Vaelrix/Desktop/scholomance-V11/codex/server/services/wordLookup.service.js)
- expose graph-derived traces to combat and language surfaces once the schema is published

---

## Non-Goals

- Do not make phonetics replace semantics.
- Do not put UI logic into the graph.
- Do not let syntax invent meaning.
- Do not make the graph fully global and unconstrained at runtime.

The graph is a bounded decision structure, not a mystical free-association engine.

---

## Practical Recommendation

Build this in the following order:

1. Graph adapter over existing RhymeAstrology data
2. New graph judiciary with backward-compatible facade
3. Graph-backed predictor for `usePredictor` and PLS
4. Spellweave migration last

That order yields immediate quality gains without forcing a full combat rewrite first.
