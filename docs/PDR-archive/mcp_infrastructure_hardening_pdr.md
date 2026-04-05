# PDR: MCP Infrastructure Hardening

**Subtitle:** Convert runtime collapses into startup failures, add a liveness layer, and close the gaps between the persistence contract and its callers

**Status:** Draft
**Classification:** Infrastructure + Resilience + MCP
**Priority:** High
**Primary Goal:** Ensure the MCP collab server fails loudly at startup when its persistence contract is broken, never silently at agent call time.

---

## 1. Executive Summary

The Scholomance MCP collab server has a structural fragility: the persistence layer (`collab.persistence.js`) is assembled manually and its callers (`collab.service.js`, `collab.agent-qa.js`) reference methods that may or may not exist on the exported object. When a method is missing, the server starts successfully, all tools appear healthy, and the failure only surfaces when an agent actually calls a tool — often mid-session, with no recovery path.

This PDR defines six hardening measures that collectively convert this class of failure from a runtime surprise into a startup assertion, add a lightweight liveness check independent of the persistence layer, close the three currently missing persistence methods, make the diagnostic engine self-sufficient, and establish a CI gate that prevents the pattern from recurring.

---

## 2. Problem Statement

**Observed failures (2026-04-05 session):**

| Tool | Error | Root Cause |
|------|-------|------------|
| `collab_agent_register` | `collabPersistence.agents.unassignTasks is not a function` | Method not exported from persistence layer |
| `collab_status_get` | `collabPersistence.tasks.getCounts is not a function` | Method not exported from persistence layer |
| `collab_diagnostic_scan` (Phase 2) | Cascades from `getStatus()` failure | Diagnostic calls service which calls missing method |

**Impact:**
- No agent can register → collab board has no live presence
- No status dashboard → operators blind to system state
- Tasks assigned to `claude-ui` without a live registration record → ghost-assigned tasks
- Minimax and other agents cannot be assigned until they self-register, which also fails

**Structural cause:**
The persistence object is a plain JS object literal with no runtime contract enforcement. The service layer calls methods by string name. There is no compile-time check, no startup validation, and no CI test that asserts the contract is complete. A method can be removed or never added and the server will not know until an agent hits the code path.

---

## 3. Product Goal

1. **Startup fails loudly** when the persistence contract is incomplete — not at agent call time
2. **A liveness check** is always available independent of persistence method correctness
3. **The three missing methods** are implemented and the contract is closed
4. **The diagnostic engine** can run its full Phase 2 scan even when `getStatus()` is broken
5. **CI prevents regression** — a contract test blocks merge if a persistence method is missing
6. **Agent assignment supports offline agents** — tasks can be assigned to a known agent ID even when that agent is not currently registered

---

## 4. Non-Goals

- Not a rewrite of the persistence layer — `collabPersistence` stays as a plain object, no ORM
- Not adding TypeScript to `collab.persistence.js` — contract enforcement is runtime + test, not compile-time
- Not changing the MCP tool surface — no new tools, no renamed tools
- Not addressing `mcp-probe.js` transport testing — the probe is correct at its layer; this PDR adds a tool-execution probe on top
- Not fixing Render deployment restart behavior — that is infrastructure, not code

---

## 5. Core Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Fail at birth, not at runtime** | A broken persistence contract should kill the server process at startup, not fail silently under load |
| **Liveness ≠ readiness** | A lightweight health ping must not depend on the same methods that break readiness |
| **Diagnostic is a first responder** | The scan tool must remain functional when the system is most broken — it cannot depend on the broken layer it is diagnosing |
| **Contract-first** | The persistence export is the source of truth; callers must not reference undeclared methods |

---

## 6. Feature Overview

### 6.1 Persistence Contract Assertion (Startup Guard)

**File:** `codex/server/collab/collab.persistence.js`

Add a `PERSISTENCE_CONTRACT` constant — an exhaustive list of required method paths — and an `assertPersistenceContract(obj)` function that walks the contract and throws immediately if any method is missing or not a function.

Call it at module export time so the failure occurs at `import`, before any route is registered:

```js
const PERSISTENCE_CONTRACT = [
  'agents.register', 'agents.heartbeat', 'agents.getAll', 'agents.getById',
  'agents.delete', 'agents.unassignTasks',
  'tasks.create', 'tasks.getAll', 'tasks.getById', 'tasks.update',
  'tasks.assignWithLocks', 'tasks.delete', 'tasks.getCounts',
  'pipelines.create', 'pipelines.getAll', 'pipelines.getById',
  'pipelines.advance', 'pipelines.fail', 'pipelines.getCounts',
  'locks.acquire', 'locks.release', 'locks.releaseForAgent',
  'locks.releaseForTask', 'locks.check', 'locks.getAll', 'locks.updateMcp',
  'bug_reports.create', 'bug_reports.getAll', 'bug_reports.getById',
  'bug_reports.update', 'bug_reports.delete',
  'memories.set', 'memories.get', 'memories.getAll', 'memories.delete',
  'activity.log', 'activity.getRecent',
  'agent_keys.create', 'agent_keys.getAll', 'agent_keys.getByAgentId',
  'agent_keys.getById', 'agent_keys.revoke', 'agent_keys.revokeAll',
  'agent_keys.delete', 'agent_keys.expire',
  'ledger.getById', 'ledger.ingest', 'ledger.updateStatus', 'ledger.list',
  'getStatus', 'close',
];
```

**Behavior:** If any entry resolves to a non-function, throw a `CollabPersistenceContractError` with the missing path in the message. The server process exits before any agent can connect.

---

### 6.2 Three Missing Persistence Methods

**File:** `codex/server/collab/collab.persistence.js`

Implement and export the three methods currently called but absent:

**`agents.unassignTasks(agentId)`**
```js
function unassignTasksForAgent(agentId) {
  const stmt = db.prepare(`
    UPDATE collab_tasks
    SET assigned_agent = NULL, status = 'backlog', updated_at = datetime('now')
    WHERE assigned_agent = ? AND status NOT IN ('completed', 'failed', 'cancelled')
  `);
  return stmt.run(agentId).changes;
}
```

**`tasks.getCounts()`**
```js
function getTaskCounts() {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status IN ('in_progress', 'assigned') THEN 1 ELSE 0 END) as active_tasks
    FROM collab_tasks
  `).get();
  return { total_tasks: row.total_tasks, active_tasks: row.active_tasks ?? 0 };
}
```

**`pipelines.getCounts()`**
```js
function getPipelineCounts() {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_pipelines,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_pipelines
    FROM collab_pipeline_runs
  `).get();
  return { total_pipelines: row.total_pipelines, running_pipelines: row.running_pipelines ?? 0 };
}
```

---

### 6.3 Liveness Endpoint

**File:** `codex/server/collab/collab.routes.js`

Add `GET /collab/health` — a liveness probe that bypasses the service and persistence layers entirely. It only confirms:

1. The Fastify server is alive and accepting requests
2. The SQLite database is reachable (`SELECT 1`)

```js
fastify.get('/health', async (_req, reply) => {
  try {
    db.prepare('SELECT 1').get(); // direct DB reference, no persistence layer
    return reply.send({ ok: true, ts: Date.now() });
  } catch (err) {
    return reply.code(503).send({ ok: false, error: err.message });
  }
});
```

This endpoint must remain functional even when `collabPersistence` methods are broken. The diagnostic scan, the MCP probe, and external monitors should check this first.

---

### 6.4 Diagnostic Phase 2 Bypass

**File:** `codex/server/collab/collab.diagnostic.js`

Phase 2 currently calls `collabService.getStatus()` which chains to the broken persistence methods. Fix: Phase 2 calls `collabPersistence` directly for its invariant checks, not through the service layer:

```js
// Before (fragile):
const status = collabService.getStatus(); // explodes if getCounts missing

// After (resilient):
const agents = collabPersistence.agents.getAll();    // direct, no getCounts
const tasks = collabPersistence.tasks.getAll();       // direct, no getCounts
const locks = collabPersistence.locks.getAll();       // direct
```

The diagnostic should also catch and report persistence contract violations explicitly — if `assertPersistenceContract` throws, record it as a `CRIT` bytecode error in the scan result rather than crashing the diagnostic itself.

---

### 6.5 MCP Tool Execution Probe

**File:** `codex/server/collab/mcp-probe.js`

The existing probe verifies transport + tool listing. Add an optional `probeTools` phase that actually calls a known-safe read tool (`collab_status_get`) and reports the result. This converts the probe from a connection test into a functional test:

```js
// New probe phase — runs after listTools if opts.probeToolExecution is true
report.stage = 'probeToolExecution';
const toolResult = await withTimeout(
  client.callTool({ name: 'collab_status_get', arguments: {} }),
  timeoutMs,
  'probeToolExecution'
);
report.tool_probe = {
  tool: 'collab_status_get',
  ok: !toolResult.isError,
  content: toolResult.content?.[0]?.text ?? null,
};
```

The probe runner (`scripts/qa-audit.js` or equivalent) should use this in CI and surface tool-level failures separately from transport failures.

---

### 6.6 Persistence Contract CI Test

**File:** `tests/unit/collab.persistence.contract.test.js` *(new)*

A lightweight Vitest unit test that imports `collabPersistence` and asserts every method in `PERSISTENCE_CONTRACT` exists and is a function. Runs in ~50ms with no database (uses a temp in-memory SQLite). Blocks merge if any method is missing.

```js
import { collabPersistence } from '../../../codex/server/collab/collab.persistence.js';

const CONTRACT = [/* same list as 6.1 */];

for (const path of CONTRACT) {
  test(`persistence contract: ${path}`, () => {
    const parts = path.split('.');
    let obj = collabPersistence;
    for (const part of parts) obj = obj?.[part];
    expect(typeof obj).toBe('function');
  });
}
```

---

## 7. Architecture

```
Server Startup
     │
     ▼
assertPersistenceContract(collabPersistence)
     │ PASS                    │ FAIL
     ▼                         ▼
Routes registered         Process exits (CRIT)
     │                    "PERSISTENCE_CONTRACT_VIOLATION: agents.unassignTasks"
     ├── GET /collab/health ──→ SELECT 1 only (always available)
     ├── collab_status_get ──→ service.getStatus() → tasks.getCounts() ✓
     ├── collab_agent_register → agents.unassignTasks() ✓
     └── collab_diagnostic_scan → persistence.agents.getAll() direct ✓

CI Gate
     │
     ▼
persistence.contract.test.js
     │ PASS                    │ FAIL
     ▼                         ▼
Build continues           Merge blocked
                          "Missing: pipelines.getCounts"
```

---

## 8. Module Breakdown

| Change | File | Type |
|--------|------|------|
| `PERSISTENCE_CONTRACT` + `assertPersistenceContract` | `collab.persistence.js` | Add |
| `unassignTasksForAgent`, `getTaskCounts`, `getPipelineCounts` | `collab.persistence.js` | Add |
| `GET /collab/health` | `collab.routes.js` | Add |
| Phase 2 direct persistence access | `collab.diagnostic.js` | Modify |
| `probeToolExecution` phase | `mcp-probe.js` | Add |
| Contract unit test | `tests/unit/collab.persistence.contract.test.js` | New |

---

## 9. Implementation Phases

### Phase 1 — Immediate (unblocks current session)
- Implement the three missing methods (`unassignTasks`, `getCounts` × 2)
- Add `assertPersistenceContract` with the full contract list
- **Result:** `collab_agent_register` and `collab_status_get` unblock. All agents can register.

### Phase 2 — Resilience
- Add `GET /collab/health` liveness endpoint
- Fix Phase 2 of diagnostic to bypass service layer
- **Result:** Diagnostic and health check survive persistence failures independently.

### Phase 3 — CI Gate
- Add `collab.persistence.contract.test.js`
- Wire `mcp-probe.js` tool execution phase into `scripts/qa-audit.js`
- **Result:** This class of bug is blocked at merge time, never reaches production.

---

## 10. QA Requirements

| Test | Type | Pass Criteria |
|------|------|---------------|
| Contract assertion fires on missing method | Unit | Process throws `PERSISTENCE_CONTRACT_VIOLATION` with method path if any method removed |
| `unassignTasks` releases tasks on agent eviction | Integration | Tasks assigned to evicted agent return to `backlog` |
| `getCounts` returns correct active/total counts | Unit | Counts match direct `SELECT COUNT` query |
| `GET /collab/health` returns 200 when DB is up | Integration | Response `{ ok: true }` within 100ms |
| `GET /collab/health` returns 503 when DB is gone | Integration | Response `{ ok: false }` if SQLite file deleted |
| Diagnostic Phase 2 completes without `getStatus` | Integration | Scan returns invariant results even with `getCounts` stubbed to throw |
| MCP probe tool execution phase catches broken tool | Integration | `tool_probe.ok: false` when `collab_status_get` returns error |
| CI contract test blocks missing method | Unit | Test fails if any `PERSISTENCE_CONTRACT` entry removed from exports |

---

## 11. Success Criteria

1. **`collab_agent_register` and `collab_status_get` return `ok: true`** — the immediate session blockers are resolved
2. **Server startup fails within 500ms** if any persistence contract method is missing — before any agent connects
3. **`GET /collab/health` always returns within 100ms** regardless of persistence layer state
4. **`collab_diagnostic_scan` completes** even when `getStatus()` would throw
5. **CI test suite blocks merge** if a persistence method is removed without updating the contract list
6. **Zero recurrence** — this exact class of failure (method called but not exported) cannot merge again

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Contract list goes stale as methods are added | Medium | Medium | Contract test fails if new method added to callers but not to contract list — forces explicit update |
| Phase 1 SQL queries have off-by-one on status values | Low | Medium | Unit test asserts counts against known fixture data |
| Health endpoint leaks DB path info on 503 | Low | Low | Return only `{ ok: false, error: 'db_unavailable' }` — no internal path |
| Diagnostic direct-persistence access bypasses service invariants | Low | Low | Diagnostic is read-only — it reads state, never writes |

---

*PDR Author: claude-ui*
*Date: 2026-04-05*
*Classification: Infrastructure + Resilience + MCP*
*Assigned: Codex (Phase 1 immediate) / Codex (Phases 2–3)*
