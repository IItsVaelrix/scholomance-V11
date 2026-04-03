import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';

const DEFAULT_LOOKUP_LIMIT = 5;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SUGGEST_LIMIT = 20;
const DEFAULT_RHYME_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeWord(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function toBoundedLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

function parseJsonArray(value) {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractGloss(senses) {
  if (!Array.isArray(senses)) return null;
  for (const sense of senses) {
    if (!sense || typeof sense !== 'object') continue;
    for (const key of ['glosses', 'raw_glosses', 'definitions']) {
      const list = sense[key];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (typeof item === 'string' && item.trim()) {
          return item.trim();
        }
      }
    }
    for (const key of ['definition', 'gloss']) {
      const value = sense[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
}

function normalizeEntry(row) {
  const senses = parseJsonArray(row.senses_json);
  return {
    id: row.id,
    headword: row.headword,
    pos: row.pos,
    ipa: row.ipa,
    etymology: row.etymology,
    senses,
    source: row.source,
    sourceUrl: row.source_url,
  };
}

function sanitizeFtsQuery(raw) {
  const query = String(raw ?? '').trim();
  if (!query) return '';
  const strippedOperators = query
    .replace(/\b(?:AND|OR|NOT|NEAR)\b/gi, ' ')
    .replace(/["'*:^(){}[\]|+\-~\\/<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = strippedOperators
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .join(' ');
  return normalized;
}

function createEmptyAdapter() {
  const emptyRhyme = Object.freeze({ family: null, words: [] });
  return {
    lookupWord() {
      return [];
    },
    lookupRhymes() {
      return emptyRhyme;
    },
    batchLookupFamilies() {
      return {};
    },
    batchValidateWords() {
      return [];
    },
    searchEntries() {
      return [];
    },
    suggestEntries() {
      return [];
    },
    close() {},
    __unsafe: {
      connected: false,
      dbPath: null,
    },
  };
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function resolveDbPath(dbPath) {
  if (typeof dbPath !== 'string' || !dbPath.trim()) return null;
  const resolved = path.resolve(dbPath.trim());
  
  // In production, if the env path is an absolute path that doesn't exist,
  // it's likely a synced local dev path. Fallback to /var/data.
  if (IS_PRODUCTION && path.isAbsolute(resolved) && !existsSync(resolved)) {
    const prodPath = path.join('/var/data', path.basename(resolved));
    if (existsSync(prodPath)) return prodPath;
  }
  return resolved;
}

export function createLexiconAdapter(dbPath, options = {}) {
  const logger = options.log ?? console;
  const resolvedPath = resolveDbPath(dbPath);

  let db = null;
  let stmts = null;
  const familyBatchStmtCache = new Map();
  const validateBatchStmtCache = new Map();

  function tryConnect() {
    if (db && db.open) return true;
    if (!resolvedPath || !existsSync(resolvedPath)) return false;

    try {
      db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
      db.pragma('query_only = ON');
      db.pragma('busy_timeout = 5000');
      
      stmts = {
        lookupEntries: db.prepare(`
          SELECT id, headword, pos, ipa, etymology, senses_json, source, source_url
          FROM entry
          WHERE headword_lower = ?
          LIMIT ?
        `),
        lookupRhymeFamily: db.prepare(`
          SELECT rhyme_family, ipa
          FROM rhyme_index
          LEFT JOIN entry ON entry.headword_lower = rhyme_index.word_lower
          WHERE word_lower = ?
        `),
        lookupRhymes: db.prepare(`
          SELECT word_lower
          FROM rhyme_index
          WHERE rhyme_family = ? AND word_lower != ?
          LIMIT ?
        `),
        lookupSynonyms: db.prepare(`
          SELECT l2.lemma AS lemma
          FROM wordnet_lemma l1
          JOIN wordnet_lemma l2 ON l1.synset_id = l2.synset_id
          WHERE l1.lemma_lower = ?
          LIMIT ?
        `),
        lookupAntonyms: db.prepare(`
          SELECT l2.lemma AS lemma
          FROM wordnet_lemma l1
          JOIN wordnet_rel r ON l1.synset_id = r.synset_id
          JOIN wordnet_lemma l2 ON r.target_synset_id = l2.synset_id
          WHERE l1.lemma_lower = ? AND r.rel = 'antonym'
          LIMIT ?
        `),
        searchEntries: db.prepare(`
          SELECT e.id, e.headword, e.pos, e.ipa, e.etymology, e.senses_json, e.source, e.source_url
          FROM entry_fts f
          JOIN entry e ON e.id = f.rowid
          WHERE entry_fts MATCH ?
          LIMIT ?
        `),
        suggestEntries: db.prepare(`
          SELECT headword, pos
          FROM entry
          WHERE headword_lower LIKE ?
          LIMIT ?
        `)
      };
      
      logger.info?.({ dbPath: resolvedPath }, '[LexiconAdapter] Connected to dictionary DB.');
      return true;
    } catch (error) {
      logger.warn?.({ err: error.message, dbPath: resolvedPath }, '[LexiconAdapter] Failed to open dictionary DB.');
      return false;
    }
  }

  // Initial connection attempt
  tryConnect();

  function lookupWord(word, limit = DEFAULT_LOOKUP_LIMIT) {
    if (!tryConnect()) return [];
    const normalized = normalizeWord(word);
    if (!normalized) return [];
    const boundedLimit = toBoundedLimit(limit, DEFAULT_LOOKUP_LIMIT);
    const rows = stmts.lookupEntries.all(normalized, boundedLimit);
    return rows.map(normalizeEntry);
  }

  function lookupRhymes(word, limit = DEFAULT_RHYME_LIMIT) {
    if (!tryConnect()) return { family: null, words: [] };
    const normalized = normalizeWord(word);
    if (!normalized) return { family: null, words: [] };
    const familyRow = stmts.lookupRhymeFamily.get(normalized);
    if (!familyRow?.rhyme_family) {
      return { family: null, words: [] };
    }
    const boundedLimit = toBoundedLimit(limit, DEFAULT_RHYME_LIMIT);
    const rows = stmts.lookupRhymes.all(familyRow.rhyme_family, normalized, boundedLimit);
    return {
      family: familyRow.rhyme_family,
      words: rows.map((row) => row.word_lower),
    };
  }

  function batchLookupFamilies(words) {
    if (!tryConnect()) return {};
    const normalized = [...new Set((Array.isArray(words) ? words : [])
      .map(normalizeWord)
      .filter(Boolean))];
    if (normalized.length === 0) return {};
    const placeholderCount = normalized.length;
    let statement = familyBatchStmtCache.get(placeholderCount);
    if (!statement) {
      const placeholders = normalized.map(() => '?').join(', ');
      statement = db.prepare(`
        SELECT word_lower, rhyme_family, ipa
        FROM rhyme_index
        LEFT JOIN entry ON entry.headword_lower = rhyme_index.word_lower
        WHERE word_lower IN (${placeholders})
      `);
      familyBatchStmtCache.set(placeholderCount, statement);
    }
    const rows = statement.all(...normalized);
    const out = {};
    for (const row of rows) {
      if (!row?.word_lower || !row?.rhyme_family) continue;
      out[row.word_lower.toUpperCase()] = {
        family: row.rhyme_family,
        phonemes: row.ipa ? row.ipa.split(' ') : null,
      };
    }
    return out;
  }

  function batchValidateWords(words) {
    if (!tryConnect()) return [];
    const normalized = [...new Set((Array.isArray(words) ? words : [])
      .map(normalizeWord)
      .filter(Boolean))].sort();
    if (normalized.length === 0) return [];
    const placeholderCount = normalized.length;
    let statement = validateBatchStmtCache.get(placeholderCount);
    if (!statement) {
      const placeholders = normalized.map(() => '?').join(', ');
      statement = db.prepare(`
        SELECT DISTINCT headword_lower
        FROM entry
        WHERE headword_lower IN (${placeholders})
      `);
      validateBatchStmtCache.set(placeholderCount, statement);
    }
    const rows = statement.all(...normalized);
    return rows
      .map((row) => row?.headword_lower)
      .filter((word) => typeof word === 'string' && word.length > 0);
  }

  function lookupSynonyms(word, limit = 20) {
    if (!tryConnect()) return [];
    const normalized = normalizeWord(word);
    if (!normalized) return [];
    const boundedLimit = toBoundedLimit(limit + 10, 30);
    const rows = stmts.lookupSynonyms.all(normalized, boundedLimit);
    return sanitizeLemmaRows(rows, normalized, limit);
  }

  function lookupAntonyms(word, limit = 20) {
    if (!tryConnect()) return [];
    const normalized = normalizeWord(word);
    if (!normalized) return [];
    const boundedLimit = toBoundedLimit(limit + 10, 30);
    const rows = stmts.lookupAntonyms.all(normalized, boundedLimit);
    return sanitizeLemmaRows(rows, normalized, limit);
  }

  function searchEntries(query, limit = DEFAULT_SEARCH_LIMIT) {
    if (!tryConnect()) return [];
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];
    const boundedLimit = toBoundedLimit(limit, DEFAULT_SEARCH_LIMIT);
    try {
      const rows = stmts.searchEntries.all(sanitized, boundedLimit);
      return rows.map(normalizeEntry);
    } catch {
      return [];
    }
  }

  function suggestEntries(prefix, limit = DEFAULT_SUGGEST_LIMIT) {
    if (!tryConnect()) return [];
    const normalized = normalizeWord(prefix);
    if (!normalized) return [];
    const boundedLimit = toBoundedLimit(limit, DEFAULT_SUGGEST_LIMIT);
    const rows = stmts.suggestEntries.all(`${normalized}%`, boundedLimit);
    return rows.map((row) => ({
      headword: row.headword,
      pos: row.pos,
    }));
  }

  function close() {
    if (db && db.open) {
      db.close();
    }
  }

  return {
    lookupWord,
    lookupRhymes,
    batchLookupFamilies,
    batchValidateWords,
    searchEntries,
    suggestEntries,
    lookupSynonyms,
    lookupAntonyms,
    extractGloss,
    close,
    __unsafe: {
      get connected() { return !!(db && db.open); },
      get dbPath() { return resolvedPath; },
    },
  };
}
