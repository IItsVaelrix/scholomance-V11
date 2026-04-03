# BUG-2026-04-03-LOCK-SYNC-SPLIT

**Title:** Dual Persistence Split — File Locks Never Created in Service Layer
**Severity:** CRIT
**Category:** BACKEND / PERSISTENCE
**Status:** NEW
**Source:** runtime
**Reporter:** qwen-code
**Date:** 2026-04-03

---

## Summary

The collab service's `assignTaskInternal()` calls `persistence.tasks.assignWithLocks()` from `codex/server/persistence.adapter.js`. This function updates the task row correctly but **never creates file locks**. The test layer reads locks from `collab.persistence.js`, which has a real lock implementation — but the service never writes to it.

Two parallel persistence modules exist:
- `codex/server/persistence.adapter.js` — Service layer adapter (lock support is a stub)
- `codex/server/collab/collab.persistence.js` — Collab persistence (real lock implementation)

The service imports from the adapter. The tests import from collab persistence. They share the same SQLite file but the service's adapter never writes locks, so the test always reads an empty lock table.

## Impact

- Pipeline auto-assignment appears to succeed (task gets `assigned_agent`) but no file locks are created
- Lock conflict detection is non-functional in the service layer
- `checkLock()` always returns `null` for service-created assignments
- Pipeline stage tasks can be stolen by concurrent agents without lock protection
- Tests fail because they verify real behavior that the stub doesn't implement

## Reproduction

1. Register an agent with role `ui`
2. Create a task with `file_paths: ['src/pages/Collab/test.jsx']`
3. Call `collabService.createPipeline({ pipeline_type: 'ui_feature', trigger_task_id, actor_agent_id: 'agent-ui' })`
4. Observe: `result.stage_task.assigned_agent === 'agent-ui'` ✓
5. Observe: `collabService.checkLock('src/pages/Collab/test.jsx') === null` ✗

## Root Cause

**Dual database split.** Two completely separate SQLite databases exist:

| Module | Env Var | Database |
|--------|---------|----------|
| `persistence.adapter.js` | `USER_DB_PATH` | `abyss.sqlite` (user data: auth, settings, user tasks) |
| `collab.persistence.js` | `COLLAB_DB_PATH` | Temp test DB (collab plane: agents, collab tasks, locks) |

The service's `createPipelineStageTask` calls `persistence.tasks.create()` — which writes to the **user database** (`abyss.sqlite`). Then `autoAssignStageTask` calls `persistence.tasks.assignWithLocks()` — which reads from the **user database** and finds the task there. But the test checks `collabPersistence.locks.getAll()` — which reads from the **collab database** (empty).

The `persistence.adapter.js` `assignTaskWithLocks` was a stub that never created locks. Even after delegating to `collabPersistence.tasks.assignWithLocks()`, the collab persistence can't find the task because it was created in the user database, not the collab database.

**The service layer is wired to the wrong persistence layer for collab operations.**

## Fix

**Migrate all collab task operations from `persistence` (user DB) to `collabPersistence` (collab DB).**

The following changes were made in `codex/server/collab/collab.service.js`:

| Function | Before | After |
|----------|--------|-------|
| `getTaskOrThrow` | `persistence.tasks.getById` | `collabPersistence.tasks.getById` |
| `createPipelineStageTask` | `persistence.tasks.create` | `collabPersistence.tasks.create` |
| `assignTaskInternal` | `persistence.tasks.assignWithLocks` | `collabPersistence.tasks.assignWithLocks` |
| `listTasks` | `persistence.tasks.getAll` | `collabPersistence.tasks.getAll` |
| `createTask` | `persistence.tasks.create` | `collabPersistence.tasks.create` |
| `updateTask` | `persistence.tasks.update` | `collabPersistence.tasks.update` |
| `deleteTask` | `persistence.tasks.delete` | `collabPersistence.tasks.delete` |
| `createPipeline` | `persistence.tasks.getById` (trigger) | `collabPersistence.tasks.getById` |
| `advancePipeline` | `persistence.tasks.getById` (trigger) | `collabPersistence.tasks.getById` |

The `persistence.adapter.js` stub was left in place — it serves the user data layer (auth, settings). The collab service now correctly uses `collabPersistence` for all collab-plane operations.

## Verification

- `tests/collab/collab.service.test.js`: 5/5 pass (was 3/5)
- `tests/collab/` + `tests/qa/features/collab.qa.test.jsx`: 72/72 pass
- `npm run lint`: clean
- `npm run build`: success

## Files Affected

- `codex/server/persistence.adapter.js` — Stub implementation (line 717)
- `codex/server/collab/collab.service.js` — Consumer (line 123)
- `tests/collab/collab.service.test.js` — Failing tests (lines 108, 135)

## Bytecode

N/A — Pure backend logic bug, no PixelBrain bytecode involved.

## Recovery Hints

- No data migration needed — the `collab_file_locks` table schema is correct
- The fix is purely in the JavaScript layer
- Existing tasks with missing locks can be audited post-fix with a backfill script
