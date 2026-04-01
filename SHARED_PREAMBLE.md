# SHARED PROJECT PREAMBLE
## All agents read this before every session.

---

Scholomance V11 is a ritual-themed, text-combat MUD where syntax is a living world — grammar, phoneme structure, and linguistic form are not just scoring mechanisms. They are the physical laws of the universe. Words have mass. Rhyme keys are resonance frequencies. Alliteration is kinetic force. The editor is the arena.

---

## The Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React SPA (`src/`) |
| Backend | Fastify (`codex/server/`) |
| Storage | SQLite + Redis cache |
| Engine | CODEx — four strict layers: Core → Services → Runtime → Server |
| Dictionary | WordNet (OEWN) primary, GCIDE secondary, Datamuse fallback |
| Combat | Phoneme-density scoring with full explanation traces (`ScoreTrace[]`) |
| Schools | SONIC / PSYCHIC / VOID / ALCHEMY / WILL — each has CSS variables, XP gates, thematic flavor |
| Bytecode | `PB-ERR-v1` errors, `PB-RECURSE-v1` recursion detection, `0xF` formulas, lattice grids |
| QA | Bytecode assertion library (`tests/qa/tools/bytecode-assertions.js`) |

---

## Repository

Live at `github.com/IItsVaelrix/scholomance-V11`.

Folders confirmed present: `.claude/`, `codex/`, `dict_data/`, `docs/`, `public/`, `scripts/`

---

## The Nine-Persona Pantheon

Vaelrix, Agatha Blacklight, Seymore Prism, Big Dad, Angel, Mutant, Hollow God, The Demon, Wildflower.

These are both creative infrastructure and, in future Mirrorborne integration, mechanical archetypes.

- **Gemini** is consulted when personas map to game mechanics
- **Claude** is consulted when personas surface in UI

Mirrorborne integration is forward-looking. Do not implement mechanic or UI surfaces for it without an explicit spec.

---

## The Laws of This World (Physical Constants)

These are not flavor — they are the axioms everything else is derived from:

- Words have mass — phoneme density determines damage weight
- Rhyme keys are resonance frequencies — matching keys creates harmonic interference
- Alliteration is kinetic force — consonant clusters at onset generate momentum
- Meter consistency is structural integrity — broken meter destabilizes a scroll's power
- Rarity and novelty are entropy — uncommon words disrupt predictable defenses
- **Bytecode is truth** — all exports, persistence, and interoperability encode to bytecode first
- **Lattice is law** — pixel art exists as grid coordinates, not rendered images
- **Symmetry is automatic** — every upload analyzed for inherent symmetry patterns
- **Errors are bytecode** — all failures use `PB-ERR-v1` format with FNV-1a checksums

All scoring heuristics are expressions of these constants. If a heuristic cannot be explained in these terms, it does not belong in the engine.

**Bytecode Error System Documentation:**
- `docs/ByteCode Error System/01_Bytecode_Error_System_Overview.md` — System architecture
- `docs/ByteCode Error System/02_Error_Code_Reference.md` — Error code catalog
- `docs/ByteCode Error System/03_AI_Parsing_Guide.md` — AI parsing specifications
- `docs/ByteCode Error System/04_QA_Integration_Guide.md` — QA assertion library
- `docs/ByteCode Error System/05_Integration_Summary.md` — Implementation summary

---

## Agent Reading Order (Every Session)

1. `SHARED_PREAMBLE.md` — this file, the world
2. `VAELRIX_LAW.md` — the law, the escalation protocol
3. `SCHEMA_CONTRACT.md` — the data shapes and event bus
4. `docs/ByteCode Error System/` — error encoding, QA assertions (MANDATORY for all agents)
5. Your agent context file (`CLAUDE.md` / `CODEX.md` / `BLACKBOX.md` / `GEMINI.md`)
