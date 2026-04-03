# PDR: Live Website Hosting — Remote Collab Plane Access

**Subtitle:** Passwordless agent orchestration over public network with zero-trust security

**Status:** Implemented
**Classification:** Infrastructure + Security + Collaboration
**Priority:** High
**Primary Goal:** Enable AI agents to connect to Scholomance's collab control plane from the live website without password friction, while maintaining security through allow-listed agent keys and transport encryption.

---

## 1. Executive Summary

Scholomance's collab control plane currently runs on `localhost:3000` with session-cookie authentication via `/auth/login`. This works for local development but blocks remote agent participation. This PDR defines a passwordless, secure path to expose the collab plane on the live website, enabling distributed AI agents to register, claim tasks, acquire locks, and coordinate without interactive login.

---

## 2. Problem Statement

**Current state:**
- Collab plane bound to `localhost:3000`
- Agent registration requires interactive login (`/auth/login` with username/password)
- Session cookies stored in `/tmp/scholomance_cookie.txt` — not shareable across machines
- MCP bridge is a local stdio process — cannot be reached remotely
- No mechanism for remote agents to prove identity without credentials

**Impact:**
- Only agents running on the host machine can participate in collab coordination
- Remote AI agents (Claude, Gemini, Blackbox on other infrastructure) cannot join the orchestration plane
- Task assignment, file locking, and pipeline coordination are single-machine only
- The collab plane's value as a multi-agent coordination surface is capped at 1 machine

---

## 3. Product Goal

Enable **passwordless, secure agent registration** on the live website so that:
1. Any authorized AI agent can connect to the collab plane from any network location
2. No interactive login or password is required — agents authenticate via pre-shared agent keys
3. All collab operations (tasks, locks, pipelines, activity) are available remotely
4. Security is maintained through allow-listed agent identities, rate limiting, and transport encryption

---

## 4. Non-Goals

- **Not** a general user authentication system — this is agent-only access
- **Not** a replacement for local development auth — localhost login still works
- **Not** a public API — only pre-registered agents may connect
- **Not** a browser-based UI change — the collab console UI remains unchanged
- **Not** removing auth entirely — replacing password auth with key-based auth for agents

---

## 5. Core Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Keys, not passwords** | Agents are machines — they don't type passwords. Pre-shared keys are the standard pattern for machine-to-machine auth. |
| **Allow-list over deny-list** | Per `security/ai-tools.policy.json` mode `deny-by-default` — only known agents may connect. Unknown agents are rejected before auth. |
| **Transport encryption mandatory** | All remote collab traffic must use HTTPS. No plaintext agent keys over the wire. |
| **Rate-limited per agent** | Per `security/qa-map.json` — DoS protection via rate limiting on all collab endpoints. |
| **No session cookies for agents** | Agent auth is stateless — each request carries the agent key. No cookie jar needed. |
| **Localhost unchanged** | Local dev experience (`npm run dev:server` + `connect-collab.js`) remains password-based. |

---

## 6. Feature Overview

### 6.1 Agent Key Registration

Angel (repository owner) generates agent keys during initial setup:

```bash
node scripts/collab-admin.js generate-agent-key --agent-id qwen-code --role backend
# Output: sk-scholomance-qwen-code-a1b2c3d4e5f6...
```

Keys are stored server-side in a new `collab_agent_keys` table. The key is shared with the agent out-of-band (not committed to the repo).

### 6.2 Remote Agent Authentication

Agents authenticate by including their key in the `Authorization` header:

```
Authorization: Bearer sk-scholomance-qwen-code-a1b2c3d4e5f6...
```

The server validates the key against the allow-list, derives the agent identity, and processes the request.

### 6.3 Dual Auth Path

| Path | Auth Method | Use Case |
|------|-------------|----------|
| `/auth/login` (existing) | Username + password + CSRF | Local dev, human users |
| `/collab/*` (new) | Bearer token (agent key) | Remote agents, CI/CD |

Both paths converge on the same `collabService` — the auth layer is the only difference.

### 6.4 Agent Key Rotation

Angel can rotate keys at any time:

```bash
node scripts/collab-admin.js rotate-agent-key --agent-id qwen-code
# Old key invalidated immediately. New key issued.
```

---

## 7. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Remote Agent (qwen-code, claude-ui, etc.)                  │
│  Has: Agent Key (sk-scholomance-...)                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS + Bearer Token
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Live Website (Fastify Server)                              │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ Agent Key Auth   │    │ Session Auth (existing)      │  │
│  │ Middleware       │    │ /auth/login + CSRF           │  │
│  │                  │    │                              │  │
│  │ 1. Extract key   │    │ 1. Check session cookie      │  │
│  │ 2. Validate key  │    │ 2. Verify CSRF token         │  │
│  │ 3. Resolve agent │    │ 3. Resolve user              │  │
│  └────────┬─────────┘    └──────────────┬───────────────┘  │
│           │                             │                   │
│           └─────────────┬───────────────┘                   │
│                         ▼                                   │
│              ┌──────────────────────┐                       │
│              │  Collab Routes       │                       │
│              │  /collab/agents      │                       │
│              │  /collab/tasks       │                       │
│              │  /collab/locks       │                       │
│              │  /collab/pipelines   │                       │
│              │  /collab/activity    │                       │
│              │  /collab/bugs        │                       │
│              └──────────┬───────────┘                       │
│                         ▼                                   │
│              ┌──────────────────────┐                       │
│              │  Collab Service      │                       │
│              │  (collab.service.js) │                       │
│              └──────────┬───────────┘                       │
│                         ▼                                   │
│              ┌──────────────────────┐                       │
│              │  Collab Persistence  │                       │
│              │  (SQLite + WAL)      │                       │
│              └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Module Breakdown

### 8.1 New: Agent Key Auth Middleware

**File:** `codex/server/collab/collab.agent-auth.js`

- Extracts `Authorization: Bearer <key>` header
- Validates key against `collab_agent_keys` table
- Resolves agent identity (id, name, role, capabilities)
- Sets `X-Agent-ID` on the request for downstream handlers
- Returns 401 for invalid/missing/expired keys

### 8.2 New: Agent Key Admin Script

**File:** `scripts/collab-admin.js`

Commands:
- `generate-agent-key --agent-id <id> --role <role>`
- `rotate-agent-key --agent-id <id>`
- `revoke-agent-key --agent-id <id>`
- `list-agent-keys`

### 8.3 New: Database Migration

**File:** `codex/server/collab/migrations/010_agent_keys.js`

```sql
CREATE TABLE IF NOT EXISTS collab_agent_keys (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES collab_agents(id),
    key_hash TEXT NOT NULL,  -- bcrypt hash, never stored plaintext
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,     -- NULL = never expires
    revoked_at DATETIME,     -- NULL = active
    created_by TEXT          -- Angel's agent ID
);
```

### 8.4 Modified: Collab Routes

**File:** `codex/server/collab/collab.routes.js`

Add pre-handler that tries agent key auth first, falls back to session auth:

```js
async function collabAuthPreHandler(request, reply) {
    // Try agent key auth first
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        const agent = await validateAgentKey(authHeader.slice(7));
        if (agent) {
            request.headers['x-agent-id'] = agent.id;
            return;
        }
    }
    // Fall back to session auth (existing)
    // ... existing session validation ...
}
```

### 8.5 Modified: Collab Client

**File:** `scripts/collab-client.js`

Add `AGENT_KEY` environment variable support:

```js
const AGENT_KEY = process.env.AGENT_KEY;
if (AGENT_KEY) {
    headers['Authorization'] = `Bearer ${AGENT_KEY}`;
}
```

---

## 9. Security Protocol Integration

### 9.1 From `security/qa-map.json`

| Security Issue | Check | How This PDR Addresses It |
|----------------|-------|---------------------------|
| `auth-bypass` | `auth-middleware` | Agent key auth is a parallel auth path, not a bypass. Same service layer validates both. |
| `hardcoded-secrets` | `client-key-storage` | Agent keys are **never** stored client-side in the repo. They are environment variables or secret manager values. |
| `dos` | `rate-limit` | Rate limiting applied per agent key (existing `@fastify/rate-limit` covers this). |
| `input-validation` | `schema-validation` | All collab endpoints already use Zod schemas — unchanged. |
| `information-exposure` | `error-redaction` | Auth failures return generic 401 — no key hints or agent details leaked. |
| `ai-tools` | `ai-policy` | `security/ai-tools.policy.json` mode `deny-by-default` — only allow-listed agents may connect. |

### 9.2 From `security/dependency-allowlist.json`

All dependencies used are already allow-listed:
- `bcrypt` — key hashing
- `@fastify/rate-limit` — rate limiting
- `@fastify/helmet` — security headers
- `zod` — schema validation (already in use)

No new dependencies required.

### 9.3 Transport Security

- **HTTPS mandatory** for remote access — agent keys must never travel over plaintext HTTP
- **HSTS header** enforced via `@fastify/helmet`
- **CORS restricted** — only known agent origins allowed (configurable via env var `COLLAB_ALLOWED_ORIGINS`)

### 9.4 Key Storage

- Keys stored as **bcrypt hashes** — even if the database is compromised, keys cannot be reversed
- Keys are **never logged** — request logs show agent ID, not the key
- Keys are **never returned** in API responses — registration returns agent metadata, not the key

---

## 10. Implementation Phases

### Phase 1: Agent Key Infrastructure (Backend)
- Database migration for `collab_agent_keys` table
- `collab.agent-auth.js` middleware
- `scripts/collab-admin.js` admin tool
- Key validation in collab routes pre-handler
- **QA:** Unit tests for key validation, hash verification, rotation, revocation

### Phase 2: Remote Client Support
- `AGENT_KEY` env var in `collab-client.js`
- `heartbeat-pulse.mjs` supports remote URLs
- Update `VAELRIX_LAW.md` §14 with remote auth path
- **QA:** Integration tests for remote agent registration and heartbeat

### Phase 3: Live Deployment
- HTTPS configuration for production server
- CORS allow-list configuration
- Rate limiting tuned for remote agents
- Agent key generation for all canonical agents (per VAELRIX_LAW.md §14.6)
- **QA:** End-to-end test: remote agent connects, claims task, acquires lock, completes task

---

## 11. QA Requirements

| Test | Type | Pass Criteria |
|------|------|---------------|
| Valid key accepted | Unit | 200 response, agent ID resolved |
| Invalid key rejected | Unit | 401 response, no agent details leaked |
| Revoked key rejected | Unit | 401 response |
| Expired key rejected | Unit | 401 response |
| Key not in logs | Integration | Server logs contain agent ID, not key |
| Key not in responses | Integration | No API response contains key material |
| Rate limit enforced | Integration | >N requests/min returns 429 |
| HTTPS required | Integration | HTTP request to remote endpoint returns 301→HTTPS |
| CORS enforced | Integration | Unknown origin returns 403 |
| Localhost unchanged | Regression | Password login still works on localhost |

---

## 12. Success Criteria

1. **Remote agent can register** — `curl -H "Authorization: Bearer sk-..." https://live-site/collab/agents/register` succeeds
2. **Remote agent can heartbeat** — Pulse script runs against live URL, agent stays online
3. **No password required** — Agent connects using key only, no username/password flow
4. **Security audit passes** — All 16 security checks from `security/qa-map.json` pass
5. **Localhost unchanged** — Local dev auth (`connect-collab.js connect`) still works with username/password
6. **Key rotation works** — Angel rotates a key, old key immediately stops working, new key works

---

## 13. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLAB_AGENT_KEY_AUTH` | `false` | Enable agent key auth on collab endpoints |
| `COLLAB_REMOTE_ACCESS` | `false` | Allow non-localhost origins |
| `COLLAB_ALLOWED_ORIGINS` | `""` | Comma-separated list of allowed CORS origins |
| `COLLAB_RATE_LIMIT_MAX` | `60` | Max requests per agent per minute |
| `COLLAB_KEY_EXPIRY_DAYS` | `90` | Default key expiry (0 = never) |

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent key leaked in logs | Low | Critical | Key is never logged. Only agent ID appears in logs. |
| Key brute-forced | Low | Critical | Keys are 32+ random bytes. bcrypt hash prevents offline attack. |
| Replay attack | Medium | High | Future: add request signing with timestamps. Phase 1: HTTPS + short key rotation cycle. |
| DoS via auth endpoint | Medium | Medium | Rate limiting per IP + per key. `@fastify/rate-limit` handles this. |
| Accidental key commit | Medium | High | `.gitignore` pattern for `*.key` files. Pre-commit hook scans for `sk-scholomance-` pattern. |

---

*PDR Author: qwen-code*
*Date: 2026-04-03*
*Classification: Infrastructure + Security + Collaboration*
