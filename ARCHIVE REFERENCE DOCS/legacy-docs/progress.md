Original prompt: implement your part of ECHANIC SPEC - Procedural Opponent Doctrines and Seeded Unique Move Kits.MD

- 2026-03-14: Reviewed SHARED_PREAMBLE.md, VAELRIX_LAW.md, SCHEMA_CONTRACT.md, AGENTS.md, and the mechanic spec handoff section.
- 2026-03-14: Confirmed current combat UI has no doctrine-specific rendering yet and current engine state does not expose the new doctrine fields by name.
- 2026-03-14: Implementing a UI-only doctrine surface that renders optional authoritative fields when present and degrades cleanly against the current encounter state.
- 2026-03-14: Added `src/pages/Combat/components/OpponentDoctrinePanel.jsx` and wired it into `src/pages/Combat/CombatPage.jsx`.
- 2026-03-14: Added combat doctrine styling for school-aware doctrine headers, telegraph/phase banners, move reveal cards, and text-first status/token chips in `src/pages/Combat/CombatPage.css`.
- 2026-03-14: Verified `npm run build` passes.
- 2026-03-14: Verified `eslint` passes for `src/pages/Combat/CombatPage.jsx` and `src/pages/Combat/components/OpponentDoctrinePanel.jsx`.
- 2026-03-14: Browser-check artifacts captured at `output/web-game/combat-doctrine/shot-0.png` and `output/web-game/combat-doctrine-long/shot-0.png`; doctrine surface rendered successfully and the arena loaded on the longer capture.
- 2026-03-14: Residual note from browser pass: `errors-0.json` logged one generic 500 resource error during `/combat` route load. The doctrine panel still rendered and the arena still booted; source of the 500 was not traced in this pass.
