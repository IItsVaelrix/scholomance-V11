/**
 * The CODEx Authority Server entry point.
 * Built with Fastify.
 *
 * @see AI_Architecture_V2.md section 3.1, 5.2, and 8.3
 */

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
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { requireAuth } from './auth-pre-handler.js';
import { persistence } from './persistence.adapter.js';
import { collabPersistence } from './collab/collab.persistence.js';
import { collabRoutes } from './collab/collab.routes.js';
import { wordLookupRoutes } from './routes/wordLookup.routes.js';
import { panelAnalysisRoutes } from './routes/panelAnalysis.routes.js';
import { isApiRoutePath, stripQueryFromUrl } from './notFound.utils.js';
import { createOpsMetrics } from './observability.metrics.js';

import 'dotenv/config';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
        if (IS_PRODUCTION) {
            throw new Error('SESSION_SECRET environment variable is required in production');
        }
        console.warn('[SESSION] Using development secret - NOT FOR PRODUCTION');
        return crypto.randomBytes(32).toString('hex');
    }
    if (IS_PRODUCTION && secret.length < 32) {
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

// Ensure audio directory exists
if (!existsSync(AUDIO_UPLOAD_PATH)) {
    mkdirSync(AUDIO_UPLOAD_PATH, { recursive: true });
}

export const fastify = Fastify({
  logger: true,
  trustProxy: TRUST_PROXY
});
fastify.decorate('opsMetrics', createOpsMetrics());

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

const loginBodySchema = z.object({
    username: z.string(),
    password: z.string(),
});

const registerBodySchema = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(8),
});

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
    const schema = z.toJSONSchema(zodSchema, { target: 'draft-7' });
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

function readHeaderAsString(headerValue) {
  if (typeof headerValue === 'string') return headerValue;
  if (Array.isArray(headerValue) && typeof headerValue[0] === 'string') return headerValue[0];
  return null;
}

function secureTokenEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAudioAdminRequest(request) {
  const headerToken = readHeaderAsString(request.headers['x-audio-admin-token']);
  if (!headerToken || !AUDIO_ADMIN_TOKEN) {
    return false;
  }
  return secureTokenEquals(headerToken, AUDIO_ADMIN_TOKEN);
}

function isAudioRequestAuthorized(request) {
  if (!IS_PRODUCTION) {
    return true;
  }
  if (request.session?.user) {
    return true;
  }
  return isAudioAdminRequest(request);
}

// Register Helmet for security headers
fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://suno.com", "https://www.suno.com"],
      connectSrc: ["'self'", "https://api.datamuse.com", "https://api.dictionaryapi.dev"],
      mediaSrc: ["'self'", "https://audiocdn001.suno.ai", "https://cdn1.suno.ai", "blob:"],
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

// Route to provide CSRF token to the client
fastify.get('/auth/csrf-token', async (_request, reply) => {
    const token = await reply.generateCsrf();
    return { token };
});

// 4. Authentication Routes
fastify.post('/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    preValidation: [csrfPreValidation],
    schema: { body: toFastifySchema(registerBodySchema) },
    handler: async (request, reply) => {
        const { username, email, password } = request.body;
        const existingUser = persistence.users.findByUsername(username);
        if (existingUser) return reply.status(409).send({ message: 'Username already taken' });
        const existingEmail = persistence.users.findByEmail(email);
        if (existingEmail) return reply.status(409).send({ message: 'Email already registered' });
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = persistence.users.createUser(username, email, hashedPassword);
        return reply.status(201).send({ message: 'User registered successfully', userId: user.id });
    }
});

fastify.post('/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preValidation: [csrfPreValidation],
    schema: { body: toFastifySchema(loginBodySchema) },
    handler: async (request, reply) => {
        const { username, password } = request.body;
        const user = persistence.users.findByUsername(username);
        if (!user) {
            fastify.opsMetrics.increment('authFailures');
            return reply.status(401).send({ message: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            fastify.opsMetrics.increment('authFailures');
            return reply.status(401).send({ message: 'Invalid credentials' });
        }
        request.session.user = { id: user.id, username: user.username, email: user.email };
        return reply.status(200).send({ message: 'Logged in successfully' });
    },
});

fastify.post('/auth/logout', {
    preValidation: [csrfPreValidation],
    handler: async (request, reply) => {
        await request.session.destroy();
        reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        return reply.status(200).send({ message: 'Logged out successfully' });
    }
});

fastify.get('/auth/me', async (request, reply) => {
    if (!request.session.user) {
        reply.status(401).send({ message: 'Not authenticated' });
        return;
    }

    if (!request.session.user.email || !request.session.user.username) {
        const persistedUser = persistence.users.findById(request.session.user.id);
        if (!persistedUser) {
            await request.session.destroy();
            reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
            reply.status(401).send({ message: 'Not authenticated' });
            return;
        }
        request.session.user = {
            ...request.session.user,
            id: persistedUser.id,
            username: persistedUser.username,
            email: persistedUser.email,
        };
    }

    reply.status(200).send({ user: request.session.user });
});

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

// Upload and Audio List Routes
fastify.get('/api/audio-files', async (request, reply) => {
    if (!isAudioRequestAuthorized(request)) {
        return reply.status(401).send({ message: 'Unauthorized' });
    }
    try {
        const files = readdirSync(AUDIO_UPLOAD_PATH);
        return files.filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f)).map(f => ({
            name: f,
            url: `/audio/${f}`
        }));
    } catch (e) {
        return [];
    }
});

fastify.post('/api/upload', async (request, reply) => {
    if (!isAudioRequestAuthorized(request)) {
        fastify.opsMetrics.increment('uploadFailures');
        return reply.status(401).send({ message: 'Unauthorized' });
    }
    try {
        const data = await request.file();
        if (!data) {
            fastify.opsMetrics.increment('uploadFailures');
            return reply.status(400).send({ message: 'No file' });
        }
        if (!/\.(mp3|wav|ogg|m4a)$/i.test(data.filename)) {
            fastify.opsMetrics.increment('uploadFailures');
            return reply.status(400).send({ message: 'Invalid type' });
        }
        const safeFilename = data.filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
        const targetPath = path.join(AUDIO_UPLOAD_PATH, safeFilename);
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
    fastify.register(fastifyStatic, { root: FRONTEND_DIST_PATH, prefix: '/', index: ['index.html'] });
    fastify.setNotFoundHandler((request, reply) => {
        const requestPath = stripQueryFromUrl(request.raw?.url || request.url);
        if (isApiRoutePath(requestPath)) {
            return reply.code(404).send({
                message: 'Route not found',
                path: requestPath,
            });
        }
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
