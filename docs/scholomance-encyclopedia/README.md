# Scholomance Encyclopedia

## The Living Memory of the Codebase

> "No fix is complete without its story."

**Bytecode Search Code:** `SCHOL-ENC-BYKE-SEARCH`

---

## Purpose

The Scholomance Encyclopedia is the canonical repository of bug fix documentation, architectural decisions, and system knowledge. Every bug fixed, every pattern discovered, every lesson learned lives here.

This is not a changelog. This is not a release notes document. This is **deep technical narrative** — the story of how and why the system evolved.

---

## When to Write an Entry

**Angel's Command:** When Angel says **"BUG REPORT AUDIT"**, you will:

1. Stop current work
2. Open the relevant bug report
3. Trace the fix you implemented
4. Write the encyclopedia entry
5. Commit with the bytecode search code in the message

---

## Entry Format

All entries follow this structure:

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

---

## Entries

| Bug Code | Date | Title | Files Changed |
|----------|------|-------|---------------|
| `TEMPLATE` | N/A | Entry Template | N/A |
| `SCHOL-ENC-BYKE-SEARCH-001` | 2026-04-02 | Whitespace Alignment Bug | `IDE.css`, `ScrollEditor.jsx`, `corpusWhitespaceGrid.ts` |
| `SCHOL-ENC-BYKE-SEARCH-002` | 2026-04-02 | Font Audit Oracle Architecture (PDR) | `pixelbrain_font_audit_bytecode_pdr.md` |
| `SCHOL-ENC-BYKE-SEARCH-003` | 2026-04-02 | Sovereign Editor Principle (Foundational) | `SHARED_PREAMBLE.md` |

---

## Searching the Encyclopedia

Use the bytecode search code to find entries:

- **In your editor:** Search for `SCHOL-ENC-BYKE-SEARCH-`
- **CLI:** `grep -r "SCHOL-ENC-BYKE-SEARCH" docs/scholomance-encyclopedia/`
- **By date:** Entries are dated `BUG-[YYYY-MM-DD]-*`
- **By keyword:** Search entry titles for topic keywords

---

## Related Documents

- `VAELRIX_LAW.md` — Law 11 mandates this documentation
- `SHARED_PREAMBLE.md` — Agent coordination protocols
- `SCHEMA_CONTRACT.md` — Data shape definitions

---

*The Scholomance Encyclopedia grows with every battle fought. Each entry is a lesson for the next agent who walks this path.*
