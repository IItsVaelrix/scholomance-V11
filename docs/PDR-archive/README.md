# PDR Archive — Product Design Requirements

**Location:** `docs/PDR-archive/`

All Product Design Requirements (PDRs) for Scholomance are archived here. Each PDR defines a major feature or architectural system before implementation.

---

## Active PDRs

| PDR | Classification | Status | Priority |
|-----|---------------|--------|----------|
| [`mcp_bridge_enhancements_pdr.md`](./mcp_bridge_enhancements_pdr.md) | Collaboration + MCP + Orchestration | Draft | High |
| [`collab_control_plane_mcp_convergence_pdr.md`](./collab_control_plane_mcp_convergence_pdr.md) | Collaboration + MCP + Orchestration | Draft | High |
| [`collab_ui_polish_v2_pdr.md`](./collab_ui_polish_v2_pdr.md) | Collaboration + UI + Operational Trust | Draft | High |
| [`pixelbrain_font_audit_bytecode_pdr.md`](./pixelbrain_font_audit_bytecode_pdr.md) | Rendering + Measurement + Bytecode IR | **Draft** | Critical |
| [`lexical_atrium_pdr_redesign.md`](./lexical_atrium_pdr_redesign.md) | UI + Lexicon + Search | Draft | High |
| [`collab_vscode_experience_pdr.md`](./collab_vscode_experience_pdr.md) | UI + Collaboration + VS Code Integration | Draft | High |
| [`live_website_collab_hosting_pdr.md`](./live_website_collab_hosting_pdr.md) | Infrastructure + Security + Remote Agent Access | **Implemented** | High |
| [`postfix_integration_pdr.md`](./postfix_integration_pdr.md) | Infrastructure + Security + Communications | Draft | High |
| [`lexicon_oracle_aesthetic_refinement_pdr.md`](./lexicon_oracle_aesthetic_refinement_pdr.md) | UI + Data Visualization + Animation | Draft | High |

## Implemented PDRs

| PDR | Classification | Implemented | Notes |
|-----|---------------|-------------|-------|
| [`animation_amp_pdr.md`](./animation_amp_pdr.md) | Animation + Bytecode + AMP | ✅ Yes | Animation MicroProcessor system |
| [`bytecode_blueprint_bridge_pdr.md`](./bytecode_blueprint_bridge_pdr.md) | Bytecode + Compiler + Parser | ✅ Yes | Blueprint → Bytecode compilation |
| [`render_secret_sync_pdr.md`](./render_secret_sync_pdr.md) | Infrastructure + DevOps + Security | ✅ Yes | Automated Render secret synchronization |
| [`scholomance_collab_console_ui_pdr.md`](./scholomance_collab_console_ui_pdr.md) | Collaboration + UI + Operations | ✅ Yes | Collab Console UI phases 1-4 completed on 2026-04-02 |

## Temporary / Working Drafts

| PDR | Purpose |
|-----|---------|
| [`pdr_markdown_temp.md`](./pdr_markdown_temp.md) | Working draft / scratchpad |

---

## PDR Lifecycle

1. **Draft** → PDR written, under review
2. **Approved** → Angel approved, ready for implementation
3. **In Progress** → Implementation underway
4. **Implemented** → Feature complete, QA passed
5. **Archived** → Superseded or deprecated

---

## How To Write A PDR

Use the standard PDR template structure:

```markdown
# PDR: [Feature Name]
## [Subtitle]

**Status:** Draft | Approved | In Progress | Implemented | Archived
**Classification:** [Architectural | UI | Rendering | etc.]
**Priority:** Critical | High | Medium | Low
**Primary Goal:** [One sentence summary]

---

# 1. Executive Summary
# 2. Problem Statement
# 3. Product Goal
# 4. Non-Goals
# 5. Core Design Principles
# 6. Feature Overview
# 7. Architecture
# 8. Module Breakdown
# 9. ByteCode IR Design (if applicable)
# 10. Implementation Phases
# 11. QA Requirements
# 12. Success Criteria
```

---

## Related Documents

- **Scholomance Encyclopedia:** `../scholomance-encyclopedia/README.md`
- **Vaelrix Law:** `../../VAELRIX_LAW.md`
- **Schema Contract:** `../../SCHEMA_CONTRACT.md`
- **Architecture:** `../../AI_ARCHITECTURE_V2.md`

---

*Last Updated: 2026-04-03 — Added collab_ui_polish_v2_pdr.md*
