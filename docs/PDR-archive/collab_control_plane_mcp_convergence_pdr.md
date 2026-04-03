# PDR: Collab Control Plane + MCP Convergence

## Summary

**Change class:** Architectural + Collaboration + MCP  
**Status:** Draft  
**Priority:** High  
**Goal:** Make the Scholomance collab system a single authoritative multi-agent control plane with parity across REST, CLI, and MCP, while hardening ownership, locking, and pipeline guarantees.

---

# 1. Executive Summary

Scholomance already has the skeleton of a strong collaboration substrate:

- agents can register and heartbeat
- tasks can be created, assigned, and completed
- file locks prevent overlapping edits
- pipelines model staged work across roles
- activity logs create operational traceability
- an MCP bridge now exposes part of that system to external agents

The problem is not lack of primitives. The problem is **surface divergence**.

Today the system is split across:

- Fastify routes under `/collab`
- a CLI client
- a connection script with auth bootstrap
- an MCP bridge over stdio

These surfaces do not all enforce the same rules, expose the same capabilities, or share the same abstraction boundary. The HTTP routes contain more validation and workflow behavior than the MCP bridge. The MCP bridge calls persistence directly. The CLI is usable but brittle. This creates a dangerous state where the control plane exists, but not yet as one coherent law.

This PDR defines the path to converge those surfaces into a single authoritative collaboration system:

- one set of orchestration semantics
- multiple transports
- consistent ownership and lock enforcement
- typed agent tooling through MCP
- predictable task and pipeline progression

The desired outcome is straightforward: whether a human uses the UI, a local script uses HTTP, or an AI agent uses MCP, the same collaboration laws apply.

---

# 2. Problem Statement

The current collab system is already useful for local development, but several weaknesses prevent it from being treated as a first-class orchestration substrate.

## 2.1 Surface divergence

The HTTP API, CLI, and MCP bridge represent overlapping but non-identical capabilities.

- The REST layer exposes agents, tasks, locks, pipelines, activity, and status.
- The MCP bridge exposes agents, tasks, locks, and activity as resources, but only a subset of actions as tools.
- The CLI can reach most of the REST API but requires environment shaping and cookie handling.

This means an agent using MCP cannot reliably perform the full collab workflow without dropping to shell or HTTP.

## 2.2 Authority leakage

The MCP bridge currently imports persistence directly instead of going through route-level orchestration or a dedicated service layer. That bypasses behaviors that should be invariant across transport surfaces:

- ownership validation
- activity logging conventions
- conflict formatting
- route-level lifecycle rules

This makes MCP a side door rather than a formal access path.

## 2.3 Incomplete lock and assignment guarantees

The core system correctly supports transactional task assignment with locks, but not every path uses it.

- direct lock acquisition can currently trust caller-supplied agent identity
- pipeline auto-assignment marks tasks assigned without going through transactional lock acquisition

This can produce states that look valid in the UI while violating the system’s own editing guarantees.

## 2.4 Pipeline contract fragility

Pipeline advancement is close to correct but not fully hardened. A terminal-state pipeline should produce a deterministic, well-typed response across all callers. Instead, the current implementation risks transport-level inconsistency when a completed pipeline is advanced again.

The result is a system that feels structurally good, but still has sharp edges at the exact moments where agents need trust the most.

---

# 3. Product Goal

Establish the Scholomance collab system as the canonical multi-agent coordination plane for local and internal orchestration work.

That means:

- every transport speaks the same semantics
- every mutation path respects ownership and lock law
- every task or pipeline state transition is deterministic
- every agent can coordinate without shell-specific glue
- every action can be audited through a single activity model

This system is not flavor infrastructure. It is the operational spine for coordinated work across backend, UI, QA, and future supporting roles.

---

# 4. Non-Goals

This PDR does not propose:

- turning collab into a public production-facing SaaS
- replacing GitHub, CI, or code review as source-of-truth systems
- implementing cross-repo orchestration
- adding document storage, chat, or general project management features
- making the MCP bridge the source of truth by itself
- changing file ownership doctrine defined elsewhere in the repo

This is a convergence and hardening effort, not a platform expansion effort.

---

# 5. Core Design Principles

## 5.1 One law, many transports

REST, CLI, UI, and MCP are transport surfaces. None of them are the business logic.

The orchestration law must live in one shared layer so every client gets identical behavior.

## 5.2 Ownership before convenience

If a file belongs to a role boundary, every mutation path must respect that boundary unless an explicit override path exists and is visibly recorded.

## 5.3 Locks are operational truth

A task is not truly assigned if the relevant files are not reserved. Task assignment and file reservation must remain coupled.

## 5.4 Deterministic stage progression

Pipelines must move through stages with typed, predictable behavior in both normal and terminal cases. Repeated advance calls must never create ambiguous state or route-level crashes.

## 5.5 Auditability is mandatory

Every meaningful action should be representable in the activity log with enough detail to reconstruct what happened and why.

## 5.6 MCP is first-class, not a shortcut

The MCP bridge should be treated as an equal control surface for agentic workflows, not as an experimental bypass around the HTTP API.

---

# 6. Feature Overview

The converged collab control plane will provide the following capabilities.

## 6.1 Shared read model

All clients must be able to read:

- agents
- tasks
- locks
- pipelines
- recent activity
- summary status

For MCP, these may be exposed as resources and targeted query tools.

## 6.2 Shared write model

All clients must be able to:

- register or update an agent
- send heartbeat updates
- create tasks
- assign tasks through lock-aware orchestration
- update task state
- acquire and release locks
- create pipelines
- advance or fail pipelines

## 6.3 Shared conflict semantics

Every transport should express conflicts through the same conceptual categories:

- validation failed
- ownership conflict
- file lock conflict
- task not found
- agent not found
- pipeline not found
- unauthorized

## 6.4 Shared agent ergonomics

An MCP-capable agent should be able to participate in the full collab workflow without falling back to shell commands for routine operations.

---

# 7. Architecture

## 7.1 Target architecture

```txt
UI / CLI / HTTP clients / MCP clients
                |
                v
      Collab Service Layer (authoritative orchestration)
                |
      ---------------------------------
      |               |               |
      v               v               v
  Validation      Activity Log   Ownership + Lock Rules
                |
                v
         Persistence Adapter
                |
                v
             SQLite
```

## 7.2 Required architectural shift

The key change is the introduction of a dedicated collab service layer between transports and persistence.

### Current

- REST routes contain orchestration logic
- MCP bridge talks directly to persistence
- CLI talks to routes

### Target

- REST routes call collab services
- MCP tools call the same collab services
- CLI remains a client of the HTTP surface
- persistence is only responsible for storage and atomic primitives

This creates one operational law instead of two partially overlapping ones.

## 7.3 Transport responsibilities

### REST routes

- request parsing
- auth boundary
- HTTP status mapping
- serialization

### MCP bridge

- tool/resource declarations
- MCP input schemas
- tool result formatting

### Collab service layer

- business rules
- assignment orchestration
- pipeline stage progression
- ownership checks
- lock checks
- activity emissions

### Persistence

- CRUD
- transactional writes
- lock storage
- pipeline storage
- activity storage

---

# 8. Module Breakdown

## 8.1 `codex/server/collab/collab.service.js` (new)

This module should become the authoritative orchestration layer.

Likely responsibilities:

- `registerAgent`
- `heartbeatAgent`
- `createTask`
- `assignTask`
- `updateTask`
- `completeTask`
- `acquireLock`
- `releaseLock`
- `createPipeline`
- `advancePipeline`
- `failPipeline`
- `getStatus`

It should own behavior that currently lives partly in routes and partly nowhere.

## 8.2 `codex/server/collab/collab.routes.js`

This file should become thinner.

It should:

- validate and coerce request input
- call service functions
- translate domain errors into HTTP responses

It should not remain the only place where orchestration behavior exists.

## 8.3 `codex/server/collab/mcp-bridge.js`

This file should stop mutating persistence directly.

It should:

- expose resources for read surfaces
- expose tools with parity to the service layer
- return structured tool errors that mirror domain conflict categories

## 8.4 `codex/server/collab/collab.persistence.js`

This file should stay focused on:

- schema migrations
- storage access
- transactional assignment primitives
- lock expiration
- pipeline persistence

It should not be the place where transport-specific policy gets invented.

## 8.5 `codex/server/collab/collab.schemas.js`

This file should remain the canonical shape set for route input validation and should be extended where necessary for parity with service and MCP operations.

---

# 9. MCP Contract Design

This system does not require ByteCode IR. It requires **typed orchestration contracts**.

## 9.1 MCP resources

Required read resources:

- `collab://agents`
- `collab://tasks`
- `collab://locks`
- `collab://activity`
- `collab://pipelines`
- `collab://status`

Optional future resources:

- per-task resource by ID
- per-pipeline resource by ID
- filtered activity resource

## 9.2 MCP tools

Required tool parity set:

- `collab_agent_register`
- `collab_agent_heartbeat`
- `collab_task_create`
- `collab_task_assign`
- `collab_task_update`
- `collab_lock_acquire`
- `collab_lock_release`
- `collab_pipeline_create`
- `collab_pipeline_advance`
- `collab_pipeline_fail`

Optional but valuable:

- `collab_status_get`
- `collab_task_get`
- `collab_pipeline_get`

## 9.3 MCP identity model

The bridge should not accept agent identity in ways that allow trivial spoofing for protected operations when a stronger session or invocation-level identity is available.

If identity must still be passed explicitly, the bridge must consistently validate:

- agent exists
- requested action is compatible with agent role
- ownership checks apply where relevant

---

# 10. Implementation Phases

## Phase 1: Correctness Hardening

Fix the known server-side behavioral weaknesses first.

- normalize pipeline advance behavior for terminal states
- ensure pipeline auto-assignment uses transactional lock-aware assignment
- harden direct lock acquisition semantics
- add tests for repeated pipeline advancement and lock spoof paths

## Phase 2: Service Layer Extraction

Move orchestration behavior out of route handlers into a dedicated service module.

- centralize activity logging
- centralize ownership validation
- centralize assignment behavior
- centralize pipeline progression behavior

## Phase 3: MCP Parity

Expand the MCP bridge to reflect the real control plane.

- add missing resources
- add missing mutation tools
- replace direct persistence access with service calls
- standardize error categories

## Phase 4: Client Alignment

Make the shell clients reflect the canonical system.

- improve `scripts/collab-client.js` ergonomics
- ensure help output documents required env vars and auth expectations
- align `scripts/connect-collab.js` role claims with actual schema support

## Phase 5: QA and Operational Readiness

- add route tests for ownership and pipeline edge cases
- add MCP-focused tests for parity and conflicts
- validate activity coverage for all mutation paths
- document expected local setup and agent workflow

---

# 11. QA Requirements

The converged collab plane must ship with direct coverage for the failure modes that matter operationally.

## 11.1 Persistence tests

- assignment remains transactional
- stale locks expire correctly
- pipeline advancement remains deterministic
- terminal pipelines remain stable under repeated calls

## 11.2 Route tests

- validation failures return `400`
- ownership conflicts return `409`
- file lock conflicts return `409`
- unauthorized requests return `401`
- authenticated requests succeed across all collab endpoints

## 11.3 MCP tests

- resources return parseable JSON
- tools map domain errors into MCP errors consistently
- MCP mutations produce the same side effects as HTTP mutations

## 11.4 Cross-surface parity tests

At minimum, the following workflows must behave the same whether initiated via REST or MCP:

- register agent
- create task
- assign task with lock acquisition
- complete task and release locks
- create pipeline
- advance pipeline

## 11.5 Manual verification

- start HTTP server and MCP bridge together
- register at least two agents
- create a file-bound task
- verify ownership-aware assignment
- verify lock conflict surfacing
- verify pipeline creation and stage progression
- verify activity visibility across the full workflow

---

# 12. Success Criteria

This PDR is successful when the following conditions are true.

## 12.1 Semantic convergence

There is one authoritative orchestration layer for collab behavior, and both REST and MCP call it.

## 12.2 Lock integrity

No task can be represented as assigned to an agent while skipping the lock guarantees that protect its file set.

## 12.3 Pipeline safety

Repeated advancement or failure of terminal pipelines does not produce crashes, ambiguous state, or transport-specific behavior.

## 12.4 MCP viability

An MCP-capable agent can complete the ordinary collab workflow without shell fallback for routine coordination tasks.

## 12.5 Audit completeness

Every meaningful state transition produces activity that makes the orchestration trail reconstructible.

## 12.6 Developer trust

Operators can treat collab as a reliable internal control plane rather than a promising prototype.

---

# 13. Related Files

- `codex/server/collab/collab.routes.js`
- `codex/server/collab/collab.persistence.js`
- `codex/server/collab/collab.schemas.js`
- `codex/server/collab/mcp-bridge.js`
- `scripts/collab-client.js`
- `scripts/connect-collab.js`

---

# 14. Proposed Outcome

The collab system should stop being “the REST version plus a separate MCP bridge” and become “one coordination law, available everywhere.”

That is the difference between a useful internal feature and a true orchestration substrate.
