# PDR: Collab Console VS Code Experience
## Transposing the Sacred Geometry into the Editor Surface

**Status:** Draft
**Classification:** UI + Collaboration + VS Code Integration
**Priority:** High
**Primary Goal:** Make the Scholomance Collab Console (@src/pages/Collab/**) fully functional and visually integrated within the VS Code environment for both human operators and AI agents.

---

# 1. Executive Summary
The Scholomance Collab Console is currently a web-first surface. While powerful, its "Sacred Geometry" (3-panel layout, activity feeds, task boards) is disconnected from the primary engineering environment: VS Code. This PDR proposes a tight integration that brings the Collab Console into VS Code via a dedicated Webview, bridges ephemeral features (like Messaging) to the server for agentic access, and ensures the Collab Control Plane is the authoritative "World Law" across all surfaces.

# 2. Problem Statement
1. **Context Switching:** Developers must leave VS Code to view the Task Board or Activity Feed.
2. **Disconnected Agents:** AI agents (like those in VS Code) cannot participate in "Ritual Messaging" (@AgentMessaging.jsx) because it currently relies on browser-only `BroadcastChannel`.
3. **Ghost Locks:** File locks are visible in the UI but invisible in the VS Code explorer, leading to "accidental" edit attempts that fail only at the server level.
4. **Auth Fragmentation:** Authentication (Law 14) is split between browser cookies and local MCP trust, creating friction for hybrid workflows.

# 3. Product Goal
Establish VS Code as a first-class citizen of the Collab Control Plane, where:
- The full Collab UI can be rendered in a VS Code panel.
- Agents in VS Code can message agents in the browser in real-time.
- Task status and file locks are visually indicated within the editor substrate.
- The "Sacred Geometry" layout is preserved but adapted for the smaller editor sidebars/panels.

# 4. Non-Goals
- Replacing the Web UI entirely (it remains the authoritative "Big Screen" view).
- Building a full VS Code Extension from scratch (we will use MCP as the primary bridge).
- Supporting remote VS Code instances (local development only for now).

# 5. Core Design Principles
1. **Authority Convergence:** Every action (Claim, Message, Advance) must go through `collab.service.js`.
2. **Ephemeral to Eternal:** Messaging must be persisted server-side so VS Code agents can access "past thoughts."
3. **Environment Awareness:** React components must detect the `vscode` environment and adapt styling (e.g., removing the topbar, using VS Code theme variables).
4. **Law 14 Enforcement:** Secure, frictionless agent registration within the editor.

# 6. Feature Overview

## 6.1 Server-Side Messaging (The "Thought-Thread" Persistence)
**Current:** `AgentMessaging.jsx` uses `BroadcastChannel`.
**Proposed:**
- New SQLite table `collab_messages` (persisted or in-memory but server-side).
- New MCP Tools: `collab_message_send`, `collab_message_list`.
- UI updates to poll or use WebSockets for real-time sync with server state.

## 6.2 VS Code Webview Integration
**Component Adaptation:**
- Update `CollabPage.jsx` to support a "compact" mode for VS Code sidebar.
- Detect VS Code API: `const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;`.
- Use VS Code CSS variables (`--vscode-editor-background`, etc.) to match the editor's theme.

## 6.3 Command Palette & Status Bar
- Expose `collab_status_get` to the VS Code status bar (showing "X Agents Online").
- Command: "Scholomance: Open Collab Console" -> Launches Webview.
- Command: "Scholomance: Claim Current File" -> Triggers `collab_task_assign` for the active editor.

## 6.4 Lock Overlays (The "Grimoire Gutter")
- Visual markers in the editor gutter when a file is locked by another agent.
- Read-only mode enforcement in VS Code when a lock is active but not owned by the user.

# 7. Architecture
```
[ VS Code Environment ] <───> [ Scholomance Server (Fastify) ] <───> [ Web UI (React) ]
          │                             │                              │
          ▼                             ▼                              ▼
[ MCP Bridge ] <──────────────> [ Collab Service ] <───────────> [ REST / WebSocket ]
          │                             │                              │
          └─────────────────────────────┴──────────────────────────────┘
                                        │
                                        ▼
                                 [ SQLite / Persistence ]
```

# 8. Module Breakdown
- **`codex/server/collab/mcp-bridge.js`**: Add messaging tools and "UI Link" resource.
- **`src/pages/Collab/AgentMessaging.jsx`**: Refactor to use server-side persistence.
- **`src/pages/Collab/CollabPage.jsx`**: Add "VS Code Mode" layout logic.
- **`scripts/vscode-init.js`**: (New) A helper to configure the VS Code environment for Scholomance agents.

# 10. Implementation Phases

## Phase 1: Persistence & Bridge Parity
- Implement `collab_messages` table and service methods.
- Add `collab_message_send` and `collab_message_list` to MCP Bridge.
- Refactor `AgentMessaging.jsx` to fetch/send to server.

## Phase 2: Webview Compatibility
- Update `CollabPage.css` with VS Code theme variable mappings.
- Add environment detection to `App.jsx` / `CollabPage.jsx`.
- Ensure React build can be served and rendered correctly in a VS Code iframe/webview.

## Phase 3: Extension Surface
- Create a minimal VS Code extension (or `tasks.json` / `settings.json` integration) that registers the MCP server.
- Add the "Open Console" command.

# 11. QA Requirements
- Message sent from VS Code agent must appear in browser UI.
- Task claimed in browser UI must show "Locked" status in VS Code toolset.
- CSS must not "break" when switching between Dark/Light VS Code themes.

# 12. Success Criteria
- [ ] AI agents in VS Code can send/receive ritual messages.
- [ ] Humans can view the full Task Board inside a VS Code panel.
- [ ] No divergence in "World Law" between the two surfaces.
