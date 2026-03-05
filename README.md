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
| `AUDIO_ADMIN_TOKEN` | Yes in production | unset in development | Required admin header token for audio upload/list routes (`x-audio-admin-token`). |
| `ENABLE_DEV_AUTH` | No | `false` | Development-only auth bypass (`test` user) when `NODE_ENV=development`. |
| `VITE_USE_CODEX_PIPELINE` | No | `true` | Enables CODEx runtime initialization in client. |
| `VITE_USE_SERVER_PANEL_ANALYSIS` | No | `true` | Frontend kill switch for Read-page panel analysis requests. |
| `VITE_USE_SERVER_ANALYSIS` | No | `true` | Frontend kill switch for `useDeepRhymeAnalysis` server requests. |
| `VITE_API_BASE_URL` | No | browser origin fallback | Base API origin for non-browser/test contexts. |
| `ENABLE_PANEL_ANALYSIS_CACHE` | No | `true` | Enables in-memory caching for `/api/analysis/panels`. |
| `ENABLE_PANEL_ANALYSIS_REDIS_CACHE` | No | `true` | Enables Redis L2 caching for `/api/analysis/panels` when Redis is ready. |
| `PANEL_ANALYSIS_CACHE_TTL_MS` | No | `300000` | Cache TTL in milliseconds for panel-analysis responses. |
| `PANEL_ANALYSIS_CACHE_MAX_SIZE` | No | `1000` | Max in-memory panel-analysis cache entries before FIFO eviction. |
| `SCHOLOMANCE_DICT_API_URL` | No | unset | Server-side Scholomance dictionary API base URL used by `/api/word-lookup*` routes. |
| `SCHOLOMANCE_DICT_PATH` | No | unset | Filesystem path to `scholomance_dict.sqlite` used by Fastify `/api/lexicon/*` proxy routes. |
| `VITE_SCHOLOMANCE_DICT_API_URL` | No | unset | Client lexicon API base URL. Keep `/api/lexicon` in this value. |
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
| `npm run typecheck` | Run TypeScript checks for frontend `.ts/.tsx` and targeted backend `checkJs` modules. |
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
- `GET /api/audio-files` (`x-audio-admin-token` required in production)
- `POST /api/upload` (`x-audio-admin-token` required in production)
- Word lookup:
- `GET /api/word-lookup/:word`
- `POST /api/word-lookup/batch`
- Lexicon proxy (session required, guest or authenticated):
- `GET /api/lexicon/lookup/:word`
- `GET /api/lexicon/search?q=&limit=`
- `GET /api/lexicon/suggest?prefix=&limit=`
- `POST /api/lexicon/lookup-batch`
- `POST /api/lexicon/validate-batch`
- Panel analysis:
- `POST /api/analysis/panels`
- Collaboration tooling (prefix `/collab`):
- agents, tasks, locks, pipelines, activity, status (`ENABLE_COLLAB_API=true`, auth required when enabled).

### Panel Analysis Ops Notes

- `POST /api/analysis/panels` emits:
  - `X-Cache`: `MISS`, `HIT`, `HIT-REDIS`, or `BYPASS`
  - `X-Analysis-Duration-Ms`: request processing duration
  - `X-Analysis-Cache-Ttl-Ms`: active cache TTL config
- `/metrics` now includes panel analysis counters:
  - `panelAnalysisRequests`
  - `panelAnalysisCacheHitsMemory`
  - `panelAnalysisCacheHitsRedis`
  - `panelAnalysisCacheMisses`
  - `panelAnalysisErrors`
  - `panelAnalysisCacheHitRatio`
  - `panelAnalysisAvgDurationMs`

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

2. Serve dictionary API (development only):

```bash
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787
```

3. Development env values:
- `SCHOLOMANCE_DICT_API_URL=http://127.0.0.1:8787/api/lexicon`
- `VITE_SCHOLOMANCE_DICT_API_URL=http://127.0.0.1:8787/api/lexicon`

4. Production lexicon proxy values:
- `SCHOLOMANCE_DICT_PATH=/absolute/path/to/scholomance_dict.sqlite`
- `VITE_SCHOLOMANCE_DICT_API_URL=https://your-domain.example/api/lexicon`

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
- Uploads fail with `missing_admin_token` or `invalid_admin_token`:
- enter a valid audio admin token in the Listen page upload panel, or send `x-audio-admin-token: <AUDIO_ADMIN_TOKEN>` when calling the API directly.

## TypeScript adoption status

- TypeScript is now enabled incrementally.
- Converted modules:
  - `src/pages/Listen/ListenPage.tsx`
  - `src/hooks/useAmbientPlayer.ts`
  - `src/lib/audioAdminApi.ts`
- Backend runtime remains Node ESM JavaScript.
- Targeted backend type-safety for audio auth is enforced via `tsconfig.checkjs.json` on `codex/server/audioAuth.js`.

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
