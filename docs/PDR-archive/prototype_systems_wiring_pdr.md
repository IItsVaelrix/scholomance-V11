# PDR: Wire Prototype Systems Into Live Analysis Pipeline

## Codex Prototype Integration Blueprint

**Status:** Draft
**Classification:** Architectural + Core Pipeline + Scoring
**Priority:** Critical
**Primary Goal:** Connect 9 disconnected prototype systems into the live CODEx analysis pipeline so every analysis pass produces metrical, semantic, syntactic, phonetic, and world-entity data — not just phoneme counts.

---

## 1. Executive Summary

Nine prototype systems currently exist as isolated exports — imported by nothing, called by nothing, registered in no pipeline. Together they implement metrical prosody, hidden Markov syntax tagging, phonetic matching, semantic-to-math translation, spellweave token-graph alignment, microprocessor factories, verseIR amplifiers, world-entity definitions, and animation presets.

This PDR defines the wiring contracts, integration phases, and data flow diagrams for connecting all nine into the existing `analyzeText()` → `analyzePanels()` → scoring pipeline without breaking any existing functionality.

---

## 2. Problem Statement

The current analysis pipeline (`analyzeText` in `codex/core/analysis.pipeline.js`) produces:
- Phoneme data (vowel families, ARPAbet phonemes, coda)
- Basic stress inference (iambic vs trochaic dominant foot)
- Word frequency, bigram repeats, scroll power

It does **not** produce:
- Full metrical analysis (meter name, feet-per-line, cadence tags, expressive deviation)
- Sequence-level syntax tagging (content vs function word HMM states)
- Phonetic similarity scores between words (sound-alike detection)
- Semantic-to-visual parameter mapping (mood → PixelBrain math constraints)
- Verse/Weave syntactic bridge scoring (spellweave alignment)
- World-entity recognition (item/npc/location/glyph extraction from text)
- VerseIR amplification (novelty, rarity, phonetic color, lexical resonance)
- Microprocessor pipeline execution (chained atomic transformations)

The PB-SANI-v1 scan flagged 447 inert exports across these systems. The prototypes are **not broken** — they are **unwired**.

---

## 3. Product Goal

After wiring, a single `analyzePanels(text)` call on the server should return a unified payload containing:

| Panel | Source System | New Data |
|-------|--------------|----------|
| `prosody` | `speaking/prosody.js` | Dominant foot, meter name, feet-per-line, beat alignment, cadence tags, closure score, expressive deviation |
| `syntaxHMM` | `hmm.js` | Per-word HMM state sequence (content/function), sequence confidence |
| `phonetic` | `phonetic_matcher.js` | Per-word phonetic codes, sound-alike clusters, phonetic density |
| `spellweave` | `spellweave.engine.js` | Semantic graph alignment, school resonance, phonetic harmony, syntax legality |
| `semanticMath` | `semantic/semantic-math-bridge.js` | Mood constraints, symbol library matches, PixelBrain parameter mapping |
| `worldEntity` | `world.entity.js` | Extracted items, NPCs, locations, glyphs with room assignments |
| `verseIR` | `verseir-amplifier/index.js` | Amplifier results (novelty, rarity, phonetic color, lexical resonance) |
| `microprocessors` | `microprocessors/factory.js` | Executed microprocessor pipeline results |

The existing panels (`scoreData`, `vowelSummary`, `rhymeAstrology`, `narrativeAMP`, `literaryDevices`, `emotion`, `scheme`, `meter`) remain unchanged.

---

## 4. Non-Goals

- **Do not modify** existing prototype implementations — they are sound, just unconnected.
- **Do not change** the `AnalyzedDocument` or `ScoreTrace` schema contracts — extend via optional fields.
- **Do not add** new UI surfaces — this is a backend-only wiring pass.
- **Do not connect** the animation presets (`src/codex/animation/presets/presetRegistry.ts`) — those are frontend-only and belong to a separate PDR.
- **Do not connect** the mailer adapters or captcha service — those are infrastructure, not analysis.

---

## 5. Core Design Principles

### 5.1 Post-Process, Don't Pre-Process

Prototype systems receive the `AnalyzedDocument` **after** `analyzeText()` completes. They do not modify the tokenization or phoneme engine. They consume, they don't intercept.

### 5.2 Optional Panels, Zero-Cost When Disabled

Every new panel is feature-flagged. If `ENABLE_PROSODY` is false, the prosody engine is never imported, never instantiated, never called. The wiring adds zero overhead when panels are off.

### 5.3 One Call Per System, Parallel Where Safe

Systems that don't depend on each other run in parallel via `Promise.all`. The dependency graph is:

```
analyzeText() ──────────────────────────────┐
  │                                          │
  ├──▶ Prosody (uses analyzedDoc.lines)     │
  ├──▶ SyntaxHMM (uses analyzedDoc.allWords)│
  ├──▶ PhoneticMatcher (uses analyzedDoc)   │──▶ Spellweave (needs phonetic)
  ├──▶ SemanticMath (uses analyzedDoc)      │
  ├──▶ WorldEntity (uses analyzedDoc)       │
  └──▶ VerseIR (needs analyzedDoc) ─────────┘
```

### 5.4 Evidence Graphs, Not Raw Scores

Each panel produces structured evidence, not just a number. Prosody returns per-line cadence tags. Spellweave returns the full graph alignment breakdown. Phonetic returns sound-alike clusters. The UI can consume as much or as little as needed.

---

## 6. Wiring Architecture

### 6.1 Integration Layer: `codex/core/integration/`

New directory containing wiring modules:

```
codex/core/integration/
  prosody.wiring.js       — ProsodyAnalyzer → PanelPayload
  syntax-hmm.wiring.js    — HiddenMarkovModel → PanelPayload
  phonetic.wiring.js      — PhoneticMatcher → PanelPayload
  spellweave.wiring.js    — SpellweaveEngine → PanelPayload
  semantic-math.wiring.js — SemanticMathBridge → PanelPayload
  world-entity.wiring.js  — WorldEntityExtractor → PanelPayload
  verseir.wiring.js       — VerseIR Amplifier → PanelPayload (already partially wired)
  index.js                — Unified analyzePanels() orchestrator
```

### 6.2 Wiring Contract

Each wiring module exports a single function:

```js
/**
 * @param {import('../schemas').AnalyzedDocument} analyzedDoc
 * @param {object} [options] — feature flags, thresholds
 * @returns {Promise<object|undefined>} Panel payload or undefined if disabled
 */
export async function wireProsodyPanel(analyzedDoc, options) {
  if (!options?.enableProsody) return undefined;
  // ... call prototype system ...
  return { /* structured panelPayload */ };
}
```

### 6.3 Panel Integration in `createPanelAnalysisService`

The existing `analyzePanels()` method in `panelAnalysis.service.js` currently runs:
1. `analyzeText(text)` → `AnalyzedDocument`
2. `buildSyntaxLayer(doc)` → `SyntaxLayer`
3. `deepRhymeEngine.analyzeDocument(text)` → `DeepAnalysis`
4. `compileVerseToIR(text)` → `VerseIR`
5. `enhanceVerseIRWithServerPolicy(ir)` → enhanced
6. `attachVerseIRAmplifier(doc, ir)` → AmplifiedDoc
7. `scoreEngine.calculateScore(doc)` → scores
8. Literary analysis (genre, scheme, meter, devices, emotion)
9. Rhyme astrology (optional, async)
10. Narrative AMP (optional, async)

**After wiring**, steps 1-10 remain unchanged. Steps 11-17 are added:

```
11. wireProsodyPanel(doc, options) → panelPayload.prosody
12. wireSyntaxHMMPanel(doc, options) → panelPayload.syntaxHMM
13. wirePhoneticPanel(doc, options) → panelPayload.phonetic
14. wireSpellweavePanel(doc, options) → panelPayload.spellweave
15. wireSemanticMathPanel(doc, options) → panelPayload.semanticMath
16. wireWorldEntityPanel(doc, options) → panelPayload.worldEntity
17. wireVerseIRPanel(doc, options) → panelPayload.verseIR (already partially done)
```

Steps 11-17 run in `Promise.all` where dependency-safe.

---

## 7. Module Breakdown

### 7.1 Prosody Wiring (`prosody.wiring.js`)

**Prototype:** `codex/core/speaking/prosody.js`
**Exports:** `analyzeProsody(analyzedDoc)`, `cadenceClosureWeight(tag)`
**Status:** Fully implemented, 238 lines, pure function, no external deps.

**Wiring:**

```js
export async function wireProsodyPanel(analyzedDoc, options = {}) {
  if (!options?.enableProsody) return undefined;
  const { analyzeProsody } = await import('../speaking/prosody.js');
  const result = analyzeProsody(analyzedDoc);
  return {
    enabled: true,
    dominantFoot: result.dominantFoot,
    meterName: result.meterName,
    feetPerLine: result.feetPerLine,
    beatAlignment: result.beatAlignment,
    controlledVariance: result.controlledVariance,
    closureScore: result.closureScore,
    cadence: result.cadence,
    lineDetails: result.lines,
  };
}
```

**Integration point:** Called in `analyzePanels()` after `analyzeText()`, before scoring. The `AnalyzedDocument` already has `lines[]` with `words[]` containing `deepPhonetics.stressPattern` — exactly what `analyzeProsody` consumes.

**Feature flag:** `ENABLE_PROSODY` (env var) → `options.enableProsody`.

**Impact:** Adds prosody panel to IDE Read view — shows meter name ("Iambic Pentameter"), cadence tags per line, closure score.

---

### 7.2 Syntax HMM Wiring (`syntax-hmm.wiring.js`)

**Prototype:** `codex/core/hmm.js`
**Exports:** `HiddenMarkovModel` (class), `englishSyntaxHMM` (pre-configured instance)
**Status:** Fully implemented, 139 lines, Viterbi algorithm with log probabilities.

**Wiring:**

```js
export async function wireSyntaxHMMPanel(analyzedDoc, options = {}) {
  if (!options?.enableSyntaxHMM) return undefined;
  const { englishSyntaxHMM } = await import('../hmm.js');

  // Build observations from document words
  const observations = analyzedDoc.allWords.map(w => w.text);
  const functionWords = new Set(
    analyzedDoc.allWords.filter(w => !w.isContentWord).map(w => w.text.toLowerCase())
  );

  const states = englishSyntaxHMM.predict(observations, functionWords);

  // Build per-word state assignments
  const wordStates = analyzedDoc.allWords.map((word, i) => ({
    word: word.text,
    state: states[i],          // 'content' or 'function'
    position: i,
  }));

  // Calculate sequence-level metrics
  const contentCount = states.filter(s => s === 'content').length;
  const functionCount = states.filter(s => s === 'function').length;
  const contentRatio = observations.length > 0 ? contentCount / observations.length : 0;

  return {
    enabled: true,
    modelType: 'englishSyntaxHMM',
    states: ['content', 'function'],
    wordStates,
    contentRatio,
    contentCount,
    functionCount,
    sequenceLength: states.length,
  };
}
```

**Integration point:** Called in `analyzePanels()` after `analyzeText()`. Uses `isContentWord` flag already computed by the pipeline.

**Feature flag:** `ENABLE_SYNTAX_HMM` → `options.enableSyntaxHMM`.

**Impact:** Adds syntax awareness — the Judiciary layer can now distinguish content from function words probabilistically, not just by stopword list.

---

### 7.3 Phonetic Wiring (`phonetic.wiring.js`)

**Prototype:** `codex/core/phonetic_matcher.js`
**Exports:** `PhoneticMatcher` (class)
**Status:** Fully implemented, 64 lines, Metaphone-inspired encoder with `encode()` and `isSoundAlike()`.

**Wiring:**

```js
export async function wirePhoneticPanel(analyzedDoc, options = {}) {
  if (!options?.enablePhonetic) return undefined;
  const { PhoneticMatcher } = await import('../phonetic_matcher.js');
  const matcher = new PhoneticMatcher();

  // Encode every word
  const wordEncodings = analyzedDoc.allWords.map(word => ({
    word: word.text,
    encoded: matcher.encode(word.text),
    lineNumber: word.lineNumber,
  }));

  // Find sound-alike clusters
  const clusters = new Map();
  for (const w of wordEncodings) {
    if (!w.encoded) continue;
    if (!clusters.has(w.encoded)) clusters.set(w.encoded, []);
    clusters.get(w.encoded).push(w.word);
  }

  // Filter to clusters with 2+ words (actual sound-alikes)
  const soundAlikeClusters = [...clusters.entries()]
    .filter(([, words]) => words.length > 1)
    .map(([code, words]) => ({ code, words }));

  return {
    enabled: true,
    wordEncodings,
    soundAlikeClusters,
    phoneticDiversity: clusters.size,
    clusterCount: soundAlikeClusters.length,
  };
}
```

**Integration point:** Called in `analyzePanels()` after `analyzeText()`.

**Feature flag:** `ENABLE_PHONETIC_MATCHER` → `options.enablePhonetic`.

**Impact:** Adds phonetic sound-alike detection to analysis — words like "light/like/lock" cluster together. Useful for alliteration detection and phonetic density scoring.

---

### 7.4 Spellweave Wiring (`spellweave.wiring.js`)

**Prototype:** `codex/core/spellweave.engine.js`
**Exports:** `parseWeave(weave)`, `calculateSyntacticBridge({ verse, weave, dominantSchool })`
**Status:** Fully implemented, 310 lines, token-graph based semantic alignment.

**Dependencies:** `token-graph/build.js`, `token-graph/activation.js`, `token-graph/traverse.js`, `token-graph/score.js`, `semantics.registry.js`, `phonetic_matcher.js`, `tokenizer.js`

**Wiring:**

```js
export async function wireSpellweavePanel(analyzedDoc, options = {}) {
  if (!options?.enableSpellweave) return undefined;

  // Extract dominant school from vowel analysis
  const vowelFamilies = analyzedDoc.allWords
    .map(w => w.phonetics?.vowelFamily)
    .filter(Boolean);
  const dominantSchool = vowelFamilies.length > 0
    ? Object.entries(
        vowelFamilies.reduce((acc, v) => { acc[v] = (acc[v]||0)+1; return acc; }, {})
      ).sort((a,b) => b[1]-a[1])[0]?.[0]
    : 'VOID';

  // Use the full verse as both verse and weave for self-alignment scoring
  // (In future, weave will be a separate input — the 60-100 char "spell formula")
  const verse = analyzedDoc.raw;
  const weave = verse; // Self-alignment for now

  const { calculateSyntacticBridge } = await import('../spellweave.engine.js');
  const result = calculateSyntacticBridge({ verse, weave, dominantSchool });

  return {
    enabled: true,
    dominantSchool,
    bridgeResult: {
      intent: result.intent,
      school: result.school,
      resonance: result.resonance,
      predicates: result.predicates,
      objects: result.objects,
      collapsed: result.collapsed,
    },
  };
}
```

**Integration point:** Called in `analyzePanels()` after `analyzeText()`. Requires `PhonemeEngine` to have already analyzed words (for vowel families).

**Dependencies to verify first:** The `token-graph/` submodules (`build.js`, `activation.js`, `traverse.js`, `score.js`) and `semantics.registry.js` must exist and be importable.

**Feature flag:** `ENABLE_SPELLWEAVE` → `options.enableSpellweave`.

**Impact:** Adds syntactic bridge scoring — measures how well the verse's semantic tokens align with its own structure. Currently self-referential; future input will accept a separate "weave" string.

---

### 7.5 Semantic-Math Bridge Wiring (`semantic-math.wiring.js`)

**Prototype:** `codex/core/semantic/semantic-math-bridge.js`
**Exports:** `MOOD_CONSTRAINTS`, `entitiesToMathConstraints(tags)`, `constraintsToPixelBrainParams(constraints)`, `getSymbolLibrary()`
**Status:** Fully implemented, 448 lines, maps 8 moods to PixelBrain math constraints.

**Wiring:**

```js
export async function wireSemanticMathPanel(analyzedDoc, options = {}) {
  if (!options?.enableSemanticMath) return undefined;
  const {
    entitiesToMathConstraints,
    constraintsToPixelBrainParams,
    getSymbolLibrary,
    MOOD_CONSTRAINTS,
  } = await import('../semantic/semantic-math-bridge.js');

  // Infer mood from emotion detection (already available in analyzePanels)
  // or fall back to mood derived from dominant school
  const inferredMood = options.inferredMood || 'mysterious';

  const moodConstraints = MOOD_CONSTRAINTS[inferredMood];
  if (!moodConstraints) {
    return { enabled: true, error: `Unknown mood: ${inferredMood}`, moodConstraints: null };
  }

  const mathConstraints = entitiesToMathConstraints({ mood: inferredMood });
  const pixelBrainParams = constraintsToPixelBrainParams(mathConstraints);

  return {
    enabled: true,
    inferredMood,
    moodConstraints,
    mathConstraints,
    pixelBrainParams,
    symbolLibrary: getSymbolLibrary(),
  };
}
```

**Integration point:** Called in `analyzePanels()` after emotion detection (step 12). The `inferredMood` can be derived from the existing `emotion` panel result.

**Feature flag:** `ENABLE_SEMANTIC_MATH` → `options.enableSemanticMath`.

**Impact:** Provides the bridge from linguistic analysis to PixelBrain visual generation. Mood → math constraints → render parameters.

---

### 7.6 World Entity Wiring (`world-entity.wiring.js`)

**Prototype:** `codex/core/world.entity.js`
**Exports:** `WORLD_ENTITY_KINDS`, `DEFAULT_WORLD_ROOMS`, `DEFAULT_WORLD_ENTITIES`, `normalizeWorldEntityKind`, `inferWorldTags`, `inferWorldSchool`, `inferMudEntityType`, `inferMudRarity`, `buildWorldEntitySummary`
**Status:** Fully implemented, 400 lines, keyword-based entity extraction with school/rarity inference.

**Wiring:**

```js
export async function wireWorldEntityPanel(analyzedDoc, options = {}) {
  if (!options?.enableWorldEntity) return undefined;
  const {
    inferWorldTags,
    inferWorldSchool,
    inferMudEntityType,
    inferMudRarity,
    buildWorldEntitySummary,
  } = await import('../world.entity.js');

  // Extract candidate words (content words only)
  const candidates = analyzedDoc.allWords
    .filter(w => w.isContentWord)
    .map(w => w.text.toLowerCase());

  // Identify entities from text
  const entities = [];
  const seen = new Set();

  for (const word of candidates) {
    const tags = inferWorldTags(word);
    const school = inferWorldSchool(word);
    const type = inferMudEntityType(word);
    const rarity = inferMudRarity(word);

    if (tags.length > 0 || school || type) {
      if (!seen.has(word)) {
        seen.add(word);
        const summary = buildWorldEntitySummary({
          lexeme: word,
          tags,
          school: school || 'VOID',
          type: type || 'item',
          rarity: rarity || 'common',
        });
        entities.push(summary);
      }
    }
  }

  return {
    enabled: true,
    entityCount: entities.length,
    entities: entities.slice(0, 50), // Cap at 50 for payload size
    byType: Object.fromEntries(
      Object.entries(entities.reduce((acc, e) => {
        acc[e.kind] = (acc[e.kind] || 0) + 1;
        return acc;
      }, {}))
    ),
    dominantSchool: Object.entries(
      entities.reduce((acc, e) => {
        acc[e.school] = (acc[e.school] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  };
}
```

**Integration point:** Called in `analyzePanels()` after `analyzeText()`. Uses `isContentWord` flag already set.

**Feature flag:** `ENABLE_WORLD_ENTITY` → `options.enableWorldEntity`.

**Impact:** Extracts game entities from verse text — "dragon" → beast entity, "tower" → location, "obsidian" → material item. Enables world-state reactivity to scroll content.

---

### 7.7 VerseIR Amplifier Wiring (Already Partially Connected)

**Prototype:** `codex/core/verseir-amplifier/index.js`
**Exports:** `DEFAULT_VERSEIR_AMPLIFIERS`, `runVerseIRAmplifiers` (partial)
**Status:** 838 lines, 7 amplifier plugins registered. Currently imported by `panelAnalysis.service.js` but only partially wired — `attachVerseIRAmplifier` is called but the full amplifier pipeline with routing, scoring, and diagnostics may not be executing end-to-end.

**Wiring:** Already partially integrated. The fix is to ensure `runVerseIRAmplifiers()` is called with proper configuration in `analyzePanels()`, and the results are serialized into the panel payload.

**Action:** Audit `panelAnalysis.service.js` lines importing `attachVerseIRAmplifier` and `enhanceVerseIRWithServerPolicy`. Verify the amplifier results appear in the response. If not, add explicit call:

```js
const verseIRResult = await runVerseIRAmplifiers(amplifiedDoc, {
  routing: { enabled: true, topK: 3, minScore: 0.05 },
  amplifierTimeouts: new Map([
    ['naturalLanguageAmp', 50],
    ['phoneticColorAmplifier', 30],
    ['pixelBrainPhase1BridgeAmplifier', 30],
  ]),
});
```

---

### 7.8 Microprocessor Factory (Register, Don't Wire Into Pipeline)

**Prototype:** `codex/core/microprocessors/factory.js`
**Exports:** `createMicroprocessorFactory()`, `verseIRMicroprocessors` (global instance)
**Status:** 84 lines, clean factory pattern with `register/execute/executePipeline`.

**Action:** The factory itself doesn't need to be "called" in the analysis pipeline. Instead, it's a **registration surface** — other systems register microprocessors into it, and the VerseIR amplifier or future WebWorker pipelines consume them.

**Wiring:** No wiring needed. The factory is ready. Document its existence in the PDR so future systems know where to register processors.

---

## 8. Implementation Phases

### Phase 1: Prosody + Phonetic (Low Risk, High Value)

**Scope:** Wire `prosody.wiring.js` and `phonetic.wiring.js`.
**Why first:** Both are pure functions with no external dependencies. Zero risk of breaking existing pipeline. High value — meter analysis and phonetic clustering are immediately useful.
**Estimated effort:** 2 files + panelAnalysis.service.js modifications.
**QA:** Existing `analyzePanels` tests pass. New panels appear in response when flags enabled.

### Phase 2: SyntaxHMM + WorldEntity (Medium Risk)

**Scope:** Wire `syntax-hmm.wiring.js` and `world-entity.wiring.js`.
**Why second:** HMM depends on `isContentWord` flag being correct. World entity depends on keyword lists matching actual text. Both are read-only — they can't break the pipeline, but their results may need tuning.
**Estimated effort:** 2 files + panelAnalysis.service.js modifications.
**QA:** HMM produces content/function labels for every word. World entity extraction returns sensible results for known test scrolls.

### Phase 3: Spellweave + SemanticMath (Higher Risk, Requires Dependency Audit)

**Scope:** Wire `spellweave.wiring.js` and `semantic-math.wiring.js`.
**Why third:** Spellweave depends on `token-graph/` submodules and `semantics.registry.js` — these need verification that they exist and are importable. Semantic math depends on mood inference from existing emotion panel.
**Estimated effort:** 2 files + dependency verification + panelAnalysis.service.js modifications.
**QA:** Spellweave returns valid bridge results for test verses. Semantic math returns valid PixelBrain params for all 8 moods.

### Phase 4: VerseIR Amplifier Audit (Ensure End-to-End)

**Scope:** Audit existing VerseIR amplifier wiring. Verify `runVerseIRAmplifiers` executes fully with routing, scoring, and diagnostics.
**Why fourth:** This is already partially wired — we're completing what exists, not adding new.
**Estimated effort:** Audit + fix in panelAnalysis.service.js.
**QA:** Amplifier results appear in `analyzePanels` response with routing scores and per-amplifier diagnostics.

### Phase 5: Feature Flags + Env Var Integration

**Scope:** Add env var parsing for all 6 feature flags (`ENABLE_PROSODY`, `ENABLE_SYNTAX_HMM`, `ENABLE_PHONETIC_MATCHER`, `ENABLE_SPELLWEAVE`, `ENABLE_SEMANTIC_MATH`, `ENABLE_WORLD_ENTITY`). Wire through `createPanelAnalysisService` options.
**Estimated effort:** Env var parsing in server index + options propagation.
**QA:** Each panel toggles on/off independently. Default off (opt-in).

---

## 9. ByteCode IR Design

Each new panel produces a standardized panel payload compatible with the existing IDE chrome:

```
PB-PANEL-v1-{PANEL_ID}-{STATUS}-{TIMESTAMP_B64}-{CHECKSUM}

PANEL_ID: PROSODY | SYNTAX_HMM | PHONETIC | SPELLWEAVE | SEMANTIC_MATH | WORLD_ENTITY
STATUS: ACTIVE | EMPTY | ERROR
```

The `attachHeuristicCommentary` system in `commentary.builder.js` should be extended to support commentary from these new panels, not just scoring heuristics.

---

## 10. QA Requirements

### 10.1 Unit Tests

Each wiring module gets a test file:

```
tests/integration/prosody.wiring.test.js
tests/integration/syntax-hmm.wiring.test.js
tests/integration/phonetic.wiring.test.js
tests/integration/spellweave.wiring.test.js
tests/integration/semantic-math.wiring.test.js
tests/integration/world-entity.wiring.test.js
```

Each test verifies:
- Panel returns `undefined` when feature flag is off
- Panel returns structured payload when feature flag is on
- Panel handles empty input gracefully
- Panel handles malformed input gracefully (no crash)

### 10.2 Integration Tests

`tests/integration/analyzePanels.new-panels.test.js`:

- Call `analyzePanels("a test verse")` with all flags enabled → all panels present
- Call `analyzePanels("a test verse")` with all flags disabled → all panels absent/null
- Call `analyzePanels("")` → no crash, all panels return empty/default
- Call `analyzePanels("a" × 10000)` → no crash, completes within timeout

### 10.3 Regression Tests

Existing `analyzePanels` tests must pass unchanged. The new panels are additive — they append fields, they don't modify existing ones.

### 10.4 Performance Budget

- Total `analyzePanels()` time increase: **< 50ms** for a 20-line verse with all panels enabled
- Per-panel budget: **< 10ms** each
- Memory increase: **< 200KB** per analysis (mostly phonetic encodings)

---

## 11. Success Criteria

| Criterion | Metric | Target |
|-----------|--------|--------|
| All 6 new panels return data in `analyzePanels` response | Panel count | 6/6 |
| Existing panels unchanged | Test pass rate | 100% |
| New panel tests pass | Test count | 30+ |
| Performance budget met | analyzePanels time for 20-line verse | < 50ms overhead |
| Feature flags work | Each panel independently toggleable | 6/6 |
| PB-SANI rescan shows these systems as ACTIVE | Inert candidates | 0 from these files |

---

## 12. Post-Wiring PB-SANI Revalidation

After all wiring is complete, re-run `npm run sani:scan`. All 9 prototype systems should transition from ARCHIVE/REVIEW to KEEP (actively used by wiring modules). Any that remain ARCHIVE after wiring indicate incomplete integration and need a follow-up ticket.

---

## 13. Files Modified

| File | Change |
|------|--------|
| `codex/core/integration/prosody.wiring.js` | **New** — Prosody panel wiring |
| `codex/core/integration/syntax-hmm.wiring.js` | **New** — SyntaxHMM panel wiring |
| `codex/core/integration/phonetic.wiring.js` | **New** — Phonetic panel wiring |
| `codex/core/integration/spellweave.wiring.js` | **New** — Spellweave panel wiring |
| `codex/core/integration/semantic-math.wiring.js` | **New** — SemanticMath panel wiring |
| `codex/core/integration/world-entity.wiring.js` | **New** — WorldEntity panel wiring |
| `codex/core/integration/index.js` | **New** — Unified orchestrator |
| `codex/server/services/panelAnalysis.service.js` | **Modify** — Add panel calls to `analyzePanels()` |
| `codex/server/index.js` | **Modify** — Add env var parsing for feature flags |
| `tests/integration/*.wiring.test.js` | **New** — 6 test files |
| `.env.example` | **Modify** — Add 6 new feature flags |

---

*PDR Status: DRAFT | Author: Qwen Code | Date: 2026-04-03*
*Awaiting: Angel approval*
