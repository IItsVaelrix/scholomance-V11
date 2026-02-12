# BACK_END_ARCH_UPGRADE.md

## Scope

Deep backend architecture review of:

- `codex/server/*`
- `codex/runtime/*`
- `codex/services/adapters/*`
- Frontend/server contract touchpoints in `src/hooks/*` and `src/lib/reference.engine.js`
- Deployment and CI surfaces (`render.yaml`, `Dockerfile`, `.github/workflows/*`, `README.md`)

Review date: 2026-02-12

---

## Executive Summary

The backend has strong building blocks (Fastify, Zod usage, Redis session support, SQLite persistence, dedicated word-lookup route layer), but there are critical production risks and contract drift that should be addressed before deeper scaling work.

Top priorities:

1. Lock down exposed production-sensitive surfaces (`/collab`, audio admin token).
2. Fix frontend/backend API contract mismatches (auth payloads, progression/scroll endpoints).
3. Remove architectural duplication in dictionary lookup paths and formalize one canonical service.

---

## Current Backend Topology

- **Authority server:** `codex/server/index.js`
- **Auth/session/security:** cookie + session + CSRF + rate-limit + helmet in `codex/server/index.js`
- **User persistence:** `codex/server/persistence.adapter.js` (SQLite)
- **Collab persistence + APIs:** `codex/server/collab/*` (SQLite + lock/pipeline/task APIs)
- **Word lookup API:** `codex/server/routes/wordLookup.routes.js`
- **Client runtime pipeline (event bus):** `codex/runtime/*`
- **Dictionary adapters:** `codex/services/adapters/*`

---

## Prioritized Upgrade Backlog

| Priority | Area | Improvement |
|---|---|---|
| P0 | Security | Gate or disable `/collab` in production by default |
| P0 | Security | Remove insecure default audio admin token and stop query-token auth |
| P0 | Security | Make `trustProxy` environment-driven, not unconditional |
| P1 | API Contract | Align `/auth/me` payload with frontend schema |
| P1 | API Contract | Implement missing `/api/scrolls*` routes |
| P1 | API Contract | Align progression routes + CSRF behavior with client/docs |
| P1 | Correctness | Fix collab lock acquisition partial-failure bug |
| P1 | Correctness | Fix `PipelineType` enum drift (`ui_feature`) |
| P1 | Runtime | Remove invalid `require()` usage in ESM modules |
| P2 | Architecture | Consolidate word lookup into one shared backend service |
| P2 | Data | Add migrations + DB pragmas + indexing strategy |
| P2 | Reliability | Add graceful shutdown for Fastify/Redis/SQLite |
| P2 | API UX | Ensure JSON 404 for API paths (do not SPA-fallback API misses) |
| P2 | Validation | Add query/params schemas + pagination limits across collab APIs |
| P3 | Observability | Add real readiness/liveness + structured operational metrics |
| P3 | Testing | Add route integration tests (`fastify.inject`) for server APIs |
| P3 | CI/Ops | Align CI runtime with production Node version and install strategy |
| P3 | Config | Sync `.env.example`/README/render config contract |

---

## Detailed Findings and Improvements

### P0-1: Secure `/collab` for production

**Evidence**

- `codex/server/collab/collab.routes.js:35` explicitly states "No authentication required".
- `codex/server/index.js:389` always registers collab routes.

**Risk**

Unauthenticated users can create/update/delete tasks, locks, and pipelines in production.

**Upgrade**

- Add `ENABLE_COLLAB_API` env flag, default `false` in production.
- Add auth pre-handler for all collab routes when enabled.
- Replace trust-on-header identity (`X-Agent-ID`) with authenticated principal mapping.

**Acceptance Criteria**

- In production defaults, `/collab/*` returns `404` or `403`.
- In enabled mode, unauthenticated requests get `401`.

---

### P0-2: Remove insecure audio admin token defaults and query transport

**Evidence**

- `codex/server/index.js:82` defaults `AUDIO_ADMIN_TOKEN` to `'echo'`.
- `codex/server/index.js:213-215` authorizes using `?admin=<token>` query param.
- `README.md:94` documents the same insecure default.

**Risk**

Predictable token plus query-string transport makes admin access guessable/leaky (logs, history, referrers).

**Upgrade**

- Require explicit `AUDIO_ADMIN_TOKEN` in production; no fallback token.
- Use header-based token (`x-audio-admin-token`) instead of query parameter.
- Prefer role/session-based admin authorization where possible.

**Acceptance Criteria**

- Server fails fast in production when token missing.
- Query `admin` token is ignored/rejected.

---

### P0-3: Fix proxy trust model for rate-limit integrity

**Evidence**

- `codex/server/index.js:68` sets `trustProxy: true` unconditionally.
- Rate limiting key uses `request.ip` fallback at `codex/server/index.js:250-254`.

**Risk**

If deployed without trusted reverse proxy controls, spoofed forwarding headers can bypass rate limiting.

**Upgrade**

- Make trust proxy explicit via env/config per deployment.
- Document required proxy chain behavior for each platform.

**Acceptance Criteria**

- Local/self-hosted mode uses strict/non-trusting defaults unless explicitly configured.

---

### P1-1: Resolve `/auth/me` schema drift

**Evidence**

- Frontend requires `email` in user schema: `src/hooks/useAuth.jsx:4-8`.
- Server session only stores `{ id, username }`: `codex/server/index.js:309`.
- `/auth/me` returns session user directly: `codex/server/index.js:323-326`.

**Risk**

Valid authenticated sessions can be treated as invalid in UI parsing.

**Upgrade**

- Option A: include `email` in session payload and `/auth/me` response.
- Option B: make frontend `email` optional and fetch profile separately.
- Add contract test for `/auth/me` shape.

**Acceptance Criteria**

- Authenticated UI parse never fails for valid server response.

---

### P1-2: Implement missing scroll APIs

**Evidence**

- Client calls `GET /api/scrolls`, `POST /api/scrolls/:id`, `DELETE /api/scrolls/:id` in `src/hooks/useScrolls.jsx:332`, `src/hooks/useScrolls.jsx:385`, `src/hooks/useScrolls.jsx:422`.
- Server has persistence functions but no corresponding routes (`codex/server/persistence.adapter.js:106-146`, no routes in `codex/server/index.js`).

**Risk**

Client silently falls back to local-only behavior; cross-device persistence contract is broken.

**Upgrade**

- Add scroll routes in server with `requireAuth` and CSRF on write/delete.
- Reuse existing `persistence.scrolls.*` methods.
- Add route schema validation and tests.

**Acceptance Criteria**

- Scroll CRUD succeeds server-side for authenticated users.
- Local fallback is only for offline/error, not normal path.

---

### P1-3: Align progression API + CSRF contract

**Evidence**

- Server exposes `GET/POST /api/progression`: `codex/server/index.js:344-353`.
- README claims `DELETE /api/progression`: `README.md:132`.
- Client calls delete: `src/hooks/useProgression.jsx:175`.
- Client `POST /api/progression` does not attach CSRF token: `src/hooks/useProgression.jsx:61-68`.

**Risk**

Reset progression can fail at runtime; save path likely fails CSRF prevalidation depending session/token state.

**Upgrade**

- Implement `DELETE /api/progression` or remove/reset client path.
- Add CSRF token acquisition in `useProgression` similar to `useScrolls` flow.
- Update README to match implemented routes exactly.

**Acceptance Criteria**

- Progression save/reset pass consistently with auth + CSRF.

---

### P1-4: Fix collab file-lock partial failure bug

**Evidence**

- Assignment acquires locks in loop: `codex/server/collab/collab.routes.js:177-184`.
- On conflict it returns immediately: `codex/server/collab/collab.routes.js:185-191`.

**Risk**

If conflict occurs after some locks acquired, earlier locks remain leaked even though task assignment failed.

**Upgrade**

- Move assignment+lock sequence into a single transaction in persistence layer.
- Roll back all acquired locks if any conflict occurs.

**Acceptance Criteria**

- Failed assignment leaves no new locks behind.
- Add regression test that reproduces multi-file partial-conflict scenario.

---

### P1-5: Fix collab pipeline schema drift

**Evidence**

- Pipeline definition includes `ui_feature`: `codex/server/collab/collab.pipelines.js:37-45`.
- Allowed enum excludes it: `codex/server/collab/collab.schemas.js:60-62`.

**Risk**

Documented/defined pipeline cannot be created by API validation.

**Upgrade**

- Add `ui_feature` to `PipelineType` enum.
- Add route test for creation.

**Acceptance Criteria**

- `POST /collab/pipelines` accepts all defined pipeline types.

---

### P1-6: Remove invalid CommonJS `require()` calls in ESM modules

**Evidence**

- `codex/runtime/wordLookupPipeline.js:220` uses `require('./cache.js')`.
- `codex/services/adapters/index.js:29-30` uses `require()` in an ESM project.

**Risk**

These code paths throw at runtime when executed (`require is not defined`).

**Upgrade**

- Replace with static imports or `await import()` and async API.
- Add direct tests for `clearWordLookupCache()` and `createAdapterChain()`.

**Acceptance Criteria**

- No runtime `require` errors in browser or Node ESM contexts.

---

### P2-1: Consolidate word lookup logic into one canonical backend service

**Evidence**

- Server route implements external-API merge: `codex/server/routes/wordLookup.routes.js`.
- Runtime pipeline has separate adapter orchestration: `codex/runtime/wordLookupPipeline.js`.
- Legacy reference engine has yet another path and outdated endpoints: `src/lib/reference.engine.js:109-141`.
- Server route is registered (`codex/server/index.js:388`) but client does not reference `/api/word-lookup`.

**Risk**

Behavior divergence, inconsistent cache/rate-limit semantics, and duplicated bug surface.

**Upgrade**

- Introduce `WordLookupService` (server-side canonical business logic).
- Make HTTP route a thin transport layer over the service.
- Make frontend default to server route (with optional offline local adapter mode).
- Deprecate/remove legacy `ReferenceEngine` API-path assumptions.

**Acceptance Criteria**

- Single source of truth for lookup normalization and provider fallback.
- Frontend and API yield consistent results for same input.

---

### P2-2: Add migration system and DB hardening pragmas

**Evidence**

- User DB uses ad hoc `CREATE TABLE IF NOT EXISTS`: `codex/server/persistence.adapter.js:14-43`.
- Collab DB same pattern: `codex/server/collab/collab.persistence.js:13-79`.
- User DB does not set WAL/foreign keys/busy timeout.

**Risk**

Schema evolution becomes error-prone; lock contention/constraint behavior can degrade unpredictably.

**Upgrade**

- Add migration table and incremental migration runner.
- Apply pragmas consistently (`journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout` set).
- Add targeted indexes (e.g., `scrolls(userId, updatedAt DESC)`).

**Acceptance Criteria**

- Schema changes are versioned and reversible.
- DB startup logs migration version and pragma state.

---

### P2-3: Add graceful shutdown lifecycle

**Evidence**

- DB close hooks only on process exit (`codex/server/persistence.adapter.js:57`, `codex/server/collab/collab.persistence.js:94`).
- No explicit Redis/Fastify shutdown handling in `codex/server/index.js`.

**Risk**

Container stop/redeploy can leave resources unflushed or in noisy error state.

**Upgrade**

- Handle `SIGTERM`/`SIGINT`: stop accepting traffic, close Fastify, quit Redis, close DB handles.
- Add shutdown timeout and fatal logging fallback.

**Acceptance Criteria**

- Clean shutdown path observable in logs during deploy/restart.

---

### P2-4: Ensure API 404 responses are JSON, not SPA fallback HTML

**Evidence**

- Production SPA not-found handler always serves `index.html`: `codex/server/index.js:391-395`.

**Risk**

Unknown API endpoints can produce HTML fallback, breaking API clients and obscuring failures.

**Upgrade**

- Conditional notFound: JSON 404 for `/api`, `/auth`, `/collab`; SPA fallback only for non-API paths.

**Acceptance Criteria**

- `GET /api/nonexistent` returns JSON 404 in production.

---

### P2-5: Add strict query validation and pagination caps for collab APIs

**Evidence**

- Numeric query parsing without schema (`priority`, `limit`) in `collab.routes`: `codex/server/collab/collab.routes.js:83-90`, `codex/server/collab/collab.routes.js:409-416`.
- List endpoints return unbounded rows.

**Risk**

NaN/large values can degrade behavior and performance.

**Upgrade**

- Add Zod schemas for query params and enforce min/max limits.
- Add pagination (`cursor`/`offset+limit`) for tasks/activity/pipelines.

**Acceptance Criteria**

- Query validation errors return deterministic `400` with clear details.
- Large datasets are paginated by design.

---

### P2-6: Normalize error envelopes and route schemas

**Evidence**

- Mixed response shapes across handlers (`message`, `error`, custom payloads).
- Many routes lack explicit Fastify schemas.

**Risk**

Client handling complexity increases; harder observability and contract testing.

**Upgrade**

- Define one API error envelope (`code`, `message`, `details`, `requestId`).
- Add route `params`, `querystring`, `body`, and `response` schemas.
- Generate OpenAPI from Fastify schemas.

**Acceptance Criteria**

- All API failures follow the same response envelope.

---

### P3-1: Improve readiness/liveness and operational visibility

**Evidence**

- Health endpoint returns static message only: `codex/server/index.js:272-274`.

**Upgrade**

- Add `/health/live` and `/health/ready`.
- Ready check should verify DB handles and Redis connection (when enabled).
- Add metrics for auth failures, rate limits, lookup cache hit ratio, upload failures.

---

### P3-2: Expand backend test strategy to include route integration

**Evidence**

- Existing tests focus on persistence and runtime units, not server route integration.

**Upgrade**

- Export app factory from server (e.g., `buildServer()`), test with `fastify.inject`.
- Cover auth, progression, scrolls, uploads, word lookup, collab routes.
- Add contract tests for frontend critical hooks against mocked server responses.

---

### P3-3: Align CI runtime with production and tighten install determinism

**Evidence**

- CI uses Node 18 (`.github/workflows/test.yml:22`, `.github/workflows/audit.yml:19`).
- Docker runtime uses Node 20 (`Dockerfile:1`, `Dockerfile:11`).

**Risk**

Version drift can hide production-only issues.

**Upgrade**

- Move CI to Node 20.
- Use `npm ci` instead of `npm install` for deterministic lockfile installs.

---

### P3-4: Fix config/documentation drift

**Evidence**

- `.env.example` omits several runtime-critical variables (`COLLAB_DB_PATH`, `AUDIO_STORAGE_PATH`, `AUDIO_ADMIN_TOKEN`, etc.).
- README route table includes `DELETE /api/progression` but server does not implement it.

**Upgrade**

- Make `.env.example` exhaustive for supported runtime options.
- Keep README route matrix generated from source-of-truth route metadata.

---

## Recommended Implementation Plan

### Phase 0 (Immediate: same day)

1. Protect `/collab` in production.
2. Remove default audio token fallback and query-token auth.
3. Make proxy trust explicit per environment.

### Phase 1 (1-2 days)

1. Fix auth/progression/scroll contract mismatches.
2. Fix collab enum drift and lock transaction bug.
3. Remove ESM/CJS `require` runtime hazards.

### Phase 2 (3-5 days)

1. Introduce shared `WordLookupService` and de-duplicate lookup stack.
2. Add DB migration framework + pragmas + indexes.
3. Add graceful shutdown lifecycle and API-specific notFound behavior.

### Phase 3 (ongoing hardening)

1. Add route integration suites and contract tests.
2. Add readiness/metrics/log normalization.
3. Align CI/runtime/config docs and enforce in PR checks.

---

## Definition of Done Checklist

- [x] No unauthenticated production mutation surface on `/collab`.
- [x] Audio upload/list admin path no longer depends on query-token fallback.
- [x] Frontend auth/progression/scroll flows match implemented server contract.
- [x] Word lookup has one canonical business service path.
- [x] DB schema is migration-driven (no ad hoc drift).
- [x] Route integration tests cover critical auth/data paths.
- [x] CI uses Node 20 + deterministic install strategy.
- [x] README + `.env.example` are accurate and complete.
