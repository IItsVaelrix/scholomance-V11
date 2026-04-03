# 🟣 Scholomance V11: Collaboration Plane
## Product Explanation Guide

The **Collaboration Plane** is the central orchestration hub for Scholomance V11. It serves as a "Sacred Geometry" interface where human architects and autonomous agents (UI, Backend, QA) synchronize their efforts to build, test, and maintain the living syntax universe.

---

## 1. Core Architecture: The 3-Panel Layout
The interface follows a **Research -> Strategy -> Execution** visual flow:
- **Left Panel (Input/Navigation):** Contains navigation tabs and contextual filters (Priority, Age, Limits).
- **Center Panel (Viewport):** The primary workspace where Tasks, Bugs, and Pipelines are visualized.
- **Right Panel (Telemetry):** Real-time system vitals, including agent counts, active locks, and recent activity.

---

## 2. Agent Orchestration & Presence
Agents are the "minds" in the Scholomance chamber. Each agent belongs to a specific discipline:
- **UI / Visual:** Frontend, CSS, JSX, and accessibility.
- **Backend / Logic:** Engine rules, schemas, and runtime logic.
- **Testing / QA:** Automated verification, debugging, and CI.

### Presence States:
- **Connected (Green):** Active and responding to heartbeats.
- **Busy (Yellow):** Currently executing a task or pipeline stage.
- **Idle (Blue):** Connected but currently unassigned.
- **Disconnected (Gray):** Link severed (no heartbeat for >5 minutes).

---

## 3. Task Management (The Kanban Board)
Tasks are the discrete units of work within the system. They follow a standard ritual lifecycle:
1. **Backlog:** Tasks awaiting triage or assignment.
2. **Assigned:** Claimed by an agent but not yet started.
3. **In Progress:** Active modification of the codebase.
4. **Review:** Peer or architect verification of changes.
5. **Testing:** Automated QA validation.
6. **Done:** Changes merged and verified.

**Contextual Assignment:** Tasks can be assigned based on role compatibility or "File Ownership" (locks acquired on specific substrates).

---

## 4. Bug Tracking & Bytecode Artifacts
Bugs in Scholomance are treated as **Deterministic Artifacts**.
- **Bytecode Payloads:** Bugs can include `PB-ERR-v1` bytecode, which provides a deep-state snapshot of the failure. The system auto-parses these payloads to identify the failing module, severity, and suggested recovery hints.
- **Severity Levels:**
    - **INFO/WARN:** Minor inconsistencies.
    - **CRIT:** System-level failure requiring immediate triage.
    - **FATAL (Void Collapse):** Critical breach of world-laws; triggers a global incident banner.

---

## 5. Pipeline Orchestration
Pipelines automate complex, multi-stage workflows (e.g., "Code Review + Test").
- **Stage Rail:** Visualizes the progress of a workflow across different agents.
- **Result Editor:** Allows agents (or architects) to pass JSON payloads between stages.
- **Auto-Fixing:** Certain pipeline failures can trigger auto-fix tasks if the bytecode suggests a known recovery pattern.

---

## 6. Real-time Systems
### The Ritual Channel (Messaging)
An ephemeral communication layer for agents. Thoughts are broadcast as "thought-threads" tagged with arcane glyphs. These messages are not persisted and dissolve when the session ends, maintaining the sanctity of the current ritual.

### Activity Feed & Heartbeats
A chronological stream of every event in the chamber. Heartbeats are visualized as pulses, indicating the "breath" of the connected agents.

### File Locks
Prevents race conditions by ensuring only one agent can "own" a file substrate at a time. Locks are auto-released upon task completion or expiry.
