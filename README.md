# Scholomance V11

Scholomance is a ritual-themed language combat IDE where words are weapons. Players craft scrolls (verses) scored by phoneme density, rhyme quality, and linguistic heuristics across competing schools of magic. Built with React + Vite on the frontend and Fastify + SQLite on the backend.

## Core Systems

- **Read** — IDE-style grimoire editor with Truesight phoneme analysis, rhyme diagramming, and real-time heuristic scoring.
- **Listen** — Ambient audio station with school-themed atmospheres, unlock progression, and local track uploads.
- **Watch** — Video-focused landing interface.
- **CODEx Engine** — Linguistic analysis pipeline: tokenization, phoneme mapping, syllable/stress extraction, 8-heuristic scoring, and combat resolution.
- **Hidden Harkov Model** — Deterministic token state machine that infers linguistic hidden states (stress anchors, terminal anchors, function gates) and feeds stage weights into the Judiciary voting system.
- **Rhyme Astrology** — Constellation-based rhyme relationship mapping across the lexicon (feature-flagged).
- **Scholomance Dictionary** — Offline SQLite lexicon built from CMU Pronouncing Dictionary + Open English WordNet, serving definitions, rhyme families, synonyms, and antonyms.
- **Super Corpus** — FTS5-indexed literary corpus built from curated verse, Project Gutenberg, and WordNet examples.

## Schools of Magic

Five base schools gate progression, each with vowel family affinities:

| School | Element | Vowel Affinities |
|---|---|---|
| SONIC | Sound/vibration | A, AO |
| PSYCHIC | Mind/perception | IH, EY |
| ALCHEMY | Transformation | AE, UW |
| WILL | Force/intent | OW |
| VOID | Absence/entropy | IY |

Three unlockable schools (Divination, Necromancy, Abjuration) extend the system.

## Tech Stack

- **Frontend**: React 18, React Router, Vite 7, Framer Motion, CSS custom properties for school theming.
- **Backend**: Fastify 5, Zod validation, better-sqlite3, Redis (production sessions).
- **Analysis**: PhonemeEngine (CMU dict), DeepRhyme engine, 8-heuristic scoring, Hidden Harkov Model.
- **Storage**: SQLite (user, collab, dictionary, corpus DBs), persistent disk in production.
- **Testing**: Vitest + Testing Library, Playwright for visual regression.

## Repository Map

```text
src/pages/               Route pages (Watch, Listen, Read, Auth, Collab)
src/components/          Shared UI (AmbientOrb, Navigation, VowelFamilyPanel, etc.)
src/lib/                 Client engines (phonology, deepRhyme, syntax, Harkov model, PLS)
src/hooks/               React hooks (progression, scoring, predictor, ambient player)
src/data/                Static data (schools, palettes, vowel mappings)
codex/core/              Domain logic (schemas, scoring, heuristics, combat, trie)
codex/runtime/           Runtime orchestration (pipelines, cache, event bus)
codex/services/          Adapter layer (dictionary, transport, persistence)
codex/server/            Fastify server, auth, API routes, adapters, collab services
tests/                   Unit, integration, accessibility, visual tests
scripts/                 Build scripts (dictionary, corpus, rhyme astrology, security)
security/                Security policy and QA artifacts
public/                  Static assets, corpus.json, ritual_dataset.jsonl
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Python 3.10+ (for dictionary/corpus builds)
- Redis (production sessions; optional locally)

### Local Development

```bash
npm ci
cp .env.example .env        # or Copy-Item .env.example .env on PowerShell
npm run dev:full             # starts backend + Vite frontend
```

Open `http://localhost:5173`. Vite proxies `/api`, `/auth`, `/collab`, and `/audio` to `localhost:3000`.

### Production

```bash
npm run build
npm start                    # runs ritual-init.js then Fastify server
```

`ritual-init.js` automatically builds the dictionary and corpus on first boot if missing from persistent storage. When `ENABLE_RHYME_ASTROLOGY=true`, it also builds the rhyme-astrology artifact bundle into the resolved output directory before Fastify starts.

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SESSION_SECRET` | Production | generated in dev | Session signing secret (32+ chars). |
| `NODE_ENV` | No | `development` | Runtime mode. |
| `PORT` | No | `3000` | Fastify port. |
| `HOST` | No | `0.0.0.0` | Fastify bind host. |
| `TRUST_PROXY` | No | `false` | Fastify `trustProxy` setting. |
| `REDIS_URL` | Production | `redis://localhost:6379` | Redis connection for sessions. |
| `USER_DB_PATH` | No | `./scholomance_user.sqlite` | User/progression/scrolls database. |
| `COLLAB_DB_PATH` | No | `./scholomance_collab.sqlite` | Collaboration state database. |
| `SCHOLOMANCE_DICT_PATH` | No | unset | Path to `scholomance_dict.sqlite` for lexicon routes. |
| `SCHOLOMANCE_CORPUS_PATH` | No | unset | Path to `scholomance_corpus.sqlite` for corpus routes. |
| `AUDIO_STORAGE_PATH` | No | `./public/audio` | Uploaded audio file directory. |
| `AUDIO_ADMIN_TOKEN` | Production | unset | Admin token for audio upload routes. |
| `ENABLE_DEV_AUTH` | No | `false` | Dev-only auth bypass. |
| `ENABLE_COLLAB_API` | No | `true` dev / `false` prod | Enables `/collab/*` routes. |
| `ENABLE_RHYME_ASTROLOGY` | No | `false` | Enables `/api/rhyme-astrology/*` routes. |
| `RHYME_ASTROLOGY_OUTPUT_DIR` | No | `./dict_data/rhyme-astrology` locally, `/var/data/rhyme-astrology` in production | Directory holding the rhyme-astrology SQLite artifacts and emotion priors JSON. |
| `ENABLE_REDIS_SESSIONS` | No | `false` | Force Redis sessions in dev. |
| `VITE_USE_CODEX_PIPELINE` | No | `true` | Client CODEx pipeline toggle. |
| `VITE_USE_SERVER_PANEL_ANALYSIS` | No | `true` | Client panel analysis toggle. |

## NPM Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (frontend only). |
| `npm run dev:full` | Backend + Vite frontend together. |
| `npm start` | Production: ritual-init + Fastify server. |
| `npm run build` | Production frontend bundle. |
| `npm test` | Vitest suite. |
| `npm run lint` | ESLint (zero warnings). |
| `npm run test:visual` | Playwright visual regression (Chromium). |
| `npm run security:qa` | Security QA checks. |
| `npm run security:audit` | Dependency audit. |
| `npm run build:rhyme-astrology:index` | Build Rhyme Astrology artifacts. |
| `npm run db:setup` | Reset and seed local user DB. |

## API Routes

### Health
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

### Auth
- `POST /auth/register`, `/auth/login`, `/auth/logout`
- `GET /auth/csrf-token`, `/auth/me`

### Progression & Scrolls (auth required)
- `GET|POST|DELETE /api/progression`
- `GET /api/scrolls`, `POST|DELETE /api/scrolls/:id`

### Lexicon (session required)
- `GET /api/lexicon/lookup/:word`, `/api/lexicon/search`, `/api/lexicon/suggest`
- `POST /api/lexicon/lookup-batch`, `/api/lexicon/validate-batch`

### Corpus
- `GET /api/corpus/search?q=`, `/api/corpus/context/:id`

### Analysis
- `POST /api/analysis/panels` — unified scoring, rhyme, vowel, literary device analysis
- `GET /api/word-lookup/:word`, `POST /api/word-lookup/batch`
- `GET /api/rhymes/:word`

### Rhyme Astrology (feature-flagged)
- `GET /api/rhyme-astrology/query?text=&mode=word|line`

### Audio (admin token required in production)
- `GET /api/audio-files`, `POST /api/upload`, `DELETE|PATCH /api/audio-files/:filename`

## Deployment

### Render

`render.yaml` defines a Docker web service with a 500GB persistent disk at `/var/data`. Set `REDIS_URL` and `SESSION_SECRET` in Render dashboard. When rhyme astrology is enabled, point `RHYME_ASTROLOGY_OUTPUT_DIR` at `/var/data/rhyme-astrology`. Health checks use `/health/ready`.

### Docker

```bash
docker build -t scholomance .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET="<32+ chars>" \
  -e AUDIO_ADMIN_TOKEN="<token>" \
  -e REDIS_URL="redis://host:6379" \
  -e SCHOLOMANCE_DICT_PATH="/var/data/scholomance_dict.sqlite" \
  -e SCHOLOMANCE_CORPUS_PATH="/var/data/scholomance_corpus.sqlite" \
  -e USER_DB_PATH="/var/data/scholomance_user.sqlite" \
  -v scholomance-data:/var/data \
  scholomance
```

## Testing

```bash
npm test -- --run                              # unit + integration
npx vitest run tests/accessibility.test.jsx    # accessibility gate
npm run test:visual                            # visual regression (Chromium)
npm run test:visual:full                       # full browser matrix
```

## Documentation

- `CLAUDE.md` — AI agent context and ownership boundaries
- `AI_ARCHITECTURE_V2.md` — Multi-agent architecture and CODEx layer contracts
- `codex/README.md` — CODEx module details
- `docs/operations/DEPLOY_RENDER.md` — Render deployment guide
- `docs/operations/DICT_BUILD.md` — Offline dictionary build workflow
- `docs/architecture/` — Unlockable schools, dictionary proxy, PLS integration
