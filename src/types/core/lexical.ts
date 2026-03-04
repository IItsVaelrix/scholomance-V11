export interface Definition {
  text: string;
  partOfSpeech: string;
  source: string;
}

export interface LexicalEntry {
  word: string;
  definition: Definition | null;
  definitions: string[];
  pos: string[];
  synonyms: string[];
  antonyms: string[];
  rhymes: string[];
  slantRhymes: string[];
  etymology?: string;
  ipa?: string;
  lore?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}
