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

  if (!resolvedPath) {
    logger.warn?.('[CorpusAdapter] SCHOLOMANCE_CORPUS_PATH is not set. Corpus routes will return empty results.');
    return createEmptyAdapter();
  }

  if (!existsSync(resolvedPath)) {
    logger.warn?.({ dbPath: resolvedPath }, '[CorpusAdapter] Corpus DB file not found. Corpus routes will return empty results.');
    return createEmptyAdapter();
  }

  let db;
  try {
    db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    db.pragma('busy_timeout = 5000');
  } catch (error) {
    logger.warn?.({ err: error, dbPath: resolvedPath }, '[CorpusAdapter] Failed to open corpus DB. Corpus routes will return empty results.');
    return createEmptyAdapter();
  }

  // Prepared Statements
  const searchSentencesStmt = db.prepare(`
    SELECT s.id, s.text, src.title, src.author, src.type, src.url
    FROM sentence_fts f
    JOIN sentence s ON s.id = f.rowid
    JOIN source src ON src.id = s.source_id
    WHERE sentence_fts MATCH ?
    LIMIT ?
  `);

  const getSentenceContextStmt = db.prepare(`
    SELECT id, text
    FROM sentence
    WHERE source_id = (SELECT source_id FROM sentence WHERE id = ?)
      AND id BETWEEN (? - ?) AND (? + ?)
    ORDER BY id ASC
  `);

  function searchSentences(query, limit = 20) {
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];
    try {
      return searchSentencesStmt.all(sanitized, Math.min(limit, 100));
    } catch (e) {
      logger.error?.({ err: e, query: sanitized }, '[CorpusAdapter] Search failed');
      return [];
    }
  }

  function getSentenceContext(sentenceId, windowSize = 2) {
    try {
      return getSentenceContextStmt.all(sentenceId, sentenceId, windowSize, sentenceId, windowSize);
    } catch (e) {
      logger.error?.({ err: e, sentenceId }, '[CorpusAdapter] Context lookup failed');
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
    if (db?.open) db.close();
  }

  return {
    searchSentences,
    getSentenceContext,
    close,
    __unsafe: {
      connected: true,
      dbPath: resolvedPath
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
