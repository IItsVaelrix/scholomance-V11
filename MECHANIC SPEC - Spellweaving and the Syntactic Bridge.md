# MECHANIC SPEC — Spellweaving and the Syntactic Bridge v1.0

**CLASSIFICATION:** New Core Combat Mechanic / Linguistic Physics Bridge
**WHY:** To separate "Intent" from "Execution." Spellweaving allows the player to explicitly command the universe (the Weave) while using their poetic skill (the Verse) to fuel and direct that command. This resolves the ambiguity of "magic by suggestion" and creates a deterministic "Grammar of Combat."

## MECHANIC SPEC
- **Name:** Spellweaving (The Syntactic Bridge)
- **World-law metaphor:** The Verse is the **Prima Materia** — raw linguistic energy. The Weave is the **Forma** — the geometric blueprint that shapes that energy. Without a Weave, the Verse is a chaotic spill. Without a Verse, the Weave is an empty hollow.
- **Input:** 
  - `Verse`: (max 300 chars) The "Body" of the spell. Determines Magnitude, Range, and Quality.
  - `Weave`: (60-100 chars) The "Instruction." Determines Action (Predicate) and Target (Object).
- **Output:** 
  - `Intent`: The resolved action (e.g., HEAL, BURN, DISPEL).
  - `Resonance`: A multiplier (0.50 – 1.50) based on semantic alignment between Verse and Weave.
  - `Targeting`: Derived from the Weave's object-tokens.
- **Weight:** 
  - Intent Mapping: 1.0 (Deterministic)
  - Resonance Multiplier: Included in the "Cohesion" weight (0.15).
- **Anti-exploit rule:** 
  - "Grocery List" Weaves (e.g., "mend heal cure fix") trigger **Syntactic Collapse**, resulting in a 0.1x magnitude multiplier.
  - The Weave *must* contain a valid Predicate and a valid Object to function at >50% efficiency.
- **Diminishing returns:** Using the same Predicate (e.g., "Mend") in consecutive turns reduces its efficiency by 20% (Linguistic Fatigue), encouraging varied spellcasting.
- **Example:** 
  - **Verse:** "The ivory light descends in silent snow, / To cover wounds that red and ragged show." (High Alchemy/Sonic affinity)
  - **Weave:** "Mend the ragged flesh of my companion."
  - **Trace:** Weave Predicate="Mend" (HEAL), Object="flesh" (BODY). Verse Subject="wounds/cover" (HEAL alignment). 
  - **Result:** HEAL spell with 1.4x Resonance bonus.
- **Codex handoff:** `codex/core/spellweave.engine.js` needs to parse the Weave for predicate/object pairs and compare them against the Verse's semantic vector.
- **Claude handoff:** UI must show two distinct input fields. The Weave field should provide real-time feedback on "Syntactic Integrity" (Green/Yellow/Red).

## RISK
If the predicate mapping is too narrow, players will feel restricted. If it's too broad, the "Living Syntax" feel is lost. We must maintain a robust `semantics.registry.js`.

## CODEX HANDOFF
- **Engine:** `codex/core/spellweave.engine.js`
- **Registry:** `codex/core/semantics.registry.js`
- **Pipeline:** Update `analysis.pipeline.js` to accept `dualInput: { verse, weave }`.

## CLAUDE HANDOFF
- **UI:** Combat screen requires a secondary "Spellweave" input below the main Verse editor.
- **VFX:** Successful "Bridge" should trigger a connecting beam effect between the two text windows.

## QA REQUEST TO BLACKBOX
- Test "Mismatched" pairs (e.g., Verse about fire, Weave about healing) to ensure Resonance penalty applies.
- Test "Grocery List" anti-exploit with keyword clusters.
