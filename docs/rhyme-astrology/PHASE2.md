# RhymeAstrology Phase 2

Phase 2 builds deploy-time SQLite artifacts for runtime lookup.

## Outputs

- `rhyme_lexicon.sqlite` (Stage A)
- `rhyme_index.sqlite` (Stage B)
- `rhyme_edges.sqlite` (Stage C)
- `rhyme_manifest.json` (validation + counts + sizes)
- `rhyme_oversized_buckets.json` (bucket imbalance log)

Default output directory:

- `dict_data/rhyme-astrology`

## Stage Audit (2026-03-08)

- [x] Stage A executed: `50000` lexicon nodes, `0` skipped.
- [x] Stage B executed: `1889` signature buckets, `2510` clusters, largest bucket `4867`.
- [x] Stage C executed: `10000` hot words, `410615` hot edges.
- [x] Manifest and oversized-bucket log emitted.
- [ ] Storage target met under default config (`116.238MB` total vs `100MB` target).

Latest generated artifacts (local, ignored by git):
- `dict_data/rhyme-astrology/rhyme_lexicon.sqlite`
- `dict_data/rhyme-astrology/rhyme_index.sqlite`
- `dict_data/rhyme-astrology/rhyme_edges.sqlite`
- `dict_data/rhyme-astrology/rhyme_manifest.json`
- `dict_data/rhyme-astrology/rhyme_oversized_buckets.json`

## Runbook

```bash
npm run build:rhyme-astrology:index
```

## Tunables

- `RHYME_ASTROLOGY_OUTPUT_DIR` (absolute or relative path)
- `RHYME_ASTROLOGY_TARGET_LEXICON` (default `50000`)
- `RHYME_ASTROLOGY_HOT_EDGE_WORD_LIMIT` (default `10000`)
- `RHYME_ASTROLOGY_HOT_EDGE_TOP_K` (default `50`)
- `RHYME_ASTROLOGY_OVERSIZED_BUCKET_THRESHOLD` (default `500`)
- `RHYME_ASTROLOGY_BUCKET_CANDIDATE_CAP` (default `600`)
- `RHYME_ASTROLOGY_CLUSTER_LIMIT_PER_BUCKET` (default `6`)
- `RHYME_ASTROLOGY_STORAGE_TARGET_MB` (default `100`)

## Validation Included

- Artifact size summary and total MB
- Row counts across all generated tables
- Oversized bucket detection and log emission
- Manifest metadata for stage timings and build configuration
