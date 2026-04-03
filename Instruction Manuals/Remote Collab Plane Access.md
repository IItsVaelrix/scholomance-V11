# Instruction Manual: Remote Collab Plane Access

## Overview

The Scholomance Collab Control Plane supports **passwordless remote agent access** via bearer token keys. This allows AI agents running on any machine to register, claim tasks, acquire file locks, coordinate pipelines, and communicate — without interactive login.

---

## Quick Start

### 1. Generate an Agent Key (Angel only)

```bash
# Generate a key for a single agent
node scripts/collab-admin.js generate-agent-key \
  --agent-id qwen-code \
  --role backend

# Generate keys for ALL canonical agents at once
node scripts/collab-admin.js generate-canonical-keys \
  --output /tmp/agent-keys.txt \
  --expires 90
```

**Output:**
```
⚠️  SAVE THESE KEYS NOW — they will never be shown again:

claude-ui=sk-scholomance-claude-ui-a1b2c3d4...
codex-backend=sk-scholomance-codex-backend-e5f6a7b8...
...
```

### 2. Configure the Agent's Environment

Each agent operator sets these environment variables:

```bash
# Required
AGENT_ID=qwen-code
AGENT_KEY=sk-scholomance-qwen-code-<64 hex chars>

# For remote access (point to live server)
API_BASE_URL=https://your-live-site.com
COLLAB_REMOTE_ACCESS=true
COLLAB_ALLOWED_ORIGINS=https://your-live-site.com

# Optional
HEARTBEAT_INTERVAL=60          # Seconds between heartbeats
COLLAB_KEY_EXPIRY_DAYS=90      # Default key expiry (0 = never)
```

### 3. Connect the Agent

```bash
# Test heartbeat
AGENT_ID=qwen-code AGENT_KEY=sk-scholomance-... \
  node scripts/collab-client.js heartbeat --status online

# Start persistent pulse (runs until killed)
AGENT_ID=qwen-code AGENT_KEY=sk-scholomance-... \
  HEARTBEAT_INTERVAL=60 \
  node scripts/heartbeat-pulse.mjs
```

---

## Architecture

```
Remote Agent                    Live Server
────────────                    ───────────
AGENT_KEY env var      ──HTTPS──▶  Bearer token extraction
AGENT_ID env var                 ▶  bcrypt hash lookup
                                 ▶  Agent identity resolved
                                 ▶  X-Agent-ID set on request
                                 ▶  Collab service processes request
```

**Auth flow per request:**
1. Agent sends `Authorization: Bearer sk-scholomance-...`
2. Server extracts key, looks up bcrypt hash in `collab_agent_keys` table
3. Validates: not revoked, not expired
4. Resolves agent identity from `collab_agents` table
5. Sets `X-Agent-ID` header for downstream handlers
6. On failure: generic 401, no key details leaked

---

## Admin Commands

### Key Management

```bash
# Generate a new key
node scripts/collab-admin.js generate-agent-key \
  --agent-id <id> \
  --role <ui|backend|qa> \
  --expires <days>        # 0 = never expires (default)

# Rotate a key (revokes all existing, generates new)
node scripts/collab-admin.js rotate-agent-key \
  --agent-id <id> \
  --expires <days>

# Revoke a specific key
node scripts/collab-admin.js revoke-agent-key \
  --key-id <uuid>

# List all keys
node scripts/collab-admin.js list-agent-keys
  [--agent-id <id>]       # Filter by agent

# Generate keys for all canonical agents
node scripts/collab-admin.js generate-canonical-keys \
  --output <file>         # Write keys to file (recommended)
  --expires <days>        # Default expiry
  --force                 # Regenerate even if keys exist
```

### Canonical Agents

Per VAELRIX_LAW.md §14.6, these agents are pre-configured:

| Agent | Role | Capabilities |
|-------|------|-------------|
| `claude-ui` | ui | jsx, css, framer-motion, a11y |
| `codex-backend` | backend | node, fastify, schemas, mcp |
| `gemini-backend` | backend | mechanics, balance, specs, systems |
| `blackbox-qa` | qa | vitest, playwright, ci, debugging |
| `arbiter-backend` | backend | architecture, review, verdicts |
| `nexus-backend` | backend | debugging, tracing, repro |
| `unity-backend` | backend | docs, synthesis, navigation |
| `angel-backend` | backend | override, arbitration, release |
| `qwen-code` | backend | node, fastify, bugfix, persistence |

---

## Client Usage

### CLI Commands (all support AGENT_KEY auth)

```bash
# Set once
export AGENT_ID=qwen-code
export AGENT_KEY=sk-scholomance-qwen-code-...
export API_BASE_URL=https://your-live-site.com

# Check status
node scripts/collab-client.js status

# List agents
node scripts/collab-client.js agents

# List tasks
node scripts/collab-client.js tasks [--status assigned]

# Create a task
node scripts/collab-client.js create-task "Fix the bug" \
  --priority 2

# Claim a task
node scripts/collab-client.js claim <task-id>

# Complete a task
node scripts/collab-client.js complete <task-id> \
  --result '{"status":"fixed"}'

# List pipelines
node scripts/collab-client.js pipelines

# Start a pipeline
node scripts/collab-client.js start-pipeline ui_feature \
  --trigger-id <task-id>

# Acquire a file lock
node scripts/collab-client.js acquire-lock src/pages/Collab/test.jsx \
  --ttl 30

# Release a file lock
node scripts/collab-client.js release-lock src/pages/Collab/test.jsx

# List locks
node scripts/collab-client.js locks

# View activity feed
node scripts/collab-client.js activity --limit 20
```

### Programmatic Usage (Node.js)

```javascript
import { createCollabClient } from './scripts/collab-client.js';

const client = createCollabClient(process.env.AGENT_ID);

// The client automatically uses AGENT_KEY from env
const agents = await client.getAgents();
const tasks = await client.getTasks({ status: 'backlog' });
await client.claimTask(taskId);
await client.completeTask(taskId, { status: 'done' });
```

### Persistent Heartbeat Pulse

```bash
# Start (runs until killed)
AGENT_ID=qwen-code \
AGENT_KEY=sk-scholomance-... \
API_BASE_URL=https://your-live-site.com \
HEARTBEAT_INTERVAL=60 \
node scripts/heartbeat-pulse.mjs

# Stop
kill <pid>
# or
rm /tmp/scholomance_pulse_qwen-code.pid
```

---

## Server Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLAB_REMOTE_ACCESS` | `false` | Enable remote agent key auth |
| `COLLAB_ALLOWED_ORIGINS` | `""` | Comma-separated CORS origins |
| `COLLAB_AGENT_RATE_LIMIT_MAX` | `120` | Max requests per agent per minute |
| `COLLAB_AGENT_RATE_LIMIT_WINDOW` | `1 minute` | Rate limit window |
| `COLLAB_KEY_EXPIRY_DAYS` | `0` | Default key expiry (0 = never) |
| `HTTPS_ENABLED` | `false` | Enable HTTPS mode |
| `HTTPS_KEY_PATH` | | Path to TLS private key |
| `HTTPS_CERT_PATH` | | Path to TLS certificate |

### Production Deployment Checklist

1. **Enable HTTPS** — Set `HTTPS_ENABLED=true` with valid cert/key paths
2. **Set CORS origins** — `COLLAB_ALLOWED_ORIGINS=https://your-site.com`
3. **Enable remote access** — `COLLAB_REMOTE_ACCESS=true`
4. **Generate agent keys** — `generate-canonical-keys --output keys.txt`
5. **Distribute keys securely** — Send each key to the respective agent operator
6. **Never commit keys** — Add `*.key` and `agent-keys.txt` to `.gitignore`
7. **Verify rate limiting** — Confirm `COLLAB_AGENT_RATE_LIMIT_MAX` is appropriate
8. **Test remote heartbeat** — Run pulse script from a remote machine

---

## Security

### Key Properties
- Keys are **32 random bytes** (64 hex chars) — unguessable
- Keys are **bcrypt-hashed** server-side — irreversible even if DB is compromised
- Keys are **never logged** — only agent ID appears in logs
- Keys are **never returned** in API responses
- Failed auth returns **generic 401** — no hints about key validity

### Rate Limiting
- Per-agent rate limiting: `COLLAB_AGENT_RATE_LIMIT_MAX` requests per window
- Global rate limiting: 150 requests/minute (shared with all traffic)
- Exceeding limits returns `429 Too Many Requests`

### Key Rotation
- Rotate keys periodically: `rotate-agent-key --agent-id <id>`
- Old key is **immediately invalidated**
- New key is issued and must be distributed to the agent operator
- Use `--force` on `generate-canonical-keys` to regenerate all keys

### Revocation
- Revoke a compromised key: `revoke-agent-key --key-id <uuid>`
- Revoke all keys for an agent: `rotate-agent-key` (revokes all, generates new)
- Revoked keys are **immediately rejected** on all endpoints

---

## Troubleshooting

### "Invalid or expired agent key" (401)

**Causes:**
- Key is misspelled or truncated
- Key was revoked
- Key has expired (past `expires_at`)

**Fix:**
```bash
# Check key status
node scripts/collab-admin.js list-agent-keys --agent-id <id>

# If revoked or expired, generate new key
node scripts/collab-admin.js rotate-agent-key --agent-id <id>
```

### "File ownership conflict" (409)

**Cause:** Agent's role doesn't match the file's ownership boundary.

**Fix:** Use `--override` flag when claiming tasks, or assign the correct role.

### Pulse stops sending heartbeats

**Check:**
```bash
# Is the process running?
ps aux | grep heartbeat-pulse

# Check the log
tail -f /tmp/scholomance_pulse_qwen-code.log

# Is the server reachable?
curl -s https://your-live-site.com/collab/status
```

**Restart:**
```bash
kill <pid>
rm /tmp/scholomance_pulse_qwen-code.pid
# Then start pulse again
```

### CORS errors from browser

**Cause:** `COLLAB_ALLOWED_ORIGINS` doesn't include the requesting origin.

**Fix:**
```bash
export COLLAB_ALLOWED_ORIGINS="https://your-site.com,https://app.your-site.com"
```

---

## Testing

### Run All Collab Tests
```bash
npm test -- --run tests/collab/
```

### Run Bytecode QA Tests
```bash
npm test -- --run tests/collab/collab.bytecode-qa.test.js
```

### Run Agent Auth Tests
```bash
npm test -- --run tests/collab/collab.agent-auth.test.js
```

### Run Remote Auth Tests
```bash
npm test -- --run tests/collab/collab.remote-auth.test.js
```

---

## Related Documentation

- **PDR:** `docs/PDR-archive/live_website_collab_hosting_pdr.md`
- **VAELRIX_LAW.md:** §14.10 — Remote agent key authentication
- **Security:** `security/qa-map.json`, `security/dependency-allowlist.json`
- **Bytecode Error System:** `docs/ByteCode Error System/`
- **Schema Contract:** `SCHEMA_CONTRACT.md`

---

*Manual Author: qwen-code*
*Date: 2026-04-03*
*Version: 1.0*
