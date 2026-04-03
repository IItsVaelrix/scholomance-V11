# PDR: Collab UI Polish V2
## No Dead Controls, No Dead Features

**Status:** Draft
**Classification:** UI + Collaboration + Operational Trust
**Priority:** High
**Primary Goal:** Bring the Collab console to a truthful, fully purposeful state where every surfaced action is functional, semantically justified, and aligned with actual system capability.

---

# 1. Executive Summary

The Collab console currently presents itself as a polished, production-ready orchestration surface, but several visible controls and workflows are either partially wired, misleading, or entirely session-local. This creates a trust gap: the interface appears more complete than the underlying behavior.

UI Polish V2 is a correction pass focused on operational truth. Every button, filter, drawer section, status indicator, and communication surface must do real work, narrate real system state, or be removed. No dead abilities. No decorative controls pretending to be product.

This PDR defines the audit findings, the governing principles for the polish pass, the required surface changes, implementation phases, and acceptance criteria needed to make the Collab console feel reliable under actual use.

---

# 2. Problem Statement

The current Collab UI has multiple trust-breaking affordances:

- visible controls that do not affect real data
- flows that imply backend validation where no backend route exists
- destructive actions that fall back to browser-native confirmation rather than an in-world confirmation surface
- communication UI that looks multi-agent but currently operates only as ephemeral, session-local BroadcastChannel messaging
- status and conflict surfaces that exist in the layout but are not fed by real conflict state
- implementation drift from the earlier Collab console PDR, which declared the surface fully polished while the runtime behavior remains incomplete

This is not only a usability issue. In Scholomance, the surface is part of the law. A false affordance is a false spell. If a control cannot act on the world, it should not be presented as if it can.

---

# 3. Product Goal

Create a Collab UI pass that guarantees the following:

- every visible button performs a real action or clearly explains why it is unavailable
- every visible filter changes the data shown
- every validation message reflects an actual backend capability or a deterministic client-side rule
- every destructive action uses an intentional in-world confirmation flow
- every panel and drawer section contains useful operational information, not filler
- every messaging or collaboration surface is either truly functional or removed until it is
- every status surface is driven by real state, not inert placeholders

The user should be able to trust that what the console offers is what the system can actually do.

---

# 4. Non-Goals

This polish pass does not aim to:

- redesign the entire Collab visual language from first principles
- introduce a brand-new collaboration backend unrelated to existing `/collab` contracts
- add speculative features that are not yet supported by the control plane
- replace task, pipeline, or agent domain logic owned by the collab backend
- solve every future collaboration feature request in one release

This is a truth-and-purpose pass, not an endless feature grab.

---

# 5. Core Design Principles

## 5.1 Operational truth over optimistic theater

If the backend does not support a workflow, the UI must not simulate confidence around it.

## 5.2 Every control earns its place

A control exists only if it triggers a meaningful state change, reveals meaningful information, or helps the user make a real decision.

## 5.3 Preflight must be real

Compatibility, assignment, and conflict previews must come from actual control-plane logic or deterministic client logic that is explicitly labeled as such.

## 5.4 Destructive actions must feel intentional

Browser-native `confirm()` dialogs break the world and provide weak interaction quality. Destructive actions must use in-world confirmation surfaces.

## 5.5 Surface state must match system state

Status bars, conflict panes, badges, and live indicators must reflect actual runtime state. Inert status architecture is worse than no status architecture.

## 5.6 Remove before pretending

If a feature cannot be made truthful in this pass, it should be hidden, disabled with explanation, or removed from primary navigation until it is ready.

---

# 6. Audit Findings

## 6.1 Dead or misleading controls

1. `FilterSliders` renders `maxAge` and `limit`, but `CollabPage` only applies `minPriority`.
2. `TaskDetailDrawer` fetches `/collab/tasks/:id/preflight`, but no matching backend route exists. The UI falls back to optimistic copy that implies meaningful validation.
3. `AgentMessaging` is mounted with `currentAgentId={null}`, so authored messages appear from `anonymous` or `Unknown Mind`.
4. `AgentMessaging` uses `BroadcastChannel` only, which creates session-local messaging with no collab-plane persistence, no agent identity authority, and no cross-client trust model.
5. `CollabPage` maintains `conflict` state, but it is only cleared and never populated. The conflict display surface is effectively inert.
6. `AgentStatus` dispatches `collab:agent-logged-in`, but `CollabPage` does not subscribe to that event. The login success path relies on incidental refreshes rather than an intentional integration.
7. Task deletion and agent deletion still rely on browser `confirm()` instead of a themed confirmation surface.

## 6.2 Spec drift

The previous Collab console PDR marks polish as complete, but the shipped UI still contains placeholder-grade behavior and incomplete trust surfaces. This new PDR corrects the mismatch between declared completeness and actual operator experience.

## 6.3 Quality debt

- status surfaces mix real system feedback with generic catch-all labels
- some controls depend on invisible assumptions instead of visible capability gating
- some panels prioritize appearance over operational consequence

---

# 7. User Stories

- As an operator, I want every visible control to either work or explicitly tell me why it cannot, so I never waste time on false actions.
- As an operator, I want assignment compatibility to come from real system rules, so I can trust preflight warnings.
- As an operator, I want destructive actions to use deliberate confirmation surfaces, so I do not misfire critical operations.
- As an operator, I want filters to change what I see, so the interface feels precise instead of decorative.
- As an operator, I want messaging to represent real agent identity and delivery semantics, so it supports coordination rather than roleplay-only noise.
- As an operator, I want conflict and status panels to surface actual blocking conditions, so I can act on them immediately.

---

# 8. Feature Overview

## 8.1 Action Truth Pass

Audit every button and interactive surface in:

- `CollabPage`
- `TaskBoard`
- `TaskDetailDrawer`
- `PipelineView`
- `PipelineTerminal`
- `AgentStatus`
- `AgentMessaging`
- `FilterSliders`
- `CollabStatusDisplay`

Each action must be classified as:

- functional and retained
- functional but unclear and rewritten
- unsupported and removed
- deferred and visibly disabled with explanatory copy

## 8.2 Filter Truth Pass

All surfaced filters must map to real client-side or server-side filtering behavior. Decorative filter controls are prohibited.

Minimum required outcomes:

- `minPriority` continues to filter tasks
- `maxAge` filters against task timestamps or is removed until age data is wired
- `limit` changes the displayed task count or is removed until meaningful pagination exists

## 8.3 Assignment Trust Pass

Replace fake preflight behavior with one of:

- a real backend preflight route with structured warnings and conflicts
- a deterministic client-side preview labeled as local heuristic
- temporary removal of the preflight promise if neither path is available

The UI may not say “checking compatibility” and then invent success copy.

## 8.4 Messaging Truth Pass

The messaging tab must choose one lawful identity:

1. Real collab messaging
   - authenticated sender identity
   - agent-aware sender selection
   - transport semantics defined
   - presence-aware recipient model

2. Explicit local-only scratch channel
   - clearly labeled as browser-local
   - not presented as agent-to-agent system messaging

3. Removal from primary navigation
   - until a real collaboration contract exists

The current in-between state is not acceptable.

## 8.5 Confirmation Surface Pass

Replace browser-native `confirm()` for:

- deleting tasks
- deleting agents
- any future destructive pipeline actions

with an in-world confirmation drawer, scroll, or ritual card that provides:

- the consequence
- the target entity
- the irreversible or reversible nature of the action
- an explicit confirm/cancel choice

## 8.6 Conflict and Status Pass

The status rail must reflect real system conditions:

- sync state
- network failure state
- ownership conflict state
- lock conflict state
- assignment rejection state

If conflict state cannot be sourced, the dormant conflict surface should be removed until a real producer exists.

## 8.7 Purposeful Empty States

Every empty state must help the user take a real next action. Empty states should not direct users toward commands or routes that no longer reflect actual product behavior.

---

# 9. Architecture

## 9.1 Surfaces in scope

- `src/pages/Collab/CollabPage.jsx`
- `src/pages/Collab/CollabPage.css`
- `src/pages/Collab/AgentStatus.jsx`
- `src/pages/Collab/AgentLoginModal.jsx`
- `src/pages/Collab/TaskBoard.jsx`
- `src/pages/Collab/TaskDetailDrawer.jsx`
- `src/pages/Collab/PipelineView.jsx`
- `src/pages/Collab/PipelineTerminal.jsx`
- `src/pages/Collab/ActivityFeed.jsx`
- `src/pages/Collab/AgentMessaging.jsx`
- `src/pages/Collab/FilterSliders.jsx`
- `src/pages/Collab/CollabStatusDisplay.jsx`
- `src/pages/Collab/MetricsGrid.jsx`

## 9.2 Backend contracts relevant to polish

- `GET /collab/agents`
- `POST /collab/agents/register`
- `POST /collab/agents/:id/heartbeat`
- `DELETE /collab/agents/:id`
- `GET /collab/tasks`
- `POST /collab/tasks`
- `PATCH /collab/tasks/:id`
- `POST /collab/tasks/:id/assign`
- `DELETE /collab/tasks/:id`
- `GET /collab/pipelines`
- `POST /collab/pipelines`
- `POST /collab/pipelines/:id/advance`
- `POST /collab/pipelines/:id/fail`
- `GET /collab/activity`
- `GET /collab/locks`

## 9.3 Architectural rule

The UI must not imply the existence of control-plane endpoints or system guarantees that are absent from the above contracts unless they are explicitly implemented as part of this polish pass.

---

# 10. Module Breakdown

## 10.1 `CollabPage`

- own the authoritative mapping between visible tabs and truthful features
- remove or gate any tab whose capability is not real
- wire live refresh behavior to successful login and task mutations intentionally
- make filter application complete and deterministic
- ensure `conflict` state is either truly produced or removed

## 10.2 `TaskDetailDrawer`

- replace nonexistent preflight assumptions
- ensure each drawer section contains meaningful content
- keep assignment, results, locks, and activity sections high-signal
- ensure delete flow uses in-world confirmation

## 10.3 `AgentStatus`

- keep login and delete flows truthful
- ensure agent presence actions update the main page intentionally
- avoid raw browser dialogs

## 10.4 `AgentMessaging`

- either become a real collaboration surface or be demoted from first-class navigation
- bind sender identity to a real selected or active agent, never `null`
- clarify delivery semantics

## 10.5 `FilterSliders`

- only render filters that affect current data
- expose human-readable filter consequences

## 10.6 `CollabStatusDisplay`

- receive real conflict payloads or simplify to pure sync/error state
- avoid dormant structural affordances

---

# 11. Implementation Phases

## Phase 1: Inventory and Removal

- enumerate every visible control in the Collab console
- tag each control as real, misleading, or dead
- remove or disable dead controls with explanatory copy
- wire missing but trivial integrations such as login-refresh propagation

## Phase 2: Trust Surfaces

- replace browser `confirm()` with in-world confirmation surfaces
- implement truthful assignment preflight behavior
- make status and conflict surfaces reflect real conditions only

## Phase 3: Messaging and Coordination Semantics

- decide whether messaging is real, local-only, or deferred
- implement the chosen posture consistently in navigation, copy, and behavior

## Phase 4: Filter and Workflow Precision

- make all visible filters effective
- ensure quick actions lead to complete workflows without dead ends
- tighten empty states and guidance copy

## Phase 5: QA and Regression

- add UI tests for all critical actions
- validate keyboard access and reduced motion behavior
- validate no button leads to an inert or misleading flow

---

# 12. QA Requirements

- verify every visible button triggers a meaningful state change, dialog, or navigational consequence
- verify all rendered filters change displayed results
- verify task assignment either receives real preflight data or uses clearly labeled local validation
- verify deletion flows use custom confirmation surfaces rather than browser dialogs
- verify messaging behavior matches its stated transport semantics
- verify the status surface displays real conflict and error conditions only
- verify `currentAgentId` is never `null` for any first-class messaging workflow
- verify no tab exists solely as a placeholder
- verify keyboard navigation remains complete across drawers, modals, tabs, and action surfaces
- verify reduced-motion paths remain usable and coherent

---

# 13. Success Criteria

The polish pass is successful when all of the following are true:

- no control in the Collab console is decorative-only
- no surfaced feature claims backend support that does not exist
- no destructive flow relies on `window.confirm()`
- no visible filter is inert
- no status surface is structurally present but functionally unpowered
- no first-class collaboration surface uses anonymous identity by default
- operators can explain what each major control does without caveat or apology
- the Collab console feels like a trustworthy orchestration instrument rather than a partially staged mockup

---

# 14. Open Decisions

- Should messaging become a real collab-plane feature, or should the current tab be explicitly reframed as browser-local scratch chat?
- Should assignment preflight be implemented in the backend, or should the UI expose a clearly local-only validator first?
- Should dormant features be hidden entirely, or remain visible in disabled form with “not yet active” explanation?

These decisions must be resolved before implementation is marked complete.
