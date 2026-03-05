# Dictionary Proxy Architecture

**Owner**: Gemini/Codex
**Status**: Proposed
**Scope**: `codex/server/` — new route plugin + SQLite adapter

---

## Problem

The Scholomance dictionary server (`scripts/serve_scholomance_dict.py`) is a bare Python HTTP server with:

- No authentication
- Wildcard CORS (`Access-Control-Allow-Origin: *`)
- No rate limiting
- No input bounds on `limit` params

Running it on `127.0.0.1` is safe for local dev. In production it cannot be used — any URL set via `VITE_SCHOLOMANCE_DICT_API_URL` is baked into the JS bundle and publicly visible, meaning the endpoint would be unauthenticated and open to the internet.

---

## Solution

Move dictionary serving into the existing Fastify authority server (`codex/server/`). The frontend points `VITE_SCHOLOMANCE_DICT_API_URL` at the Fastify server's `/api/lexicon` prefix, which already has:

- Session-based authentication (`requireAuth` pre-handler)
- CSRF protection (`@fastify/csrf-protection`)
- Rate limiting (`@fastify/rate-limit`)
- Helmet security headers (`@fastify/helmet`)
- Structured route registration pattern (see `wordLookupRoutes`, `panelAnalysisRoutes`)

The Python server becomes **dev-only**. It is never used in production builds.

---

## Architecture

```
Browser (React SPA)
  │
  │  VITE_SCHOLOMANCE_DICT_API_URL = https://your-server.com
  │
  ▼
Fastify Authority Server  (codex/server/)
  │  — session auth enforced
  │  — rate limited
  │  — helmet headers
  │
  ▼
codex/server/routes/lexicon.routes.js   ← NEW
  │
  ▼
codex/server/adapters/lexicon.sqlite.adapter.js   ← NEW
  │
  ▼
scholomance_dict.sqlite   (server filesystem, never shipped to client)
```

---

## Files to Create

### 1. `codex/server/adapters/lexicon.sqlite.adapter.js`

Pure SQLite adapter — no HTTP, no Fastify. Wraps the same queries currently in `scripts/serve_scholomance_dict.py`.

**Responsibilities:**
- Open a `better-sqlite3` (synchronous) connection at startup, or use Node `sqlite3` async if already a project dependency
- Expose named functions (not a class):
  - `lookupWord(word, limit?)` → `LexicalEntry[]`
  - `lookupRhymes(word, limit?)` → `{ family, words[] }`
  - `batchLookupFamilies(words[])` → `Record<string, string>`
  - `batchValidateWords(words[])` → `string[]`
  - `searchEntries(query, limit?)` → `SearchResult[]`
  - `suggestEntries(prefix, limit?)` → `Suggestion[]`
- Enforce a hard cap on all `limit` params (max 100 — no unbounded queries)
- Parameterized queries only — no string interpolation
- FTS `MATCH` input must be sanitized: strip special FTS operators before passing to SQLite
- Export a `createLexiconAdapter(dbPath)` factory so the server can inject the path from env

**Environment variable**: `SCHOLOMANCE_DICT_PATH` — absolute path to `scholomance_dict.sqlite`. If unset or file missing, adapter logs a warning and all functions return empty results (graceful degradation, same behavior as today).

---

### 2. `codex/server/routes/lexicon.routes.js`

Fastify plugin that registers all dictionary routes.

**Route prefix**: `/api/lexicon`

**Auth**: All routes require `requireAuth` pre-handler (same pattern as existing routes).

**Routes:**

```
GET  /api/lexicon/lookup/:word
GET  /api/lexicon/search?q=&limit=
GET  /api/lexicon/suggest?prefix=&limit=
POST /api/lexicon/lookup-batch      body: { words: string[] }
POST /api/lexicon/validate-batch    body: { words: string[] }
```

**Input validation** (Zod schemas, same pattern as existing routes):

| Field | Rule |
|---|---|
| `:word` | Non-empty string, max 100 chars, stripped |
| `?q` | Non-empty string, max 200 chars |
| `?prefix` | Non-empty string, max 100 chars |
| `?limit` | Integer, 1–100, default 20 |
| `body.words` | Array of strings, max 500 items, each max 100 chars |

**Response shape** — identical to the Python server so `src/lib/scholomanceDictionary.api.js` requires no changes:

```js
// GET /lookup/:word
{
  word: string,
  definition: { text, partOfSpeech, source } | null,
  entries: LexicalEntry[],
  synonyms: string[],
  antonyms: string[],
  rhymes: string[],
  rhymeFamily: string | null,
  lore: { seed: string }
}

// GET /search
{ query: string, results: SearchResult[] }

// GET /suggest
{ prefix: string, results: Suggestion[] }

// POST /lookup-batch
{ families: Record<string, string> }

// POST /validate-batch
{ valid: string[] }
```

**Rate limit**: Apply a stricter per-route limit on batch endpoints (e.g., 30 req/min) independent of the global limit.

**CORS**: Do not add `Access-Control-Allow-Origin: *`. Fastify's existing CORS config applies.

---

### 3. Register in `codex/server/index.js`

Import and register the plugin alongside existing routes:

```js
import { lexiconRoutes } from './routes/lexicon.routes.js';
// ...
fastify.register(lexiconRoutes, { prefix: '/api/lexicon' });
```

---

## Frontend Change (Claude's domain — informational only)

After Codex deploys this, Claude will update `VITE_SCHOLOMANCE_DICT_API_URL` in `.env.production` to point at the Fastify server. No changes to `src/lib/scholomanceDictionary.api.js` are needed — the response shape is identical.

---

## Dev Workflow (unchanged)

Local development continues to use the Python server:

```bash
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787
```

Set in `.env.development`:
```
VITE_SCHOLOMANCE_DICT_API_URL=http://127.0.0.1:8787
```

Set in `.env.production`:
```
VITE_SCHOLOMANCE_DICT_API_URL=https://your-production-domain.com
```

---

## Security Properties After Implementation

| Vector | Before | After |
|---|---|---|
| Unauthenticated access | Open (anyone with URL) | Blocked — session auth required |
| URL visibility in bundle | Exposes bare API endpoint | Exposes Fastify server URL (already public) |
| CORS | Wildcard `*` | Controlled by Fastify CORS config |
| Rate limiting | None | Fastify global + per-route on batch |
| Input bounds | `limit` unbounded | Hard capped at 100 |
| FTS injection | Unguarded | Sanitized before MATCH |
| SQLite file | Served from any machine | Lives on server filesystem only |

---

## Dependencies

Check if `better-sqlite3` or `sqlite3` is already in `package.json`. If not, `better-sqlite3` is preferred (synchronous, simpler, well-maintained). Add to `dependencies` not `devDependencies`.

---

## Acceptance Criteria

- [ ] All five routes return correct data matching the Python server's response shape
- [ ] Routes return `401` when called without a valid session
- [ ] `limit` values above 100 are clamped or rejected with `400`
- [ ] `words` arrays above 500 items are rejected with `400`
- [ ] `SCHOLOMANCE_DICT_PATH` unset → all routes return empty results, no crash
- [ ] Python server is documented as dev-only in its own file header
- [ ] Minimax test coverage on all five routes (auth, happy path, validation errors)
