# VAELRIX_LAW.md
## The Source of Truth

> Read first: `SHARED_PREAMBLE.md` → this file.

**Version: 1.11** | Status: Living Document | Arbiter: Angel (IItsVaelrix, repository owner/user)

All agents read this file before acting.
All agents reference `SCHEMA_CONTRACT.md` for data shapes.
This document supersedes all agent-specific instructions where they conflict.
If this document or any root-level agent doc conflicts with anything under `ARCHIVE REFERENCE DOCS/`, the root-level docs win.

---

## Global Law (All Agents Inherit This)

These rules cannot be overridden by any agent-specific instruction.

### 1. No Hierarchy Between Agents
No model outranks another. Domain boundaries are the law. Claude does not defer to Gemini. Gemini does not defer to Blackbox. Blackbox does not defer to Claude. Each agent is sovereign within its domain and has zero authority outside it.

### 2. Conflict Escalation Is Mandatory
If your work collides with another agent's domain, **STOP**. Write an `ESCALATION:` block (see format below) and deliver it to Angel. Do not resolve it yourself. Do not assume. Do not compromise without authorization.

### 3. Schema Is Sovereign
`SCHEMA_CONTRACT.md` defines all data shapes. If a shape you need doesn't exist, request it — do not invent it. No agent may create a parallel schema. No agent may modify `SCHEMA_CONTRACT.md` except Codex, with Angel's awareness.

### 4. Server Is Truth
Client previews decorative data. Server resolves, scores, and persists. Never make a client authoritative over a game mechanic outcome. `COMBAT_PREVIEW` is decoration. `COMBAT_RESOLVED` is law.

### 5. Pure Analysis Never Touches Effects
Scoring, phoneme, and combat logic has zero DOM, zero GSAP, zero audio imports. Ever. If a logic function touches the render layer, it is in the wrong layer. Escalate before proceeding.

### 6. Determinism Is Non-Negotiable
Same input → same output. No hidden randomness in scoring pipelines. No timestamp-seeded variation in heuristics. No environment-dependent scores. Blackbox enforces this with the determinism battery on every scoring change.

### 7. Security Before Features
No new input surface ships without allow-list validation per `ARCH_CONTRACT_SECURITY.md`. No exceptions. No "we'll add validation later." Security review gates the PR, not the milestone.

**Quality Gates Are Mandatory:**
All code changes MUST pass the QA battery defined in `ENGINEERING_RULEBOOK.md`:
- Lint pass required
- Test pass required
- Performance budget required
- Accessibility compliance required
- Security scan required

No commit without lint. No merge without tests. No deploy without QA.

### 8. Bytecode Is Priority

All persistent state, exports, and interoperable data structures use bytecode encoding. Bytecode is the canonical representation — previews, renders, and UI surfaces are derived from bytecode, not the source of truth. When in doubt, encode to bytecode first.

**Immutability Is Default:**
All domain entities (VerseIR, bytecode, analysis results, grid coordinates) are immutable.
Functions return new values; they do not mutate inputs.

Exception: Performance-critical loops may use mutation with explicit
`// MUTATION: [reason]` comments.

**Bytecode Error System is Mandatory:**
- All errors use `PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}-{CONTEXT_B64}-{CHECKSUM}` format
- All QA tests use bytecode assertions (`assertEqual`, `assertTrue`, `assertInRange`, `assertType`)
- All test failures produce AI-parsable bytecode errors
- Error codes defined in `docs/ByteCode Error System/02_Error_Code_Reference.md`
- QA integration per `docs/ByteCode Error System/04_QA_Integration_Guide.md`

**Approved Bytecode Schemas:**
- `PB-ERR-v1` — Error encoding (all categories: TYPE, VALUE, RANGE, STATE, HOOK, EXT, COORD, COLOR, NOISE, RENDER, CANVAS, FORMULA)
- `PB-RECURSE-v1` — Recursion bug detection
- `0xF`-prefixed — Pixel art formulas
- Lattice grids — Sprite coordinate systems

### 10. Stacking Sovereignty

**Hardcoded z-indexes are prohibited for values > 1.**

All stacking contexts must derive from semantic constants defined in `SCHEMA_CONTRACT.md` (e.g., `Z_BASE`, `Z_ABOVE`, `Z_OVERLAY`, `Z_SYSTEM`). Agents must ensure the render layer adheres to these tiers to prevent "layer drift" where interaction surfaces become occluded. If a new tier is required, it must be proposed via an escalation.

### 11. Scholomance Encyclopedia — Bug Fix Documentation

**All bug fixes must be documented in the Scholomance Encyclopedia upon Angel's command.**

When Angel issues the command **"BUG REPORT AUDIT"**, the agent responsible for the fix must:

1. **Reference the Scholomance Encyclopedia** using the bytecode search code: `SCHOL-ENC-BYKE-SEARCH`
2. **Create or update an entry** in `docs/scholomance-encyclopedia/` with:
   - Bug description and impact
   - Root cause analysis
   - Step-by-step thought process that led to the solution
   - Code changes made (files, lines, rationale)
   - Testing performed
   - Lessons learned

**Format:**
```markdown
# BUG-[YYYY-MM-DD]-[SHORT_NAME]

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-[BUG_CODE]`

## Bug Description
[What was broken, how it manifested, user impact]

## Root Cause
[Technical explanation of why the bug occurred]

## Thought Process
[Step-by-step reasoning:
  1. First observation that led to hypothesis
  2. Investigation path taken
  3. Dead ends encountered
  4. Breakthrough moment
  5. Solution derived]

## Changes Made
| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `path/to/file.js` | 45-67 | [why this change] |

## Testing
[How the fix was verified]

## Lessons Learned
[What this teaches us about the system]
```

**Why This Exists:**

The Scholomance Encyclopedia is the living memory of the codebase. Every bug fixed is knowledge gained. Documentation is not optional — it is the bridge between fixing one bug and preventing a thousand future bugs.

**When Angel says "BUG REPORT AUDIT", you will:**
1. Stop current work
2. Open the relevant bug report
3. Trace the fix you implemented
4. Write the encyclopedia entry
5. Commit with the bytecode search code in the message

**No fix is complete without its story.**

### 12. Law Evolution Is Mandatory

**Any agent reading this document MUST evaluate whether the law itself requires updating.**

This is not optional. This is not "someone else's job." This is a core obligation.

**Evaluation Criteria:**

| Criterion | Question | Action |
|-----------|----------|--------|
| **Critical Nature** | Does a gap in this law enable architecture violations? | Propose update |
| **Structural Integrity** | Does new learning reveal a stronger pattern? | Propose update |
| **Contradiction** | Does practice contradict stated law? | Propose update |
| **Obsolescence** | Is a clause superseded by better architecture? | Propose update |

**Update Mechanism:**

If evaluation reveals need for update:

```
ESCALATION: LAW_UPDATE_PROPOSAL
- Clause: [which clause needs change]
- Current Text: [quote existing]
- Proposed Text: [quote replacement]
- Rationale: [why this strengthens the law]
- Critical Nature: [HIGH/MEDIUM/LOW]
- Structural Impact: [ARCHITECTURE/SECURITY/DETERMINISM/other]
- Needs: Angel's approval
```

**Why This Exists:**

This law is not scripture. It is **engineered constraint**. Like any engineered system, it must evolve when:
- New patterns prove stronger than old ones
- Gaps enable violations the law intended to prevent
- Practice reveals better formulations

**An agent that reads this law and does not evaluate it is violating Law 9.**

### 13. PDR Archive Is Mandatory

**All Product Design Requirements (PDRs) must be stored in `docs/PDR-archive/`.**

No PDR document may remain in the repository root or any location outside the designated archive.

**When creating a new PDR:**

1. Write the PDR using the standard template in `docs/PDR-archive/README.md`
2. Save the file directly to `docs/PDR-archive/[feature_name]_pdr.md`
3. Update the archive index `docs/PDR-archive/README.md` with the new PDR entry
4. Classify status: `Draft` | `Approved` | `In Progress` | `Implemented` | `Archived`

**When discovering a PDR outside the archive:**

1. Move it immediately to `docs/PDR-archive/`
2. Update the archive index if not already listed
3. Never leave PDRs in root or scattered directories

**Why This Exists:**

PDRs are architectural artifacts — they define major features before implementation. Scattered PDRs become:
- Lost or forgotten
- Outdated without notice
- Impossible to audit as a collection
- Difficult to reference in onboarding

Centralized archive ensures:
- All agents can find the complete PDR catalog
- Status tracking (Draft → Implemented) is visible
- Historical PDRs are preserved, not deleted
- Architecture decisions are auditable

**Related:** Scholomance Encyclopedia (`docs/scholomance-encyclopedia/`) documents bug fixes and architecture proposals post-implementation. PDRs document features pre-implementation.

### 14. Collab Login and MCP Access Protocol

**Any agent participating in coordinated work must use the collab control plane through approved login and MCP access paths.**

No agent may invent an alternate transport, bypass authentication on the HTTP surface, or access collab persistence directly as a substitute for the control plane.

#### 14.1 Transport split is explicit

There are two distinct access paths:

- **HTTP / CLI control plane**: authenticated routes under `/collab`, used by `scripts/connect-collab.js` and `scripts/collab-client.js`
- **MCP bridge**: local stdio server at `codex/server/collab/mcp-bridge.js`, used by MCP-capable clients and agents

These paths serve different purposes:

- HTTP / CLI requires login and uses a session cookie
- MCP is a local process transport and does **not** use the browser/session login cookie
- Both paths must converge on the same collab service law

#### 14.2 Required boot order

Before any agent attempts to coordinate through the collab plane:

1. Start the local server:
   `npm run dev:server`
2. Start the MCP bridge if MCP access is needed:
   `npm run mcp:collab`
3. If using HTTP / CLI, log in first:
   `node scripts/connect-collab.js connect --agent-id <id> --name "<name>" --role <role>`
4. If using MCP, connect the client to the stdio bridge and then register through MCP:
   call `collab_agent_register`
5. After registration on either surface, keep presence alive with heartbeat:
   HTTP: `node scripts/connect-collab.js heartbeat --agent-id <id> --status online`
   MCP: call `collab_agent_heartbeat`

If the server is not running, login and collab HTTP calls will fail.
If the MCP bridge is not running, MCP clients will not see `collab://*` resources or `collab_*` tools.

#### 14.3 HTTP / CLI login path

**Primary login command**

```bash
node scripts/connect-collab.js connect \
  --agent-id <agent-id> \
  --name "<display-name>" \
  --role <ui|backend|qa> \
  --capabilities <comma,separated,capabilities>
```

**What this does**

- fetches a CSRF token
- logs in against `/auth/login`
- persists the session cookie to `COLLAB_COOKIE_FILE` (default: `/tmp/scholomance_cookie.txt`)
- registers the agent on `/collab/agents/register`

**Relevant environment variables**

- `API_BASE_URL` — defaults to `http://localhost:3000`
- `COLLAB_URL` — defaults to `http://localhost:3000/collab`
- `COLLAB_COOKIE_FILE` — defaults to `/tmp/scholomance_cookie.txt`
- `COLLAB_USER` / `COLLAB_PASS` — optional CLI login credentials
- `AGENT_ID` — used by `scripts/collab-client.js`

**Local default credentials**

The helper script currently defaults to:

- username: `test`
- password: `password`

These defaults are for local development only. If local auth has been changed, agents must use the current valid credentials instead of assuming the defaults still apply.

#### 14.4 MCP access path

**Canonical bridge command**

```bash
npm run mcp:collab
```

Equivalent direct invocation:

```bash
node --env-file=.env codex/server/collab/mcp-bridge.js
```

**Canonical MCP client configuration**

```json
{
  "mcpServers": {
    "scholomance-collab": {
      "command": "node",
      "args": ["--env-file=.env", "codex/server/collab/mcp-bridge.js"]
    }
  }
}
```

If an MCP host prefers npm wrappers, `npm run mcp:collab` is acceptable as the command target instead of the raw `node` invocation.

**Minimum MCP verification sequence**

1. Read `collab://status`
2. Call `collab_status_get`
3. Call `collab_agent_register`
4. Call `collab_agent_heartbeat`

**Required MCP resources**

- `collab://agents`
- `collab://tasks`
- `collab://locks`
- `collab://activity`
- `collab://pipelines`
- `collab://status`

**Required MCP tools**

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
- `collab_status_get`

#### 14.5 Supported collab roles are currently narrow

The current collab schema supports only these roles:

- `ui`
- `backend`
- `qa`

Agents must **not** invent additional role strings during registration. In particular, `docs` may appear in older helper text, but it is **not** a valid collab schema role at this time.

Until schema support expands, agents whose domain does not map perfectly must choose the nearest lawful operational role.

#### 14.6 Canonical role map by agent

| Agent | Domain | Collab role | Canonical capabilities |
|-------|--------|-------------|------------------------|
| Claude | UI, visuals, accessibility | `ui` | `jsx,css,framer-motion,a11y` |
| Codex | engine, backend, schemas, runtime | `backend` | `node,fastify,schemas,mcp` |
| Gemini | mechanics, balance, formal rules | `backend` | `mechanics,balance,specs,systems` |
| Blackbox | testing, QA, CI | `qa` | `vitest,playwright,ci,debugging` |
| Arbiter | verdicts, architecture review | `backend` | `architecture,review,verdicts` |
| Nexus | interactive debugging, repro traces | `backend` | `debugging,tracing,repro` |
| Unity | documentation synthesis, navigation | `backend` | `docs,synthesis,navigation` |
| Angel | arbitration, operator authority | `backend` | `override,arbitration,release` |

This role map is an operational transport mapping, not a redefinition of domain ownership.
Role choice grants access to the collab plane. It does **not** authorize edits outside the agent's actual domain.

#### 14.7 Canonical login examples by agent

```bash
# Claude
node scripts/connect-collab.js connect --agent-id claude-ui --name "Claude UI" --role ui --capabilities jsx,css,framer-motion,a11y

# Codex
node scripts/connect-collab.js connect --agent-id codex-backend --name "Codex Backend" --role backend --capabilities node,fastify,schemas,mcp

# Gemini
node scripts/connect-collab.js connect --agent-id gemini-backend --name "Gemini Mechanics" --role backend --capabilities mechanics,balance,specs,systems

# Blackbox
node scripts/connect-collab.js connect --agent-id blackbox-qa --name "Blackbox QA" --role qa --capabilities vitest,playwright,ci,debugging

# Arbiter
node scripts/connect-collab.js connect --agent-id arbiter-backend --name "Arbiter" --role backend --capabilities architecture,review,verdicts

# Nexus
node scripts/connect-collab.js connect --agent-id nexus-backend --name "Nexus" --role backend --capabilities debugging,tracing,repro

# Unity
node scripts/connect-collab.js connect --agent-id unity-backend --name "Unity" --role backend --capabilities docs,synthesis,navigation

# Angel
node scripts/connect-collab.js connect --agent-id angel-backend --name "Angel" --role backend --capabilities override,arbitration,release
```

#### 14.8 Lawful operating sequence after login or MCP attach

After access is established, agents should follow this sequence:

1. Register the agent if not already present
2. Send heartbeat when beginning work
3. Read current state:
   `collab://status`, `collab://tasks`, `collab://locks`, or HTTP equivalents
4. Create or claim a task before editing shared files
5. Respect ownership and lock conflicts instead of bypassing them casually
6. Update task state as work progresses
7. Mark completion and release locks through the control plane

No agent may treat "I can reach the repo" as sufficient substitute for "I am registered on the control plane."

#### 14.9 MCP access is not a privilege escalation path

MCP exists to expose the collab plane to agentic tools, not to bypass the law.

Therefore:

- MCP callers must register the same way any other agent does
- MCP callers must respect lock conflicts and ownership conflicts
- MCP callers must use collab tools instead of reaching into persistence or sqlite directly
- terminal pipeline states must be treated as terminal across all transports

Any agent that uses MCP as a shortcut around ownership, locking, or audit rules is violating this law.

#### 14.10 Remote agent key authentication

Agents connecting from remote machines (not the host running the server) authenticate via **bearer token keys**, not passwords.

**How it works:**

1. Angel generates an agent key: `node scripts/collab-admin.js generate-agent-key --agent-id <id> --role <role>`
2. The plaintext key (`sk-scholomance-<id>-<hex>`) is shared out-of-band with the agent
3. The agent includes the key in every request: `Authorization: Bearer sk-scholomance-...`
4. The server validates the key against bcrypt-hashed entries in `collab_agent_keys`
5. On success, the agent identity is resolved and `X-Agent-ID` is set on the request
6. On failure, a generic 401 is returned — no key details leaked

**Key Management Commands:**

```bash
# Generate keys for ALL canonical agents
node scripts/collab-admin.js generate-canonical-keys --output tmp/agent-keys.txt --expires 90 --force

# Generate a specific key
node scripts/collab-admin.js generate-agent-key --agent-id <id> --role <ui|backend|qa>

# Rotate/Revoke keys
node scripts/collab-admin.js rotate-agent-key --agent-id <id>
node scripts/collab-admin.js revoke-agent-key --key-id <uuid>
node scripts/collab-admin.js list-agent-keys
```

**Remote agent CLI usage:**

```bash
# Any collab-client.js command with AGENT_KEY set
AGENT_KEY=sk-scholomance-qwen-code-... AGENT_ID=qwen-code \
  node scripts/collab-client.js heartbeat --status online

# Or set in .env file (Automatic Update Protocol)
AGENT_KEY=sk-scholomance-qwen-code-...
AGENT_ID=qwen-code
API_BASE_URL=https://your-live-site.com
```

#### 14.11 Automatic Secret Synchronization (Render)

To maintain parity between local development and the live server, a **pre-push hook** is mandatory for all operators with Render access.

**Automation Protocol:**
1. The hook is located at `.git/hooks/pre-push`.
2. It executes `npm run sync:render-secrets` before every `git push`.
3. It requires `RENDER_API_KEY` and `RENDER_SERVICE_ID` in the local `.env`.
4. If the secret sync fails, the code push is blocked to prevent environment drift.

**Manual Bypass (Emergency Only):**
`git push --no-verify`

**Security constraints:**

- Keys are bcrypt-hashed server-side — never stored or transmitted in plaintext after generation.
- **NEVER** commit `tmp/agent-keys.txt` or any file containing plaintext keys.
- Keys are never logged, never returned in API responses.
- Revoked or expired keys are rejected immediately.
- Rate limiting applies per agent key (same as session auth).
- HTTPS is mandatory for remote access — keys must never travel over plaintext HTTP.

**This is not a privilege escalation path.** Remote agent keys grant the same collab plane access as local session auth. They do not bypass ownership checks, lock conflicts, or audit rules.

---

## Before Using PixelBrain: Essential Knowledge

**PixelBrain is a bytecode-driven visual synthesis engine, not a physics simulator.**

All animation is **pre-computed bytecode** read at runtime — never per-frame simulation.

### Core Principle: Bytecode → Render, Never Simulate → Render

```
❌ WRONG: Per-frame physics simulation
update(delta) {
  solveLaplace()      // Expensive computation
  growLightning()     // Physics simulation
  render()
}

✅ RIGHT: Bytecode lookup
update(time, delta) {
  const glow = getBytecodeAMP(time, GLOW)  // Instant lookup
  const flicker = getBytecodeAMP(time, FLICKER)
  sprite.setRotation(getRotationAtTime(time, bpm))  // Absolute time
}
```

### The Three Laws of PixelBrain Animation

**1. Absolute Time Is Sovereign**
- All rotation/animation uses **absolute time** (`time` parameter), never delta
- `rotation = radiansPerSecond * timeSeconds` — always smooth, frame-rate independent
- Delta-based animation accumulates error and chokes on frame drops

**2. Bytecode Channels Drive All Motion**
- `getBytecodeAMP(time, CHANNEL)` — O(1) lookup, zero simulation
- Channels: `ROTATION`, `GLOW`, `FLICKER`, `SCALE`, `OPACITY`
- AMP (Animation MicroProcessor) pre-computes all motion curves

**3. Pre-Generate, Never Compute Per-Frame**
- Patterns (lightning, particles, waves) are **pre-generated** and cached
- Runtime selects from cached patterns based on bytecode state
- One-time generation cost, zero per-frame cost

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  PDR / Blueprint (Human Intent)                         │
│  "orb pulse with 4-way symmetry, 800ms period"          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Bytecode Blueprint Bridge (Compiler)                   │
│  - Parse blueprint                                      │
│  - Validate semantics                                   │
│  - Compile to bytecode + math formulas                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  AMP Runtime (Lookup Engine)                            │
│  - getBytecodeAMP(time, GLOW) → 0.73                    │
│  - getRotationAtTime(time, bpm) → 2.45 rad              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Phaser Renderer (Execution)                            │
│  - sprite.setRotation(rotation)                         │
│  - graphics.lineStyle(color, glow * alpha)              │
└─────────────────────────────────────────────────────────┘
```

### Performance Budget

| Operation | Budget | Actual |
|-----------|--------|--------|
| Bytecode lookup | <0.01ms | ✅ O(1) table read |
| Rotation calculation | <0.01ms | ✅ Single multiply |
| Sprite transform | <0.1ms | ✅ GPU batched |
| Graphics draw | <1ms | ✅ Vector paths |
| **Total per frame** | **<16ms** (60fps) | ✅ Typically 2-4ms |

### What PixelBrain Is NOT

- ❌ **Not a physics engine** — No per-frame collision, no rigidbody simulation
- ❌ **Not a particle simulator** — Particles are pre-generated patterns
- ❌ **Not a ray tracer** — Lighting is bytecode-driven glow values
- ❌ **Not a procedural generator** — Patterns are authored, not emergent

### What PixelBrain IS

- ✅ **A bytecode interpreter** — Reads pre-computed animation states
- ✅ **A deterministic renderer** — Same bytecode = same output
- ✅ **A game engine surface** — Phaser execution of authored intent
- ✅ **A visual synthesis layer** — Combines patterns, colors, motion

### Common Mistakes

```javascript
// ❌ MISTAKE: Simulating lightning every frame
update() {
  solveLaplace(15)  // 5-10ms per call
  growLightning()   // 2-5ms per call
  render()
}
// Result: 30-50fps, choppy animation

// ✅ CORRECT: Bytecode-driven glow
update(time) {
  const glow = getBytecodeAMP(time, GLOW)  // 0.01ms
  graphics.lineStyle(color, glow)          // Instant
  graphics.strokeCircle(...)               // GPU batched
}
// Result: 60fps, smooth animation
```

### The Rotation Formula (Memorize This)

```javascript
// Absolute time → rotation (radians)
export function getRotationAtTime(absoluteTimeMs, bpm, degreesPerBeat = 90) {
  const radiansPerSecond = (degreesPerBeat * π / 180) * (bpm / 60);
  const timeSeconds = absoluteTimeMs * 0.001;
  const rotation = radiansPerSecond * timeSeconds;
  return rotation % (2 * π);  // Normalize to [0, 2π)
}
```

**Why this works:**
- `rotation = speed × time` — linear, continuous, no accumulation
- No `delta` parameter — frame drops don't cause jumps
- Modulo wrap — never overflows, always smooth

### Bytecode Blueprint Syntax

```text
ANIM_START
ID orb-transmission-pulse
TARGET id player-orb
DURATION 800
EASE TOKEN IN_OUT_ARC
SCALE BASE 1.0 PEAK 1.05
GLOW BASE 0.0 PEAK 0.5
SYMMETRY TYPE radial ORDER 4
ANIM_END
```

**Compiles to:**
```json
{
  "formula": "scale(t) = 1.0 + 0.05 * sin(2πt/800)",
  "glow_envelope": { "kind": "pulse", "peak": 0.5, "duration": 800 },
  "symmetry": { "type": "radial", "order": 4 }
}
```

**Executes as:**
```javascript
sprite.setScale(1.0 + 0.05 * Math.sin(2 * Math.PI * time / 800));
graphics.lineStyle(color, getBytecodeAMP(time, GLOW));
```

### The PixelBrain Mantra

> **"Bytecode first. Render second. Never simulate."**

Before writing any PixelBrain code, ask:
1. Is this pre-computed as bytecode?
2. Am I using absolute time, not delta?
3. Is this a lookup, not a simulation?

If any answer is **no**, rewrite it.

---

## Escalation Block Format

When a domain conflict arises, any agent issues this block to Angel:

```
ESCALATION:
- Conflict: [what overlaps — name both domains explicitly]
- My domain says: [your position, grounded in your jurisdiction]
- Other domain says: [their likely position, grounded in their jurisdiction]
- Option A: [path + tradeoff]
- Option B: [path + tradeoff]
- Recommendation: [optional — clearly labeled as opinion, not decision]
- Needs: Angel's decision
```

An escalation is not a failure. It is the correct behavior when the law is ambiguous. Agents who resolve domain conflicts unilaterally without escalating are violating Vaelrix Law.

---

## Domain Map (Quick Reference)

| Domain | Owner | Hard Boundary |
|--------|-------|---------------|
| UI surface, components, CSS, animations | Claude | `src/pages/`, `src/components/`, `*.css` |
| World-law, balance, mechanic specifications | Gemini | Mechanic specs and canonical rule definitions |
| CODEx engine, backend, schemas, logic hooks, data implementation | Codex | `codex/`, `codex/server/`, `src/lib/`, `src/hooks/` (logic), `src/data/`, `scripts/` |
| Tests, CI, debug reports, visual baselines | Blackbox | `tests/`, `.github/workflows/` |
| Law, arbitration, final decisions | Angel (repository owner/user) | This document |

Shared boundaries that require explicit coordination before any agent acts:
- Combat result rendering (Claude renders, Codex defines shape)
- School theme generation (Claude consumes output, Codex runs script)
- `src/data/` tuning (Gemini specifies values, Codex implements and publishes the resulting schema/data contract)
- Visual regression baselines (Claude owns UI, Blackbox owns the tests)

---

## Agent Context Files

Each agent has a context file that inherits this law and specifies domain jurisdiction:

| Agent | Context File |
|-------|-------------|
| Claude (UI) | `CLAUDE.md` |
| Codex (Runtime / backend / schemas) | `CODEX.md` |
| Gemini (Mechanics) | `GEMINI.md` |
| Blackbox (Testing) | `BLACKBOX.md` |
| All agents (schemas) | `SCHEMA_CONTRACT.md` |

---

## Glossary: Critical Variables & Terminology by Page

**Mandatory reading for all agents.** These are the variables, hooks, and terms you will encounter most frequently. Know them.

### Global / Shared

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `verseIR` | Object | `src/lib/truesight/` | Canonical intermediate representation of analyzed text |
| `phonemeEngine` | Service | `src/hooks/usePhonemeEngine.jsx` | Returns phonetic analysis with vowel family colors |
| `getBytecodeAMP(time, channel)` | Function | `src/lib/ambient/bytecodeAMP.js` | O(1) lookup for animation values (GLOW, FLICKER, ROTATION, SCALE) |
| `getRotationAtTime(time, bpm, degPerBeat)` | Function | `src/lib/ambient/bytecodeAMP.js` | Absolute time → radians, always smooth |
| `useAnimationIntent(intent)` | Hook | `src/ui/animation/hooks/useAnimationIntent.ts` | Submit animation blueprint to AMP, returns resolved motion |
| `motionToFramerProps(motion)` | Function | `src/ui/animation/adapters/motionToFramerProps.ts` | Convert AMP output to Framer Motion props |
| `SCHOOLS` | Constant | `src/data/schools.js` | School definitions: SONIC, PSYCHIC, VOID, WILL, ALCHEMY |
| `generateSchoolColor(schoolId)` | Function | `src/data/schools.js` | Returns HSL string for school |
| `useSonicAnalysis()` | Hook | `src/hooks/useSonicAnalysis.ts` | Returns real-time sonic profile (rhythm, intensity) based on current audio state |
| `analyzeSonicProfile` | Function | `src/lib/sonic/analysis.js` | Core logic for extracting sonic features from station metadata and signal levels |
| `useAtmosphere()` | Hook | `src/hooks/useAtmosphere.js` | Manages environmental ambience, background particles, and scene-wide visual state |
| `useProgression()` | Hook | `src/hooks/useProgression.jsx` | Tracks player career advancement, transmuter levels, and unlocked doctrines |
| `useColorCodex()` | Hook | `src/hooks/useColorCodex.js` | Resolves school-specific color palettes and dynamic CSS variables for components |
| `usePredictor()` | Hook | `src/hooks/usePredictor.js` | AI-driven heuristic engine for input anticipation and sequence completion |

---

### Listen Page (`src/pages/Listen/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `SignalChamberConsole` | Component | `SignalChamberConsole.tsx` | React mount for Phaser console UI |
| `SignalChamberScene` | Phaser Scene | `scenes/SignalChamberScene.js` | Phaser scene for console rendering (zIndex: 100) |
| `AlchemicalLabBackground` | Component | `AlchemicalLabBackground.tsx` | Background hexagram + atmosphere (zIndex: 0) |
| `AlchemicalLabScene` | Phaser Scene | `scenes/AlchemicalLabScene.js` | Rotating hexagram, ambient particles |
| `CrystalBallVisualizer` | Component | `CrystalBallVisualizer.tsx` | Sacred geometry orb (ScholomanceStation) |
| `CrystalBallScene` | Phaser Scene | `scenes/CrystalBallScene.js` | Procedural orb art with school-specific patterns |
| `HolographicEmbed` | Component | `HolographicEmbed.jsx` | Music player UI overlay (zIndex: 25) |
| `ScholomanceStation` | Component | `ScholomanceStation.tsx` | Station selection menu (zIndex: 100) |
| `useAmbientPlayer()` | Hook | `src/hooks/useAmbientPlayer.ts` | Audio playback, school tuning, BPM |
| `useCurrentSong()` | Hook | `src/hooks/useCurrentSong.jsx` | Tracks the currently playing track metadata, playback progress, and album art |
| `OutputDeviceSelector` | Component | `src/pages/Listen/OutputDeviceSelector.tsx` | UI for managing audio output destinations and quality settings |
| `signalLevel` | Number | Ambient player | 0-1, drives visual intensity |
| `isPlaying` | Boolean | Ambient player | Audio active state |
| `isTuning` | Boolean | Ambient player | School transition state |
| `activeStation` | Object | Ambient player | Current school metadata |
| `triggerIgnition()` | Callback | `ListenPage.tsx` | Orb click handler → opens ScholomanceStation |
| `viewMode` | String | `ListenPage.tsx` | `'CHAMBER'` (console) or `'STATION'` (menu overlay) |

**Z-Index Stack (Listen Page):**
```
100 — ScholomanceStation overlay
 25 — HolographicEmbed (video player)
 15 — Orb interaction trigger
  1 — Phaser canvas (SignalChamberScene)
  0 — AlchemicalLabBackground
```

---

### Read Page (`src/pages/Read/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `ScrollEditor` | Component | `ScrollEditor.jsx` | Main text input surface with Truesight overlay |
| `IDE` | Component | `IDE.css` | Three-column layout container |
| `AnalysisPanel` | Component | `src/pages/Read/AnalysisPanel.jsx` | Side panel displaying phonetic, rhythmic, and linguistic breakdown of the scroll |
| `usePanelAnalysis` | Hook | `src/hooks/usePanelAnalysis.js` | Returns analysis results (rhyme, meter, phonemes) |
| `useScrolls` | Hook | `src/hooks/useScrolls.jsx` | Manages scroll state, autosave |
| `useWordLookup()` | Hook | `src/hooks/useWordLookup.jsx` | Interface for querying the Abyss lexicon and rhyme dictionary |
| `bytecodeRenderer` | Service | `src/pages/Read/bytecodeRenderer.js` | Renders bytecode-encoded visual effects directly onto the scroll surface |
| `Truesight` | Mode | `ScrollEditor.jsx` | Phonetic coloring overlay mode |
| `analyzedWords` | Array | `ScrollEditor.jsx` | Words with phonetic color data |
| `isTruesight` | Boolean | `ScrollEditor.jsx` | Truesight overlay active |
| `textarea.onScroll → overlay.scrollTop` | Pattern | `ScrollEditor.jsx` | Sync scroll between textarea and overlay |
| `color: transparent` on textarea | CSS | `ScrollEditor.jsx` | Hides native text when Truesight active |

**Truesight Pattern (Sacred — Do Not Alter):**
```jsx
// Textarea (z:1) + Overlay div (z:2)
// Shared: Georgia, var(--text-xl), line-height: 1.9, white-space: pre-wrap
// Truesight ON: textarea { color: transparent; caret-color: gold }
//               overlay renders analyzedWords as colored buttons
// Truesight OFF: overlay hidden, textarea visible
```

---

### Combat Page (`src/pages/Combat/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `CombatPage` | Component | `CombatPage.jsx` | Main combat surface |
| `BattleScene` | Phaser Scene | `scenes/BattleScene.js` | WebGL combat rendering |
| `Spellbook` | Component | `components/Spellbook.jsx` | Player's verse library |
| `useCombatEngine` | Hook | `hooks/useCombatEngine.js` | Combat state machine |
| `useScoring` | Hook | `src/hooks/useScoring.js` | Returns combat scores from backend |
| `COMBAT_PREVIEW` | State | Client | Decorative only — never authoritative |
| `COMBAT_RESOLVED` | State | Server | Authoritative combat outcome |
| `battleLog` | Array | Combat engine | Turn-by-turn combat events |
| `playerDoctrines` | Array | Combat engine | Active player modifiers |
| `opponentDoctrines` | Array | Combat engine | Procedural opponent modifiers |

**Law:** Client preview is decoration. Server resolution is truth.

---

### PixelBrain Page (`src/pages/PixelBrain/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `PixelBrainPage` | Component | `PixelBrainPage.jsx` | Main upload/analysis/export surface |
| `PixelBrainTerminal` | Component | `PixelBrainTerminal.jsx` | Bytecode inspector / formula editor |
| `TemplateEditor` | Component | `TemplateEditor.jsx` | Visual template/grid editor |
| `FormulaLibrary` | Component | `FormulaLibrary.jsx` | Saved formula presets |
| `uploadToPixelBrain(file)` | Function | `utils/imageAnalysis.client.js` | Client-side image analysis |
| `analyzeImageClientSide(file)` | Function | `utils/imageAnalysis.client.js` | Canvas-based image decoding |
| `imageDuplication.service.js` | Backend | `codex/server/services/` | Texture duplication (Void Echo) |
| `coord-symmetry-amp.js` | Backend | `codex/core/pixelbrain/` | Symmetry detection + transforms |
| `lattice-grid-engine.js` | Backend | `codex/core/pixelbrain/` | Grid snapping, coordinate systems |
| `bytecode-error.js` | Backend | `codex/core/pixelbrain/` | PB-ERR error encoding |

**Upload Pipeline:**
```
File → analyzeImageClientSide() → Backend /api/image/analyze → Bytecode → Lattice Grid → Export
```

---

### Nexus Page (`src/pages/Nexus/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `NexusPanel` | Component | `NexusPanel.jsx` | Collaborative editing surface |
| `useCODExPipeline` | Hook | `src/hooks/useCODExPipeline.jsx` | Backend analysis queue status |

---

### Watch Page (`src/pages/Watch/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `WatchPage` | Component | `WatchPage.jsx` | Video playback + analysis sync |

---

### Career Page (`src/pages/Career/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `CareerPage` | Component | `CareerPage.tsx` | Transmuter career progression |

---

### Profile Page (`src/pages/Profile/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `ProfilePage` | Component | `ProfilePage.jsx` | User stats, settings |

---

### Auth Pages (`src/pages/Auth/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `AuthPage` | Component | `AuthPage.jsx` | Login/register surface |
| `useAuth` | Hook | `src/hooks/useAuth.jsx` | Auth state, session management |

---

### CODEx Backend (`codex/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `combat.scoring.js` | Module | `codex/core/` | Combat score heuristics |
| `combat.profile.js` | Module | `codex/core/` | Player/opponent profile generation |
| `lexicon.abyss.js` | Module | `codex/core/` | Entropy scoring, linguistic depth |
| `speaking/prosody.js` | Module | `codex/core/` | Rhythm, stress pattern analysis |
| `microprocessors/` | Module | `codex/core/` | NLU + PixelBrain processor factory |
| `pixelbrain/symmetry-amp.js` | Module | `codex/core/` | Symmetry detection engine |
| `server/services/combatScore.service.js` | Service | `codex/server/` | Authoritative scoring |
| `server/services/panelAnalysis.service.js` | Service | `codex/server/` | VerseIR analysis backend |
| `server/persistence.adapter.js` | Adapter | `codex/server/` | SQLite (abyss.sqlite) adapter |

---

### Animation AMP (`src/codex/animation/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `runAnimationAmp(intent)` | Function | `amp/runAnimationAmp.ts` | Main AMP entry point |
| `fuseMotionOutput(outputs)` | Function | `src/codex/animation/amp/fuseMotionOutput.ts` | Fuses multiple motion processor results into a single `ResolvedMotionOutput` |
| `normalizeAnimationIntent(intent)` | Function | `src/codex/animation/amp/normalizeAnimationIntent.ts` | Validates and fills defaults for `AnimationIntent` before processing |
| `registerAllProcessors()` | Function | `src/codex/animation/processors/registerAllProcessors.ts` | Bootstraps the AMP processor registry with Symmetry, Time, and Transform modules |
| `AnimationIntent` | Type | `contracts/animation.types.ts` | Animation request shape |
| `ResolvedMotionOutput` | Type | `contracts/animation.types.ts` | AMP output shape |
| `MotionProcessor` | Interface | `contracts/animation.types.ts` | Processor contract |
| `processorRegistry` | Registry | `amp/runAnimationAmp.ts` | Registered processor collection |
| `compileBlueprint(blueprint)` | Function | `bytecode-bridge/compiler/blueprintCompiler.ts` | Blueprint → backend payloads |
| `parseBlueprintBlock(source)` | Function | `bytecode-bridge/parser/blueprintParser.ts` | Parse PDR blueprint syntax |
| `validateBlueprint(blueprint)` | Function | `bytecode-bridge/validator/blueprintValidator.ts` | Semantic validation |
| `generateQAReport(blueprint)` | Function | `bytecode-bridge/qa/blueprintQA.ts` | QA invariant report |

**AMP Pipeline:**
```
Intent → Normalize → Processors → Fuse → Output → Adapter (CSS/Phaser/PixelBrain)
```

---

### Bytecode Blueprint Bridge (`src/codex/animation/bytecode-bridge/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `AnimationBlueprintV1` | Type | `contracts/blueprint.types.ts` | Canonical animation schema |
| `FormulaNode` | Type | `contracts/blueprint.types.ts` | Mathematical AST node |
| `BytecodeInstruction` | Type | `contracts/blueprint.types.ts` | Bytecode op + params |
| `executeBlueprint(options)` | Function | `index.ts` | Full pipeline: parse → validate → compile → execute |
| `UNIT_MULTIPLIERS` | Constant | `dimension-formula-compiler.ts` | Unit conversion (em, rem, vh, vw → px) |
| `detectDeviceClass(viewportWidth)` | Function | `dimension-formula-compiler.ts` | Returns: desktop, tablet, mobile-ios, mobile-android |
| `detectOrientation(width, height)` | Function | `dimension-formula-compiler.ts` | Returns: portrait, landscape, square |

---

### Dimension Formula Compiler (`codex/core/pixelbrain/dimension-formula-compiler.ts`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `DimensionCompiler` | Class | `dimension-formula-compiler.ts` | Parse + canonicalize + compile dimensions |
| `DimensionRuntime` | Class | `dimension-formula-compiler.ts` | Execute bytecode → dimensions |
| `CanonicalDimensionSpec` | Type | `dimension-formula-compiler.ts` | Normalized dimension schema |
| `RuntimeBindings` | Interface | `dimension-formula-compiler.ts` | Viewport, parent, device, orientation |

**Dimension Types:**
- `fixed` — Exact size (1920×1080)
- `range` — Clamped (1200–1440)
- `aspect` — Ratio-locked (16:9)
- `viewport` — Viewport-relative (100vw)
- `container` — Parent-relative (clamp(parent.width, 1200, 1440))
- `variant` — Alternatives (A or B)

---

### Tests (`tests/`)

| Term | Type | Location | Description |
|------|------|----------|-------------|
| `bytecode-bridge.test.ts` | Test Suite | `tests/codex/animation/` | Parser, validator, compiler, QA tests |
| `dimension-compiler.test.js` | Test Suite | `tests/qa/pixelbrain/` | Dimension parsing + execution tests |
| `ui-stasis-bytecode.test.jsx` | Test Suite | `tests/qa/` | Bytecode error detection tests |
| `coord-symmetry-amp.test.js` | Test Suite | `tests/qa/` | Symmetry AMP functional tests |
| `assertEqual`, `assertTrue`, etc. | Assertions | `tests/qa/tools/bytecode-assertions.js` | Bytecode-format test assertions |

---

## Agent Tool Reference

**Mandatory reading for all agents.** This is the canonical inventory of hooks, utilities, services, and components available to each domain. Use these — do not invent parallel patterns.

### Core Hooks (All Pages)

| Hook | Returns | Location | Description |
|------|---------|----------|-------------|
| `useAuth()` | `{ user, isLoading, login, logout, register }` | `src/hooks/useAuth.jsx` | Auth state, session management, CSRF handling |
| `useTheme()` | `{ theme, toggleTheme }` | `src/hooks/useTheme.jsx` | Dark/light theme, persists to storage |
| `useUserSettings()` | `{ settings, updateSettings, isLoading }` | `src/hooks/useUserSettings.js` | User preferences (truesight, predictive, fontSize, compactMode) |
| `useProgression()` | `{ xp, unlockedSchools, addXP, getLevel, achievements, nexus }` | `src/hooks/useProgression.jsx` | Player career, transmuter levels, school unlocks |
| `useScrolls()` | `{ scrolls, activeScrollId, saveScroll, deleteScroll, getScrollById }` | `src/hooks/useScrolls.jsx` | Scroll CRUD, autosave, localStorage + backend sync |
| `useAtmosphere()` | `{ schoolId, isActive, auroraLevel }` | `src/hooks/useAtmosphere.js` | Environmental ambience, school-themed CSS vars, aurora cycle |
| `useAuroraLevel()` | `level` (0-2) | `src/hooks/useAtmosphere.js` | Aurora intensity: 0=OFF, 1=DIM, 2=FULL |
| `useCurrentSong()` | `{ currentSong, isPlaying, progress }` | `src/hooks/useCurrentSong.jsx` | Currently playing track metadata, playback state |
| `useAmbientPlayer()` | `{ play, pause, tune, signalLevel, bpm, activeStation }` | `src/hooks/useAmbientPlayer.ts` | Audio playback, school tuning, BPM sync |
| `useSonicAnalysis()` | `{ rhythm, intensity, profile }` | `src/hooks/useSonicAnalysis.ts` | Real-time sonic profile from audio state |
| `useColorCodex()` | `{ palette, variables }` | `src/hooks/useColorCodex.js` | School-specific color palettes, CSS var resolver |
| `usePredictor()` | `{ predict, ready, loading }` | `src/hooks/usePredictor.js` | AI heuristic engine for input anticipation |
| `usePanelAnalysis()` | `{ analysis, schemeDetection, meterDetection, scoreData, rhymeAstrology, vowelSummary, analyzeDocument }` | `src/hooks/usePanelAnalysis.js` | Rhyme, meter, phonemes, heuristics, vowel analysis |
| `useWordLookup()` | `{ lookup, data, isLoading, error, reset }` | `src/hooks/useWordLookup.jsx` | Query Abyss lexicon, rhyme dictionary |
| `useScoring()` | `{ scores, loading, error }` | `src/hooks/useScoring.js` | Combat scores from backend |
| `useCombatEngine()` | `{ state, turn, battleLog, playerDoctrines, opponentDoctrines }` | `src/hooks/useCombatEngine.js` | Combat state machine |
| `useCODExPipeline()` | `{ queueStatus, isProcessing, results }` | `src/hooks/useCODExPipeline.jsx` | Backend analysis queue status |
| `usePrefersReducedMotion()` | `boolean` | `src/hooks/usePrefersReducedMotion.js` | Respects user's motion preferences |

---

### Core Utilities (`src/lib/`)

| Utility | Purpose | Location |
|---------|---------|----------|
| `Storage` | localStorage wrapper with error handling | `src/lib/platform/storage.js` |
| `analyzeDocumentAsync()` | Worker-based document analysis | `src/lib/workers/analysis.client.js` |
| `buildVowelSummary()` | Build vowel family statistics | `src/lib/phonology/vowelFamily.js` |
| `normalizeVowelFamily()` | Normalize vowel family aliases | `src/lib/phonology/vowelFamily.js` |
| `detectScheme()` | Rhyme scheme detection | `src/lib/rhymeScheme.detector.js` |
| `analyzeMeter()` | Meter analysis (iambic, trochaic, etc.) | `src/lib/rhymeScheme.detector.js` |
| `buildSyntaxLayer()` | Syntax highlighting layer builder | `src/lib/syntax.layer.js` |
| `patternColor()` | Generate color from pattern label | `src/lib/patternColor.js` |
| `getBytecodeAMP(time, channel)` | O(1) animation lookup (GLOW, FLICKER, ROTATION, SCALE) | `src/lib/ambient/bytecodeAMP.js` |
| `getRotationAtTime(time, bpm, degPerBeat)` | Absolute time → radians | `src/lib/ambient/bytecodeAMP.js` |
| `resolveVerseIrColor()` | Resolve VerseIR token color | `src/lib/truesight/color/pcaChroma.js` |
| `attachPlsVerseIRBridge()` | PLS ↔ VerseIR bridge | `src/lib/pls/verseIRBridge.js` |
| `musicEmbeds` | Music video embed registry | `src/lib/musicEmbeds.js` |
| `combatApi` | Combat API client | `src/lib/combatApi.js` |
| `combatScoring` | Combat scoring heuristics | `src/lib/combatScoring.js` |
| `deepRhymeEngine` | Deep rhyme analysis | `src/lib/deepRhyme.engine.js` |
| `literaryDevicesDetector` | Literary device detection | `src/lib/literaryDevices.detector.js` |
| `literaryClassifier` | Genre/style classifier | `src/lib/literaryClassifier.js` |
| `phoneticHackingEngine` | Phonetic analysis | `src/lib/phoneticHacking.engine.js` |
| `poeticLanguageServer` | Poetic language analysis | `src/lib/poeticLanguageServer.js` |
| `progressionUtils` | XP/level calculations | `src/lib/progressionUtils.js` |
| `rhymeSchemeDetector` | Rhyme scheme detection | `src/lib/rhymeScheme.detector.js` |
| `routes` | App route definitions | `src/lib/routes.js` |
| `scholomanceCorpusApi` | Corpus API client | `src/lib/scholomanceCorpus.api.js` |
| `scholomanceDictionaryApi` | Dictionary API client | `src/lib/scholomanceDictionary.api.js` |
| `wordTokenization` | Word tokenization utilities | `src/lib/wordTokenization.js` |
| `pixelbrainAdapter` | PixelBrain adapter | `src/lib/pixelbrain.adapter.js` |
| `processorBridge` | Microprocessor bridge | `src/lib/processor-bridge.js` |
| `renderEngine` | Render engine | `src/lib/render-engine.js` |
| `microprocessorWorkerClient` | Worker client for microprocessors | `src/lib/microprocessor.worker-client.js` |
| `lazyWithRetry` | Lazy loading with retry logic | `src/lib/lazyWithRetry.js` |

---

### Data Modules (`src/data/`)

| Module | Exports | Location |
|--------|---------|----------|
| `schools.js` | `SCHOOLS`, `VOWEL_FAMILY_TO_SCHOOL`, `getSchoolsByUnlock()`, `getSchoolById()`, `generateSchoolColor()` | `src/data/schools.js` |
| `schoolPalettes.js` | `SCHOOL_SKINS`, `getVowelColorsForSchool()`, `getRitualPalette()` | `src/data/schoolPalettes.js` |
| `progression_constants.js` | XP tables, level thresholds | `src/data/progression_constants.js` |
| `rhymeScheme.patterns.js` | Rhyme scheme pattern library | `src/data/rhymeScheme.patterns.js` |
| `sonicStationBuckets.js` | Sonic analysis buckets | `src/data/sonicStationBuckets.js` |
| `stacking_tiers.js` | Z-index semantic constants | `src/data/stacking_tiers.js` |
| `library.js` | Shared library utilities | `src/data/library.js` |

---

### Shared Components (`src/components/`)

| Component | Props | Location |
|-----------|-------|----------|
| `Icons` | Various icon exports | `src/components/Icons.jsx` |
| `HeuristicScorePanel` | `{ scoreData, genreProfile, visible, isEmbedded }` | `src/components/HeuristicScorePanel.jsx` |
| `InfoBeamPanel` | `{ connections, visible, groupLabel, groupColor }` | `src/components/InfoBeamPanel.jsx` |
| `RhymeDiagramPanel` | `{ connections, lineCount, visible, highlightedLines }` | `src/components/RhymeDiagramPanel.jsx` |
| `VowelFamilyPanel` | `{ families, totalWords, uniqueWords, visible, isEmbedded }` | `src/components/VowelFamilyPanel.jsx` |
| `WordTooltip` | `{ word, definition, position, onClose }` | `src/components/WordTooltip.jsx` |
| `IntelliSense` | `{ suggestions, index, onSelect }` | `src/components/IntelliSense.jsx` |
| `AtmosphereSync` | `{ schoolId, auroraLevel }` | `src/components/AtmosphereSync.jsx` |
| `SigilChamber` | `{ sigils, onSelect }` | `src/components/SigilChamber.jsx` |

---

### Read Page Components (`src/pages/Read/`)

| Component | Props | Location |
|-----------|-------|----------|
| `ScrollEditor` | `{ content, title, isEditable, isTruesight, analyzedWords, onContentChange }` | `src/pages/Read/ScrollEditor.jsx` |
| `ScrollList` | `{ scrolls, activeScrollId, onSelect }` | `src/pages/Read/ScrollList.jsx` |
| `AnalysisPanel` | `{ scheme, meter, statistics, literaryDevices, emotion, genreProfile, scoreData, rhymeAstrology }` | `src/pages/Read/AnalysisPanel.jsx` |
| `TruesightControls` | `{ isTruesight, onToggle, analysisMode, onModeChange }` | `src/pages/Read/TruesightControls.jsx` |
| `ToolsSidebar` | `{ isTruesight, selectedSchool, schoolList, onSchoolChange }` | `src/pages/Read/ToolsSidebar.jsx` |
| `SearchPanel` | `{ scrolls, query, results }` | `src/pages/Read/SearchPanel.jsx` |
| `Minimap` | `{ lines, cursorLine, visible }` | `src/pages/Read/Minimap.jsx` |
| `IDEAmbientCanvas` | `{ auroraLevel, schoolId }` | `src/pages/Read/IDEAmbientCanvas.jsx` |
| `KeystrokeSparksCanvas` | `{ onKeystroke }` | `src/pages/Read/KeystrokeSparksCanvas.jsx` |
| `FloatingPanel` | `{ children, position, onClose }` | `src/components/shared/FloatingPanel.jsx` |
| `IDEChrome` | `{ TopBar, StatusBar }` | `src/pages/Read/IDEChrome.jsx` |

---

### Listen Page Components (`src/pages/Listen/`)

| Component | Props | Location |
|-----------|-------|----------|
| `SignalChamberConsole` | `{ signalLevel, isPlaying }` | `src/pages/Listen/SignalChamberConsole.tsx` |
| `AlchemicalLabBackground` | `{ schoolId }` | `src/pages/Listen/AlchemicalLabBackground.tsx` |
| `CrystalBallVisualizer` | `{ onClick, schoolId }` | `src/pages/Listen/CrystalBallVisualizer.tsx` |
| `HolographicEmbed` | `{ videoId, isPlaying }` | `src/pages/Listen/HolographicEmbed.jsx` |
| `ScholomanceStation` | `{ stations, onSelect, onClose }` | `src/pages/Listen/ScholomanceStation.tsx` |
| `OutputDeviceSelector` | `{ devices, selected, onChange }` | `src/pages/Listen/OutputDeviceSelector.tsx` |

---

### Animation AMP (`src/codex/animation/`)

| Function | Purpose | Location |
|----------|---------|----------|
| `runAnimationAmp(intent)` | Main AMP entry point | `amp/runAnimationAmp.ts` |
| `fuseMotionOutput(outputs)` | Fuse multiple motion results | `amp/fuseMotionOutput.ts` |
| `normalizeAnimationIntent(intent)` | Validate + fill defaults | `amp/normalizeAnimationIntent.ts` |
| `registerAllProcessors()` | Bootstrap processor registry | `processors/registerAllProcessors.ts` |
| `compileBlueprint(blueprint)` | Blueprint → backend payloads | `bytecode-bridge/compiler/blueprintCompiler.ts` |
| `parseBlueprintBlock(source)` | Parse PDR blueprint syntax | `bytecode-bridge/parser/blueprintParser.ts` |
| `validateBlueprint(blueprint)` | Semantic validation | `bytecode-bridge/validator/blueprintValidator.ts` |
| `generateQAReport(blueprint)` | QA invariant report | `bytecode-bridge/qa/blueprintQA.ts` |

**Types:** `AnimationIntent`, `ResolvedMotionOutput`, `MotionProcessor`, `AnimationBlueprintV1`, `FormulaNode`, `BytecodeInstruction`

---

### Bytecode Error System (`docs/ByteCode Error System/`)

| Module | Purpose | Location |
|--------|---------|----------|
| Error codes | `PB-ERR-v1-{CATEGORY}-{SEVERITY}-{MODULE}-{CODE}` | `02_Error_Code_Reference.md` |
| QA assertions | `assertEqual`, `assertTrue`, `assertInRange`, `assertType` | `04_QA_Integration_Guide.md` |
| Approved schemas | `PB-ERR-v1`, `PB-RECURSE-v1`, `0xF`-prefixed formulas | `01_System_Overview.md` |

---

### Security Patterns (`ARCH_CONTRACT_SECURITY.md`)

| Pattern | Rule |
|---------|------|
| Input validation | Allow-list only, never deny-list |
| Output escaping | React default, sanitize if `dangerouslySetInnerHTML` |
| Auth tokens | httpOnly cookies only, never localStorage |
| No `eval()` | Never use `eval()`, `new Function()`, or inline handlers |
| CSRF | All mutating requests require CSRF token |

---

### Common Gotchas

| Gotcha | Correct Approach |
|--------|-----------------|
| Using `delta` for rotation | Use `getRotationAtTime(time, bpm)` — absolute time |
| Simulating particles per-frame | Pre-generate patterns, cache, select by bytecode state |
| Making client authoritative | Server resolves, client decorates |
| Inline styles for state | CSS classes + event bus only |
| `eval()` or `new Function()` | Never. Use bytecode interpreter |
| Unsanitized `dangerouslySetInnerHTML` | Sanitize per `ARCH_CONTRACT_SECURITY.md` |
| Parallel animations fighting | Use Animation AMP — single source of truth |
| Z-index conflicts | Reference the z-index stack for each page |

---

## Online Reference Resources

**Mandatory bookmarks for all agents.** These resources provide essential reference data for bytecode-to-pixel conversions and typographic measurements.

| Resource | Purpose | URL |
|----------|---------|-----|
| **Points vs Pixels Calculator** | Interactive reference for converting typographic points to screen pixels at various DPIs. Essential for bytecode mathematical conversion when calculating glyph positioning and grid-fitting. | https://reeddesign.co.uk/test/points-pixels.html |
| **Google Fonts** | Web font library with metric data. Use for cross-platform font consistency (Crimson Pro = Georgia alternative for Linux). | https://fonts.google.com |
| **Can I Use** | Browser compatibility reference for CSS properties and APIs. | https://caniuse.com |
| **MDN Web Docs** | Authoritative reference for web APIs including Canvas `measureText()`, font properties, and text rendering. | https://developer.mozilla.org |

**Why Points vs Pixels Matters:**

When implementing bytecode-driven typography:
- **1 point = 1/72 inch** (typographic standard)
- **Pixels vary by DPI**: 96 DPI (Windows), 72 DPI (macOS legacy), device-specific (mobile)
- **Device Pixel Ratio (DPR)**: `window.devicePixelRatio` converts CSS pixels to device pixels
- **Formula**: `pixels = points × (DPI / 72) × DPR`

Use the Points vs Pixels calculator to verify:
- Font size conversions (e.g., 12pt @ 96 DPI = 16px)
- Line height calculations
- Character width measurements
- Grid cell dimensions for bytecode positioning

---

## Version Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-03-10 | Initial law established |
| 1.1 | 2026-03-10 | Split Gemini and Codex roles, clarified Angel authority, and established root-doc precedence over archive references |
| 1.2 | 2026-04-01 | Added "Before Using PixelBrain: Essential Knowledge" — bytecode-driven animation principles, absolute time formula, architecture pattern |
| 1.3 | 2026-04-01 | Added Law 9: "Law Evolution Is Mandatory" — requires agents to evaluate and propose law updates based on critical nature and structural integrity |
| 1.4 | 2026-04-01 | Added Law 10: "Stacking Sovereignty" — z-index must use semantic constants. Added `ENGINEERING_RULEBOOK.md` — mandatory QA gates for all code changes |
| 1.5 | 2026-04-01 | Added immutability clause to Law 8. Added dependency whitelisting rule to ENGINEERING_RULEBOOK.md |
| 1.6 | 2026-04-01 | Added "Agent Tool Reference" — comprehensive inventory of all hooks, utilities, services, and components. Mandatory reference for all agents to prevent parallel pattern invention |
| 1.7 | 2026-04-02 | Added Law 11: "Scholomance Encyclopedia — Bug Fix Documentation" — mandates documentation of all bug fixes with bytecode search codes upon Angel's "BUG REPORT AUDIT" command. Renumbered subsequent laws |
| 1.8 | 2026-04-02 | Added "Online Reference Resources" section — mandatory bookmarks for bytecode-to-pixel conversions, typography measurements, and web API references. Added Points vs Pixels calculator for DPI/DPR calculations |
| 1.9 | 2026-04-02 | Added Law 13: "PDR Archive Is Mandatory" — all Product Design Requirements must be stored in `docs/PDR-archive/`. Scattered PDRs prohibited |
| 1.10 | 2026-04-02 | Added Law 14: "Collab Login and MCP Access Protocol" — explicit boot order, login path, MCP bridge configuration, role mapping, and per-agent access instructions. Corrected stale top-level version header to match the actual law revision |
| 1.11 | 2026-04-03 | Expanded Law 14.10 with Key Management commands and added Law 14.11 "Automatic Secret Synchronization" for Render integration. |

---

*Arbiter: Angel (IItsVaelrix, repository owner/user). Final decisions on all escalations rest here.*
