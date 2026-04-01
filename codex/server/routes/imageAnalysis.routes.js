/**
 * IMAGE ANALYSIS ROUTES
 * 
 * POST /api/image/analyze - Upload and analyze reference image
 */

import { analyzeReferenceImage } from '../services/imageAnalysis.service.js';

/**
 * @param {import('fastify').FastifyInstance} app
 */
export async function imageAnalysisRoutes(app) {
  // Upload and analyze reference image
  app.post('/analyze', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            analysis: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Parse multipart form data
      const data = await request.file({
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB max
          files: 1,
        },
      });

      if (!data || !data.file) {
        app.log.warn('Upload attempt with no file or invalid data');
        return reply.status(400).send({
          error: 'No image file provided. Upload a PNG, JPEG, or BMP image.',
        });
      }

      // Validate file type
      // REFINED: Fastify-multipart can store mimetype in different locations depending on version/config
      const mimetype = data.mimetype || data.file?.mimetype || data.file?.headers?.['content-type'];
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
      
      if (!mimetype || !allowedTypes.includes(mimetype)) {
        app.log.warn({ mimetype, filename: data.filename }, 'Rejected upload due to invalid/missing mimetype');
        return reply.status(400).send({
          error: `Unsupported image type: ${mimetype || 'unknown'}. Use PNG, JPEG, or BMP.`,
        });
      }

      // Read file buffer
      // FIX: Consume the buffer from the file stream correctly
      const buffer = await data.toBuffer();

      // Validate buffer was created
      if (!buffer || buffer.length === 0) {
        app.log.warn({ bufferSize: buffer?.length, filename: data.filename }, 'Received empty or invalid buffer');
        return reply.status(400).send({
          error: 'Failed to read image data. The file may be corrupted or empty.',
        });
      }

      // Get optional description
      const description = data.fields.description?.value || '';

      // Analyze image (pass mimetype for proper format detection)
      const analysis = await analyzeReferenceImage(buffer, mimetype);

      // Add user description to semantic params
      if (description) {
        analysis.userDescription = description;
      }

      return reply.send({
        success: true,
        analysis,
      });
    } catch (error) {
      app.log.error({ error }, 'Image analysis failed');
      
      if (error.message.includes('Unsupported image format')) {
        return reply.status(400).send({
          error: error.message,
        });
      }

      return reply.status(500).send({
        error: 'Image analysis failed. Please try again.',
      });
    }
  });

  // Simple JSON-based endpoint for base64 images (alternative to multipart)
  app.post('/analyze/base64', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['imageData'],
        properties: {
          imageData: {
            type: 'string',
            description: 'Base64-encoded image data',
          },
          description: {
            type: 'string',
            maxLength: 500,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            analysis: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { imageData, description } = request.body;

      // Decode base64
      const buffer = Buffer.from(imageData, 'base64');

      // Analyze image
      const analysis = await analyzeReferenceImage(buffer);

      // Add user description
      if (description) {
        analysis.userDescription = description;
      }

      return reply.send({
        success: true,
        analysis,
      });
    } catch (error) {
      app.log.error({ error }, 'Base64 image analysis failed');
      
      if (error.message.includes('Unsupported image format')) {
        return reply.status(400).send({
          error: error.message,
        });
      }

      return reply.status(500).send({
        error: 'Image analysis failed. Please try again.',
      });
    }
  });
}
