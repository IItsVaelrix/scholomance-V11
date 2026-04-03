import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function resolveDefaultCorpusDbPath() {
  const envPath = process.env.SCHOLOMANCE_CORPUS_PATH || process.env.CORPUS_DB_PATH;
  if (typeof envPath === 'string' && envPath.trim()) {
    const resolved = path.resolve(envPath.trim());
    // In production, if the env path is an absolute path that doesn't exist, 
    // it's likely a synced local dev path. Fallback to /var/data.
    if (IS_PRODUCTION && path.isAbsolute(resolved) && !existsSync(resolved)) {
      const prodPath = path.join('/var/data', path.basename(resolved));
      if (existsSync(prodPath)) return prodPath;
    }
    return resolved;
  }
  
  const defaultProd = path.join('/var/data', 'scholomance_corpus.sqlite');
  if (IS_PRODUCTION && existsSync(defaultProd)) return defaultProd;
  
  return path.join(PROJECT_ROOT, 'scholomance_corpus.sqlite');
}

export function createCorpusService(options = {}) {
  const targetPath = options.dbPath ? path.resolve(options.dbPath) : resolveDefaultCorpusDbPath();
  const log = options.log || console;
  
  let db = null;

  function tryConnect() {
    if (db && db.open) return true;
    if (!targetPath || !existsSync(targetPath)) return false;

    try {
      db = new Database(targetPath, { readonly: true });
      log.info?.(`[CorpusService] Connected to ${targetPath}`);
      return true;
    } catch (error) {
      log.warn?.({ err: error.message, targetPath }, '[CorpusService] Failed to connect to corpus database');
      return false;
    }
  }

  // Initial attempt
  tryConnect();

  /**
   * Search for sentences in the corpus using FTS5.
   * @param {string} query - FTS5 query string.
   * @param {number} limit - Max results.
   */
  function searchSentences(query, limit = 10) {
    if (!tryConnect()) return [];
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
      log.warn?.({ err: error.message, query }, '[CorpusService] Search failed');
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
    close: () => {
      if (db && db.open) db.close();
    },
  };
}
