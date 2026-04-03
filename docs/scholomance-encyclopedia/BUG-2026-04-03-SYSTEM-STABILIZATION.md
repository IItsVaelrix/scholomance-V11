# BUG-2026-04-03-SYSTEM-STABILIZATION

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-STABILIZE-V11`

## Bug Description
The system was suffering from a multi-vector instability event:
1. **Dimension Parsing Failures:** Complex orientation and clamp formulas triggered malformed dimension errors.
2. **TrueSight Regression:** Word-coloring was non-functional in JSDOM due to data structure mismatches.
3. **Pipeline Rejections:** Asynchronous rejections were escaping the catch boundaries in image processing.
4. **Missing Heuristics:** Core recovery hints for Linguistic and Combat errors were documented but not implemented.

## Root Cause
- **Dimension Compiler:** The regex-based splitting logic was too aggressive, failing to respect nested brackets and specific orientation pairs.
- **Test Harness:** `truesight.renderHarness.jsx` and related tests were providing `bytecode` instead of `visualBytecode` and omitting the `analyzedWordsByIdentity` Map required by `useColorCodex`.
- **Async Execution:** `generatePixelArtFromImage` was called without `await` in several test paths, leading to unhandled rejections.

## Thought Process
1. **Observation:** Ran `npm run test:qa` and observed 15 failures across multiple domains.
2. **Investigation:** Isolated the `DimensionCompiler` failure and discovered the comma-splitting logic was breaking orientation pairs like `portrait 1920x1080, landscape 1920x600`.
3. **Breakthrough:** Realized that `useColorCodex` exclusively uses `analyzedWordsByIdentity`, while tests were only providing `analyzedWordsByCharStart`.
4. **Solution:** Refactored the compiler to prioritize pair matching, updated the test harness to provide the correct data shape, and implemented the missing recovery hint logic in the core bytecode module.

## Changes Made
| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `codex/core/pixelbrain/bytecode-error.js` | 150-185 | Implemented recovery hints for LINGUISTIC, COMBAT, and UI_STASIS. |
| `codex/core/pixelbrain/dimension-formula-compiler.ts` | 180-250 | Refactored parsing to handle orientation pairs and nesting. |
| `tests/qa/features/truesight.qa.test.jsx` | All | Harmonized data structure with `useColorCodex` requirements. |
| `scripts/generate-school-styles.js` | All | Refactored into a testable module with a `main()` entry point. |
| `tests/qa/bytecode-edge-cases.test.js` | NEW | Created to verify integrity and security invariants. |

## Testing
- **Full QA Suite:** 570/570 tests passing (including `test:qa` and `test:qa:stasis`).
- **Edge Case Battery:** Verified checksum tampering detection and recursive stress limits.

## Lessons Learned
Infrastructure documentation (PDRs) must be mirrored in the code immediately to prevent "Implementation Drift." Always ensure test mocks match the *current* property names expected by logic hooks (`visualBytecode` vs `bytecode`).
