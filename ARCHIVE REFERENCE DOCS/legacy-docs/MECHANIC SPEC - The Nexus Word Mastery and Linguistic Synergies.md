# MECHANIC SPEC - The Nexus: Word Mastery and Linguistic Synergies

**CLASSIFICATION:** New Progression Mechanic / World-Law Expansion
**WHY:** To manifest the user's vision of a "Nexus" panel that acts as a database of unlocked words and their synergies. This rewards long-term play by allowing players to master specific linguistic components, unlocking deterministic mechanical bonuses.

## MECHANIC SPEC
- **Name:** The Nexus
- **World-law metaphor:** The Nexus is the Akashic record of the Scholomance, where words are etched into the crystalline lattice of the world. Mastery allows an architect to tap into the word's inherent resonance (Synergy).
- **Input:** `AnalyzedDocument` (Combat Verse) + `NexusState` (Progression)
- **Output:** `UpdatedWordMastery` + `ActiveSynergies`
- **Weight:** 0.00 (Progression layer). Synergies may add `damageMultiplier` (1.05-1.15) or `statusDurationBonus`.
- **Anti-exploit rule:** 
  - Word discovery is capped at unique tokens per scroll.
  - Mastery XP is weighted by school alignment and scroll quality (total score).
  - Minimum word length (3+ chars) to prevent mastering stop words.
- **Diminishing returns:** Repetitive use of the same word in a single combat session yields 0 mastery XP after the first valid use.
- **Example:** 
  - Input: "VOID" used in a VOID school verse.
  - Trace: `isFirstUseInSession: true`, `schoolMatch: true`, `qualityBonus: true` -> `+50 Mastery XP`.
  - Result: "VOID" reaches Mastery Level 3 (Fluent), unlocking "Void Echo" synergy.
- **Codex handoff:** 
  - `codex/core/nexus.registry.js`: Canonical registry of synergies and levels.
  - `src/hooks/useProgression.jsx`: `recordWordUse` function updates the state.
- **Claude handoff:** `NexusPanel` component displays the grid of discovered words and their synergy trees.

## RISK
High-level mastered words might lead to power creep. Synergies must be conservative (5-10% multipliers) and highly specific to linguistic conditions (e.g., "only in multisyllabic rhymes").

## CODEX HANDOFF
- Registry: `codex/core/nexus.registry.js`
- State: `nexus` object in `useProgression` hook.
- Trigger: `useCombatEngine.js` calls `recordWordUse` on successful cast.

## CLAUDE HANDOFF
- Component: `src/components/Nexus/NexusPanel.jsx`
- Page: `src/pages/Nexus/NexusPage.jsx`
- Route: `/nexus`

## QA REQUEST TO BLACKBOX
- Verify that words are correctly added to `nexus.discoveredWords` after a combat cast.
- Verify that mastery XP increases correctly and levels up words.
- Verify that synergies are displayed correctly in the NexusPanel.
