# ARCH: PLS Enhancements — Phonetic Index, HMM Syntax, Dictionary Fix, SKITTLES

**Owner**: Gemini/CODEx (with noted exceptions for Claude)
**Status**: Specification — awaiting implementation
**Branch**: `claude/pls-architecture-doc-KzOds`
**Date**: 2026-03-04

---

## Overview

The Poetic Language Server (PLS) and surrounding CODEx analysis pipeline have four documented deficiencies that limit the depth and accuracy of phonetic and linguistic analysis. This document specifies precise, non-breaking fixes for each one.

**All changes listed below are Gemini/CODEx's domain** (files under `codex/`, `src/lib/`, `src/hooks/`, `src/data/`, `scripts/`) **unless explicitly marked `[CLAUDE]`**.

---

## Change 1 — CMUDICT as Phonetic Index (Authoritative Source)

### Problem

`CmuPhonemeEngine` at `src/lib/cmu.phoneme.engine.js` is the de-facto phoneme authority for the entire system, but it is never explicitly initialized at server startup. The existing `ensureAuthorityBatch()` method on the general `PhonemeEngine` was designed to pre-warm a vowel-family override cache from the Scholomance dictionary via HTTP, but since `SCHOLOMANCE_DICT_API_URL` is never configured, it silently no-ops on every server boot. There is no readiness check, no warm-up telemetry, and no guarantee that the CMU dictionary is loaded before the first analysis request arrives.

Additionally, `CmuPhonemeEngine` has no public method to expose its full entry table, which means callers that need batch phoneme resolution (e.g., the analysis pipeline's rhyme-indexer) fall back to per-word `analyzeWord()` calls instead of a single bulk lookup.

### Required Changes

#### `src/lib/cmu.phoneme.engine.js`

Add one public method after `isAvailable()`:

```javascript
/**
 * Returns a read-only snapshot of the full CMU phoneme table.
 * Keys are uppercase word strings; values are arrays of ARPAbet phone arrays (pronunciations).
 * Returns an empty Map if the engine is not yet initialised.
 * @returns {ReadonlyMap<string, string[][]>}
 */
getAllEntries() {
  return this._dict ?? new Map();
}
```

No other changes to this file.

#### `src/lib/phoneme.engine.js`

Remove `ensureAuthorityBatch()` entirely. It is unreachable, silently fails, and its intent is superseded by Change 3 (direct SQLite adapter). Update any callers to `CmuPhonemeEngine.getAllEntries()` instead.

#### `codex/server/index.js` — Startup Sequence

Add a dedicated phonetic-index warm-up step as the **first item** in the server startup sequence, before any route registration:

```javascript
import { CmuPhonemeEngine } from '../src/lib/cmu.phoneme.engine.js';

// Phonetic Index: warm up CMU dictionary (blocking — must complete before routes open)
await CmuPhonemeEngine.init();
if (!CmuPhonemeEngine.isAvailable()) {
  log.warn('[Startup] CMU phoneme engine unavailable — analysis accuracy degraded');
} else {
  log.info(`[Startup] Phonetic Index ready (${CmuPhonemeEngine.getAllEntries().size} entries)`);
}
```

This makes CMU the explicit, documented **Phonetic Index** for the server. All downstream services (`panelAnalysis.service.js`, `wordLookup.service.js`, scoring heuristics) already call through `CmuPhonemeEngine` indirectly — this change simply guarantees it is warm before the first request.

#### `codex/server/routes/` — Health Check

Add `/health/phonetics` to the health route (or extend the existing `/health`):

```json
{
  "phoneticIndex": {
    "ready": true,
    "entryCount": 133854,
    "source": "cmudict-0.7a"
  }
}
```

---

## Change 2 — HMM-Enhanced Syntax Layer

### Problem

`src/lib/syntax.layer.js` classifies each word's grammatical role using a deterministic, rule-based multi-pass system: a hardcoded `FUNCTION_WORDS` set (~115 entries), morphological suffix heuristics, and line-position overrides. This approach fails on:

- **Homographs**: "burns" classified as function-adjacent when it is a high-stress content noun; "well" treated as an adverb when functioning as a pivot word in a verse line.
- **Contextual stress**: Prepositions that carry stress in poetic inversions (e.g., "OF the many, BY the few") are penalised as function words even when they anchor a stressed syllable.
- **Low-confidence defaulting**: Every word gets a deterministic label with `reasons: []` for ambiguous cases, giving the Judiciary no signal about how uncertain the classification is.

### Architecture Decision: ONE Brain

The HMM runs as **Pass 1b** *inside* the Syntax Layer's existing multi-pass pipeline. It does not register as a separate Judiciary voter. The Judiciary's existing weights (`PHONEME 0.40 / SPELLCHECK 0.25 / PREDICTOR 0.20 / SYNTAX 0.15`) are unchanged. The Syntax Layer already produces the `syntaxContext` object that the Judiciary consumes — the HMM enriches that object with `hmmPosTag` and `hmmConfidence` fields, which the Judiciary's existing `getSyntaxModifier()` can optionally read.

Rationale: A second independent voter would require re-tuning all four Judiciary weights, risk conflicting POS signals between rule-based and probabilistic paths, and add a new failure mode. A single-brain approach keeps the Judiciary contract stable.

### New Files: `codex/core/hmm/`

This directory is new. The HMM module lives here because it is **pure Core logic** — no DOM, no I/O, no side effects, deterministic given the same input.

#### `codex/core/hmm/matrices.default.js`

Pre-built simplified Penn Treebank (PTB-9) transition and emission matrices, hardcoded as frozen objects. No training infrastructure is needed — the matrices are derived offline from PTB and embedded at build time.

**Tag set** (9 tags, PTB-simplified):

| Tag | Description | Example words |
|-----|-------------|---------------|
| `NN` | Noun | fire, soul, blood, name |
| `VB` | Verb | burns, rise, know, seek |
| `JJ` | Adjective | deep, golden, silent, pale |
| `RB` | Adverb | slowly, never, only, still |
| `DT` | Determiner | the, a, an, this, that |
| `IN` | Preposition/Conjunction | of, in, by, for, with, but |
| `PR` | Pronoun | I, me, you, we, they, it |
| `MD` | Modal/Aux | can, will, shall, must, may |
| `XX` | Unknown/Other | (anything not matched above) |

**Data shape** (abbreviated):

```javascript
export const TRANSITION_MATRIX = Object.freeze({
  // P(tag_t | tag_{t-1})
  START: { NN: 0.18, VB: 0.08, JJ: 0.12, RB: 0.07, DT: 0.22, IN: 0.13, PR: 0.14, MD: 0.04, XX: 0.02 },
  NN:    { NN: 0.14, VB: 0.26, JJ: 0.06, RB: 0.04, DT: 0.03, IN: 0.22, PR: 0.02, MD: 0.05, XX: 0.18 },
  VB:    { NN: 0.28, VB: 0.07, JJ: 0.10, RB: 0.14, DT: 0.12, IN: 0.09, PR: 0.12, MD: 0.03, XX: 0.05 },
  // ... (full matrix in implementation)
});

export const EMISSION_MATRIX = Object.freeze({
  // Top-N words per tag, P(word | tag)
  // Implementation: for unknown words, use uniform XX distribution + suffix heuristics
  NN: { fire: 0.003, blood: 0.002, soul: 0.004, name: 0.003, ... },
  // ...
});
```

#### `codex/core/hmm/hmm.tagger.js`

Viterbi decoder. Pure function — no state.

```javascript
/**
 * @param {string[]} tokens  — lowercased word sequence for a single line
 * @param {object}   options
 * @param {boolean}  [options.returnProbabilities=false]
 * @returns {Array<{ word: string, tag: string, confidence: number }>}
 */
export function viterbiTag(tokens, options = {}) { ... }

/**
 * Maps a PTB-9 tag to a Scholomance syntactic role.
 * @param {string} tag
 * @returns {{ role: 'content'|'function', stressRole: 'primary'|'secondary'|'unstressed' }}
 */
export function tagToRole(tag) { ... }
```

**Suffix fallback** (for OOV words not in the emission matrix):

| Suffix | → Tag |
|--------|-------|
| `-ing`, `-ed`, `-ize`, `-ise` | VB |
| `-ness`, `-tion`, `-ment`, `-ity`, `-hood` | NN |
| `-ful`, `-less`, `-ous`, `-ic`, `-al`, `-ive` | JJ |
| `-ly` (on JJ stem) | RB |
| everything else | XX |

#### `codex/core/hmm/index.js`

```javascript
export { viterbiTag, tagToRole } from './hmm.tagger.js';
export { TRANSITION_MATRIX, EMISSION_MATRIX } from './matrices.default.js';
```

### Modified File: `src/lib/syntax.layer.js`

Add **Pass 1b** between the existing Pass 1 (function word check) and Pass 2 (contextual override). Pass 1b is **server-only** — it lazy-imports the HMM module so the browser bundle is never affected.

```javascript
// Pass 1b: HMM POS tagging (server-only, lazy-loaded)
if (typeof window === 'undefined') {
  try {
    const { viterbiTag, tagToRole } = await import('../../codex/core/hmm/index.js');
    const lineTokens = tokens.map(t => t.word.toLowerCase());
    const tagged = viterbiTag(lineTokens);
    tagged.forEach(({ word, tag, confidence }, idx) => {
      const token = tokens[idx];
      if (!token) return;
      const { role, stressRole } = tagToRole(tag);
      // Only override if HMM is more confident than the rule-based result
      if (confidence > 0.70) {
        token.hmmPosTag = tag;
        token.hmmConfidence = confidence;
        // Promote role if rule-based defaulted to 'content' + HMM disagrees strongly
        if (token.role !== role && confidence > 0.85) {
          token.role = role;
          token.stressRole = stressRole;
          token.reasons.push(`hmm:${tag}@${confidence.toFixed(2)}`);
        }
      }
    });
  } catch {
    // HMM unavailable — rule-based pass-through unchanged
  }
}
```

The `SyntaxToken` schema gains two **optional** fields (no breaking change):

```typescript
hmmPosTag?: string;        // e.g. "VB", "NN", "JJ"
hmmConfidence?: number;    // 0.0 – 1.0
```

### Modified File: `codex/core/judiciary.js` — `getSyntaxModifier()`

Read `hmmConfidence` when present to modulate the syntax modifier weight:

```javascript
getSyntaxModifier(candidate, syntaxContext) {
  // ... existing logic unchanged ...

  // HMM confidence boost: if context carries high-confidence HMM label, tighten modifiers
  if (syntaxContext?.hmmConfidence && syntaxContext.hmmConfidence > 0.80) {
    // Scale modifier toward 1.0 (neutral) when HMM overrides a borderline rule
    if (modifier > 0.8 && modifier < 1.2) {
      modifier = 1.0 + (modifier - 1.0) * (1 - syntaxContext.hmmConfidence * 0.3);
    }
  }
  return modifier;
}
```

---

## Change 3 — Scholomance Dictionary Direct Access

### Problem

`codex/server/services/wordLookup.service.js` calls `lookupFromScholomanceDict()`, which makes an HTTP request to the Python sidecar (`serve_scholomance_dict.py`) using the URL from `SCHOLOMANCE_DICT_API_URL`. This env var is **never configured** in any deployed or local environment — it is present in `.env.example` but `.env` does not exist. The result: every word lookup falls through directly to the Free Dictionary API and Datamuse, and the 123k-word Scholomance SQLite dictionary with its pre-computed ARPAbet phonemes, WordNet synsets, and rhyme families is **never consulted**.

The Python sidecar is unnecessary for server-side lookups. The server runs Node.js and has filesystem access to `scholomance_dict.sqlite`. `better-sqlite3` is already a project dependency.

### New File: `codex/services/adapters/sqliteDict.adapter.js`

```javascript
/**
 * Direct SQLite adapter for scholomance_dict.sqlite.
 * Server-side only. Provides synchronous lookups via better-sqlite3.
 * Zero HTTP round-trips. Python sidecar not required.
 */

import Database from 'better-sqlite3';
import { createEmptyLexicalEntry } from '../../core/schemas.js';

export function createSqliteDictAdapter(options = {}) {
  const dbPath = options.dbPath ?? process.env.SCHOLOMANCE_DICT_PATH ?? './scholomance_dict.sqlite';
  let db = null;

  function open() {
    if (db) return;
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.pragma('journal_mode = WAL');
  }

  function isAvailable() {
    try { open(); return true; } catch { return false; }
  }

  function close() {
    if (db) { db.close(); db = null; }
  }

  /**
   * @param {string} word
   * @returns {import('../../core/schemas.js').LexicalEntry | null}
   */
  function lookup(word) {
    if (!word) return null;
    try {
      open();
      const normalized = word.trim().toLowerCase();

      // 1. Core word data
      const wordRow = db.prepare(`
        SELECT w.id, w.word, w.pos, w.frequency
        FROM words w WHERE w.word = ? LIMIT 1
      `).get(normalized);
      if (!wordRow) return null;

      const entry = createEmptyLexicalEntry(normalized);
      entry.pos = wordRow.pos ? [wordRow.pos] : [];

      // 2. Definitions (from synset glosses)
      const glossRows = db.prepare(`
        SELECT DISTINCT s.gloss
        FROM synsets s
        JOIN word_synsets ws ON ws.synset_id = s.id
        WHERE ws.word_id = ?
        ORDER BY ws.sense_number ASC
        LIMIT 5
      `).all(wordRow.id);
      entry.definitions = glossRows.map(r => r.gloss).filter(Boolean);
      if (entry.definitions.length > 0) {
        entry.definition = {
          text: entry.definitions[0],
          partOfSpeech: entry.pos[0] || '',
          source: 'Scholomance Dictionary',
        };
      }

      // 3. Phonetics
      const phoneticRow = db.prepare(`
        SELECT arpabet, syllable_count, stress_pattern, rhyme_key, vowel_family
        FROM phonetics WHERE word_id = ? LIMIT 1
      `).get(wordRow.id);
      if (phoneticRow) {
        entry.arpabet     = phoneticRow.arpabet;
        entry.syllables   = phoneticRow.syllable_count;
        entry.stressPattern = phoneticRow.stress_pattern;
        entry.rhymeKey    = phoneticRow.rhyme_key;
        entry.vowelFamily = phoneticRow.vowel_family;
      }

      // 4. Synonyms / antonyms (via semantic relations)
      const synRows = db.prepare(`
        SELECT DISTINCT w2.word
        FROM semantic_relations sr
        JOIN word_synsets ws1 ON ws1.synset_id = sr.synset_id
        JOIN word_synsets ws2 ON ws2.synset_id = sr.related_synset_id
        JOIN words w2 ON w2.id = ws2.word_id
        WHERE ws1.word_id = ? AND sr.relation_type = 'synonym'
        LIMIT 10
      `).all(wordRow.id);
      entry.synonyms = synRows.map(r => r.word).filter(w => w !== normalized);

      const antRows = db.prepare(`
        SELECT DISTINCT w2.word
        FROM semantic_relations sr
        JOIN word_synsets ws1 ON ws1.synset_id = sr.synset_id
        JOIN word_synsets ws2 ON ws2.synset_id = sr.related_synset_id
        JOIN words w2 ON w2.id = ws2.word_id
        WHERE ws1.word_id = ? AND sr.relation_type = 'antonym'
        LIMIT 10
      `).all(wordRow.id);
      entry.antonyms = antRows.map(r => r.word).filter(w => w !== normalized);

      // 5. Rhymes (from pre-computed rhyme index)
      const rhymeRows = db.prepare(`
        SELECT DISTINCT w2.word
        FROM rhyme_index r1
        JOIN rhyme_index r2 ON r2.rhyme_key = r1.rhyme_key AND r2.word_id != r1.word_id
        JOIN words w2 ON w2.id = r2.word_id
        WHERE r1.word_id = ?
        ORDER BY w2.frequency DESC
        LIMIT 20
      `).all(wordRow.id);
      entry.rhymes = rhymeRows.map(r => r.word);

      return entry;
    } catch (err) {
      return null;
    }
  }

  return { lookup, isAvailable, close };
}
```

> **Note on schema**: The SQL above assumes table names from `scripts/build_scholomance_dict.py`. If the actual schema uses different table/column names, map accordingly — the interface contract (`lookup(word) → LexicalEntry | null`) must remain unchanged.

### Modified File: `codex/server/index.js`

Instantiate the adapter at startup and pass it to the word lookup service:

```javascript
import { createSqliteDictAdapter } from '../codex/services/adapters/sqliteDict.adapter.js';

const sqliteDictAdapter = createSqliteDictAdapter({
  dbPath: process.env.SCHOLOMANCE_DICT_PATH ?? './scholomance_dict.sqlite',
});

if (sqliteDictAdapter.isAvailable()) {
  log.info('[Startup] Scholomance SQLite dictionary available');
} else {
  log.warn('[Startup] Scholomance SQLite dictionary not found — will use external APIs only');
}

// Pass to word lookup service factory:
const wordLookupService = createWordLookupService({
  redis,
  log,
  sqliteDictAdapter,  // NEW
  // scholomanceDictApiUrl removed — replaced by adapter
});
```

### Modified File: `codex/server/services/wordLookup.service.js`

Replace `lookupFromScholomanceDict()` (HTTP) with a direct adapter call:

```javascript
// REMOVE: scholomanceDictApiUrl resolution and HTTP fetch function

// ADD to createWordLookupService(options):
const sqliteDictAdapter = options.sqliteDictAdapter ?? null;

// In lookupWord():
const localResult = sqliteDictAdapter?.lookup(normalizedWord) ?? null;
if (localResult) {
  return { data: constrainLexicalEntry(localResult), source: 'scholomance-sqlite' };
}
// ... fallback to external APIs unchanged
```

### Client-Side (no change required)

The client-side `src/lib/scholomanceDictionary.api.js` continues to call the Python HTTP server when `VITE_SCHOLOMANCE_DICT_API_URL` is set. Document in `.env.example` (already present) that this is optional and only needed for client-side lookups in development.

---

## Change 4 — SKITTLES Color Over-Representation

### Root Causes (three, not one)

After tracing the full color pipeline:

**Root cause A — `analysisMode` not gated by `isTruesight`** (`src/pages/Read/ReadPage.jsx`)
The `analysisMode` state variable defaults to `ANALYSIS_MODES.VOWEL` and is passed directly to `ScrollEditor` via the `analysisMode` prop. The `ScrollEditor` passes it to `useColorCodex`. `useColorCodex.shouldColorWord()` at line 148 colors ALL content words when `analysisMode === 'vowel'`, regardless of whether the truesight overlay is visible. The color computation runs and the hook produces colored word data even when the overlay is hidden. When the vowel family panel button is pressed (separate from the truesight toggle), it sets or confirms `VOWEL` mode while truesight is off, but `ScrollEditor` is already processing `shouldColorWord` with that mode.

**Root cause B — `SCHWA_FAMILIES` uses alias IDs** (`src/lib/colorCodex.js`)
`buildColorMap()` defines a `SCHWA_FAMILIES` set to de-emphasise schwa-dominated vowel families (reduced opacity, lower saturation). It contains `"AH"`, `"ER"`, `"UR"` — which are alias IDs. Since every word's `vowelFamily` is normalized to canonical IDs before the color map is built (`normalizeVowelFamily()` is called upstream), the keys `"AH"`, `"ER"`, `"UR"` are never matched. Words that should be de-emphasised as schwas receive full-saturation color instead, contributing to the over-saturated "skittles" rainbow.

**Root cause C — `summarizeVowelFamilies()` has no canonical allowlist** (`codex/server/services/panelAnalysis.service.js`)
The function does call `normalizeVowelFamily()` on each word, but if any upstream phoneme engine returns an unusual token not covered by `FAMILY_ALIASES` (e.g., a stress-digit-suffixed form like `"IH1"` leaking through), it passes normalization unchanged and appears as a new bucket. Adding an explicit canonical-8 allowlist closes this gap permanently.

### Fix A — `[CLAUDE]` `src/pages/Read/ReadPage.jsx`

Derive `effectiveAnalysisMode` from the combination of `isTruesight` and `analysisMode`:

```javascript
// After existing analysisMode state declaration:
const effectiveAnalysisMode = isTruesight ? analysisMode : ANALYSIS_MODES.NONE;
```

Pass `effectiveAnalysisMode` (not `analysisMode`) to `ScrollEditor`:

```jsx
<ScrollEditor
  // ... other props ...
  analysisMode={effectiveAnalysisMode}   // was: analysisMode
/>
```

This is a **single derived variable and one prop change**. No state mutations, no new hooks. The vowel family panel button may still set `analysisMode` to `VOWEL` for panel display purposes, but the coloring layer only sees `NONE` when truesight is off.

### Fix B — `src/lib/colorCodex.js`

Change `SCHWA_FAMILIES` to use canonical IDs:

```javascript
// BEFORE:
const SCHWA_FAMILIES = new Set(['AH', 'ER', 'UR']);

// AFTER:
const SCHWA_FAMILIES = new Set(['A', 'IH']);
```

Verify: `normalizeVowelFamily('AH') === 'A'` ✓, `normalizeVowelFamily('ER') === 'IH'` ✓, `normalizeVowelFamily('UR') === 'IH'` ✓.

### Fix C — `src/lib/vowelFamily.js`

Export the canonical-8 set so all consumers can reference it authoritatively:

```javascript
/**
 * The eight canonical vowel families used by Scholomance's color and analysis systems.
 * All normalizeVowelFamily() outputs are guaranteed to be members of this set (or empty string).
 */
export const CANONICAL_VOWEL_FAMILIES = Object.freeze(
  new Set(['IY', 'IH', 'EY', 'AE', 'A', 'AO', 'OW', 'UW'])
);
```

### Fix C (server) — `codex/server/services/panelAnalysis.service.js`

Update `summarizeVowelFamilies()` to enforce the canonical-8 allowlist as a hard filter after normalization:

```javascript
import { normalizeVowelFamily } from '../../../src/lib/vowelFamily.js';

// Add at top of file:
const CANONICAL_VOWEL_FAMILIES = Object.freeze(
  new Set(['IY', 'IH', 'EY', 'AE', 'A', 'AO', 'OW', 'UW'])
);

// In summarizeVowelFamilies(), after normalization:
const familyId = normalizeVowelFamily(analyzedWord?.phonetics?.vowelFamily);
if (!familyId || !CANONICAL_VOWEL_FAMILIES.has(familyId)) continue; // NEW: allowlist guard
```

> **Note**: Once `CANONICAL_VOWEL_FAMILIES` is exported from `src/lib/vowelFamily.js` (Fix C above), import it from there rather than re-declaring it.

---

## Implementation Order

Implement in this sequence to minimise breakage at each step:

| Step | Change | Blast Radius |
|------|--------|--------------|
| 1 | **Change 3** — SQLite dict adapter + wire into server | Additive only. External API fallback unchanged if SQLite absent. |
| 2 | **Change 1** — CMU warm-up at server startup + `getAllEntries()` | Additive only. Log lines only if CMU unavailable. |
| 3 | **Change 4B** — Fix `SCHWA_FAMILIES` in `colorCodex.js` | One-line change, all tests should still pass. |
| 4 | **Change 4C** — Export `CANONICAL_VOWEL_FAMILIES` + add allowlist guard | Additive export; guard only filters noise, not valid data. |
| 5 | **Change 4A** `[CLAUDE]` — `effectiveAnalysisMode` in `ReadPage.jsx` | Single derived variable + one prop change. Claude implements. |
| 6 | **Change 2** — HMM module + Pass 1b in syntax layer | Last — purely additive on server, zero browser impact. |

---

## File Ownership Summary

| File | Owner | Change Type |
|------|-------|-------------|
| `codex/core/hmm/hmm.tagger.js` | Gemini | **NEW** |
| `codex/core/hmm/matrices.default.js` | Gemini | **NEW** |
| `codex/core/hmm/index.js` | Gemini | **NEW** |
| `codex/services/adapters/sqliteDict.adapter.js` | Gemini | **NEW** |
| `codex/core/judiciary.js` | Gemini | Modify `getSyntaxModifier()` |
| `codex/server/index.js` | Gemini | Add CMU warm-up + SQLite adapter lifecycle |
| `codex/server/routes/wordLookup.routes.js` | Gemini | Pass `sqliteDictAdapter` to service |
| `codex/server/services/wordLookup.service.js` | Gemini | Replace HTTP dict call with adapter |
| `codex/server/services/panelAnalysis.service.js` | Gemini | Add canonical allowlist to `summarizeVowelFamilies()` |
| `src/lib/cmu.phoneme.engine.js` | Gemini | Add `getAllEntries()` |
| `src/lib/phoneme.engine.js` | Gemini | Remove `ensureAuthorityBatch()` |
| `src/lib/syntax.layer.js` | Gemini | Add HMM Pass 1b (server-only, lazy) |
| `src/lib/colorCodex.js` | Gemini | Fix `SCHWA_FAMILIES` to canonical IDs |
| `src/lib/vowelFamily.js` | Gemini | Export `CANONICAL_VOWEL_FAMILIES` |
| `src/pages/Read/ReadPage.jsx` | **Claude** | Add `effectiveAnalysisMode`, change prop |

---

## Testing Strategy

### Change 3 (Dictionary)
- Unit test: `createSqliteDictAdapter({ dbPath }).lookup('fire')` returns entry with `definitions`, `arpabet`, `rhymes`.
- Integration test: `POST /api/words/lookup` with `{ word: "obsidian" }` returns `source: "scholomance-sqlite"` in response.
- Fallback test: instantiate adapter with nonexistent path, verify `isAvailable()` returns false and server lookup continues to external APIs.

### Change 1 (Phonetic Index)
- Server startup log includes `[Startup] Phonetic Index ready (N entries)` where N > 100000.
- `GET /health/phonetics` returns `{ ready: true }`.

### Change 2 (HMM)
- Unit test `viterbiTag(['the', 'fire', 'burns', 'below'])` → `[DT, NN, VB, RB]` (or close approximation).
- Unit test `tagToRole('NN')` → `{ role: 'content', stressRole: 'primary' }`.
- Unit test `tagToRole('DT')` → `{ role: 'function', stressRole: 'unstressed' }`.
- Integration: analyze a line with "burns" as noun — verify `hmmPosTag: "NN"` appears in returned syntax tokens.
- Browser bundle size must not increase (lazy import guard ensures HMM code is not bundled).

### Change 4 (SKITTLES)
- Visual regression: with truesight OFF and vowel family button pressed, ScrollEditor word buttons must NOT appear (no color overlay rendered).
- Unit test `buildVowelSummaryFromAnalysis()` on a document with mixed vowels → `families.length <= 8`, all IDs in `CANONICAL_VOWEL_FAMILIES`.
- Unit test `buildColorMap()` with a word tagged `vowelFamily: 'AH'` → verify it receives the schwa de-emphasis color (same as `vowelFamily: 'A'`), not full-saturation.
- Visual regression: truesight ON with diverse vowel text → verify maximum 8 distinct color families visible, schwas are visually de-emphasised.
