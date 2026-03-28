# 🟣 MECHANIC SPEC - The Lexicon Abyss & Global Linguistic Entropy
**Version:** 1.0
**Classification:** New Heuristic / World-Law Expansion
**Status:** PROPOSED

## 1. World-Law: The Law of Entropy
In the Scholomance, language is the primary resource. When a word is spoken (or a verse cast), its "vibrational mass" is recorded in the **Lexicon Abyss** (the 50GB persistent disk). Overuse of a word by the collective consciousness of the server causes "Semantic Decay," where the word's magical potency is drained. Conversely, words that have not been used recently (or are rare in the global corpus) gain "Abyssal Resonance," increasing their damage output.

## 2. Mechanic Spec: The Lexicon Abyss (GWE)

- **Name:** The Lexicon Abyss (Global Linguistic Entropy)
- **World-law metaphor:** The "Abyss" is the cosmic record of all speech. Repetition breeds entropy.
- **Input:** `VerseIR` tokens from a `COMBAT_RESOLVED` event (public casted spells and NPC battle responses ONLY).
- **Output:** `AbyssalResonanceMultiplier` (0.50–1.50) added to each word's individual contribution.
- **Weight:** 0.15 (Redistributed from Phoneme Density and Lexical Rarity to maintain sum = 1.0).
- **Anti-exploit rule:** Prevents the emergence of a "solved" meta. If every player uses the same high-phoneme word (e.g., "Blaze"), its power drops until it becomes less effective than a simpler but rarer word.
- **Privacy Boundary:** The Abyss records only what is *cast* in the arena. Drafts, IDE metadata, and local file data are never ingested.

## 3. Implementation: The Akashic Record (AR)
The 50GB disk will also house the **Akashic Record**, a high-fidelity SQLite archive of every public combat encounter.

- **Data Structure:** Stored in `/var/data/akashic_record.sqlite`.
- **Payload:** Full `VerseIR` (compiled tokens) + `CombatScoreResponse` + `TraceId`.
- **Use Case:** "Post-Mortem Analysis" (a new Mirrorborne-ready mechanic). Players can spend XP to "Consult the Abyss" and see the history of a specific word or school's performance over time.

## 4. Balanced Heuristic Weights (Post-Abyss)

| Heuristic | Weight | Anti-exploit |
|-----------|--------|--------------|
| Phoneme density | 0.15 | Diminishing returns after threshold |
| Internal rhyme | 0.15 | Must be 2+ words apart |
| Multisyllabic rhyme | 0.15 | Requires distinct root words |
| Syntactic Cohesion | 0.15 | Punctuation/Logic gate density |
| Lexical Rarity | 0.15 | Global static rarity |
| **Abyssal Resonance** | **0.15** | **Global usage entropy (Dynamic)** |
| Novelty / Flow | 0.10 | Local verse-level repetition |
| **TOTAL** | **1.00** | |

## 5. Data Privacy & Source Isolation
**Mandatory Law:** The Lexicon Abyss is a record of *public combat speech*, not user metadata.

- **Isolation:** The system MUST NOT gather IDE data, local file paths, git history, uncasted drafts, or editor metadata.
- **Persistence Boundary:** Data is only persisted to the Abyss upon a `COMBAT_RESOLVED` event.
- **Content Restriction:** Only player casted spells and NPC battle responses are recorded.
- **Payload Scrubbing:** Before storage, the `VerseIR` MUST be scrubbed of any non-linguistic client-side data.

## 6. Handoff to Codex
- **Infrastructure:** Create `/var/data/abyss.sqlite` on the Render persistent volume.
- **Schema:**
    ```sql
    CREATE TABLE word_entropy (
        word TEXT PRIMARY KEY,
        usage_count_7d INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        current_multiplier REAL DEFAULT 1.0
    );
    CREATE TABLE akashic_replays (
        combat_id TEXT PRIMARY KEY,
        timestamp DATETIME,
        player_id TEXT,
        opponent_id TEXT,
        verse_ir_json TEXT,
        score_response_json TEXT
    );
    ```
- **Service:** Implement a `LexiconAbyssService` that updates entropy on `COMBAT_RESOLVED` and provides multipliers to the `ScoringEngine`. Ensure no IDE-level metadata is passed in the payload.

## 7. Handoff to Claude
- **VFX:** Rare words (high Abyssal Resonance) should trigger a "Void Pulse" effect in the editor.
- **UI:** The `ScoreTrace` should show "Abyssal Bonus" in purple text.
- **Inspector:** A new "Abyss" tab in the Truesight panel showing the global entropy of words in the current verse.

## 8. QA Request to Blackbox
- **Persistence Test:** Ensure `abyss.sqlite` survives container restarts on Render.
- **Privacy Audit:** Verify that `akashic_replays` contains ZERO file paths, local machine data, or uncasted drafts.
- **Concurrency Test:** Stress test `LexiconAbyssService` with 100 simultaneous combat requests.
- **Determinism:** Verify that two combat requests with the same DB state return the same Abyssal multiplier.

