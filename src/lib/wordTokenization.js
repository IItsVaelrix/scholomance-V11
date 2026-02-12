/**
 * Shared word-tokenization patterns used by analysis, rhyme, and Truesight
 * rendering. Keeping one canonical definition prevents offset drift between
 * engines and UI overlays.
 */

export const WORD_PATTERN = "[A-Za-z]+(?:['-][A-Za-z]+)*";
export const WORD_REGEX_GLOBAL = new RegExp(WORD_PATTERN, "g");
export const WORD_TOKEN_REGEX = new RegExp(`^${WORD_PATTERN}$`);
export const LINE_TOKEN_REGEX = new RegExp(`${WORD_PATTERN}|\\s+|[^A-Za-z'\\s]+`, "g");
