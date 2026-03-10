# VAELRIX_LAW.md
## The Source of Truth

> Read first: `SHARED_PREAMBLE.md` → this file.

**Version: 1.1** | Status: Living Document | Arbiter: Angel (IItsVaelrix, repository owner/user)

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

## Version Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-03-10 | Initial law established |
| 1.1 | 2026-03-10 | Split Gemini and Codex roles, clarified Angel authority, and established root-doc precedence over archive references |

---

*Arbiter: Angel (IItsVaelrix, repository owner/user). Final decisions on all escalations rest here.*
