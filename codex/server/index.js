/**
 * The CODEx Authority Server entry point.
 * Built with Fastify.
 *
 * @see AI_Architecture_V2.md section 3.1, 5.2, and 8.3
 */

import 'dotenv/config';

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { RedisStore } from 'connect-redis';
import csrf from '@fastify/csrf-protection';
import { createClient } from 'redis';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import crypto from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, createWriteStream, unlinkSync, renameSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { requireAuth } from './auth-pre-handler.js';
import { persistence } from './persistence.adapter.js';
import { collabPersistence } from './collab/collab.persistence.js';
import { collabRoutes } from './collab/collab.routes.js';
import { wordLookupRoutes } from './routes/wordLookup.routes.js';
import { panelAnalysisRoutes } from './routes/panelAnalysis.routes.js';
import { lexiconRoutes } from './routes/lexicon.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { isApiRoutePath, isStaticAssetPath, stripQueryFromUrl } from './notFound.utils.js';
import { createOpsMetrics } from './observability.metrics.js';
import { PhonemeEngine } from '../../src/lib/phonology/phoneme.engine.js';
import { authorizeAudioRequest, buildAudioUnauthorizedPayload } from './audioAuth.js';
import { createLexiconAdapter } from './adapters/lexicon.sqlite.adapter.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST_RUNTIME =
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    typeof process.env.VITEST_WORKER_ID !== 'undefined' ||
    typeof process.env.JEST_WORKER_ID !== 'undefined';

function parseBooleanEnv(name, defaultValue = false) {
    const rawValue = process.env[name];
    if (rawValue === undefined) {
        return defaultValue;
    }
    if (rawValue === 'true') {
        return true;
    }
    if (rawValue === 'false') {
        return false;
    }
    throw new Error(`${name} must be either "true" or "false" when set`);
}

function parseTrustProxyEnv() {
    const rawValue = process.env.TRUST_PROXY;
    if (rawValue === undefined) {
        return false;
    }
    if (rawValue === 'true') {
        return true;
    }
    if (rawValue === 'false') {
        return false;
    }
    const maybeNumber = Number(rawValue);
    if (Number.isInteger(maybeNumber) && maybeNumber >= 0) {
        return maybeNumber;
    }
    // Supports trust proxy values like "loopback" or CIDR strings.
    return rawValue;
}

function parsePositiveIntEnv(name, defaultValue) {
    const rawValue = process.env[name];
    if (rawValue === undefined) return defaultValue;
    const parsed = Number(rawValue);
    if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    throw new Error(`${name} must be a positive integer when set`);
}

function getAudioAdminToken() {
    const token = typeof process.env.AUDIO_ADMIN_TOKEN === 'string'
        ? process.env.AUDIO_ADMIN_TOKEN.trim()
        : '';
    if (IS_PRODUCTION && token.length === 0) {
        throw new Error('AUDIO_ADMIN_TOKEN environment variable is required in production');
    }
    return token.length > 0 ? token : null;
}

function getSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        if (IS_PRODUCTION && !IS_TEST_RUNTIME) {
            throw new Error('SESSION_SECRET environment variable is required in production');
        }
        console.warn('[SESSION] Using development secret - NOT FOR PRODUCTION');
        return crypto.randomBytes(32).toString('hex');
    }
    if (IS_PRODUCTION && !IS_TEST_RUNTIME && secret.length < 32) {
        throw new Error('SESSION_SECRET must be at least 32 characters in production');
    }
    if (secret.length < 32) {
        console.warn('[SESSION] SESSION_SECRET is shorter than 32 characters; consider using a longer secret.');
    }
    return secret;
}

const SESSION_SECRET = getSessionSecret();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_DIST_PATH = path.join(PROJECT_ROOT, 'dist');
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_PATH, 'index.html');
const PUBLIC_PATH = path.join(PROJECT_ROOT, 'public');
const TRUST_PROXY = parseTrustProxyEnv();
const ENABLE_COLLAB_API = parseBooleanEnv('ENABLE_COLLAB_API', !IS_PRODUCTION);
const AUDIO_UPLOAD_PATH = process.env.AUDIO_STORAGE_PATH 
    ? path.resolve(process.env.AUDIO_STORAGE_PATH) 
    : path.join(PUBLIC_PATH, 'audio');
const SCHOLOMANCE_DICT_PATH = typeof process.env.SCHOLOMANCE_DICT_PATH === 'string' &&
    process.env.SCHOLOMANCE_DICT_PATH.trim().length > 0
    ? path.resolve(process.env.SCHOLOMANCE_DICT_PATH)
    : null;

// Ensure audio directory exists
if (!existsSync(AUDIO_UPLOAD_PATH)) {
    mkdirSync(AUDIO_UPLOAD_PATH, { recursive: true });
}

export const fastify = Fastify({
  logger: true,
  trustProxy: TRUST_PROXY
});
fastify.decorate('opsMetrics', createOpsMetrics());
const lexiconAdapter = createLexiconAdapter(SCHOLOMANCE_DICT_PATH, { log: fastify.log });

// Register multipart for uploads
fastify.register(multipart, {
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    }
});

const SESSION_COOKIE_NAME = 'scholomance.sid';
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const DEFAULT_API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 5000);
const SHUTDOWN_TIMEOUT_MS = parsePositiveIntEnv('SHUTDOWN_TIMEOUT_MS', 10000);
const AUDIO_ADMIN_TOKEN = getAudioAdminToken();
const SHOULD_SERVE_FRONTEND =
    IS_PRODUCTION &&
    process.env.SERVE_FRONTEND !== 'false' &&
    existsSync(FRONTEND_INDEX_PATH);

const progressionBodySchema = z.object({
    xp: z.number().int().min(0),
    unlockedSchools: z.array(z.string()).min(1),
});

const scrollParamsSchema = z.object({
    id: z.string().min(1).max(128),
});

const scrollBodySchema = z.object({
    title: z.string().trim().min(1).max(256),
    content: z.string().max(500000).optional().default(''),
});

function toFastifySchema(zodSchema) {
    const schema = zodToJsonSchema(zodSchema, { target: 'draft-7' });
    if (schema && typeof schema === 'object' && '$schema' in schema) {
        delete schema.$schema;
    }
    return schema;
}

function buildExternalApiUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

// 1. Initialize session store
const useRedisStore =
  process.env.NODE_ENV === 'production' ||
  process.env.ENABLE_REDIS_SESSIONS === 'true';
let redisClient = null;
let sessionStore = null;

if (useRedisStore) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isUpstash = redisUrl.includes('upstash.io');
  const isRedisLabs = redisUrl.includes('redislabs.com');
  const isTls = redisUrl.startsWith('rediss://');
  
  fastify.log.info(`[REDIS] Initializing ${isUpstash ? 'Upstash ' : isRedisLabs ? 'RedisLabs ' : ''}Redis connection (TLS: ${isTls})...`);
  
  redisClient = createClient({ 
    url: redisUrl,
    socket: {
      tls: isTls ? true : undefined, // Explicitly enable TLS for rediss://
      reconnectStrategy: (retries) => {
        const delay = Math.min(retries * 50, 2000);
        return delay;
      },
      // Upstash sometimes closes idle connections, so we set a heartbeat
      keepAlive: 5000 
    }
  });
  
  redisClient.on('error', (err) => fastify.log.error(`[REDIS] Client Error: ${err.message}`, err));
  redisClient.on('connect', () => fastify.log.info('[REDIS] Client Connected'));
  redisClient.on('ready', () => fastify.log.info('[REDIS] Client Ready'));
  
  sessionStore = new RedisStore({ 
    client: redisClient,
    prefix: "scholo:sess:",
  });
}

function getLivenessReport() {
  return {
    status: 'live',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

function isDatabaseReady(status) {
  return Boolean(
    status &&
    typeof status === 'object' &&
    Number.isInteger(status.version) &&
    status.version >= 1
  );
}

function getReadinessReport() {
  const userDbStatus = persistence.getStatus?.() ?? null;
  const collabDbStatus = collabPersistence.getStatus?.() ?? null;
  const userDbReady = isDatabaseReady(userDbStatus);
  const collabDbReady = isDatabaseReady(collabDbStatus);
  const redisReady = !useRedisStore || Boolean(redisClient?.isReady);
  const ready = userDbReady && collabDbReady && redisReady;

  return {
    status: ready ? 'ready' : 'degraded',
    ready,
    timestamp: new Date().toISOString(),
    checks: {
      userDb: {
        ready: userDbReady,
        version: userDbStatus?.version ?? null,
        path: userDbStatus?.path ?? null,
      },
      collabDb: {
        ready: collabDbReady,
        version: collabDbStatus?.version ?? null,
        path: collabDbStatus?.path ?? null,
      },
      redis: {
        ready: redisReady,
        enabled: useRedisStore,
        connected: Boolean(redisClient?.isOpen),
      },
    },
  };
}

// 2. Register cookie and session plugins
fastify.register(fastifyCookie);
const sessionOptions = {
  secret: SESSION_SECRET || 'dev-only-secret-key-not-for-production-use-32chars',
  cookieName: SESSION_COOKIE_NAME,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    path: '/',
  },
  saveUninitialized: false,
  rolling: true,
};

if (sessionStore) {
  sessionOptions.store = sessionStore;
}

fastify.register(fastifySession, sessionOptions);

// Register CSRF protection after session.
fastify.register(csrf, { sessionPlugin: '@fastify/session' });

const csrfPreValidation = async (request, reply) => {
  if (typeof fastify.csrfProtection !== 'function') {
    return reply.status(500).send({ message: 'CSRF protection is not initialized.' });
  }
  return new Promise((resolve, reject) => {
    fastify.csrfProtection(request, reply, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

function authorizeAudioRouteRequest(request) {
  return authorizeAudioRequest(request, {
    isProduction: IS_PRODUCTION,
    configuredAdminToken: AUDIO_ADMIN_TOKEN,
  });
}

// Register Helmet for security headers
fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://suno.com", "https://www.suno.com"],
      connectSrc: ["'self'", "https://api.datamuse.com", "https://api.dictionaryapi.dev"],
      mediaSrc: ["'self'", "https://audiocdn001.suno.ai", "https://cdn1.suno.ai", "blob:", "data:"],
    },
  },
});

fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string', bodyLimit: 1_000_000 },
    fastify.getDefaultJsonParser('error', 'error'),
);

// 3. Register global rate limiting (per-user when authenticated, per-IP otherwise)
fastify.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    // Use session user ID for authenticated users so each user gets their own budget.
    // Falls back to IP for unauthenticated requests.
    return request.session?.user?.id || request.ip;
  },
  errorResponseBuilder: (_request, _reply) => {
    fastify.opsMetrics.increment('rateLimitHits');
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'You have exceeded the request limit. Please try again later.',
    };
  },
});

// Serve uploaded archive tracks directly from /audio/*
fastify.register(fastifyStatic, {
  root: AUDIO_UPLOAD_PATH,
  prefix: '/audio/',
  decorateReply: false,
});

// Health route
fastify.get('/health/live', async () => {
  return getLivenessReport();
});

fastify.get('/health/ready', async (_request, reply) => {
  const readiness = getReadinessReport();
  const statusCode = readiness.ready ? 200 : 503;
  return reply.code(statusCode).send(readiness);
});

fastify.get('/health', async () => {
  return {
    ...getLivenessReport(),
    message: 'Scholomance CODEx Server is running.',
  };
});

fastify.get('/metrics', async () => {
  const readiness = getReadinessReport();
  return {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
    },
    readiness: {
      ready: readiness.ready,
      status: readiness.status,
    },
    counters: fastify.opsMetrics.snapshot(),
  };
});

fastify.register(authRoutes, { prefix: '/auth' });

// Reference API Proxy Routes
fastify.get('/api/rhymes/:word', async (request, reply) => {
    const { word } = request.params;
    try {
        const rhymeUrl = buildExternalApiUrl('https://api.datamuse.com/words', { rel_rhy: word, max: 20 });
        const res = await fetchWithTimeout(rhymeUrl);
        return await res.json();
    } catch (e) {
        return reply.status(500).send({ message: 'Error fetching rhymes' });
    }
});

// Progression
fastify.get('/api/progression', { preHandler: [requireAuth] }, async (request) => {
    return persistence.progression.get(request.session.user.id);
});

fastify.post('/api/progression', {
    preValidation: [csrfPreValidation],
    preHandler: [requireAuth],
    schema: { body: toFastifySchema(progressionBodySchema) },
    handler: async (request) => {
        return persistence.progression.save(request.session.user.id, request.body);
    }
});

fastify.delete('/api/progression', {
    preValidation: [csrfPreValidation],
    preHandler: [requireAuth],
    handler: async (request) => {
        return persistence.progression.reset(request.session.user.id);
    }
});

fastify.get('/api/scrolls', { preHandler: [requireAuth] }, async (request) => {
    return persistence.scrolls.getAll(request.session.user.id);
});

fastify.post('/api/scrolls/:id', {
    preValidation: [csrfPreValidation],
    preHandler: [requireAuth],
    schema: {
        params: toFastifySchema(scrollParamsSchema),
        body: toFastifySchema(scrollBodySchema),
    },
    handler: async (request, reply) => {
        const saved = persistence.scrolls.save(
            request.params.id,
            request.session.user.id,
            request.body,
        );
        if (!saved) {
            return reply.status(409).send({ message: 'Scroll id already exists for another user.' });
        }
        return saved;
    }
});

fastify.delete('/api/scrolls/:id', {
    preValidation: [csrfPreValidation],
    preHandler: [requireAuth],
    schema: { params: toFastifySchema(scrollParamsSchema) },
    handler: async (request, reply) => {
        const deleted = persistence.scrolls.delete(request.params.id, request.session.user.id);
        if (!deleted) {
            return reply.status(404).send({ message: 'Scroll not found.' });
        }
        return { ok: true };
    }
});

// Audio filename helpers
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a)$/i;

function sanitizeAudioFilename(raw) {
    return raw.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}

function isValidAudioFilename(name) {
    if (!name || typeof name !== 'string') return false;
    if (!AUDIO_EXT_RE.test(name)) return false;
    // Block path traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
    return true;
}

function resolveAudioFilePath(filename) {
    return path.join(AUDIO_UPLOAD_PATH, filename);
}

// Upload and Audio List Routes
fastify.get('/api/audio-files', async (request, reply) => {
    const authorization = authorizeAudioRouteRequest(request);
    if (!authorization.authorized) {
        return reply.status(401).send(buildAudioUnauthorizedPayload(authorization.reason));
    }
    try {
        const files = readdirSync(AUDIO_UPLOAD_PATH);
        return files.filter(f => AUDIO_EXT_RE.test(f)).map(f => {
            const filePath = resolveAudioFilePath(f);
            let size = null;
            let uploadedAt = null;
            try {
                const stats = statSync(filePath);
                size = stats.size;
                uploadedAt = stats.mtime.toISOString();
            } catch {
                // File may have been removed between readdir and stat
            }
            return { name: f, url: `/audio/${f}`, size, uploadedAt };
        });
    } catch (e) {
        return [];
    }
});

fastify.post('/api/upload', async (request, reply) => {
    const authorization = authorizeAudioRouteRequest(request);
    if (!authorization.authorized) {
        fastify.opsMetrics.increment('uploadFailures');
        return reply.status(401).send(buildAudioUnauthorizedPayload(authorization.reason));
    }
    try {
        const data = await request.file();
        if (!data) {
            fastify.opsMetrics.increment('uploadFailures');
            return reply.status(400).send({ message: 'No file' });
        }
        if (!AUDIO_EXT_RE.test(data.filename)) {
            fastify.opsMetrics.increment('uploadFailures');
            return reply.status(400).send({ message: 'Invalid type' });
        }
        const safeFilename = sanitizeAudioFilename(data.filename);
        const targetPath = resolveAudioFilePath(safeFilename);
        if (existsSync(targetPath)) {
            fastify.opsMetrics.increment('uploadFailures');
            return reply.status(409).send({ message: 'File already exists', filename: safeFilename });
        }
        await pipeline(data.file, createWriteStream(targetPath));
        return { message: 'Uploaded', filename: safeFilename, url: `/audio/${safeFilename}` };
    } catch (error) {
        fastify.opsMetrics.increment('uploadFailures');
        if (error?.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
            return reply.status(400).send({ message: 'No file' });
        }
        fastify.log.error({ err: error }, '[UPLOAD] Failed to store uploaded file.');
        return reply.status(500).send({ message: 'Upload failed' });
    }
});

fastify.delete('/api/audio-files/:filename', async (request, reply) => {
    const authorization = authorizeAudioRouteRequest(request);
    if (!authorization.authorized) {
        return reply.status(401).send(buildAudioUnauthorizedPayload(authorization.reason));
    }
    const { filename } = request.params;
    if (!isValidAudioFilename(filename)) {
        return reply.status(400).send({ message: 'Invalid filename' });
    }
    const targetPath = resolveAudioFilePath(filename);
    if (!existsSync(targetPath)) {
        return reply.status(404).send({ message: 'File not found' });
    }
    try {
        unlinkSync(targetPath);
        return { message: 'Deleted', filename };
    } catch (error) {
        fastify.log.error({ err: error }, '[AUDIO] Failed to delete file.');
        return reply.status(500).send({ message: 'Delete failed' });
    }
});

fastify.patch('/api/audio-files/:filename', async (request, reply) => {
    const authorization = authorizeAudioRouteRequest(request);
    if (!authorization.authorized) {
        return reply.status(401).send(buildAudioUnauthorizedPayload(authorization.reason));
    }
    const { filename } = request.params;
    if (!isValidAudioFilename(filename)) {
        return reply.status(400).send({ message: 'Invalid filename' });
    }
    const newName = request.body?.name;
    if (!newName || typeof newName !== 'string') {
        return reply.status(400).send({ message: 'Missing new name' });
    }
    const safeNewName = sanitizeAudioFilename(newName);
    if (!isValidAudioFilename(safeNewName)) {
        return reply.status(400).send({ message: 'Invalid new filename' });
    }
    const sourcePath = resolveAudioFilePath(filename);
    if (!existsSync(sourcePath)) {
        return reply.status(404).send({ message: 'File not found' });
    }
    const destPath = resolveAudioFilePath(safeNewName);
    if (existsSync(destPath)) {
        return reply.status(409).send({ message: 'Target filename already exists', filename: safeNewName });
    }
    try {
        renameSync(sourcePath, destPath);
        return { message: 'Renamed', oldFilename: filename, filename: safeNewName, url: `/audio/${safeNewName}` };
    } catch (error) {
        fastify.log.error({ err: error }, '[AUDIO] Failed to rename file.');
        return reply.status(500).send({ message: 'Rename failed' });
    }
});

// Expose Redis client to route plugins for shared caching
fastify.decorate('redis', redisClient);

fastify.addHook('onSend', async (request, _reply, payload) => {
    const requestPath = stripQueryFromUrl(request.raw?.url || request.url || '');
    if (request.method !== 'GET' || !requestPath.startsWith('/api/word-lookup/')) {
        return payload;
    }
    if (typeof payload !== 'string') {
        return payload;
    }
    try {
        const parsedPayload = JSON.parse(payload);
        fastify.opsMetrics.recordWordLookup(parsedPayload?.source);
    } catch {
        fastify.opsMetrics.recordWordLookup();
    }
    return payload;
});

fastify.register(wordLookupRoutes);
fastify.register(panelAnalysisRoutes);
fastify.register(lexiconRoutes, { prefix: '/api/lexicon', adapter: lexiconAdapter });

if (ENABLE_COLLAB_API) {
    if (IS_PRODUCTION) {
        fastify.log.warn('[COLLAB] API enabled in production; all routes require authentication.');
    }
    fastify.register(async function collabApiPlugin(instance) {
        instance.addHook('preHandler', requireAuth);
        instance.register(collabRoutes, { prefix: '/collab' });
    });
} else {
    fastify.log.info('[COLLAB] API disabled. Set ENABLE_COLLAB_API=true to enable.');
    fastify.all('/collab/*', async (_request, reply) => {
        return reply.code(404).send({ message: 'Not found' });
    });
}

if (SHOULD_SERVE_FRONTEND) {
    fastify.register(fastifyStatic, {
        root: FRONTEND_DIST_PATH,
        prefix: '/',
        index: ['index.html'],
        setHeaders: (res, filePath) => {
            const normalizedPath = String(filePath || '');
            const fileName = path.basename(normalizedPath).toLowerCase();

            if (fileName === 'index.html') {
                // Always fetch latest shell so dynamic chunk URLs stay in sync after deploys.
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                return;
            }

            if (normalizedPath.includes(`${path.sep}assets${path.sep}`)) {
                // Fingerprinted assets are immutable by design.
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return;
            }

            // Non-fingerprinted static files get a short cache.
            res.setHeader('Cache-Control', 'public, max-age=3600');
        },
    });
    fastify.setNotFoundHandler((request, reply) => {
        const requestPath = stripQueryFromUrl(request.raw?.url || request.url);
        if (isApiRoutePath(requestPath)) {
            return reply.code(404).send({
                message: 'Route not found',
                path: requestPath,
            });
        }
        if (isStaticAssetPath(requestPath)) {
            return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
        }
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
        return reply.type('text/html; charset=utf-8').sendFile('index.html');
    });
} else {
    fastify.setNotFoundHandler((request, reply) => {
        const requestPath = stripQueryFromUrl(request.raw?.url || request.url);
        if (isApiRoutePath(requestPath)) {
            return reply.code(404).send({
                message: 'Route not found',
                path: requestPath,
            });
        }
        if (isStaticAssetPath(requestPath)) {
            return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
        }
        return reply.code(404).send({ message: 'Not found' });
    });
}

let shutdownPromise = null;

async function closeRedisConnection() {
    if (!redisClient || !redisClient.isOpen) {
        return;
    }

    try {
        await redisClient.quit();
    } catch (error) {
        fastify.log.warn({ err: error }, '[REDIS] Graceful quit failed, forcing disconnect.');
        try {
            redisClient.disconnect();
        } catch {
            // Ignore disconnect errors during shutdown.
        }
    }
}

function closePersistenceConnections() {
    try {
        persistence.close();
    } catch (error) {
        fastify.log.warn({ err: error }, '[DB:user] Failed to close cleanly.');
    }
    try {
        collabPersistence.close();
    } catch (error) {
        fastify.log.warn({ err: error }, '[DB:collab] Failed to close cleanly.');
    }
    try {
        lexiconAdapter.close?.();
    } catch (error) {
        fastify.log.warn({ err: error }, '[DB:lexicon] Failed to close cleanly.');
    }
}

export async function gracefulShutdown(signal = 'manual', { exitCode = 0, exitProcess = true } = {}) {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
        fastify.log.info({ signal }, '[LIFECYCLE] Shutdown initiated.');
        const timeoutId = setTimeout(() => {
            fastify.log.error(
                { timeoutMs: SHUTDOWN_TIMEOUT_MS, signal },
                '[LIFECYCLE] Shutdown timeout reached. Forcing process exit.',
            );
            if (exitProcess) {
                process.exit(1);
            }
        }, SHUTDOWN_TIMEOUT_MS);
        if (typeof timeoutId.unref === 'function') {
            timeoutId.unref();
        }

        try {
            await fastify.close();
        } catch (error) {
            fastify.log.error({ err: error }, '[LIFECYCLE] Fastify close failed.');
        }

        await closeRedisConnection();
        closePersistenceConnections();
        clearTimeout(timeoutId);

        fastify.log.info({ signal }, '[LIFECYCLE] Shutdown complete.');
        if (exitProcess) {
            process.exit(exitCode);
        }
    })();

    return shutdownPromise;
}

export const start = async () => {
    try {
        if (redisClient && !redisClient.isOpen) {
            await redisClient.connect();
        }
        await PhonemeEngine.init();
        await fastify.listen({ host: HOST, port: PORT });
    } catch (error) {
        fastify.log.error(error);
        await closeRedisConnection();
        closePersistenceConnections();
        process.exit(1);
    }
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.once(signal, () => {
            gracefulShutdown(signal).catch((error) => {
                fastify.log.error({ err: error, signal }, '[LIFECYCLE] Shutdown failed unexpectedly.');
                process.exit(1);
            });
        });
    }
    start();
}
