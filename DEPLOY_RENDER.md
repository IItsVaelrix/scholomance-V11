# Deploying Scholomance on Render

This project is configured for single-domain app hosting:
- React app (Vite build output) is served by Fastify in production.
- API routes remain under `/api/*` and `/auth/*`.
- Sessions use Redis.
- User data uses SQLite on a persistent disk.

## 1. Prerequisites

- Render account
- Git repo connected to Render

## 2. One-click Blueprint Deploy

Use the root `render.yaml` blueprint.

It provisions:
- `scholomance-app` (Docker web service)
- `scholomance-redis` (Redis service)
- persistent disk mounted at `/var/data`

## 3. Required Environment Variables

The blueprint sets these:
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `USER_DB_PATH=/var/data/scholomance_user.sqlite`
- `REDIS_URL` (from Redis service)
- `SESSION_SECRET` (auto-generated)

Optional dictionary API variables:
- `MW_DICT_URL`
- `MW_DICT_KEY`
- `MW_THES_URL`
- `MW_THES_KEY`

## 4. Health Check

Render checks:
- `GET /health`

## 5. Local Production Smoke Test

```bash
npm run build
set NODE_ENV=production
set SESSION_SECRET=replace-with-32-char-secret
set REDIS_URL=redis://localhost:6379
npm start
```

Then open:
- `http://localhost:3000`
