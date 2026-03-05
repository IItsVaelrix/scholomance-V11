import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { createLexiconAdapter } from '../../codex/server/adapters/lexicon.sqlite.adapter.js';

function createFixtureDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE entry (
      id INTEGER PRIMARY KEY,
      headword TEXT NOT NULL,
      headword_lower TEXT NOT NULL,
      lang TEXT NOT NULL,
      pos TEXT,
      ipa TEXT,
      etymology TEXT,
      senses_json TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT
    );

    CREATE VIRTUAL TABLE entry_fts USING fts5(
      headword,
      content,
      tokenize='unicode61',
      prefix='2 3 4'
    );

    CREATE TABLE rhyme_index (
      word_id INTEGER PRIMARY KEY,
      word_lower TEXT NOT NULL,
      rhyme_family TEXT NOT NULL,
      coda TEXT,
      rhyme_key TEXT NOT NULL
    );

    CREATE TABLE wordnet_lemma (
      lemma TEXT NOT NULL,
      lemma_lower TEXT NOT NULL,
      synset_id TEXT NOT NULL,
      sense_rank INTEGER,
      pos TEXT,
      source TEXT NOT NULL,
      source_url TEXT
    );

    CREATE TABLE wordnet_rel (
      synset_id TEXT NOT NULL,
      rel TEXT NOT NULL,
      target_synset_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT
    );
  `);

  const entries = db.prepare(`
    INSERT INTO entry(id, headword, headword_lower, lang, pos, ipa, etymology, senses_json, source, source_url)
    VALUES (?, ?, ?, 'English', ?, ?, ?, ?, ?, ?)
  `);

  entries.run(
    1,
    'Arcana',
    'arcana',
    'noun',
    'AA R K AA N AH',
    null,
    JSON.stringify([{ glosses: ['Secret knowledge'] }]),
    'oewn',
    'https://en-word.net/',
  );
  entries.run(
    2,
    'Banana',
    'banana',
    'noun',
    'B AH N AE N AH',
    null,
    JSON.stringify([{ glosses: ['A yellow fruit'] }]),
    'oewn',
    'https://en-word.net/',
  );
  entries.run(
    3,
    'Cabana',
    'cabana',
    'noun',
    'K AH B AE N AH',
    null,
    JSON.stringify([{ glosses: ['A small shelter'] }]),
    'oewn',
    'https://en-word.net/',
  );

  const fts = db.prepare('INSERT INTO entry_fts(rowid, headword, content) VALUES (?, ?, ?)');
  fts.run(1, 'Arcana', 'Secret knowledge of rites');
  fts.run(2, 'Banana', 'A yellow fruit');
  fts.run(3, 'Cabana', 'A small shelter');

  const rhymes = db.prepare(`
    INSERT INTO rhyme_index(word_id, word_lower, rhyme_family, coda, rhyme_key)
    VALUES (?, ?, ?, ?, ?)
  `);
  rhymes.run(1, 'arcana', 'AA', 'N', 'AA-N');
  rhymes.run(2, 'banana', 'AA', 'N', 'AA-N');
  rhymes.run(3, 'cabana', 'AA', 'N', 'AA-N');

  const lemmas = db.prepare(`
    INSERT INTO wordnet_lemma(lemma, lemma_lower, synset_id, sense_rank, pos, source, source_url)
    VALUES (?, ?, ?, ?, ?, 'oewn', 'https://en-word.net/')
  `);
  lemmas.run('arcana', 'arcana', 'syn.arcana', 1, 'noun');
  lemmas.run('mystery', 'mystery', 'syn.arcana', 2, 'noun');
  lemmas.run('enigma', 'enigma', 'syn.arcana', 3, 'noun');
  lemmas.run('banality', 'banality', 'syn.banal', 1, 'noun');

  const rels = db.prepare(`
    INSERT INTO wordnet_rel(synset_id, rel, target_synset_id, source, source_url)
    VALUES (?, ?, ?, 'oewn', 'https://en-word.net/')
  `);
  rels.run('syn.arcana', 'antonym', 'syn.banal');

  db.close();
}

describe('[Server] lexicon.sqlite.adapter', () => {
  let tempDir = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('returns empty-safe methods when db path is missing', () => {
    const warn = vi.fn();
    const adapter = createLexiconAdapter('', { log: { warn } });

    expect(adapter.lookupWord('arcana')).toEqual([]);
    expect(adapter.lookupRhymes('arcana')).toEqual({ family: null, words: [] });
    expect(adapter.batchLookupFamilies(['arcana'])).toEqual({});
    expect(adapter.batchValidateWords(['arcana'])).toEqual([]);
    expect(adapter.searchEntries('arcana')).toEqual([]);
    expect(adapter.suggestEntries('ar')).toEqual([]);
    expect(() => adapter.close()).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('supports lookup, rhyme, and batch operations against sqlite', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'lexicon-adapter-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    createFixtureDb(dbPath);
    const adapter = createLexiconAdapter(dbPath);

    const entries = adapter.lookupWord('Arcana');
    expect(entries).toHaveLength(1);
    expect(entries[0].headword).toBe('Arcana');
    expect(entries[0].senses[0].glosses[0]).toBe('Secret knowledge');

    const rhymes = adapter.lookupRhymes('arcana');
    expect(rhymes.family).toBe('AA');
    expect(rhymes.words).toEqual(['banana', 'cabana']);

    const families = adapter.batchLookupFamilies(['arcana', 'banana', 'unknown']);
    expect(families).toEqual({
      ARCANA: 'AA',
      BANANA: 'AA',
    });

    const valid = adapter.batchValidateWords(['Arcana', 'banana', 'unknown']);
    expect(valid).toEqual(['arcana', 'banana']);

    adapter.close();
  });

  it('supports search/suggest and sanitizes unsafe FTS input', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'lexicon-adapter-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    createFixtureDb(dbPath);
    const adapter = createLexiconAdapter(dbPath);

    const search = adapter.searchEntries('secret', 20);
    expect(search.map((entry) => entry.headword)).toEqual(['Arcana']);

    const unsafe = adapter.searchEntries('" OR *', 20);
    expect(unsafe).toEqual([]);

    const suggestions = adapter.suggestEntries('ba', 20);
    expect(suggestions).toEqual([{ headword: 'Banana', pos: 'noun' }]);

    adapter.close();
  });
});
