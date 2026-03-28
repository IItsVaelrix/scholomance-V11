# 🟣 MECHANIC SPEC - The Phonemic Oracle & Linguistic Insight Engine
**Version:** 1.0
**Classification:** New Heuristic / Technical Commentary Integration
**Status:** CANONICAL

## 1. World-Law: The Voice of the World's Physics
In the Scholomance, language is the primary force. The **Phonemic Oracle** is the personification of the world's underlying physics (the `VerseIR` and the `Lexicon Abyss`). It does not "chat" like a generic assistant; it provides **Forensic Technical Insights** into why a verse succeeded or failed. It is the "Reverse Compiler" that translates math back into technical advice for the Scholar.

## 2. Mechanic Spec: The Phonemic Oracle (PO)

- **Name:** The Phonemic Oracle
- **World-law metaphor:** The Personification of the Abyss.
- **Input:** `VerseIR`, `HHM Summary` (Hidden States), `LexiconAbyss` (Global Entropy).
- **Output:** `OraclePayload` (Technical critiques and "undervalued" word suggestions).
- **Weight:** N/A (Non-scoring / Consultative).
- **Anti-exploit rule:** The Oracle will identify "Macro-casting" (repeated use of the same high-phoneme blocks) and warn the player about incoming **Semantic Decay** before it ruins their score.

## 3. Insight Generation Logic (The Brain)

The Oracle uses three data sources to "speak":

### 3.1 HHM State Analysis (Rhythm & Grammar)
Maps **Hidden Harkov States** to technical observations.
- **Trigger:** High density of `line_launch` without `flow`.
- **Oracle Insight:** "Your kinetic launch is being truncated. You're grounding your frequencies before they can achieve resonance. Extend your vowels in the mid-bar."
- **Trigger:** `terminal_anchor` mismatch.
- **Oracle Insight:** "The terminal anchor in line 2 is vibrating out of phase with the stanzaic root. The dissonance is bleeding 12% of your kinetic potential."

### 3.2 Abyssal Entropy Mapping (The Economy)
Consults the 50GB disk to find "Stock Market" shifts in the dictionary.
- **Logic:** Identifies words in the verse with > 0.7 entropy (decaying).
- **Oracle Insight:** "The word 'Shatter' is currently exhausted in the Abyss (Multiplier: 0.6). Its vibrational mass is leaking. Consider 'Fracture' or 'Splinter'—they are currently resonating in the deep vaults."

### 3.3 Synapse Slot Amplification (Awe)
If the `VerseIRAmplifier` identifies **Inexplicable** elements, the Oracle shifts state.
- **Mood:** `AWE`.
- **Oracle Insight:** "You have breached Source-Law. The 'Inexplicable' resonance in line 3 suggests you are no longer writing; you are rewriting the dictionary itself."

## 4. Balanced Heuristic Handoff (Codex)
- **Service:** Implement `PhonemicOracleService` in `codex/server/services/`.
- **Abyss Integration:** Query the `word_entropy` table for the top 3 most decayed words in the current verse and suggest replacements from the same semantic cluster with low entropy.
- **Persona Mapping:**
    *   **SONIC:** "The Vowel Scribe" (Focus on flow/rhythm)
    *   **VOID:** "The Echo Warden" (Focus on rarity/silence)
    *   **PSYCHIC:** "The Neural Archon" (Focus on complexity/density)
    *   **ALCHEMY:** "The Substance Chronicler" (Focus on cohesion/logic)
    *   **WILL:** "The Pulse Arbiter" (Focus on meter/impact)

## 5. Handoff to Claude
- **Component:** A new `OracleChamber` sub-panel in the `AnalysisPanel`.
- **Interaction:** Clicking an Oracle suggestion should trigger a "Linguistic Swap" preview in the editor.
- **VFX:** Use the `plus-lighter` blend mode for Oracle text to make it feel "Aetheric."

## 6. QA Request to Blackbox
- **Relevance Test:** Ensure that if a verse has 0 rhymes, the Oracle correctly identifies the "Rhyme Policy: Suppressed" state from the HHM and comments on the lack of resonance.
- **Accuracy Test:** Verify that suggested words actually have a higher `AbyssalResonanceMultiplier` than the original words.
