# Codex Specialized Instruction List (ARCH-Derived)

This file converts your ARCH docs into a practical instruction set that is tuned to Codex strengths: architecture-safe implementation, fast cross-file refactors, backend contract alignment, security hardening, and test-backed delivery.

## Source Docs Used
- `AI_README_ARCHITECTURE.md`
- `ARCH_DICTIONARY_MUD.md`
- `UNLOCKABLE_SCHOOLS_ARCHITECTURE.md`
- `ARCHIVE REFERENCE DOCS/ARCH.md`
- `ARCHIVE REFERENCE DOCS/ARCH_CONTRACT.md`
- `ARCHIVE REFERENCE DOCS/ARCH_CONTRACT_SECURITY.md`
- `ARCHIVE REFERENCE DOCS/BACK_END_ARCH_UPGRADE.md`
- `ARCHIVE REFERENCE DOCS/SECURITY_ARCHITECTURE_V2.0.md`
- `ARCHIVE REFERENCE DOCS/AI_ARCHITECTURE_V2.md`
- `ARCHIVE REFERENCE DOCS/AI_COLLABORATION_ARCHITECTURE_PLAN.md`

## Codex Strength Profile To Exploit
- Implement multi-file changes quickly when scope and contracts are explicit.
- Keep layered boundaries intact (`core -> services -> runtime -> server -> src` UI usage).
- Convert architectural plans into concrete patches plus tests.
- Do strong bug-risk and regression detection in code review mode.
- Enforce deterministic logic and measurable acceptance criteria.
- Execute security hardening with allow-list validation and schema checks.

## High-Value Instruction Rules

1. Always give a priority tag.
- Format: `Priority: P0 | P1 | P2 | P3`.

2. Always declare layer ownership.
- Say exactly where logic must live and where it must not live.
- Example: `Parsing/scoring stays in codex/core only. No DOM access.`

3. Keep the "server is truth" rule explicit for gameplay state.
- XP, unlocks, combat resolution, and persistence are server-authoritative.

4. Require pure analysis behavior in language engines.
- No DOM, audio, animation, or side effects in parser/phoneme/rhyme/scoring code.

5. Use adapter-first integration for external systems.
- New providers go through adapters, not direct calls from core logic.

6. Require contract-first changes for API work.
- Update schemas, route validation, and client expectations in one pass.

7. Ask for allow-list validation, not deny-list filtering.
- Inputs, query params, ids, and enums must be validated by schema.

8. Require secure auth transport.
- No secrets in query strings.
- Prefer headers/session/cookie + CSRF model already used in backend.

9. Require rate-limit integrity by identity.
- Prefer per-user identity keys with safe IP fallback.
- Avoid proxy assumptions unless explicitly configured.

10. Require cache and dedupe strategy for repeated lookup calls.
- Prefer shared server caching and in-flight request coalescing.

11. Require deterministic scoring and explainability.
- Same input must yield same output.
- Expose score traces/breakdowns where applicable.

12. Require data-driven expansion over hardcoded constants.
- Follow school/dictionary architecture patterns using config maps and generated data.

13. Require migration-safe data changes.
- For DB/schema changes: include migration path, rollout assumptions, and fallback behavior.

14. Require bounded query behavior.
- Add pagination caps, strict query schemas, and predictable error envelopes.

15. Require JSON behavior for API surfaces.
- API misses return JSON errors, not SPA fallback HTML.

16. Require test updates in the same patch.
- Add or update unit/integration tests for changed behavior.
- Include at least one regression test for the bug being fixed.

17. Require verification command output in final report.
- Include exact commands run and pass/fail summary.

18. Require file-scoped change logs.
- Final response must list touched files and what changed in each.

19. Require no unrelated refactors.
- Keep patch scope tight unless explicitly authorized to broaden.

20. Require risk notes when uncertainty exists.
- Call out assumptions, unknowns, and potential regressions before merge.

## Specialized Task Template (Copy/Paste)

Use this template when assigning work to Codex:

```md
Task:
Priority: P1
Outcome: <one sentence of desired behavior>

Architecture Constraints:
- Allowed layers/files: <list>
- Forbidden layers/files: <list>
- Server truth rules: <if applicable>
- Security constraints: allow-list validation, no query-token auth, schema validation

Contract:
- Request/response schema: <types>
- Backward compatibility requirement: <yes/no + details>

Implementation Scope:
- Files expected to change: <list>
- Files that must not change: <list>

Verification:
- Required tests: <list>
- Required command(s): <list>
- Definition of done:
  - [ ] Behavior implemented
  - [ ] Tests added/updated
  - [ ] Relevant suite passes
  - [ ] Risks documented
```

## Review Mode Template (Bug/Risk Focus)

```md
Review this patch with findings first.
Focus order:
1) correctness bugs
2) security regressions
3) contract drift
4) missing tests
5) performance risks

For each finding include:
- severity
- file and line
- why it is a real risk
- minimal fix
```

## Definition Of Done Checklist (ARCH-Aligned)
- Layer boundaries respected.
- Contracts and schemas aligned across backend and frontend.
- Security validations added where input/output surfaces changed.
- Deterministic behavior preserved for scoring/analysis logic.
- Tests cover new behavior and regression case(s).
- Verification commands run and summarized.
- No unrelated files changed.
