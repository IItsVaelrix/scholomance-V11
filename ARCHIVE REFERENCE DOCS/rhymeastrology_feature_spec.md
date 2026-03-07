# RhymeAstrology — Feature Implementation Spec (Revised for 50GB Disk)

## Summary

**RhymeAstrology** is a new Scholomance subsystem that turns rhyme discovery from a flat word lookup into a **phonetic constellation engine**.

Instead of:
- word → rhyme list

It introduces:
- word / line → phonetic signature
- phonetic signature → weighted similarity index
- index → rhyme constellations
- constellations → suggestions, scoring, visualization, and future gameplay hooks

This feature is implemented as a **modular platform layer**, not a one-off UI widget.

### Classification
**Architectural + behavioral feature**

---

## Disk Budget

**Total available:** 50GB
**RhymeAstrology ceiling:** 2GB
**System target:** 35GB total across all /var/data assets

| Asset | Budget |
|---|---|
| `scholomance_dict.sqlite` | 3 GB |
| `scholomance_corpus.sqlite` | 1 GB |
| `audio/` | 20 GB |
| `scholomance_user.sqlite` | 1 GB |
| `scholomance_collab.sqlite` | 500 MB |
| RhymeAstrology indexes | 2 GB |
| OS + app + build artifacts | 5 GB |
| Free headroom | ~2.5 GB |
| **Total** | **~35 GB** |

### What changed from v0 spec
- Lexicon reduced from 182k words to **50k words** (covers all practical poetry vocabulary, eliminates rare technical/archaic terms that never appear in verse)
- Flat pairwise edge shards eliminated — replaced with **signature-bucket index** (see below)
- Hot edge precomputation scoped to **top 10k high-frequency words only**
- Parquet dropped — **SQLite only**
- Redis dropped — **in-process LRU cache only**
- All code in **JavaScript**, not TypeScript (matches existing CODEx stack)

---

## Why

Scholomance already treats language as a structured system. RhymeAstrology extends that philosophy by treating rhyme as a **navigable space**, not a static dictionary response.

### Problem with normal rhyme tools
- exact rhyme lists only
- no slant-rhyme reasoning
- no line-level pattern matching
- no reusable graph layer for scoring or gameplay

### Why this matters for Scholomance
RhymeAstrology gives the PLS a reusable **phonetic topology layer** that can power:
- smarter rhyme suggestions
- internal rhyme discovery
- constellation visualization
- flow complexity analysis
- future XP / spell / pattern unlock logic

---

## Goals

### Primary goals
1. Build a persistent **phonetic signature index** over 50k curated words.
2. Support **exact**, **slant**, **family**, and **structure-adjacent** rhyme discovery.
3. Return results under 15ms (word) / 35ms (line) on the hot path.
4. Expose a stable API that other Scholomance systems can reuse.
5. Make output visualizable as constellations.

### Non-goals for v1
- full semantic metaphor matching
- beat-aligned rap prosody scoring
- multi-language support
- ML embedding search
- user-facing social corpus search
- graph canvas rendering

---

## Feature Concept

RhymeAstrology models language as a sky of phonetic bodies.

| Concept | Meaning |
|---|---|
| Star | word or phrase node |
| Constellation | clustered phonetic family |
| Orbit | weighted similarity relationship |
| Galaxy | broader vowel / stress family |
| Transit | query traversal through the index |
| Sign | dominant phonetic pattern class |

This metaphor is naming flavor only. Internally, implementation is explicit and deterministic.

---

## Proposed Architecture

```
Input Text
  → Token Normalization
  → Pronunciation Resolution
  → Phonetic Signature Extraction
  → Signature-Bucket Index Lookup
  → Candidate Scoring (within bucket only)
  → Constellation Assembly
  → API Response
  → UI Visualization / PLS Hooks
```

### Placement in Scholomance
```
codex/
  core/
    rhyme-astrology/
      signatures.js
      similarity.js
      clustering.js
      types.js        (JSDoc only)
      scoring.js
  runtime/
    rhyme-astrology/
      queryEngine.js
      cache.js
      assembly.js
  services/
    rhyme-astrology/
      lexiconRepo.js
      indexRepo.js
  server/
    routes/
      rhymeAstrology.routes.js
  scripts/
    buildRhymeAstrologyIndex.js
```

---

## Data Model

All types defined as JSDoc. No TypeScript.

### 1. LexiconNode
```js
/**
 * @typedef {Object} LexiconNode
 * @property {string} id
 * @property {string} token
 * @property {string} normalized
 * @property {string[]} phonemes
 * @property {string} stressPattern
 * @property {number} syllableCount
 * @property {string[]} vowelSkeleton
 * @property {string[]} consonantSkeleton
 * @property {string} endingSignature
 * @property {string} onsetSignature
 * @property {number} frequencyScore
 */
```

`rarityScore` removed — `frequencyScore` is sufficient for v1 ranking. Reduces per-row storage.

### 2. SimilarityEdge
```js
/**
 * @typedef {Object} SimilarityEdge
 * @property {string} fromId
 * @property {string} toId
 * @property {number} exactRhymeScore
 * @property {number} slantRhymeScore
 * @property {number} vowelMatchScore
 * @property {number} consonantMatchScore
 * @property {number} stressAlignmentScore
 * @property {number} syllableDeltaPenalty
 * @property {number} overallScore
 */
```

Edges are **not stored for all word pairs**. Only precomputed for top 10k high-frequency words. All others are scored at query time from their signature bucket.

### 3. ConstellationCluster
```js
/**
 * @typedef {Object} ConstellationCluster
 * @property {string} id
 * @property {string} anchorId
 * @property {string} label
 * @property {string[]} dominantVowelFamily
 * @property {string} dominantStressPattern
 * @property {string[]} members
 * @property {number} densityScore
 * @property {number} cohesionScore
 */
```

### 4. QueryPattern
```js
/**
 * @typedef {Object} QueryPattern
 * @property {string} rawText
 * @property {string[]} tokens
 * @property {LexiconNode[]} resolvedNodes
 * @property {string} [lineEndingSignature]
 * @property {string[]} [internalPattern]
 * @property {string} [stressContour]
 */
```

---

## Signature Extraction

### Word-level signature fields
- phoneme array
- vowel skeleton
- consonant skeleton
- ending rhyme signature
- onset cluster
- stress pattern
- syllable count

### Example
```
flame
phonemes: F L EY1 M
vowelSkeleton: [EY1]
consonantSkeleton: [F, L, M]
endingSignature: EY1-M
onsetSignature: F-L
stressPattern: 1
```

### Line-level example
```
spitting venom in the senate
stressContour: 10010010
vowelFlow: IH-IH-EH-IH-EH
endingSignature: EH-T
internalChunks: spit / ven / sen
```

Keep extraction deterministic and transparent. No opaque composite scores without breakdown.

---

## Signature-Bucket Index (replaces flat edge shards)

Instead of storing 12M precomputed pairwise edges, words are grouped by `endingSignature` into buckets at build time.

### How it works
- Build time: group all 50k words by `endingSignature` → write buckets to `rhyme_index.sqlite`
- Query time: resolve the query word's `endingSignature` → fetch its bucket (typically 20–200 members) → score all candidates in the bucket → return ranked results
- No full graph traversal. Candidate set is bounded by bucket size.

### Storage estimate
- ~3,000 unique ending signatures across 50k words
- Average bucket: ~17 members
- Largest buckets (e.g., "-AH0-N"): ~500 members
- Total index size: negligible — well under 10MB

### Hot edge precomputation
For the top 10k most frequent words, edges are precomputed and stored in `rhyme_edges.sqlite`:
- 10k words × avg 40 scored neighbors × ~80 bytes per edge = **~32MB**
- These are served directly without bucket lookup, keeping hot-path latency minimal

---

## Similarity Logic

### Score dimensions

| Dimension | Meaning |
|---|---|
| Exact ending match | identical rhyme tail |
| Vowel family match | similar stressed vowel nucleus |
| Consonant tail match | similar coda shape |
| Stress alignment | matching stress position |
| Syllable compatibility | penalize mismatch |
| Onset echo | alliteration / mirrored onset |
| Internal recurrence | repeated sound pattern across line |

### Weighted formula
```js
overallScore =
  exactRhymeScore * 0.35 +
  slantRhymeScore * 0.20 +
  vowelMatchScore * 0.20 +
  consonantMatchScore * 0.10 +
  stressAlignmentScore * 0.10 -
  syllableDeltaPenalty * 0.05;
```

### Centralized weights config
```js
// codex/core/rhyme-astrology/scoring.js
export const RHYME_ASTROLOGY_WEIGHTS = {
  exact: 0.35,
  slant: 0.20,
  vowel: 0.20,
  consonant: 0.10,
  stress: 0.10,
  syllablePenalty: 0.05,
};
```

Weights must not be buried inside query functions.

---

## Constellation Assembly

### Assembly steps
1. Resolve query token or line signature.
2. Check hot edge cache (top 10k words) — serve directly if hit.
3. Otherwise fetch signature bucket, score candidates on demand.
4. Group scored results by dominant vowel family + tail signature.
5. Calculate cluster cohesion.
6. Return ranked constellations.

### Result shape
```js
/**
 * @typedef {Object} RhymeAstrologyResult
 * @property {QueryPattern} query
 * @property {Array<{nodeId: string, token: string, overallScore: number, reasons: string[]}>} topMatches
 * @property {ConstellationCluster[]} constellations
 * @property {{queryTimeMs: number, cacheHit: boolean, candidateCount: number}} diagnostics
 */
```

### Reasons array example
```js
[
  "shared stressed vowel EY1",
  "matching ending consonant M",
  "same syllable count",
  "strong line-ending rhyme affinity"
]
```

---

## Storage Strategy

### SQLite only. No Parquet. No Redis.

| File | Purpose | Estimated Size |
|---|---|---|
| `rhyme_lexicon.sqlite` | 50k LexiconNodes + signatures | ~25 MB |
| `rhyme_index.sqlite` | Signature buckets + cluster index | ~15 MB |
| `rhyme_edges.sqlite` | Hot precomputed edges (top 10k words) | ~32 MB |
| `rhyme_manifest.json` | Build metadata | < 1 KB |
| **Total** | | **~72 MB** |

RhymeAstrology uses ~72MB of the 2GB allocation. The remaining ~1.9GB is buffer for:
- user growth in `rhyme_edges.sqlite` if hot set is expanded later
- line-pattern memoization added in v2
- corpus-derived frequency rescoring

### In-process LRU cache
Hot query results cached in-process. No external cache dependency. Cache size configurable via env var, default 500 entries.

### Do not
- compute all pairwise edges at runtime
- store edges as loose JSON blobs
- couple index generation to HTTP startup
- add Parquet or Redis without explicit architectural approval

---

## Build Pipeline

### Script
`scripts/buildRhymeAstrologyIndex.js`

### Three stages (down from five)

**Stage A — Lexicon**
- Load source lexicon (50k curated words)
- Normalize pronunciations via CMU dict
- Derive all signatures per word
- Write to `rhyme_lexicon.sqlite`

**Stage B — Index**
- Group words by `endingSignature` → write buckets to `rhyme_index.sqlite`
- Pre-cluster dominant vowel families
- Write cluster records

**Stage C — Hot Edges**
- Select top 10k words by `frequencyScore`
- For each: fetch its signature bucket, score all candidates, store top 50 results
- Write to `rhyme_edges.sqlite`
- Write `rhyme_manifest.json`

### Manifest
```json
{
  "version": 1,
  "builtAt": "2026-03-06T00:00:00.000Z",
  "lexiconCount": 50000,
  "signatureBuckets": 3100,
  "hotEdgeWords": 10000,
  "hotEdgeCount": 487000,
  "clusterCount": 3100
}
```

---

## API Design

### Route
`GET /api/rhyme-astrology/query`

### Query params
- `text` — word or line
- `mode` — `word` | `line`
- `limit` — default 25
- `minScore` — default 0.4
- `includeConstellations` — boolean
- `includeDiagnostics` — boolean

### Example
```http
GET /api/rhyme-astrology/query?text=flame&mode=word&limit=25&includeConstellations=true
```

### Response
```json
{
  "query": { "rawText": "flame", "tokens": ["flame"] },
  "topMatches": [
    {
      "nodeId": "w_1932",
      "token": "frame",
      "overallScore": 0.97,
      "reasons": [
        "shared stressed vowel EY1",
        "matching ending consonant M"
      ]
    }
  ],
  "constellations": [
    {
      "id": "c_ey1_m",
      "anchorId": "w_1932",
      "label": "EY1-M Cluster",
      "dominantVowelFamily": ["EY1"],
      "dominantStressPattern": "1",
      "members": ["w_1932", "w_3881", "w_9012"],
      "densityScore": 0.88,
      "cohesionScore": 0.91
    }
  ],
  "diagnostics": {
    "queryTimeMs": 6,
    "cacheHit": true,
    "candidateCount": 43
  }
}
```

---

## UI Integration

### v1 targets (in order)
1. **Inspector panel** — selected word → top matches + dominant constellation
2. **Tooltip extension** — show rhyme sign / vowel family on hover
3. **Side panel cluster list** — exact / slant / family neighbors
4. **Inline highlights** — optional visual links between internal rhyme anchors

### Future UI (not v1)
- graph canvas view
- animated star map
- line-level orbit trails
- compare-two-lines mode

Ship the API and cluster list first. Do not block usefulness on the star map.

---

## PLS Integration

### Hook outputs
```js
/**
 * @typedef {Object} PLSPhoneticFeatures
 * @property {number} rhymeAffinityScore     - avg overallScore of top 3 matches
 * @property {number} constellationDensity   - densityScore of dominant cluster
 * @property {number} internalRecurrenceScore - ratio of lines with internal rhyme matches
 * @property {number} phoneticNoveltyScore   - inverse of frequencyScore for matched words
 */
```

These are computed inside `codex/core/rhyme-astrology/scoring.js` and exported as a clean object. UI consumes via the existing hook/adapter pattern — no direct API calls from components.

---

## Performance Targets

| Path | Target |
|---|---|
| Word query, cache hit | < 5 ms |
| Word query, bucket lookup | < 15 ms |
| Line query | < 35 ms |
| Index build (full) | acceptable at deploy time |

### Optimization rules
- Candidate set bounded by bucket size — no full graph traversal
- Memoized signature extraction
- In-process LRU, 500 entries default
- Depth-1 graph only in v1 (no recursive expansion)
- Do not trigger query on every keystroke — debounce upstream

---

## Code Skeleton (JavaScript)

```js
// codex/core/rhyme-astrology/scoring.js
export const RHYME_ASTROLOGY_WEIGHTS = {
  exact: 0.35, slant: 0.20, vowel: 0.20,
  consonant: 0.10, stress: 0.10, syllablePenalty: 0.05,
};
```

```js
// codex/core/rhyme-astrology/signatures.js
export function buildPhoneticSignature(phonemes) {
  // derive vowelSkeleton, consonantSkeleton, endingSignature, onsetSignature
}
```

```js
// codex/core/rhyme-astrology/similarity.js
export function scoreNodeSimilarity(a, b, weights) {
  // compute dimensional scores + final weighted result
  // return { overallScore, reasons[] }
}
```

```js
// codex/runtime/rhyme-astrology/queryEngine.js
export async function queryRhymeAstrology(input, mode) {
  // 1. resolve signature
  // 2. check hot edge cache
  // 3. if miss: fetch bucket, score candidates
  // 4. cluster results
  // 5. return RhymeAstrologyResult
}
```

```js
// codex/server/routes/rhymeAstrology.routes.js
export default async function rhymeAstrologyRoutes(fastify) {
  fastify.get('/api/rhyme-astrology/query', async (request, reply) => {
    // validate params
    // invoke queryRhymeAstrology
    // return result
  });
}
```

---

## Implementation Order

### Phase 1 — Foundations
- define JSDoc types
- build signature extraction
- centralize weights
- create lexicon repository
- build script shell

### Phase 2 — Index Build
- generate signature buckets
- pre-cluster top families
- precompute hot edges (top 10k)
- write manifest

### Phase 3 — Query Runtime
- implement word mode
- implement line mode
- add in-process LRU cache
- add diagnostics

### Phase 4 — UI
- inspector panel
- tooltip extension
- cluster list
- optional inline linking

### Phase 5 — PLS Hooks
- add feature outputs
- expose scoring extensions
- test downstream consumers

---

## QA Checklist

### Data correctness
- [ ] exact rhyme results are stable and predictable
- [ ] slant rhyme results are plausible, not noisy
- [ ] stress patterns resolve correctly
- [ ] syllable mismatches are penalized appropriately
- [ ] missing pronunciations fall back safely
- [ ] bucket lookup returns same results as hot edge cache for top-10k words

### Runtime
- [ ] hot path latency within targets
- [ ] cache hit rate observable via diagnostics
- [ ] cold build artifacts survive redeploys without regeneration
- [ ] total index size stays under 100MB

### UI
- [ ] inspector does not block editor performance
- [ ] results are understandable without graph view
- [ ] explanations show why a match appeared
- [ ] colors consistent with existing school palette

### Integration
- [ ] no duplicate rhyme logic in UI components
- [ ] PLS consumes exported features, not internals
- [ ] build pipeline decoupled from HTTP startup
- [ ] weights are centralized and versioned

---

## Regression Risks

### 1. Query noise
If weights are untuned, results feel random.
**Mitigation:** return dimensional reasons. Log low-confidence results during build.

### 2. Bucket imbalance
Some ending signatures have hundreds of members (common rhyme families), others have one.
**Mitigation:** cap bucket scoring at top 200 candidates. Log oversized buckets at build time.

### 3. UI overreach
Graph canvas blocks shipping a useful product.
**Mitigation:** ship API + cluster list first. Gate canvas behind a feature flag.

### 4. PLS duplication
Multiple systems compute rhyme quality independently, causing drift.
**Mitigation:** RhymeAstrology is the canonical phonetic-neighbor engine. All consumers import from it.

### 5. Missing pronunciations
Unknown words, slang, stylized spellings fail lookup.
**Mitigation:** fallback pronunciation heuristics. Allow custom lexicon injection in v2.

---

## Final Recommendation

Implement RhymeAstrology as a **first-class core subsystem** with:

- 50k curated lexicon (not 182k)
- signature-bucket index replacing pairwise edge storage
- hot precomputed edges for top 10k words only
- SQLite only, in-process LRU, JavaScript throughout
- total disk footprint ~72MB within a 2GB allocation
- shallow, useful UI first
- explicit PLS integration points

This gives Scholomance a durable phonetic topology layer that fits the disk, the stack, and the product's actual needs.
