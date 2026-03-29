import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function resolveDefaultCorpusDbPath() {
  if (typeof process.env.CORPUS_DB_PATH === 'string' && process.env.CORPUS_DB_PATH.trim()) {
    return path.resolve(process.env.CORPUS_DB_PATH.trim());
  }
  return path.join(PROJECT_ROOT, 'scholomance_corpus.sqlite');
}

export function createCorpusService(options = {}) {
  const dbPath = options.dbPath ? path.resolve(options.dbPath) : resolveDefaultCorpusDbPath();
  const log = options.log || console;
  
  let db = null;
  try {
    db = new Database(dbPath, { readonly: true });
    log.info?.(`[CorpusService] Connected to ${dbPath}`);
  } catch (error) {
    log.warn?.({ err: error, dbPath }, '[CorpusService] Failed to connect to corpus database');
  }

  /**
   * Search for sentences in the corpus using FTS5.
   * @param {string} query - FTS5 query string.
   * @param {number} limit - Max results.
   */
  function searchSentences(query, limit = 10) {
    if (!db) return [];
    try {
      const stmt = db.prepare(`
        SELECT 
          s.id, 
          s.text, 
          src.title, 
          src.author, 
          src.type as source_type
        FROM sentence_fts f
        JOIN sentence s ON s.id = f.rowid
        JOIN source src ON src.id = s.source_id
        WHERE sentence_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      return stmt.all(query, limit);
    } catch (error) {
      log.warn?.({ err: error, query }, '[CorpusService] Search failed');
      return [];
    }
  }

  /**
   * Find sentences containing specific tokens for RAG.
   * @param {string[]} tokens - List of tokens to match.
   * @param {number} limit - Max results.
   */
  function findLiteraryExamples(tokens, limit = 5) {
    if (!tokens || tokens.length === 0) return [];
    // Build a simple OR query for FTS
    const query = tokens.map(t => `"${t}"`).join(' OR ');
    return searchSentences(query, limit);
  }

  return {
    searchSentences,
    findLiteraryExamples,
    close: () => db?.close(),
  };
}
