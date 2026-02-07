/**
 * @typedef {Object} Scroll
 * @property {string} id - Unique identifier for the scroll.
 * @property {string} title - The title of the scroll.
 * @property {string} content - The text content of the scroll.
 * @property {number} createdAt - Timestamp of when the scroll was created.
 * @property {number} updatedAt - Timestamp of when the scroll was last updated.
 * @property {string} authorId - The ID of the user who authored the scroll.
 */

/**
 * @typedef {Object} PhonemeAnalysis
 * @property {string} vowelFamily - The primary vowel family identified (e.g., "AY", "IY").
 * @property {string[]} phonemes - An array of phonemes in the word.
 * @property {string|null} coda - The consonant cluster at the end of the syllable.
 * @property {string} rhymeKey - A key for determining rhymes, typically `{vowelFamily}-{coda}`.
 */

/**
 * @typedef {Object} CombatAction
 * @property {string} scrollId - The ID of the scroll being used.
 * @property {string[]} lines - The specific lines of text being used in the action.
 * @property {number} timestamp - Timestamp of the combat action.
 * @property {string} playerId - The ID of the player performing the action.
 */

/**
 * @typedef {Object} ScoreTrace
 * @property {string} heuristic - The name of the scoring heuristic (e.g., "phoneme_density").
 * @property {number} rawScore - The score from 0.0 to 1.0 before weighting.
 * @property {number} weight - The weight of this heuristic in the total score.
 * @property {number} contribution - The final contribution to the total score (rawScore * weight * scale).
 * @property {string} explanation - A human-readable explanation of the score.
 */

/**
 * @typedef {Object} CombatResult
 * @property {number} damage - The total damage dealt.
 * @property {string[]} statusEffects - Any status effects applied.
 * @property {Object} resourceChanges - Changes to player resources (e.g., mana, health).
 * @property {ScoreTrace[]} explainTrace - An array of traces detailing how the score was calculated.
 */

/**
 * @typedef {Object} XPEvent
 * @property {string} source - The source of the XP gain (e.g., "scroll_created", "combat_victory").
 * @property {number} amount - The amount of XP gained.
 * @property {number} timestamp - Timestamp of the event.
 * @property {string} playerId - The ID of the player receiving the XP.
 * @property {Object} [context] - Additional context for the event.
 */

/**
 * @typedef {Object} Definition
 * @property {string} text - The definition text.
 * @property {string} partOfSpeech - Part of speech (noun, verb, etc.).
 * @property {string} source - The source of this definition (WordNet, GCIDE, Datamuse, etc.).
 */

/**
 * @typedef {Object} LexicalEntry
 * @property {string} word - The word itself.
 * @property {Definition|null} definition - Primary definition object.
 * @property {string[]} definitions - An array of all definition texts.
 * @property {string[]} pos - Parts of speech.
 * @property {string[]} synonyms - An array of synonyms.
 * @property {string[]} antonyms - An array of antonyms.
 * @property {string[]} rhymes - An array of rhyming words.
 * @property {string} [etymology] - The word's origin.
 * @property {string} [ipa] - The IPA pronunciation.
 * @property {Object} [lore] - MUD-specific lore data.
 * @property {Object} [raw] - Raw response from the data source (for debugging).
 */

/**
 * Creates an empty LexicalEntry with default values.
 * @param {string} word - The word to create an entry for.
 * @returns {LexicalEntry} An empty lexical entry.
 */
export function createEmptyLexicalEntry(word) {
  return {
    word: word.toUpperCase(),
    definition: null,
    definitions: [],
    pos: [],
    synonyms: [],
    antonyms: [],
    rhymes: [],
    etymology: undefined,
    ipa: undefined,
    lore: undefined,
    raw: undefined,
  };
}

/**
 * Merges two LexicalEntry objects, preferring non-empty values from the second entry.
 * @param {LexicalEntry} base - The base entry.
 * @param {Partial<LexicalEntry>} overlay - Values to overlay on the base.
 * @returns {LexicalEntry} The merged entry.
 */
export function mergeLexicalEntries(base, overlay) {
  return {
    word: overlay.word || base.word,
    definition: overlay.definition ?? base.definition,
    definitions: overlay.definitions?.length ? overlay.definitions : base.definitions,
    pos: overlay.pos?.length ? overlay.pos : base.pos,
    synonyms: overlay.synonyms?.length ? overlay.synonyms : base.synonyms,
    antonyms: overlay.antonyms?.length ? overlay.antonyms : base.antonyms,
    rhymes: overlay.rhymes?.length ? overlay.rhymes : base.rhymes,
    etymology: overlay.etymology ?? base.etymology,
    ipa: overlay.ipa ?? base.ipa,
    lore: overlay.lore ?? base.lore,
    raw: overlay.raw ?? base.raw,
  };
}

// This is just for type definitions, so we export an empty object.
export const schemas = {};