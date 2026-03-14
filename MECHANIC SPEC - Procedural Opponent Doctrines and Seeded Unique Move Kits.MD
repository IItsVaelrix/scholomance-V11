# MECHANIC SPEC - Procedural Opponent Doctrines and Seeded Unique Move Kits

Status: Proposed
Owner: Codex
UI Consumer: Claude
Testing Consumer: Blackbox
Schema Note: This document defines mechanic intent and implementation detail. It does not amend `SCHEMA_CONTRACT.md` by itself.

## 1. Purpose

The current opponent loop produces seeded names, schools, intelligence values, and deterministic counter-verses, but the enemy does not yet behave like a true doctrine-bearing combatant. This spec defines a deterministic opponent system in which each NPC profile type owns a unique combat identity, a seeded move kit, a telegraphed battle pattern, and clear counters the player can answer through writing.

The intent is to make the combat loop:

1. Read the enemy.
2. Infer the enemy's doctrine and imminent move.
3. Write around the telegraph.
4. Resolve the cast under server-authoritative combat rules.
5. Adapt as the opponent changes phase or exposes a signature pattern.

## 2. Core Outcome

After this system ships:

- A `Null Scribe` is not merely a VOID-flavored enemy.
- A `Null Scribe` consistently behaves as an anti-resonance doctrine with silence, anti-sound, cadence disruption, and void counters.
- Two `Null Scribe` encounters can differ in exact loadout and text, but still feel recognizably like the same doctrine.
- Same seed plus same combat history always yields the same opponent identity, move choices, move text selection, telegraphs, and combat outcomes.
- The authoritative unit of enemy behavior is the chosen move and its effects, not just the generated line of text.

## 3. World-Law Basis

This system must remain grounded in the world laws from `SHARED_PREAMBLE.md`.

- Words have mass: heavy diction can attract punishes, counters, or theft.
- Rhyme keys are resonance frequencies: repeated rhyme structures can be read and broken.
- Alliteration is kinetic force: phoneme-heavy Sonic play can be damped, reflected, or redirected.
- Meter consistency is structural integrity: cadence-targeting enemies should destabilize the player through meter disruption, not arbitrary debuffs.
- Rarity and novelty are entropy: some doctrines should punish repetition and reward the player's lexical unpredictability.

If a move cannot be justified through these laws, it does not belong in the mechanic set.

## 4. Design Principles

### 4.1 Determinism

- No hidden randomness may affect move selection after a combat state is known.
- All seeded variation must derive from explicit deterministic hashes.
- Generated spell text may vary within a move's deterministic template bank, but move identity and effect resolution may not vary from the same state.

### 4.2 Doctrine First

- `school` is elemental/magical alignment.
- `profileType` is combat doctrine.
- `doctrine` is the readable summary of how that profile fights.
- Move selection is primarily doctrine-driven, then modified by school affinity and player read-state.

### 4.3 Telegraphability

- The player must have at least one readable signal for major enemy actions.
- Signature and desperation moves should not feel like invisible gotchas.
- Telegraphs are authored as mechanic surfaces, not flavor-only prose.

### 4.4 Counterplay

- Every doctrine must be beatable through player writing behavior, not only raw score inflation.
- Counterplay should include school choice, token choice, rhythm choice, rarity choice, and pacing choice.

### 4.5 Backend Authority

- Move legality, move selection, state mutation, status application, arena changes, and final resolution are Codex/server concerns.
- UI displays the authoritative state and telegraphs. UI never infers hidden mechanic truth.

## 5. Terminology

- Encounter Seed: The root deterministic seed for a fight.
- Profile Type: The named enemy identity such as `null_scribe`.
- Doctrine: The playstyle summary, such as "anti-resonance nullifier."
- Variant: A seeded sub-style within a profile type.
- Move Kit: The set of moves available to the opponent for the encounter.
- Read Model: The reduced deterministic summary of recent player behavior used for enemy decision-making.
- Telegraph: The authored indication of an upcoming move or phase shift.
- Phase: A doctrine state such as `opening`, `control`, `pressure`, or `desperation`.

## 6. Scope

This spec covers:

- Procedural opponent identity generation
- Deterministic seeded move-kit assembly
- Turn-by-turn move selection
- Enemy status and arena effects
- Telegraph rules
- Combat-state additions needed to support the system
- Backend ownership and UI handoff

This spec does not cover:

- New UI art direction details beyond the required data surfaces
- Full database schema migration detail
- PvP move doctrine systems
- New player-side spell categories beyond what enemy moves interact with

## 7. Current Implementation Gap

The current system in `codex/core/opponent.engine.js` already provides:

- seeded name choice
- seeded school choice
- seeded intelligence
- deterministic counter-line generation from player history

The current system does not yet provide:

- explicit profile types
- doctrine-aware move selection
- persistent move kits
- cooldowns or usage caps
- telegraphs
- phase logic
- authoritative enemy statuses or arena conditions
- guaranteed signature behavior per profile type

## 8. Opponent Identity Model

Each opponent must be represented by the following conceptual identity layers.

### 8.1 School

One of:

- `SONIC`
- `PSYCHIC`
- `VOID`
- `ALCHEMY`
- `WILL`

School determines:

- affinity tables
- school-facing text bank
- ambient flavor
- default damage coloration
- some secondary move modifiers

School does not determine the full doctrine by itself.

### 8.2 Profile Type

Named combat doctrine IDs such as:

- `null_scribe`
- `hollow_tongue`
- `cryptonym`
- `resonant_shade`
- `echo_revenant`
- `phonocrat`
- `schism_oracle`
- `mnemonic_hound`
- `fractured_mind`
- `mercurial_apostle`
- `verbalith`
- `brass_grammarian`
- `iron_liturgist`
- `crown_of_intent`
- `volitional_saint`

Profile type determines:

- passive
- signature move
- desperation move
- target preferences
- telegraph language family
- preferred setup/punish patterns

### 8.3 Doctrine

Doctrine is the readable statement of enemy logic. Example:

- `null_scribe`: anti-resonance, anti-sound, silence, cadence erasure
- `mnemonic_hound`: tracks repeated tokens and hunts remembered lines
- `mercurial_apostle`: rewrites terrain and school context

Doctrine exists for design clarity, combat readability, UI rendering, and testing.

### 8.4 Variant

Each profile type must permit seeded variants without losing identity.

Variant may alter:

- one support move
- one counter move
- phrase bank priority
- phase weighting
- one minor modifier value within bounded ranges

Variant may not alter:

- passive identity
- signature move identity
- desperation move identity
- doctrine category
- core counterplay

## 9. Seed Model

All seeded choices must use deterministic hash inputs. No timestamps, wall-clock values, or ambient environment values are allowed.

### 9.1 Required Seed Chain

Root derivation:

`encounterSeed = hash(runSeed | arenaId | encounterOrdinal | difficultyTier)`

Profile derivation:

`profileSeed = hash(encounterSeed | school | profileType)`

Variant derivation:

`variantSeed = hash(profileSeed | variantOrdinal)`

Kit derivation:

`kitSeed = hash(profileSeed | variantSeed | rulesetVersion)`

Turn derivation:

`turnSeed = hash(encounterSeed | turnNumber | playerHistoryDigest | opponentPhase | activeArenaConditionDigest)`

Text derivation:

`textSeed = hash(turnSeed | moveId | counterTokensDigest | telegraphKey)`

### 9.2 Ruleset Versioning

- Add a `rulesetVersion` or equivalent constant to seed derivation when mechanic changes would otherwise change historical replay outputs.
- This allows deterministic replays inside a known ruleset while permitting future balance revisions.

### 9.3 Seed Output Use

Allowed seeded outputs:

- profileType selection
- variant selection
- move kit secondary move selection
- phrase bank selection
- tie-break selection among equally valid moves
- cosmetic label selection within a deterministic bank

Disallowed seeded outputs:

- arbitrary post-selection bonus damage
- hidden hit chance
- silent critical chance
- untracked extra move effects

## 10. Move Kit Structure

Each encounter opponent owns exactly one active kit.

### 10.1 Required Kit Slots

Each kit must contain:

- `passive`
- `pressureMove`
- `setupMove`
- `counterMove`
- `signatureMove`
- `desperationMove`

Optional later slots:

- `recoveryMove`
- `phaseShiftMove`
- `terrainMove`

These optional slots are not required for initial implementation.

### 10.2 Slot Responsibilities

Passive:

- always on or conditionally on
- should express doctrine identity continuously
- should be simple enough to explain in one short line

Pressure move:

- default offense when no special trigger dominates
- low or zero cooldown
- keeps the encounter from stalling

Setup move:

- establishes a status, telegraph, token theft, mark, or arena condition
- should make a later move stronger

Counter move:

- reacts to detected player tendencies
- should punish recognizable repetition, school bias, or recent spell traits

Signature move:

- the defining move of the doctrine
- must feel memorable and unique
- must have deterministic forcing logic so it actually appears in play

Desperation move:

- late-fight escalation
- one use only
- should visibly alter pressure

## 11. Move Definition Schema Intent

This is a mechanic intent shape, not yet the sovereign schema contract.

```ts
interface OpponentMoveDefinition {
  id: string;
  label: string;
  slot: "pressure" | "setup" | "counter" | "signature" | "desperation";
  school: School;
  doctrine: string;
  minTurn: number;
  cooldownTurns: number;
  maxUses: number | null;
  phaseAllowlist: string[];
  triggerRules: TriggerRule[];
  telegraphKey: string | null;
  priorityBase: number;
  effectBundle: OpponentEffect[];
  textTemplates: string[];
}
```

Important rules:

- `id` is the authoritative move identity.
- `label` is UI-facing and stable.
- `textTemplates` are derived from `textSeed`; they are not the source of truth.
- `effectBundle` resolves the mechanic.

## 12. Combat Read Model

The opponent chooses moves from a deterministic read model of recent player behavior.

### 12.1 Read Window

Use opponent intelligence with current memory-window rules:

- INT `< 6`: read last `1` line
- INT `6-11`: read last `4` lines
- INT `12-19`: read last `8` lines
- INT `20+`: read all visible history

### 12.2 Required Read Features

Each opponent turn must compute the following read features:

- recent player dominant school over last 3 casts
- recent SONIC density average
- recent healing count
- recent terrain count
- recent failure-cast count
- repeated token set
- stolen token matches
- repeated rhyme key presence
- repeated meter/cadence pattern presence if available
- average token count
- average lexical novelty proxy
- last player cast school
- last player cast rarity ordinal
- last player cast healing flag
- last player cast terrain flag
- player HP ratio
- opponent HP ratio

### 12.3 Minimum Read Guarantees

- If insufficient history exists, the read model must still produce safe defaults.
- Lack of history must never produce undefined move selection.
- Opening-turn behavior must still feel doctrinal through profile defaults.

## 13. Trigger Vocabulary

Moves may trigger from a bounded vocabulary of conditions. These are deterministic booleans or bounded scores.

Required initial trigger types:

- `turn_at_least`
- `player_school_is`
- `player_school_bias_is`
- `player_sonic_bias`
- `player_healing_bias`
- `player_terrain_bias`
- `player_failure_bias`
- `player_repeated_token_present`
- `player_repeated_rhyme_present`
- `player_used_stolen_token`
- `opponent_hp_below`
- `player_hp_below`
- `arena_condition_is`
- `status_present_on_player`
- `status_present_on_opponent`
- `signature_due`
- `desperation_unlocked`

## 14. Move Selection Algorithm

The move selector is pure. It must always receive a full combat snapshot and return exactly one chosen move.

### 14.1 Validation Pipeline

For each move in the active kit:

1. Reject if phase not allowed.
2. Reject if `turnNumber < minTurn`.
3. Reject if cooldown active.
4. Reject if `maxUses` exceeded.
5. Reject if desperation conditions not met.
6. Score trigger matches.
7. Apply doctrine bias score.
8. Apply forced signature or desperation rules.

### 14.2 Priority Formula

Suggested deterministic priority formula:

`priority = basePriority + triggerScore + phaseBonus + doctrineBonus + readConfidenceBonus + forcedBonus - repeatPenalty`

Suggested component ranges:

- `basePriority`: `0-40`
- `triggerScore`: `0-60`
- `phaseBonus`: `0-20`
- `doctrineBonus`: `0-15`
- `readConfidenceBonus`: `0-12`
- `forcedBonus`: `0-100`
- `repeatPenalty`: `0-30`

### 14.3 Tie Break Rules

If multiple valid moves share the same final priority:

1. Choose lower usage count.
2. Choose longer-unseen move.
3. Choose deterministic `hash(turnSeed | moveId)` winner.

### 14.4 Repeat Control

- The same move may not be used twice in a row unless all other valid moves are blocked.
- Signature may override this only if it is due and no other signature-valid route exists.

## 15. Signature Move Guarantee

Each doctrine must reliably reveal its identity in actual play.

Rules:

- Signature moves unlock no later than turn 3.
- If the signature move is valid at least once before turn 4, it must be used by turn 3 unless the opponent dies first.
- If the signature move is invalid due to explicit counterplay conditions, the system may defer it, but must re-evaluate every turn.
- A doctrine whose signature never appears in typical 3-5 turn combat is considered failed design.

## 16. Desperation Move Rules

- Desperation unlocks at opponent HP ratio `<= 0.35`.
- Desperation may only be used once per encounter.
- Desperation should be telegraphed unless the doctrine specifically themes ambush or fracture, and even then should have a pre-state indicator.
- Desperation must materially alter encounter pressure, not merely add a flat damage bump.

## 17. Cooldown and Use Defaults

Initial default ranges:

- Pressure move: cooldown `0`, max uses `null`
- Setup move: cooldown `2`, max uses `2`
- Counter move: cooldown `1`, max uses `3`
- Signature move: cooldown `3`, max uses `1 or 2`
- Desperation move: cooldown `99`, max uses `1`

Profile types may override within bounded ranges, but should not violate role clarity.

## 18. Effect Vocabulary

Enemy moves may only use explicit, server-resolved effect classes.

Required initial effect types:

- `damage`
- `apply_status_to_player`
- `apply_status_to_opponent`
- `clear_status`
- `set_arena_condition`
- `clear_arena_condition`
- `steal_focus_token`
- `mark_stolen_token`
- `modify_next_player_cast`
- `modify_next_opponent_cast`

Each effect must be:

- bounded
- serializable
- explainable in combat log text
- replayable from state

## 19. Initial Status Catalog

These are proposed initial authoritative statuses for the first implementation wave.

### 19.1 `silence_lattice`

Applied by anti-resonance doctrines.

Effect:

- reduce SONIC mana-regeneration bonus
- cap SONIC arena-resonance bonus on the next player cast

Duration:

- 1 player cast

### 19.2 `meter_fray`

Applied by cadence-break doctrines.

Effect:

- reduce syntax-control multiplier by `12%`

Duration:

- 1 player cast

### 19.3 `thought_split`

Applied by Psychic fracture doctrines.

Effect:

- reduce efficiency of mixed-intent casts

Duration:

- 1 player cast

### 19.4 `reagent_mark`

Applied by Alchemy conversion doctrines.

Effect:

- reduce healing and terrain output by `18%`

Duration:

- 2 player casts

### 19.5 `edict_weight`

Applied by Will doctrines.

Effect:

- increase failure pressure on low-token casts

Duration:

- 1 player cast

### 19.6 `named_wound`

Applied when a token is stolen or named against the player.

Effect:

- if the player reuses the marked token, the opponent gains damage bonus on the next relevant cast

Duration:

- until consumed or battle end

## 20. Initial Arena Condition Catalog

### 20.1 `feedback_field`

Effect:

- reflect a bounded portion of high-phoneme pressure into the next opponent response

### 20.2 `null_zone`

Effect:

- reduce SONIC density contribution while active

### 20.3 `mercury_ground`

Effect:

- temporarily rewrite arena-school context to a seeded alternate school

### 20.4 `crown_pressure`

Effect:

- strengthen doctrine authority and school-affinity pressure for a fixed duration

## 21. Null Scribe Doctrine Spec

This is the primary example and must be treated as canonical for first-wave implementation intent.

### 21.1 Identity

- Profile Type: `null_scribe`
- School: usually `VOID`
- Doctrine: anti-resonance nullifier
- Core fantasy: erase sound, hollow cadence, silence Sonic force, and turn remembered words into negative space

### 21.2 Counterplay Intent

The player should beat `Null Scribe` by:

- avoiding overcommitting to Sonic-heavy repetition
- varying rhyme and token choices
- using novelty instead of predictable cadence loops
- shifting schools when telegraphed silence is imminent

### 21.3 Passive

`Silence Lattice`

Effect:

- while active, Sonic-facing player bonuses are partially damped
- passive intensity may scale slightly by seeded variant, but must remain readable

### 21.4 Move Kit

Pressure move:

- `anti_phoneme_lash`
- VOID strike
- bonus priority against high Sonic density

Setup move:

- `black_margin`
- steals one focus token from readable history
- applies `named_wound`

Counter move:

- `mute_the_chorus`
- prioritizes when the player has Sonic bias
- applies `silence_lattice`

Punish move:

- `erase_cadence`
- prioritizes on repeated rhyme or repeated token patterns
- applies `meter_fray`

Signature move:

- `wordless_verdict`
- consumes active anti-resonance setup if present
- large doctrine-defining VOID strike

Desperation move:

- `cathedral_of_zero`
- unlocks below `35%` HP
- intensifies silence pressure and empties safe Sonic lines

### 21.5 Telegraph Family

Null Scribe telegraphs should communicate:

- hush
- missing sound
- anti-echo
- hollowing of repeated words
- vanishing cadence

Telegraphs must not communicate:

- vague generic danger without doctrine identity

## 22. Initial Doctrine Catalog

First-wave doctrine identities:

### VOID

- `null_scribe`: anti-resonance, silence, cadence erasure
- `hollow_tongue`: devours refrain and repeated line structure
- `cryptonym`: steals, renames, and weaponizes key tokens

### SONIC

- `resonant_shade`: reflects or bends phoneme pressure
- `echo_revenant`: repeats or amplifies prior damage structures
- `phonocrat`: cages meter and rewards formal dominance

### PSYCHIC

- `schism_oracle`: punishes mixed intent and divided meaning
- `mnemonic_hound`: tracks memory and hunts reused language
- `fractured_mind`: introduces failure pressure and split resolution

### ALCHEMY

- `mercurial_apostle`: rewrites terrain and arena state
- `verbalith`: converts player healing/support patterns into enemy advantage
- `brass_grammarian`: hardens against verbose, heavy diction

### WILL

- `iron_liturgist`: punishes terse force and command-style casts
- `crown_of_intent`: exploits failure and weak resolve
- `volitional_saint`: stabilizes, buffs, and counter-bolsters itself

## 23. Combat State Additions

The encounter state must add fields sufficient to replay and resolve doctrine behavior exactly.

Required conceptual additions:

- `encounterSeed`
- `rulesetVersion`
- `opponentProfile`
- `opponentMoveHistory`
- `opponentCooldowns`
- `opponentUsageCounts`
- `opponentPhase`
- `currentTelegraph`
- `playerStatuses`
- `opponentStatuses`
- `arenaCondition`
- `stolenTokens`
- `playerHistoryDigest`

The current state in `codex/core/combat.session.js` is the correct place to extend this.

## 24. Turn Lifecycle

Each full round follows this order:

1. Start of player turn state exists with telegraph and statuses visible.
2. Player writes and submits a cast.
3. Server resolves player cast against active statuses and arena condition.
4. Combat state mutates authoritatively.
5. If opponent dies, victory resolves and no enemy cast occurs.
6. If opponent survives, enemy read model is built from the updated state.
7. Move selector chooses exactly one enemy move.
8. Telegraph consumption rules execute.
9. Enemy move resolves its effect bundle.
10. Enemy action text is generated from `textSeed`.
11. State updates with cooldowns, usages, statuses, and phase transitions.
12. Next player turn begins with any new telegraph.

## 25. Phase Model

Each doctrine may expose one or more phases. Initial shared phase vocabulary:

- `opening`
- `control`
- `pressure`
- `desperation`

Suggested default transitions:

- `opening`: turns 1-2
- `control`: while setup effects are being established
- `pressure`: once player pattern has been read or the signature has fired
- `desperation`: below HP threshold

Phase affects:

- move weighting
- telegraph tone
- setup/counter priority
- signature forcing logic

## 26. Text Generation Rules

The enemy line is not the mechanic source of truth.

Rules:

- Move resolution determines the action.
- Text is generated after move choice.
- Text templates are doctrine-scoped, school-scoped, and move-scoped.
- Text may incorporate deterministic focus tokens from player history.
- Text may mention stolen tokens, arena condition, or active silence state if mechanically present.

Text must never imply:

- an effect that was not applied
- a school that was not used
- a token theft that did not occur

## 27. Backend Implementation Ownership

Codex owns:

- doctrine catalog definitions
- seed derivation
- move-kit generation
- read model generation
- move selection
- move effect resolution
- combat state mutation
- server authority
- serialization and persistence
- schema publication after approval

Codex must not delegate any of the above to UI inference.

## 28. Proposed Codex Module Split

Suggested module additions:

- `codex/core/opponent.catalog.js`
- `codex/core/opponent.seed.js`
- `codex/core/opponent.readModel.js`
- `codex/core/opponent.selector.js`
- `codex/core/opponent.effects.js`
- `codex/core/opponent.telegraph.js`
- `codex/core/opponent.resolution.js`

Suggested responsibilities:

- `catalog`: doctrine data, move definitions, template banks
- `seed`: hash derivation and deterministic selectors
- `readModel`: player tendency extraction
- `selector`: pure move choice logic
- `effects`: authoritative effect application
- `telegraph`: telegraph generation and exposure rules
- `resolution`: end-to-end enemy turn result builder

## 29. Route and Authority Direction

The long-term correct direction is server-authoritative session combat.

Required session responsibilities:

- start encounter with authoritative profile and seed
- resolve player cast against session state
- resolve opponent cast against session state
- persist enough state to replay the encounter

Recommended route pattern:

- `POST /api/combat/session/start`
- `POST /api/combat/session/:id/player-cast`
- `POST /api/combat/session/:id/opponent-cast`

The existing stateless score route may remain as preview or fallback, but must not become the authoritative doctrine engine.

## 30. Claude UI Handoff

Claude owns only the surface presentation of the authoritative doctrine data.

Claude should render:

- profile-type label
- doctrine label or subtitle
- passive indicator
- telegraph banner
- phase shift banner
- move-name reveal
- status chips
- stolen-token chips
- arena-condition indicator
- combat-log phrasing from authoritative payloads

Claude must not infer:

- hidden cooldowns unless explicitly provided
- move legality
- trigger logic
- backend-only priority logic
- whether a move was "about to happen" unless a telegraph field says so

### 30.1 Required UI Data Contract

Claude will need authoritative payload fields for:

- `profileType`
- `doctrine`
- `passiveLabel`
- `phase`
- `telegraph`
- `telegraphKey`
- `moveId`
- `moveLabel`
- `moveSchool`
- `statusesApplied`
- `stolenTokens`
- `arenaCondition`

### 30.2 UI Accessibility Expectations

UI should:

- announce telegraph arrival
- announce status application
- announce move-name cast
- announce phase changes
- announce token theft

UI should not rely on color alone to communicate:

- silence
- cadence damage
- token theft
- desperation state

## 31. Blackbox Test Expectations

Blackbox should receive a follow-up test handoff after implementation.

Minimum required test classes:

- identical snapshot returns identical profile, kit, telegraph, and move
- profile type always owns the correct signature move
- signature forcing logic fires by expected turn windows
- desperation unlock obeys threshold
- cooldown blocking works
- max-use blocking works
- repeated-move prevention works
- stolen token behavior is deterministic
- text generation never contradicts mechanic outcome
- replay-from-seed returns identical action sequence

## 32. Migration Strategy

Phase 1:

- add profile types and seeded move kits
- keep opponent turn client-orchestrated if needed for temporary integration
- surface move identity in internal state

Phase 2:

- move enemy resolution to session-authoritative backend flow
- persist encounter state
- expose telegraphs and statuses through route payloads

Phase 3:

- expand doctrine catalog
- add richer arena conditions
- tune balance with recorded combat traces

## 33. Non-Negotiable Constraints

- No hidden randomness after state is known.
- No client-authored enemy mechanic truth.
- No doctrine without a real signature move.
- No profile type whose actual behavior can be mistaken for a generic school bot.
- No generated text that lies about the action.
- No status effect without explicit resolution rules and duration rules.

## 34. Acceptance Criteria

This system is considered successful when:

- players can identify major enemy doctrines from behavior within 2-3 turns
- `Null Scribe` reliably uses anti-sound/nullification behaviors
- different seeded encounters of the same doctrine remain recognizably related
- a replay using the same encounter seed and inputs reproduces the same fight
- the backend exposes enough authoritative data for Claude to render doctrine-driven combat cleanly
- Blackbox can write deterministic fixtures around move choice and state mutation

## 35. Immediate Implementation Recommendation

Implement in this order:

1. Add `profileType` and seeded doctrine selection to opponent creation.
2. Introduce an explicit move definition catalog with at least one full doctrine implemented end-to-end.
3. Replace generic enemy spell generation with `generateOpponentAction`.
4. Extend combat session state with cooldowns, statuses, telegraphs, and move history.
5. Publish schema changes only after the concrete payload shape is finalized.
6. Hand Claude the authoritative doctrine and telegraph fields once stable.

## 36. First Gold Standard

The first fully realized doctrine should be `Null Scribe`.

Reason:

- it directly answers the current need for anti-sound/anti-Sonic combat identity
- it is legible against existing Sonic-heavy combat assumptions
- it forces the architecture to support silence, cadence punishment, token theft, telegraphs, and signature escalation

If `Null Scribe` ships correctly, the rest of the doctrine catalog can follow the same scaffold.
