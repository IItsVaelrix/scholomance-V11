/**
 * Server-side route for unified Read panel analysis payloads.
 * Backend-first source of truth for rhyme, scheme, score, and vowel panels.
 */

import { z } from 'zod';
import { createPanelAnalysisService } from '../services/panelAnalysis.service.js';

const MAX_TEXT_LENGTH = 500_000;

const panelAnalysisBodySchema = z.object({
  text: z.string().max(MAX_TEXT_LENGTH),
});

/**
 * Registers panel analysis routes on the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {Object} _opts
 */
export async function panelAnalysisRoutes(fastify, _opts) {
  const panelAnalysisService = createPanelAnalysisService({
    log: fastify.log,
  });

  fastify.post('/api/analysis/panels', {
    config: {
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
    handler: async (request, reply) => {
      const parsed = panelAnalysisBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parsed.error.issues,
        });
      }

      const data = panelAnalysisService.analyzePanels(parsed.data.text);
      return {
        source: 'server-analysis',
        data,
      };
    },
  });
}
