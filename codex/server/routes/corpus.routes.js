/**
 * Corpus Routes
 * Exposes the Scholomance Super Corpus for literary analysis and rituals.
 */
export async function corpusRoutes(fastify, options) {
  const { adapter } = options;
  if (!adapter) {
    throw new Error('[CorpusRoutes] Adapter is required');
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
