# Archive/Prototypes

## Purpose

This directory contains **disconnected prototype systems** — code that implements real algorithms, data structures, and architectural patterns but is not currently wired into the live analysis pipeline.

These are **not dead code**. They are dormant infrastructure. Each file was authored to solve a specific problem, implements a working solution, and will be reconnected via the wiring plan defined in:

**→ [docs/PDR-archive/prototype_systems_wiring_pdr.md](../../docs/PDR-archive/prototype_systems_wiring_pdr.md)**

---

## Inventory

| File | System | Lines | Architectural Value | Wiring Phase |
|------|--------|-------|-------------------|--------------|
| `speaking/prosody.js` | Metrical prosody analyzer (foot detection, cadence tags, closure scoring) | 238 | HIGH | Phase 1 |
| `hmm.js` | Hidden Markov Model for syntax tagging (Viterbi, content/function states) | 139 | HIGH | Phase 2 |
| `phonetic_matcher.js` | Phonetic encoder (Metaphone-inspired, sound-alike clustering) | 64 | MEDIUM | Phase 1 |
| `spellweave.engine.js` | Spellweave syntactic bridge (token graphs, school resonance, alignment) | 310 | HIGH | Phase 3 |
| `semantic/semantic-math-bridge.js` | Mood → PixelBrain math constraints (8 moods, symbol library) | 448 | HIGH | Phase 3 |
| `world.entity.js` | World entity extractor (items, NPCs, locations, glyphs, school inference) | 400 | MEDIUM | Phase 2 |
| `tokenizer.js` | Tokenizer engine (text → tokens → phonemes, vowel-to-school mapping) | 52 | MEDIUM | N/A (already wired) |
| `microprocessors/factory.js` | Microprocessor factory (atomic data transforms, pipeline execution) | 84 | MEDIUM | N/A (registration surface) |
| `verseir-amplifier/` | VerseIR amplification pipeline (7 plugins, routing, diagnostics) | 838+ | HIGH | Phase 4 (audit) |

---

## Wiring Status

- **Phase 1 (Prosody + Phonetic):** Not started
- **Phase 2 (SyntaxHMM + WorldEntity):** Not started
- **Phase 3 (Spellweave + SemanticMath):** Not started
- **Phase 4 (VerseIR Amplifier Audit):** Not started
- **Phase 5 (Feature Flags):** Not started

---

## Rules

1. **Do not delete files here** — they are archived, not deleted.
2. **Do not modify files here** without checking the wiring PDR first.
3. **After wiring is complete**, these files remain in their original locations (`codex/core/`) and this directory becomes a README-only index.
4. **New prototypes** discovered by PB-SANI scans should be added to this inventory.

---

*Created: 2026-04-03 | Last Updated: 2026-04-03*
