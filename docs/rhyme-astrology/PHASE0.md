# RhymeAstrology Phase 0

Phase 0 establishes fixed contracts and rollout guardrails before any runtime behavior is enabled.

## Completed

1. v1 contract module defined in `codex/core/rhyme-astrology/contracts.js`.
- Locked query route: `/api/rhyme-astrology/query`
- Locked query defaults:
  - `mode=word`
  - `limit=25`
  - `minScore=0.4`
  - `includeConstellations=true`
  - `includeDiagnostics=true`
- Locked result schema sections:
  - `query`
  - `topMatches[]`
  - `constellations[]`
  - `diagnostics`

2. Backend feature flag wired.
- `ENABLE_RHYME_ASTROLOGY` added with default `false`.
- Exposed in server metrics payload under `featureFlags`.
- Included in `.env.example`, `README.md`, and backend contract verification.

3. Data-source verification script added.
- Script: `scripts/verify-rhyme-astrology-phase0.js`
- Output artifact: `docs/rhyme-astrology/phase0-source-verification.json`
- Verifies:
  - dictionary pronunciation-backed word pool from `entry` + `rhyme_index`
  - corpus token frequency derivation from `sentence.text`
  - overlap pool size and any coverage gap against target lexicon size (`50000` by default)
  - deterministic fallback fill policy for uncovered words (`fallback_floor`)

## Runbook

```bash
npm run verify:rhyme-astrology:phase0
```

Optional override:

```bash
RHYME_ASTROLOGY_TARGET_LEXICON=50000 npm run verify:rhyme-astrology:phase0
```
