# BUG-2026-04-03-DEV-MISSING-BACKEND

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-DEV-MISSING-BACKEND`

## Bug Description
Running `npm run dev` launched the Vite frontend on port 5173 but **did not start the Fastify backend server** on port 3000. All `/api/lexicon/*` and `/api/corpus/*` requests proxied by Vite would silently fail because nothing was listening on port 3000. The dictionary appeared broken from the UI's perspective — lookups returned nothing, batch lookups timed out, rhyme analysis had no data.

**User impact:** Every dictionary-dependent feature (word validation, phoneme lookup, rhyme families, Truesight coloring, corpus search) was non-functional when using the documented `npm run dev` command.

**Symptom confusion:** The Python dev dictionary server (`npm run dev:dict` on port 8787) *was* sometimes running, but it was a red herring — the Fastify backend reads `scholomance_dict.sqlite` directly via `better-sqlite3` and does not proxy through the Python server. The client-side `ScholomanceDictionaryAPI` uses `VITE_SCHOLOMANCE_DICT_API_URL=/api/lexicon` (a relative path) which goes through Vite's proxy to port 3000, not 8787.

## Root Cause
The `dev` script in `package.json` was:
```json
"dev": "vite"
```

This only started the Vite development server. The Fastify backend (`codex/server/index.js`) — which registers the `/api/lexicon/*` and `/api/corpus/*` routes and connects directly to `scholomance_dict.sqlite` via `better-sqlite3` — was never started.

The Vite config proxies `/api/*` to `http://localhost:3000`:
```js
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    ...
  }
}
```

Without the Fastify process on 3000, every proxied API request returned nothing (connection refused, silently swallowed by the client's error handling with offline cooldown).

**Why this happened:** At some point in development history, `npm run dev` was simplified to just `vite`, with the expectation that developers would manually run `npm run dev:server` in a separate terminal. This assumption was never enforced or documented, so most sessions started without a backend.

## Thought Process

1. **First observation:** User reported "dictionary suddenly doesn't work with my backend." The SQLite files existed, the build script was sound, the Python server was running on 8787.

2. **Investigation path:**
   - Checked `scholomance_dict.sqlite` exists ✅ (147 MB)
   - Checked `scholomance_corpus.sqlite` exists ✅ (55 MB)
   - Checked `.env` — `VITE_SCHOLOMANCE_DICT_API_URL=/api/lexicon` (relative path) ✅
   - Listed listening ports — 5173 (Vite) ✅, 8787 (Python) ✅, **3000 (Fastify) ❌**

3. **Dead ends encountered:**
   - Initially suspected dictionary DB corruption — ruled out by direct SQLite inspection
   - Suspected schema mismatch between build script and adapter — schemas matched
   - Suspected Python server incompatibility — irrelevant, Fastify doesn't use it

4. **Breakthrough moment:**
   - `curl http://localhost:3000/api/lexicon/suggest?prefix=ar` → connection refused
   - `cat package.json` → `"dev": "vite"` — no backend startup at all
   - Manually started `npm run dev:server` → port 3000 came up → `curl` returned valid JSON ✅

5. **Solution derived:**
   - Change `dev` script to launch both Fastify and Vite concurrently
   - Cross-platform: use Node's `child_process.execSync` with platform detection
   - Unix: `npm run dev:server & vite`
   - Windows: `start /B npm run dev:server && vite`

## Changes Made

| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `package.json` | `"dev"` script (line 6) | Changed from `"vite"` to concurrent Fastify + Vite launch, cross-platform |

**Before:**
```json
"dev": "vite"
```

**After:**
```json
"dev": "node -e \"const cmd = process.platform === 'win32' ? 'start /B npm run dev:server && vite' : 'npm run dev:server & vite'; require('child_process').execSync(cmd, { stdio: 'inherit' });\""
```

**Verification:**
- `npm run dev` → both ports 3000 and 5173 listening within 6 seconds
- `curl http://localhost:5173/api/lexicon/lookup/arcana` → 1 entry, 50 rhymes ✅
- `curl -X POST http://localhost:3000/api/lexicon/lookup-batch` → valid family data ✅
- `curl http://localhost:3000/api/corpus/search?q=spell` → valid corpus results ✅

## Testing
1. Killed all existing server processes on ports 3000, 5173
2. Ran `npm run dev` — both processes started
3. Verified port 3000 (Fastify) listening after ~5 seconds
4. Verified port 5173 (Vite) listening after ~5 seconds
5. Proxied request through Vite (`localhost:5173/api/lexicon/lookup/arcana`) returned correct data
6. Direct Fastify requests (`localhost:3000/api/lexicon/*`) returned correct data
7. Commit + push succeeded, Render secrets synced via pre-push hook

## Lessons Learned

1. **The primary dev command must start the full stack.** If developers need a backend for the app to function, `npm run dev` must start it. Requiring manual second-terminal setups guarantees someone will miss it.

2. **Relative API URLs hide broken backends.** `VITE_SCHOLOMANCE_DICT_API_URL=/api/lexicon` silently proxies to a dead port. The client's offline cooldown pattern (`OFFLINE_RETRY_COOLDOWN_MS = 30000`) means failures persist for 30 seconds before retrying, masking the root cause during initial diagnosis.

3. **Multiple dictionary sources create confusion.** The Python `serve_scholomance_dict.py` on port 8787 and Fastify's `lexicon.sqlite.adapter.js` both serve dictionary data from the same SQLite file but through completely different code paths. Only the Fastify adapter is used in the `npm run dev` flow. The Python server is only needed for `npm run dev:all` or manual debugging.

4. **Port diagnostics beat log diving.** When an API surface fails, `ss -tlnp` (or `lsof -i`) to check what's actually listening is faster than grepping through server logs. It immediately surfaces "nobody is on port 3000."

5. **Commit message clarity matters.** The fix commit (`c3c950e`) clearly states what changed and why, making it easy to audit later when someone wonders why `npm run dev` looks like a Node one-liner instead of just `vite`.

---

*Entry Status: COMPLETE | Last Updated: 2026-04-03*
