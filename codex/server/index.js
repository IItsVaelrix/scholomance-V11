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
import { collabRoutes } from './collab/collab.routes.js';
import { wordLookupRoutes } from './routes/wordLookup.routes.js';

import 'dotenv/config';

function getSessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SESSION_SECRET environment variable is required in production');
        }
        console.warn('[SESSION] Using development secret - NOT FOR PRODUCTION');
        return crypto.randomBytes(32).toString('hex');
    }
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
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
const AUDIO_UPLOAD_PATH = process.env.AUDIO_STORAGE_PATH 
    ? path.resolve(process.env.AUDIO_STORAGE_PATH) 
    : path.join(PUBLIC_PATH, 'audio');

// Ensure audio directory exists
if (!existsSync(AUDIO_UPLOAD_PATH)) {
    mkdirSync(AUDIO_UPLOAD_PATH, { recursive: true });
}

const fastify = Fastify({
  logger: true,
  trustProxy: true
});

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
const AUDIO_ADMIN_TOKEN = String(process.env.AUDIO_ADMIN_TOKEN ?? 'echo');
const SHOULD_SERVE_FRONTEND =
    process.env.NODE_ENV === 'production' &&
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
  const isTls = redisUrl.startsWith('rediss://');
  
  fastify.log.info(`[REDIS] Initializing ${isUpstash ? 'Upstash ' : ''}Redis connection (TLS: ${isTls})...`);
  
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
  return fastify.csrfProtection(request, reply);
};

function readQueryParamAsString(queryValue) {
  if (typeof queryValue === 'string') return queryValue;
  if (Array.isArray(queryValue) && typeof queryValue[0] === 'string') return queryValue[0];
  return null;
}

function isAudioAdminRequest(request) {
  const queryAdmin = readQueryParamAsString(request.query?.admin);
  return Boolean(AUDIO_ADMIN_TOKEN) && queryAdmin === AUDIO_ADMIN_TOKEN;
}

function isAudioRequestAuthorized(request) {
  if (process.env.NODE_ENV !== 'production') {
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

fastify.addContentTypeParser("application/json", { bodyLimit: 1_000_000 }, fastify.getDefaultJsonParser("error"));

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
fastify.get('/health', async () => {
  return { message: 'Scholomance CODEx Server is running.' };
});

// Route to provide CSRF token to the client
fastify.get('/auth/csrf-token', async (request) => {
    const token = request.csrfToken();
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
        if (!user) return reply.status(401).send({ message: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return reply.status(401).send({ message: 'Invalid credentials' });
        request.session.user = { id: user.id, username: user.username };
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
    if (request.session.user) {
        reply.status(200).send({ user: request.session.user });
    } else {
        reply.status(401).send({ message: 'Not authenticated' });
    }
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
    handler: async (request) => {
        return persistence.progression.save(request.session.user.id, request.body);
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
        return reply.status(401).send({ message: 'Unauthorized' });
    }
    const data = await request.file();
    if (!data) return reply.status(400).send({ message: 'No file' });
    if (!/\.(mp3|wav|ogg|m4a)$/i.test(data.filename)) return reply.status(400).send({ message: 'Invalid type' });
    const safeFilename = data.filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
    const targetPath = path.join(AUDIO_UPLOAD_PATH, safeFilename);
    await pipeline(data.file, createWriteStream(targetPath));
    return { message: 'Uploaded', filename: safeFilename, url: `/audio/${safeFilename}` };
});

// Expose Redis client to route plugins for shared caching
fastify.decorate('redis', redisClient);

fastify.register(wordLookupRoutes);
fastify.register(collabRoutes, { prefix: '/collab' });

if (SHOULD_SERVE_FRONTEND) {
    fastify.register(fastifyStatic, { root: FRONTEND_DIST_PATH, prefix: '/', index: ['index.html'] });
    fastify.setNotFoundHandler((request, reply) => {
        return reply.type('text/html; charset=utf-8').sendFile('index.html');
    });
}

const start = async () => {
  try {
    if (redisClient) await redisClient.connect();
    await fastify.listen({ host: HOST, port: PORT });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
    start();
}
