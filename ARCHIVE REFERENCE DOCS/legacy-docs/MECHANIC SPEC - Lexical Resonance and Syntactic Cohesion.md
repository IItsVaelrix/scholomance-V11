# MECHANIC SPEC - Lexical Resonance and Syntactic Cohesion
**Version:** 1.0
**Status:** Canonical / Awaiting Implementation

## Overview
This document defines the laws governing how semantic meaning and sentence structure manifest as physical effects in the Scholomance.

## 1. Lexical Resonance (Semantic Induction)
**World-Law:** Words are organisms with mass. Rare words reach deeper into the semantic archetype.

### The Registry
- **ALCHEMY (IGNITE):** Singe, Ignite, Blaze, Conflagration, Supernova
- **SONIC (REVERB):** Echo, Reverb, Resonance, Harmonic Tear, Shatterpoint
- **VOID (ATROPHY):** Fade, Wither, Atrophy, Nullification, Oblivion
- **PSYCHIC (AMNESIA):** Haze, Blur, Amnesia, Fracture, Ego Death
- **WILL (BULWARK):** Stiffen, Guard, Bulwark, Iron Citadel, Invulnerability

### Logic
- **Detection:** Tokenized verse hits keywords in `SEMANTIC_REGISTRY`.
- **Tiering:** `Tier = Math.floor(Average(Keyword Rarity) * 5)`.
- **Dominance:** If a word exists in multiple chains, it is claimed by the `dominantSchool` of the verse.

## 2. Syntactic Cohesion (The Weaver's Path)
**World-Law:** Logical flow creates an "unassailable argument" that bypasses defense.

### Metrics
- **Sentence Variation:** Variance in length provides rhythm.
- **Connective Density:** Usage of logic-gates (*therefore, nonetheless, whereas*) provides stability.
- **Punctuation Complexity:** Use of commas/semicolons increases "Defense Penetration."

## 3. Implementation Directives

### For Codex (Engine)
- Create `codex/core/semantics.registry.js`.
- Create `codex/core/heuristics/cohesion.js`.
- Integrate into `combat.profile.js` and `combat.session.js`.

### For Claude (VFX)
- **Glory Scaling:** Visual intensity must scale with `rarity.id`.
- **Source Calamity:** Legendary/Source spells trigger full-screen environment shifts.
- **Status UI:** Display tiered labels in the combat status tray.

## 4. Balanced Heuristic Weights
- **Phoneme Density:** 0.15
- **Internal Rhyme:** 0.15
- **Multisyllabic Rhyme:** 0.15
- **Syntactic Cohesion:** 0.15
- **Lexical Rarity:** 0.25
- **Novelty / Flow:** 0.15
