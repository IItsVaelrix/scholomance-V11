import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Adapter for the Scholomance Super Corpus SQLite database.
 * Provides full-text search and context retrieval for literary sentences.
 */
export function createCorpusAdapter(dbPath, options = {}) {
  const logger = options.log ?? console;
  const resolvedPath = typeof dbPath === 'string' && dbPath.trim()
    ? path.resolve(dbPath.trim())
    : null;

  let db = null;
  let stmts = null;

  function tryConnect() {
    if (db && db.open) return true;
    if (!resolvedPath || !existsSync(resolvedPath)) return false;

    try {
      db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
      db.pragma('query_only = ON');
      db.pragma('busy_timeout = 5000');

      // Prepared Statements
      stmts = {
        searchSentences: db.prepare(`
          SELECT s.id, s.text, src.title, src.author, src.type, src.url
          FROM sentence_fts f
          JOIN sentence s ON s.id = f.rowid
          JOIN source src ON src.id = s.source_id
          WHERE sentence_fts MATCH ?
          LIMIT ?
        `),
        getSentenceContext: db.prepare(`
          SELECT id, text
          FROM sentence
          WHERE source_id = (SELECT source_id FROM sentence WHERE id = ?)
            AND id BETWEEN (? - ?) AND (? + ?)
          ORDER BY id ASC
        `)
      };

      logger.info?.({ dbPath: resolvedPath }, '[CorpusAdapter] Connected to corpus DB.');
      return true;
    } catch (error) {
      logger.warn?.({ err: error.message, dbPath: resolvedPath }, '[CorpusAdapter] Failed to open corpus DB.');
      return false;
    }
  }

  // Initial attempt
  tryConnect();

  function searchSentences(query, limit = 20) {
    if (!tryConnect()) return [];
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];
    try {
      return stmts.searchSentences.all(sanitized, Math.min(limit, 100));
    } catch (e) {
      logger.error?.({ err: e.message, query: sanitized }, '[CorpusAdapter] Search failed');
      return [];
    }
  }

  function getSentenceContext(sentenceId, windowSize = 2) {
    if (!tryConnect()) return [];
    try {
      return stmts.getSentenceContext.all(sentenceId, sentenceId, windowSize, sentenceId, windowSize);
    } catch (e) {
      logger.error?.({ err: e.message, sentenceId }, '[CorpusAdapter] Context lookup failed');
      return [];
    }
  }

  function sanitizeFtsQuery(raw) {
    const query = String(raw ?? '').trim();
    if (!query) return '';
    return query
      .replace(/\b(?:AND|OR|NOT|NEAR)\b/gi, ' ')
      .replace(/["'*:^(){}[\]|+\-~\\/<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function close() {
    if (db && db.open) db.close();
  }

  return {
    searchSentences,
    getSentenceContext,
    close,
    __unsafe: {
      get connected() { return !!(db && db.open); },
      get dbPath() { return resolvedPath; }
    }
  };
}

function createEmptyAdapter() {
  return {
    searchSentences: () => [],
    getSentenceContext: () => [],
    close: () => {},
    __unsafe: { connected: false, dbPath: null }
  };
}
