# PLS + Dictionary Integration Spec

## Problem

The Poetic Language Server (PLS) and the Scholomance Dictionary are two independent systems that should be connected. Currently:

- **PLS** builds its `RhymeIndex` from a small corpus (`corpus.json`, typically a few hundred unique words). Its rhyme, prefix, meter, and color providers can only suggest words already in the document. The `Spellchecker` only validates against that same tiny corpus.
- **Dictionary** has 123k words with pre-computed ARPAbet phonemes, rhyme families, codas, rhyme keys, plus 31k WordNet definitions, 185k lemma-to-synset mappings, and 234k semantic relations (synonyms, hypernyms, antonyms). It sits behind a Python HTTP API (`serve_scholomance_dict.py`) that PLS never touches.

Connecting them gives PLS access to a full English lexicon for rhyme lookups, spelling validation, synonym suggestions, and definition-aware ranking — transforming it from a document-scoped autocomplete into a language-aware poetic assistant.

---

## Architecture Overview

```
                         ┌─────────────────────────┐
                         │    usePredictor Hook     │
                         │  (src/hooks/usePredictor)│
                         └────────┬────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   PoeticLanguageServer      │
                    │  (src/lib/poeticLanguageServer.js)
                    │                             │
                    │  engines: {                  │
                    │    phonemeEngine,            │
                    │    trie,                     │
                    │    spellchecker,             │
                    │    rhymeIndex,               │
                    │    dictionaryAPI  ← NEW      │
                    │  }                           │
                    │                             │
                    │  providers: [                │
                    │    rhymeProvider     (gen)   │  ← enhanced with DB rhymes
                    │    prefixProvider    (gen)   │
                    │    synonymProvider   (gen)   │  ← NEW provider
                    │    meterProvider     (score) │
                    │    colorProvider     (score) │
                    │    validityProvider  (score) │  ← NEW provider
                    │  ]                          │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │  ScholomanceDictionaryAPI               │
              │  (src/lib/scholomanceDictionary.api.js) │
              └───────────────────┬────────────────────┘
                                  │ HTTP
              ┌───────────────────▼────────────────────┐
              │  serve_scholomance_dict.py              │
              │  scholomance_dict.sqlite                │
              │  ┌──────────┬──────────┬─────────────┐ │
              │  │  entry   │ wordnet_ │ rhyme_index  │ │
              │  │ (123k)   │ synset/  │ (families,   │ │
              │  │          │ lemma/   │  codas,      │ │
              │  │          │ rel      │  keys)       │ │
              │  └──────────┴──────────┴─────────────┘ │
              └────────────────────────────────────────┘
```

---

## Changes Required

### 1. PLS Constructor — Accept Dictionary API

**File:** `src/lib/poeticLanguageServer.js`

Add `dictionaryAPI` as an optional engine dependency. When present, it unlocks the new providers and enhanced rhyme lookups.

```js
constructor({ phonemeEngine, trie, spellchecker = null, dictionaryAPI = null }) {
  this.phonemeEngine = phonemeEngine;
  this.trie = trie;
  this.spellchecker = spellchecker;
  this.dictionaryAPI = dictionaryAPI;
  this.rhymeIndex = new RhymeIndex();
  this.weights = { ...DEFAULT_WEIGHTS };
  this.ready = false;
}
```

Pass `dictionaryAPI` through the `engines` object in `getCompletions()`:

```js
const engines = {
  phonemeEngine: this.phonemeEngine,
  trie: this.trie,
  spellchecker: this.spellchecker,
  rhymeIndex: this.rhymeIndex,
  dictionaryAPI: this.dictionaryAPI,
};
```

### 2. usePredictor Hook — Wire the API

**File:** `src/hooks/usePredictor.js`

Import the dictionary API and pass it to PLS during initialization:

```js
import { ScholomanceDictionaryAPI } from '../lib/scholomanceDictionary.api.js';

// Inside loadCorpus(), after PhonemeEngine init:
const pls = new PoeticLanguageServer({
  phonemeEngine: PhonemeEngine,
  trie: model,
  spellchecker,
  dictionaryAPI: ScholomanceDictionaryAPI.isEnabled() ? ScholomanceDictionaryAPI : null,
});
```

No other changes to the hook — the PLS API surface (`getCompletions()`) stays the same.

### 3. Enhanced rhymeProvider — DB-Backed Rhyme Lookup

**File:** `src/lib/pls/providers/rhymeProvider.js`

When `engines.dictionaryAPI` is available, supplement the local `rhymeIndex` results with dictionary rhymes. The dictionary's `rhyme_index` table has 123k words with pre-computed ARPAbet families and codas — far richer than the document-scoped index.

```js
export async function rhymeProvider(context, engines) {
  const { prevLineEndWord } = context;
  if (!prevLineEndWord) return [];

  const { phonemeEngine, rhymeIndex, dictionaryAPI } = engines;
  const targetAnalysis = phonemeEngine.analyzeWord(prevLineEndWord);
  if (!targetAnalysis) return [];

  // ... existing local rhyme logic (unchanged) ...

  // Supplement with dictionary rhymes if available
  if (dictionaryAPI) {
    try {
      const apiResult = await dictionaryAPI.lookup(prevLineEndWord);
      const dbRhymes = apiResult?.rhymes || [];
      for (const word of dbRhymes.slice(0, 30)) {
        const upper = word.toUpperCase();
        if (seen.has(upper) || upper === targetUpper) continue;

        // Score DB rhymes: exact family match = 0.85, else 0.5
        const candidateAnalysis = phonemeEngine.analyzeWord(word);
        let score = 0.6; // base DB rhyme score
        if (candidateAnalysis) {
          if (candidateAnalysis.rhymeKey === targetRhymeKey) score = 0.95;
          else if (candidateAnalysis.vowelFamily === targetVowelFamily) score = 0.75;
        }

        seen.add(upper);
        results.push({
          token: word.toLowerCase(),
          score,
          badge: score >= 0.7 ? 'RHYME' : null,
        });
      }
    } catch (e) {
      // Dictionary unavailable — local results still work
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
```

**Important:** This makes `rhymeProvider` async. The PLS `getCompletions()` method must be updated to `await` generators. See section 7 below.

### 4. New: synonymProvider (Generator)

**File:** `src/lib/pls/providers/synonymProvider.js` (new file)

A generator provider that suggests semantically related words. Triggered when the user has a previous word (for contextual synonyms) or when the current prefix could match a synonym.

```js
/**
 * SynonymProvider — Generator provider.
 * Suggests semantically related words from the WordNet database
 * via the Scholomance Dictionary API.
 */
export async function synonymProvider(context, engines) {
  const { prevWord, prefix } = context;
  const { dictionaryAPI } = engines;
  if (!dictionaryAPI) return [];

  const targetWord = prevWord || prefix;
  if (!targetWord || targetWord.length < 2) return [];

  try {
    const result = await dictionaryAPI.lookup(targetWord);
    const synonyms = result?.synonyms || [];
    if (synonyms.length === 0) return [];

    const prefixUpper = (prefix || '').toUpperCase();

    return synonyms
      .filter(s => !prefixUpper || s.toUpperCase().startsWith(prefixUpper))
      .slice(0, 15)
      .map((word, i) => ({
        token: word.toLowerCase(),
        score: Math.max(0.3, 0.8 - (i * 0.03)),
        badge: i < 3 ? 'SYNONYM' : null,
      }));
  } catch (e) {
    return [];
  }
}
```

### 5. New: validityProvider (Scorer)

**File:** `src/lib/pls/providers/validityProvider.js` (new file)

A scorer that validates candidates against the dictionary's 123k-word lexicon. Words that exist in the dictionary get a boost; unknown words get penalized. This improves suggestion quality by filtering out junk tokens that the trie might generate from noisy corpus data.

```js
/**
 * ValidityProvider — Scorer provider.
 * Boosts candidates that exist in the dictionary lexicon.
 * Penalizes candidates that are not real English words.
 */
export async function validityProvider(context, engines, candidates) {
  const { dictionaryAPI } = engines;
  if (!dictionaryAPI || candidates.length === 0) return candidates;

  // Batch-check all candidates against the dictionary
  const words = candidates.map(c => c.token);
  try {
    const result = await dictionaryAPI.lookupBatch(words);
    const knownWords = new Set(
      Object.keys(result).map(w => w.toLowerCase())
    );

    return candidates.map(c => {
      const isKnown = knownWords.has(c.token.toLowerCase());
      return {
        ...c,
        scores: {
          ...c.scores,
          validity: isKnown ? 1.0 : 0.2,
        },
      };
    });
  } catch (e) {
    // API down — don't penalize anything
    return candidates;
  }
}
```

**Note:** The `lookupBatch` endpoint currently only returns rhyme families, not a simple existence check. A lightweight `/api/lexicon/validate-batch` endpoint should be added to `serve_scholomance_dict.py` that accepts `{ "words": [...] }` and returns `{ "valid": ["word1", "word2", ...] }`. This avoids paying the full rhyme-family query cost when all you need is word validation.

### 6. Ranker — Add New Weight Channels

**File:** `src/lib/pls/ranker.js`

Add the new providers to the weight map and badge thresholds:

```js
const DEFAULT_WEIGHTS = {
  rhyme:    0.30,
  meter:    0.20,
  color:    0.15,
  prefix:   0.15,
  synonym:  0.10,  // NEW
  validity: 0.10,  // NEW
};

const BADGE_THRESHOLDS = {
  rhyme: 0.7,
  meter: 0.8,
  color: 1.0,
  synonym: 0.5,  // NEW
};
```

### 7. PLS getCompletions — Async Pipeline

**File:** `src/lib/poeticLanguageServer.js`

Since dictionary-backed providers are async (HTTP calls), `getCompletions()` must become async. The generators and scorers run in parallel where possible.

```js
async getCompletions(context, options = {}) {
  if (!this.ready) return [];

  const { limit = 10, weights } = options;
  const effectiveWeights = weights ? { ...this.weights, ...weights } : this.weights;

  const engines = {
    phonemeEngine: this.phonemeEngine,
    trie: this.trie,
    spellchecker: this.spellchecker,
    rhymeIndex: this.rhymeIndex,
    dictionaryAPI: this.dictionaryAPI,
  };

  // Phase 1: Generators produce candidate pools (run in parallel)
  const [rhymeResults, prefixResults, synonymResults] = await Promise.all([
    rhymeProvider(context, engines),
    Promise.resolve(prefixProvider(context, engines)),  // sync, wrapped
    this.dictionaryAPI
      ? synonymProvider(context, engines)
      : Promise.resolve([]),
  ]);

  const generatorResults = {
    rhyme: rhymeResults,
    prefix: prefixResults,
    synonym: synonymResults,
  };

  // Phase 2: Collect unique candidates
  const allCandidates = [];
  const seen = new Set();
  for (const results of Object.values(generatorResults)) {
    for (const r of results) {
      if (!seen.has(r.token)) {
        seen.add(r.token);
        allCandidates.push({ token: r.token, score: 0, scores: {}, badge: null });
      }
    }
  }

  // Phase 3: Scorers rank the combined pool (run in parallel)
  const [meterResults, colorResults, validityResults] = await Promise.all([
    Promise.resolve(meterProvider(context, engines, allCandidates)),
    Promise.resolve(colorProvider(context, engines, allCandidates)),
    this.dictionaryAPI
      ? validityProvider(context, engines, allCandidates)
      : Promise.resolve(allCandidates),
  ]);

  const scorerResults = {
    meter: meterResults,
    color: colorResults,
    validity: validityResults,
  };

  // Phase 4: Rank and return
  return rankCandidates(generatorResults, scorerResults, effectiveWeights, context, limit);
}
```

### 8. usePredictor Hook — Await Async Completions

**File:** `src/hooks/usePredictor.js`

The `getCompletions` callback must handle the now-async return:

```js
const getCompletions = useCallback(async (context, options) => {
  if (!isReady || !plsRef.current) return [];
  return plsRef.current.getCompletions(context, options);
}, [isReady]);
```

All callers of `getCompletions` must `await` it. Check the component(s) that consume `usePredictor` — likely `IntelliSense.jsx` and/or `ScrollEditor.jsx`.

### 9. Serve Endpoint — Add Batch Validation

**File:** `scripts/serve_scholomance_dict.py`

Add a lightweight batch validation endpoint for the `validityProvider`:

```python
# In do_POST():
if parsed.path == "/api/lexicon/validate-batch":
    content_length = int(self.headers.get('Content-Length', 0))
    body = self.rfile.read(content_length).decode('utf-8')
    try:
        data = json.loads(body)
        words = data.get("words", [])
        if not isinstance(words, list):
            self.send_json(400, {"error": "words must be a list"})
            return
        placeholders = ', '.join('?' for _ in words)
        with self.lock:
            rows = self.conn.execute(
                f"SELECT DISTINCT headword_lower FROM entry WHERE headword_lower IN ({placeholders})",
                [w.lower() for w in words]
            ).fetchall()
        valid = [row["headword_lower"] for row in rows]
        self.send_json(200, {"valid": valid})
    except json.JSONDecodeError:
        self.send_json(400, {"error": "Invalid JSON"})
    return
```

### 10. ScholomanceDictionaryAPI — Add Validate Method

**File:** `src/lib/scholomanceDictionary.api.js`

```js
async validateBatch(words) {
  if (!BASE_URL || !words?.length) return [];
  const url = buildUrl(`${BASE_URL}/validate-batch`);
  const payload = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });
  return payload?.valid || [];
},
```

---

## Graceful Degradation

Every integration point must be guarded. When the dictionary API is unavailable:

- `rhymeProvider` falls back to the local `RhymeIndex` (current behavior, unchanged)
- `synonymProvider` returns `[]`
- `validityProvider` returns candidates unmodified (no penalty)
- `prefixProvider` and `meterProvider` are unaffected (no API dependency)
- `colorProvider` is unaffected (no API dependency)

The PLS works exactly as it does today when `dictionaryAPI` is `null`. No features are lost, only gained.

---

## Files Summary

| File | Change | Type |
|------|--------|------|
| `src/lib/poeticLanguageServer.js` | Accept `dictionaryAPI`, async `getCompletions()`, wire new providers | Modify |
| `src/lib/pls/ranker.js` | Add `synonym` + `validity` weight channels and badges | Modify |
| `src/lib/pls/providers/rhymeProvider.js` | Make async, supplement with DB rhymes | Modify |
| `src/lib/pls/providers/synonymProvider.js` | New generator provider | Create |
| `src/lib/pls/providers/validityProvider.js` | New scorer provider | Create |
| `src/hooks/usePredictor.js` | Import dictionary API, pass to PLS, async `getCompletions` | Modify |
| `src/lib/scholomanceDictionary.api.js` | Add `validateBatch()` method | Modify |
| `scripts/serve_scholomance_dict.py` | Add `/api/lexicon/validate-batch` endpoint | Modify |

---

## Testing

1. **Unit tests for new providers:**
   - `synonymProvider` returns results when API available, `[]` when not
   - `validityProvider` scores known words at 1.0 and unknown at 0.2
   - Both handle API errors gracefully

2. **Existing PLS tests must still pass** with `dictionaryAPI: null` — the integration is purely additive.

3. **Integration test:**
   - Start dictionary server
   - Call `pls.getCompletions()` with a context that has `prevLineEndWord: "time"`
   - Verify results include dictionary rhymes (rhyme, sublime, dime) that wouldn't exist in a small corpus
   - Verify SYNONYM badges appear for semantically related words
   - Verify candidates are boosted/penalized by validity scores

4. **Performance:**
   - Dictionary API calls are parallelized via `Promise.all` — no sequential waterfall
   - Batch endpoints minimize HTTP round-trips
   - If latency is a concern, add a client-side LRU cache to `ScholomanceDictionaryAPI` for repeated lookups
