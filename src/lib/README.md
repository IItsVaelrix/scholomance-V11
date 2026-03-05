# `src/lib` Layout

This folder is organized by concern to reduce scan time:

- `phonology/`: phoneme engines, syllabification, vowel normalization, and phonological weighting/process rules.
- `models/`: deterministic model/state logic (e.g., HHM/Harkov weights).
- `platform/`: browser/platform adapters (e.g., storage).
- `config/`: runtime configuration bootstraps (e.g., Zod CSP setup).
- `docs/`: lib-adjacent concept/reference docs.
- `pls/`: poetic language server ranking/providers.
- root `*.js`: higher-level orchestration utilities that combine submodules.
