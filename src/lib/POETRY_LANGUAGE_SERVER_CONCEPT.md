“Poetic Language Server” (PLS)

Model it like an LSP (Language Server Protocol)-style engine (even if you don’t literally use LSP at first):

Inputs (what the PLS sees)

Cursor context: current line, previous lines, stanza, section labels

Phonetic layer: CMU phones + stress + syllable counts + rhyme-part extraction

Scholomance lexicon: your dictionary entries + tags (archetype, school, taboo, era, lore entity)

Codex features (deterministic):

rhyme density, internal rhyme chains, assonance families, alliteration clusters

stress profile, cadence drift, line length variance

semantic fields (pain/void/divinity/tech/etc.)

your token weight/color distribution (your “heat map”)

User intent signals: mode toggles (“Freewrite” vs “Formal sonnet” vs “Battle bars”), active constraints

Outputs (IntelliSense “providers”)

Think of these as completion sources that compete, then a ranker orders them:

Rhyme completions

perfect rhyme (same rhyme-part)

slant rhyme / near rhyme (distance in phoneme space)

multi-syllable rhyme chaining (2–4 syllable tails)

“rhyme rescue” for end-of-line targets

Meter & stress completions

suggestions that fit the target stress grid (iambic-ish, trochaic-ish, your custom cadence)

“cadence repair” suggestions if the line drifts off-pattern

Assonance / vowel-family completions

words that continue the current vowel color family (your existing color hook now becomes a completion signal, not just UI)

Alliteration / consonant weave

maintain onset consonant patterns (e.g., c/k/g chain, sibilant chain, plosives)

Semantic & imagery completions

keep the current “image field” coherent (ocean→fishbowl→glass→drown)

controlled divergence: “surprise me, but don’t break tone”

Scholomance lore completions

proper nouns, spell names, pantheon entities, signature phrases

continuity checks: “you used The Demon as X earlier; do you mean Y here?”

Snippet completions

reusable micro-structures (not “recycled bars”)

think: rhetorical frames, bridge patterns, call-and-response, chorus scaffolds

Diagnostics & quick-fixes

“This line breaks your active constraint: end-rhyme family ER1”

“You introduced a new proper noun not in lexicon—add to Scholomance dictionary?”

(Versepad is proof that poets value syllable/meter/rhyme scheme as live features; you’re basically building the power-user + lore + Codex evolution version of that. )

Ranking: deterministic first, Codex-guided second
A. Deterministic scoring (always on)

Each candidate completion gets a vector score:

Phonetic fit

rhyme-part match (exact/near)

stress alignment

syllable delta from target

Pattern continuation

vowel-family continuity (color)

alliteration strength

internal rhyme opportunity (does it create a chain?)

Semantic coherence

embedding-ish similarity if you have it, otherwise your deterministic semantic tags

Lore constraints

dictionary flags: allowed, deprecated, taboo, “only in Eden zone”, etc.

B. Codex modulation (your “LLM-adjacent” layer)

Codex doesn’t invent candidates; it reweights:

boosts things that raise desired stats (CNWV/CINF/VOID/etc.)

penalizes drift (style mismatch, overused phrases, tonal betrayal)

keeps it explainable: “Boosted because it preserves ER1 rhyme-tail + extends VOID imagery field.”

This mirrors how “completion” systems often blend sources—simple word-based + smarter inference—then rank.

UI/UX: IntelliSense, but for verse
1) Ghost-line preview (most important)

When you arrow through suggestions:

show the completed line as a faint overlay

highlight what changed

display tiny badges: RHYME: perfect, METER: fits, COLOR: matches, CODEX: +VOID

2) Constraint chips (click-to-lock)

Above the editor:

End rhyme: ER1 (locked)

Syllables: 10±1

Vowel family: IY (locked)

Tone: lament

Lore: Eden arc

3) “Explain this suggestion”

One-liner justification:

“Matches rhyme-part ER1 P AH0 L, keeps 10 syllables, continues IY vowel weave, boosts CNWV.”
(“rhyming part” concept is straight out of CMUdict tooling. )

4) Inline diagnostics (non-annoying)

Underlines that mean something in poetry:

meter drift (soft underline)

accidental near-homophone clash (warning)

repeated end-word too soon (style warning)

lore inconsistency (Codex warning)

Data structures that make this scale
Lexicon schema (Scholomance dictionary)

Each entry as structured data:

surface: "Penne Obake"

phones: ["P EH1 N EY0 OW0 B AA1 K IY0"] (or multi-pron variants)

tags: ["lore:entity", "school:void", "register:mythic"]

constraints: { allowedContexts: [...], avoidWith: [...] }

statsBias: { VOID:+2, CNWV:+1, CINF:+1 }

Candidate index

Precompute indexes for speed:

rhyme-part → words

vowel-family signature → words

stress pattern → words

onset consonant → words

(There are existing CMUdict-based rhyme utilities and APIs that formalize rhyme-part extraction; your system can either use or mimic that behavior. )

“Tokenized weight/color distribution” as first-class IntelliSense

You already have color distribution: treat it like a constraint heatmap.

Each token has:

phonemeSignature

colorFamily

weight (importance in your analysis)

IntelliSense uses the last N tokens as a rolling “signature window”

Suggestions are ranked by minimizing divergence from the window unless the user toggles Chaos / Mutation mode

This becomes your “poetry type system”.

Minimal MVP that feels instantly powerful

If you want the smallest slice that still feels like real IntelliSense:

End-of-line rhyme targeter

detect last stressed vowel target from the line you’re rhyming against

offer candidates sorted by: rhyme strength → syllable fit → rarity

include “Add to Scholomance dict” flow

Syllable + stress fit

live syllable count and stress profile

warnings only when “constraint locked”

Color-family continuation suggestions

one hotkey: “continue this vowel weave”

This already beats generic “rhyme tools” because it’s contextual and constraint-aware.

QA checklist (regression-aware)

Perf: completions under ~50ms for typical contexts (cache rhyme-part lookups)

Determinism: same context → same ranked list (unless user toggles stochastic mode)

Fallbacks: OOV words handled (grapheme-to-phoneme fallback or “unknown phones” path)

UI coupling: ensure analysis engine outputs are UI-agnostic (you already started decoupling this)

Dictionary safety: adding custom entries never breaks CMUdict lookups (merge layer precedence)

🤔 Considerations & Potential Issues
Performance at Scale - Need incremental index updates
Ranking Weight Tuning - Start simple, use feedback to tune
OOV Handling - Need grapheme-to-phoneme fallback
Ghost-Line Preview Complexity - UI-heavy
🚀 Suggested Enhancements
Rhyme Chain Memory - Don't reuse same rhyme-part within N lines
Stanza-Aware Context - Verse form detection, section labels
Borrowed Rhyme Feature - For intentional slant rhymes
Collaboration Features - Track accepted suggestions
📋 Recommended MVP Priority
End-of-line rhyme targeter
Syllable + stress fit
Color-family continuation