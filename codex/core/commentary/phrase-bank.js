/**
 * Static criticism phrase bank used by CODEx heuristic commentary.
 * Curated for deterministic offline commentary generation.
 */

function freezeEntry(entry) {
  return Object.freeze({
    concept: String(entry?.concept || "craft signal"),
    citations: Object.freeze(Array.isArray(entry?.citations) ? entry.citations.map((citation) => Object.freeze({
      quote: String(citation?.quote || ""),
      attribution: String(citation?.attribution || ""),
    })) : []),
    bridges: Object.freeze(Array.isArray(entry?.bridges) ? entry.bridges.map((bridge) => String(bridge || "")) : []),
    closers: Object.freeze(Array.isArray(entry?.closers) ? entry.closers.map((closer) => String(closer || "")) : []),
  });
}

const DEFAULT_COMMENTARY_ENTRY = freezeEntry({
  concept: "craft signal",
  citations: [
    {
      quote: "Poetry is the spontaneous overflow of powerful feelings",
      attribution: "Wordsworth, Preface to Lyrical Ballads (PG 5600)",
    },
  ],
  bridges: [
    "The critical tradition weighs form and feeling together.",
    "Classical criticism reads technique as meaning, not decoration.",
  ],
  closers: [
    "The signal is coherent with the song's present diction.",
    "The craft reading supports what the lyric is already doing.",
  ],
});

export const PHRASE_BANK = Object.freeze({
  phoneme_density: freezeEntry({
    concept: "sonic texture",
    citations: [
      {
        quote: "The sound must seem an echo to the sense",
        attribution: "Pope, An Essay on Criticism (PG 2612)",
      },
      {
        quote: "Poetry is the breath and finer spirit of all knowledge",
        attribution: "Wordsworth, Preface to Lyrical Ballads (PG 5600)",
      },
    ],
    bridges: [
      "Criticism here asks whether phonetic pattern carries semantic intent.",
      "The ear is treated as an index of line-level intelligence.",
    ],
    closers: [
      "This texture reads deliberate rather than incidental.",
      "The sound design strengthens the line's semantic gravity.",
    ],
  }),
  alliteration_density: freezeEntry({
    concept: "consonant chaining",
    citations: [
      {
        quote: "The sound must seem an echo to the sense",
        attribution: "Pope, An Essay on Criticism (PG 2612)",
      },
      {
        quote: "Sublimity is the echo of a great soul",
        attribution: "Longinus, On the Sublime (PG 6081)",
      },
    ],
    bridges: [
      "Repetition at line onset can be rhetorical architecture, not ornament.",
      "Initial-consonant recurrence is read as emphasis and memory scaffolding.",
    ],
    closers: [
      "The chain lands as controlled emphasis.",
      "The recurrence sharpens the lyric's attack.",
    ],
  }),
  rhyme_quality: freezeEntry({
    concept: "echo architecture",
    citations: [
      {
        quote: "The sound must seem an echo to the sense",
        attribution: "Pope, An Essay on Criticism (PG 2612)",
      },
      {
        quote: "Poetry is an imitation of action",
        attribution: "Aristotle, Poetics (PG 1974)",
      },
    ],
    bridges: [
      "Rhyme is judged by structural coherence and meaningful return.",
      "The pattern is strongest when recurrence advances motion, not just closure.",
    ],
    closers: [
      "The rhyme net supports narrative continuity.",
      "The return pattern stays legible under close reading.",
    ],
  }),
  meter_regularity: freezeEntry({
    concept: "metrical cadence",
    citations: [
      {
        quote: "There is not, or never has been, any essential difference between the language of prose and metrical composition",
        attribution: "Wordsworth, Preface to Lyrical Ballads (PG 5600)",
      },
      {
        quote: "No man was ever yet a great poet, without being at the same time a profound philosopher",
        attribution: "Coleridge, Biographia Literaria (PG 7700)",
      },
    ],
    bridges: [
      "Cadence is read as the operating tempo of thought.",
      "Regularity is valued when it serves emotional pacing.",
    ],
    closers: [
      "The metrical discipline remains mostly stable.",
      "The cadence control keeps the delivery intentional.",
    ],
  }),
  vocabulary_richness: freezeEntry({
    concept: "diction range",
    citations: [
      {
        quote: "True wit is nature to advantage dressed",
        attribution: "Pope, An Essay on Criticism (PG 2612)",
      },
      {
        quote: "Poetry is of all human learning the most ancient and of most fatherly antiquity",
        attribution: "Sidney, Defence of Poesy (PG 1265)",
      },
    ],
    bridges: [
      "Lexical choice is read for precision, freshness, and register control.",
      "Range matters less than fit: diction should match pressure and theme.",
    ],
    closers: [
      "The lexical palette contributes usable contrast.",
      "Word choice shows measured selection rather than noise.",
    ],
  }),
  literary_device_richness: freezeEntry({
    concept: "rhetorical layering",
    citations: [
      {
        quote: "Sublimity is the echo of a great soul",
        attribution: "Longinus, On the Sublime (PG 6081)",
      },
      {
        quote: "Poetry therefore is an art of imitation",
        attribution: "Aristotle, Poetics (PG 1974)",
      },
    ],
    bridges: [
      "Device density is read as rhetorical layering, not mere decoration.",
      "Patterns of figure and motif indicate intentional craft pressure.",
    ],
    closers: [
      "The device mix creates a durable interpretive surface.",
      "The rhetorical texture sustains close analysis.",
    ],
  }),
  scroll_power: freezeEntry({
    concept: "coherence pressure",
    citations: [
      {
        quote: "Poetry is the spontaneous overflow of powerful feelings",
        attribution: "Wordsworth, Preface to Lyrical Ballads (PG 5600)",
      },
      {
        quote: "Sublimity is the echo of a great soul",
        attribution: "Longinus, On the Sublime (PG 6081)",
      },
    ],
    bridges: [
      "Power is read as the coupling between formal order and emotional force.",
      "The score tracks how cohesion and intensity reinforce each other.",
    ],
    closers: [
      "The line system holds under pressure.",
      "Form and force are aligned more often than they conflict.",
    ],
  }),
  phonetic_hacking: freezeEntry({
    concept: "vowel strategy",
    citations: [
      {
        quote: "The sound must seem an echo to the sense",
        attribution: "Pope, An Essay on Criticism (PG 2612)",
      },
      {
        quote: "Poetry is an imitation of action",
        attribution: "Aristotle, Poetics (PG 1974)",
      },
    ],
    bridges: [
      "Vowel-family concentration is interpreted as directed resonance.",
      "Phonetic clustering is strongest when it supports scene and tone.",
    ],
    closers: [
      "The resonance profile appears intentionally steered.",
      "The vowel logic gives the lyric a repeatable contour.",
    ],
  }),
  emotional_resonance: freezeEntry({
    concept: "affective continuity",
    citations: [
      {
        quote: "Poetry is the spontaneous overflow of powerful feelings",
        attribution: "Wordsworth, Preface to Lyrical Ballads (PG 5600)",
      },
      {
        quote: "Sublimity is the echo of a great soul",
        attribution: "Longinus, On the Sublime (PG 6081)",
      },
    ],
    bridges: [
      "Emotion is judged by continuity and escalation, not isolated intensity.",
      "The dominant affect is strongest when repeated through structural pivots.",
    ],
    closers: [
      "The emotional arc reads coherent across the stanza flow.",
      "Affective pressure persists beyond single-line peaks.",
    ],
  }),
  default: DEFAULT_COMMENTARY_ENTRY,
});

export { DEFAULT_COMMENTARY_ENTRY };

