# Scholomance v10

Scholomance is a ritual-themed language IDE and audio environment built with React + Vite on the frontend and Fastify + SQLite on the backend. It combines writing tools, phoneme/rhyme analysis, heuristic scoring, progression systems, and a local collaboration API for agent-style workflows.

## What is in this repo

- A frontend app with route-based experiences:
- `Watch`: video-focused landing interface.
- `Listen`: ambient station console with unlock progression and optional local uploads.
- `Read`: IDE-style writing workspace with Truesight analysis tools.
- `Auth`: registration/login/session flow.
- `Collab`: local collaboration dashboard for agents/tasks/pipelines.
- A backend authority server for auth, progression, scroll persistence, uploads, word lookup, and collab APIs.
- CODEx runtime/core modules for linguistic analysis and scoring.

## Tech stack

- Frontend: React 18, React Router, Vite 7, Framer Motion.
- Backend: Fastify 5, Zod, better-sqlite3.
- Storage: SQLite (user and collab DBs), Redis for session storage in production (or when enabled in development).
- Testing: Vitest + Testing Library, Playwright for visual regression.
- CSS: native CSS + Lightning CSS transforms via Vite.

## Repository map

```text
src/                     Frontend app (pages, components, hooks, lib)
codex/core/              Domain logic (schemas, scoring, heuristics)
codex/runtime/           Runtime orchestration (pipelines, cache, event bus)
codex/services/          Adapter layer (dictionary, transport, persistence)
codex/server/            Fastify server, auth, API routes, collab services
tests/                   Unit/integration/accessibility/visual tests
scripts/                 Utility scripts (security, collab, dictionary, etc.)
security/                Security policy and QA artifacts
public/                  Static assets and data packs
dict_data/               Local dictionary data workspace (gitkept)
```

## Prerequisites

- Node.js 20+.
- npm 10+.
- Python 3.10+ (only if you want to build/serve the offline dictionary).
- Redis (required for production sessions; optional in local development unless enabled).

## Quick start (local development)

1. Install dependencies.

```bash
npm ci
```

2. Create local environment file.

```powershell
Copy-Item .env.example .env
```

3. Start backend API server.

```bash
npm run start
```

4. Start Vite frontend in another terminal.

```bash
npm run dev
```

5. Open `http://localhost:5173`.

Notes:
- Vite proxies `/api`, `/auth`, `/collab`, and `/audio` to `http://localhost:3000` (see `vite.config.js`).
- In production-style local testing, build first and run only `npm start`.

## Environment variables

The project reads env vars from `.env` (via `dotenv/config` in server scripts) and `import.meta.env` in client code.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SESSION_SECRET` | Yes in production | generated in dev if missing | Session signing secret (minimum 32 chars in production). |
| `NODE_ENV` | No | `development` | Runtime mode. |
| `HOST` | No | `0.0.0.0` | Fastify bind host. |
| `PORT` | No | `3000` | Fastify port. |
| `TRUST_PROXY` | No | `false` | Fastify `trustProxy` setting (`true`/`false`, hop count, or proxy string). |
| `SERVE_FRONTEND` | No | `true` in production | If not `false`, server serves `dist/` in production. |
| `USER_DB_PATH` | No | `./scholomance_user.sqlite` | SQLite path for users/progression/scrolls. |
| `COLLAB_DB_PATH` | No | `./scholomance_collab.sqlite` | SQLite path for collaboration state. |
| `ENABLE_COLLAB_API` | No | `true` in development, `false` in production | Enables `/collab/*` backend routes. |
| `REDIS_URL` | Required in production | `redis://localhost:6379` | Redis connection for sessions. |
| `ENABLE_REDIS_SESSIONS` | No | `false` in development | Forces Redis sessions in development if `true`. |
| `API_TIMEOUT_MS` | No | `5000` | External API timeout in ms. |
| `DB_BUSY_TIMEOUT_MS` | No | `5000` | SQLite busy timeout in ms for both user and collab databases. |
| `SHUTDOWN_TIMEOUT_MS` | No | `10000` | Max graceful-shutdown wait before forced exit. |
| `AUDIO_STORAGE_PATH` | No | `./public/audio` | Directory for uploaded audio files served at `/audio/*`. |
| `AUDIO_ADMIN_TOKEN` | Yes in production | unset in development | Admin header token for audio upload/list fallback (`x-audio-admin-token`). |
| `ENABLE_DEV_AUTH` | No | `false` | Development-only auth bypass (`test` user) when `NODE_ENV=development`. |
| `VITE_USE_CODEX_PIPELINE` | No | `true` | Enables CODEx runtime initialization in client. |
| `VITE_API_BASE_URL` | No | browser origin fallback | Base API origin for non-browser/test contexts. |
| `SCHOLOMANCE_DICT_API_URL` | No | unset | Server-side Scholomance dictionary API base URL used by `/api/word-lookup*` routes. |
| `VITE_SCHOLOMANCE_DICT_API_URL` | No | unset | Optional local dictionary API endpoint. |
| `VITE_DICTIONARY_API_URL` | No | set in `.env.example` | Optional/legacy dictionary provider URL. |
| `VITE_THESAURUS_API_URL` | No | set in `.env.example` | Optional/legacy thesaurus provider URL. |

## NPM scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server. |
| `npm run start` | Start Fastify server (`codex/server/index.js`). |
| `npm run build` | Build frontend production bundle. |
| `npm run preview` | Preview built frontend with Vite preview server. |
| `npm run lint` | ESLint checks with zero warnings allowed. |
| `npm test` | Run Vitest suite. |
| `npm run test:visual` | Run Chromium Playwright visual tests. |
| `npm run test:visual:full` | Run full Playwright project matrix. |
| `npm run security:qa` | Security QA checks from `scripts/security/security-qa.js`. |
| `npm run security:audit` | Dependency audit checks from `scripts/security/dependency-audit.js`. |
| `npm run db:setup` | Reset and seed local user DB for development. |
| `npm run track:add:suno` | Helper script for adding Suno track metadata. |

## Core backend routes

- Health:
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`
- Auth and session:
- `GET /auth/csrf-token`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- Progression and content:
- `GET /api/progression` (auth required)
- `POST /api/progression` (auth + CSRF)
- `DELETE /api/progression` (auth + CSRF)
- `GET /api/scrolls` (auth required)
- `POST /api/scrolls/:id` (auth + CSRF)
- `DELETE /api/scrolls/:id` (auth + CSRF)
- `GET /api/rhymes/:word`
- `GET /api/audio-files`
- `POST /api/upload` (session or `x-audio-admin-token` gated in production)
- Word lookup:
- `GET /api/word-lookup/:word`
- `POST /api/word-lookup/batch`
- Collaboration tooling (prefix `/collab`):
- agents, tasks, locks, pipelines, activity, status (`ENABLE_COLLAB_API=true`, auth required when enabled).

## Data and persistence

- User DB (`USER_DB_PATH`) is auto-created with required schema at server startup.
- Collab DB (`COLLAB_DB_PATH`) is auto-created with WAL mode at startup.
- Production deployments should mount a persistent disk for SQLite files.
- `dict_data/` is intended for local dictionary datasets and is mostly ignored by git.

## Offline dictionary workflow (optional)

Use this if you want a large local dictionary backend.

1. Build dictionary SQLite:

```bash
python scripts/build_scholomance_dict.py --kaikki_url "<url>" --oewn_url "<url>" --db scholomance_dict.sqlite --overwrite
```

2. Serve dictionary API:

```bash
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787
```

3. Set:
- `SCHOLOMANCE_DICT_API_URL=http://127.0.0.1:8787/api/lexicon`
- `VITE_SCHOLOMANCE_DICT_API_URL=http://127.0.0.1:8787/api/lexicon`

Reference: `DICT_BUILD.md`.

## Collaboration quick start

1. Start backend server:

```bash
npm run start
```

2. Register an agent:

```powershell
$env:AGENT_ID='agent-ui'
node scripts/collab-client.js register --name "Frontend Agent" --role ui --capabilities jsx,css
```

3. View status:

```bash
node scripts/collab-client.js status
```

4. Open UI at `http://localhost:5173/collab`.

## Deployment

### Render blueprint

- `render.yaml` defines `scholomance-app` (Docker runtime) and a persistent disk mounted at `/var/data`.
- Render health checks use `GET /health/ready`.
- Set `REDIS_URL` to your Upstash connection string.
- Keep `USER_DB_PATH=/var/data/scholomance_user.sqlite`.

Reference: `DEPLOY_RENDER.md`.

### Docker

Build and run:

```bash
docker build -t scholomance .
docker run --rm -p 3000:3000 -e NODE_ENV=production -e TRUST_PROXY=true -e SESSION_SECRET="<32+ chars>" -e AUDIO_ADMIN_TOKEN="<long-random-token>" -e REDIS_URL="redis://host:6379" -e USER_DB_PATH="/var/data/scholomance_user.sqlite" scholomance
```

## Testing strategy

- Unit/integration/accessibility:

```bash
npm test -- --run
```

- Accessibility gate (same suite enforced in CI):

```bash
npx vitest run tests/accessibility.test.jsx
```

- Visual regression (Chromium only):

```bash
npm run test:visual
```

- Full visual browser matrix:

```bash
npm run test:visual:full
```

## Troubleshooting

- `401 Unauthorized` on progression routes:
- log in via `/auth`, or enable development bypass with `ENABLE_DEV_AUTH=true` in development.
- Redis connection failures:
- verify `REDIS_URL` and run `node scripts/verify-upstash.js`.
- No API data in frontend dev:
- ensure backend is running on `localhost:3000` so Vite proxy can forward requests.
- Upload admin panel not visible:
- in production, authenticate with session or send `x-audio-admin-token: <AUDIO_ADMIN_TOKEN>` on API requests.

## Documentation index

- `ARCH.md`: architecture review and current improvement plan.
- `codex/README.md`: CODEx module details.
- `DEPLOY_RENDER.md`: Render deployment guide.
- `DICT_BUILD.md`: offline dictionary build details.
- `SECURITY_ARCHITECTURE_V2.0.md`: security architecture notes.

## Pre-push checklist

1. Run `npm run lint`.
2. Run `npx vitest run tests/accessibility.test.jsx`.
3. Run `npm test -- --run`.
4. Run `npm run build`.
5. Verify `git status` contains only intended changes.
6. Ensure `.env`, local SQLite files, and temporary artifacts are not staged.
7. Push branch:

```bash
git push -u origin main
```
