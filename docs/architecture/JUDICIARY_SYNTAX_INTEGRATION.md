# Judiciary + Syntax Layer Integration Spec

## Problem

The syntax layer (`src/lib/syntax.layer.js`) produces rich per-token classification — role, lineRole, stressRole, rhymePolicy, and reason trails — but the judiciary (`codex/core/judiciary.js`) is completely blind to it. Every candidate gets flat `confidence * weight` scoring regardless of what kind of token is being judged. A function word at line-mid and a primary-stressed content word at line-end are treated identically.

This defeats the purpose of having a syntax layer at all. The classification data exists; it just never reaches the voting system.

## Current State

### Syntax Layer Output (per token)
```js
{
  word, normalized, lineNumber, wordIndex, charStart, charEnd,
  role,        // "content" | "function"
  lineRole,    // "line_start" | "line_mid" | "line_end"
  stressRole,  // "primary" | "secondary" | "unstressed" | "unknown"
  rhymePolicy, // "allow" | "allow_weak" | "suppress"
  stem,
  reasons      // ["closed_class_token", "function_non_terminal", ...]
}
```

### Judiciary Layers
```js
PHONEME:    { weight: 0.45 }
SPELLCHECK: { weight: 0.30 }
PREDICTOR:  { weight: 0.25 }
```

`vote(candidates)` computes `confidence * layerWeight` per candidate. No syntactic context.

## Proposed Changes

### 1. Add a SYNTAX layer to the judiciary

Register syntax as a fourth voting layer:

```js
this.layers = {
  PHONEME:    { weight: 0.40, name: 'Phoneme Engine' },
  SPELLCHECK: { weight: 0.25, name: 'Spellchecker' },
  PREDICTOR:  { weight: 0.20, name: 'Predictor' },
  SYNTAX:     { weight: 0.15, name: 'Syntax Analyzer' }
};
```

Weights are rebalanced to accommodate the new layer while keeping phoneme dominant. Adjust as needed — the key principle is that syntax should have meaningful but not dominant influence.

### 2. Syntax-aware vote modifiers

Extend `vote()` to accept an optional syntax context for the target position. When present, apply modifiers to all candidates based on the syntactic slot being filled:

| Syntax Signal | Effect | Rationale |
|---|---|---|
| `rhymePolicy: "suppress"` | Multiply all rhyme-based candidates by 0.3 | Don't suggest rhymes for mid-line function words |
| `rhymePolicy: "allow_weak"` | Multiply rhyme candidates by 0.6 | Function words at line-end can rhyme, but weakly |
| `role: "content"` + `lineRole: "line_end"` | Boost rhyme candidates by 1.25x | Terminal content words are prime rhyme positions |
| `stressRole: "primary"` | Boost phoneme-layer candidates by 1.15x | Primary stress = high phonetic salience |
| `stressRole: "unstressed"` + `role: "function"` | Reduce all candidate scores by 0.8 | Low-value position, don't over-optimize |

### 3. Syntax layer candidate generation

The SYNTAX layer should also submit its own candidates to `vote()` when it has an opinion. For example:

- If the target position is `lineRole: "line_end"` and `role: "content"`, the syntax layer could submit the existing word with higher confidence (endorsing the current choice)
- If a function word is occupying a `line_end` content slot, the syntax layer could submit alternatives with `confidence` proportional to how strongly the position demands a content word

### 4. Signature change

```js
// Before
vote(candidates)

// After
vote(candidates, syntaxContext = null)
// syntaxContext: { role, lineRole, stressRole, rhymePolicy } | null
```

When `syntaxContext` is null, behavior is identical to current (backward compatible).

## Files to Modify

| File | Change |
|---|---|
| `codex/core/judiciary.js` | Add SYNTAX layer, rebalance weights, implement modifiers in `vote()` |
| `src/lib/syntax.layer.js` | No changes needed — already produces the required data |
| `tests/core/judiciary.test.js` | Add test cases for syntax-modulated voting |

## Test Cases to Add

1. **Suppress rhyme for function word at line-mid**: Candidate from PHONEME layer with rhyme suggestion should be heavily penalized when `syntaxContext.rhymePolicy === "suppress"`
2. **Boost terminal content word**: Rhyme candidate for a `line_end` + `content` + `primary` stress position should score higher than the same candidate without syntax context
3. **Backward compatibility**: `vote(candidates)` without syntax context produces identical results to current behavior
4. **Tie-breaking with syntax**: When phoneme tiebreaker fires, syntax modifiers should still apply to the adjusted scores

## Non-Goals

- No changes to the syntax layer's classification logic
- No UI changes (Claude's domain)
- No new external dependencies
- Not adding POS tagging from an NLP library — the existing heuristic classification (function word set + contextual triggers + morphological suffixes) is sufficient for vote modulation
