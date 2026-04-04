/**
 * Corpus Routes
 * Exposes the Scholomance Super Corpus for literary analysis and rituals.
 *
 * All errors use PB-ERR-v1 bytecode for AI-parsable diagnostics.
 */
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
} from '../../core/pixelbrain/bytecode-error.js';

const MOD = MODULE_IDS.SHARED;

export async function corpusRoutes(fastify, options) {
  const { adapter } = options;
  if (!adapter) {
    throw new BytecodeError(
      ERROR_CATEGORIES.STATE, ERROR_SEVERITY.CRIT, MOD,
      ERROR_CODES.INVALID_STATE,
      { reason: 'CorpusRoutes adapter is required', parameter: 'adapter' },
    );
  }

  // GET /api/corpus/search?q=query&limit=20
  fastify.get('/search', async (request, reply) => {
    const { q, limit } = request.query;
    if (!q) {
      return reply.status(400).send({ message: 'Query "q" is required' });
    }
    const results = adapter.searchSentences(q, limit ? parseInt(limit) : 20);
    return { query: q, results };
  });

  // GET /api/corpus/context/:id?window=2
  fastify.get('/context/:id', async (request, reply) => {
    const { id } = request.params;
    const { window } = request.query;
    const sentenceId = parseInt(id);
    if (isNaN(sentenceId)) {
      return reply.status(400).send({ message: 'Invalid sentence ID' });
    }
    const results = adapter.getSentenceContext(sentenceId, window ? parseInt(window) : 2);
    return { id: sentenceId, results };
  });
}
