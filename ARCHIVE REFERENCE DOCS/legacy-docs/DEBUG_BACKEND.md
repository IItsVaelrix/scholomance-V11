# Backend Startup Debug Guide

## What was broken

`npm run dev` only starts the Vite frontend. The Fastify backend (`codex/server/index.js`) was never started, so:

- `/api/word-lookup/*` → network error → word cards showed no definitions
- `/api/lexicon/*` → network error → Scholomance dictionary unreachable
- `/api/corpus/*` → network error → corpus data unavailable
- The predictor spellchecker had no Scholomance validation layer

Additionally, `.env` was missing `SCHOLOMANCE_DICT_PATH` and `SCHOLOMANCE_CORPUS_PATH`, so even when Fastify started manually it logged:

```
[LexiconAdapter] SCHOLOMANCE_DICT_PATH is not set. Lexicon routes will return empty results.
[CorpusAdapter] SCHOLOMANCE_CORPUS_PATH is not set. Corpus routes will return empty results.
```

The word card was falling through to external APIs (Datamuse / Free Dictionary) instead of the Scholomance dictionary — hence "the backup is working, not the Scholomance dictionary."

---

## Permanent fix (applied)

### 1. `.env` now includes all required server vars

Critical additions:
```
SCHOLOMANCE_DICT_PATH=./scholomance_dict.sqlite
SCHOLOMANCE_CORPUS_PATH=./scholomance_corpus.sqlite
```

Both SQLite files must exist at the project root. Current status:
- `scholomance_dict.sqlite` — 147 MB, present
- `scholomance_corpus.sqlite` — 22 MB, present

### 2. New npm scripts

```bash
npm run dev:server   # Fastify only  (port 3000)
npm run dev:full     # Fastify + Vite together (recommended for development)
```

`dev:full` uses `node --env-file=.env` (Node 20.6+ native) to guarantee env vars load before the server resolves SQLite paths — bypassing any dotenv ESM timing issues.

---

## How the lookup chain works

```
Click word in Truesight
  → useWordLookup calls /api/word-lookup/:word   (Fastify, port 3000)
      → WordLookupService checks Scholomance SQLite first
          HIT  → returns phoneme data, vowelFamily, rhymeKey, IPA, definitions
          MISS → falls back to Datamuse + Free Dictionary (definitions only, no phoneme data)
      → word card renders with full or partial data
```

Without Fastify running, every lookup is a network error → card shows "No arcane definitions found."

---

## Day-to-day workflow

```bash
# Option A — single terminal (recommended)
npm run dev:full

# Option B — two terminals
# Terminal 1:
npm run dev:server

# Terminal 2:
npm run dev
```

Fastify listens on `http://localhost:3000`. Vite proxies `/api`, `/auth`, `/collab`, `/audio` there automatically (see `vite.config.js`).

---

## Verify it's working

```bash
curl http://localhost:3000/api/lexicon/lookup/fire
```

Should return JSON with phoneme data. If it returns `{}` or 401, check:

1. Is the server running? → `curl http://localhost:3000/` should respond
2. Is `.env` loaded? → Check Fastify startup logs for `[LexiconAdapter]` warnings
3. Does the SQLite file exist? → `ls -lh scholomance_dict.sqlite`

---

## Optional: Python dict server (port 8787)

The `VITE_SCHOLOMANCE_DICT_API_URL` in `.env` points to a separate Python service used by `usePredictor` client-side for spellcheck/suggest. It is optional — the main word lookup goes through Fastify, not this service.

To run it:
```bash
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787
```

Without it, `ScholomanceDictionaryAPI.isEnabled()` returns `true` (env var is set) but calls fail silently — the predictor degrades to corpus-only suggestions with no server-side dictionary validation.

---

## Common symptoms and causes

| Symptom | Cause |
|---------|-------|
| Word card shows "No arcane definitions found" | Fastify not running |
| Card shows definitions but no phoneme/vowelFamily data | Fastify running but SCHOLOMANCE_DICT_PATH missing — falling back to external APIs |
| School name shows "Arcane" instead of e.g. "Sonic" | `vowelFamily` not in word data — phoneme lookup failed |
| Predictor suggestions are generic, not phonetically aware | Python dict server on :8787 not running |
| Fastify starts but logs `SCHOLOMANCE_DICT_PATH is not set` | `.env` missing that variable, or server started without `--env-file=.env` |
