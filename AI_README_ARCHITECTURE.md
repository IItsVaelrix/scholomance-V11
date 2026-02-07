# Scholomance V10 AI Architecture README

Scholomance V10 is a single-page React app built with Vite that presents a ritual-themed interface across Watch, Listen, and Read flows. The runtime is driven by React Router, Context providers, and a dynamic CSS theme system that reacts to the selected school and track. This document is optimized for AI agents to map features, data flow, and extension points quickly and consistently.

**TL;DR for AI**
- Entry: `src/main.jsx` sets up React Router and mounts the app.
- Layout: `src/App.jsx` wires providers, background layers, navigation, and animated page transitions.
- Data: schools and tracks live in `src/data/schools.js` and `src/data/library.js`.
- State: Context hooks in `src/hooks/` drive song selection, progression, phoneme engine readiness, and scroll storage.
- Styling: global tokens in `src/index.css`, school variables in `src/lib/css/generated/school-styles.css`.
- Read flow: phoneme analysis in `src/lib/phoneme.engine.js` plus external references via `src/lib/reference.engine.js`.

**Quickstart and Scripts**
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm run test`
- Preview build: `npm run preview`
- Generate school CSS: `node scripts/generate-school-styles.js`
- Tech stack: Vite, React, React Router, Framer Motion, Vitest

**Repo Map**
- `src/` app source
- `src/main.jsx` entrypoint, router creation, root render
- `src/App.jsx` app shell and providers
- `src/pages/` page-level features (Watch, Listen, Read)
- `src/components/` shared UI and layout
- `src/hooks/` Context providers and custom hooks
- `src/data/` static data for schools, tracks, progression constants
- `src/lib/` engines and utilities (phoneme analysis, progression math, references)
- `public/phoneme_dictionary_v2.json` phoneme dictionary data
- `public/rhyme_matching_rules_v2.json` rhyme rule data
- `public/data/` JSON data that appears unused by `src` (see Gotchas)
- `scripts/` build-time helpers (CSS generation)
- `tests/` unit and accessibility tests
- `vite.config.js` Vite and Vitest config

**Runtime Architecture**
- `src/main.jsx` creates a `createBrowserRouter` with lazy-loaded pages and renders `RouterProvider` under `ErrorBoundary`.
- `src/App.jsx` is the app shell with `ProgressionProvider`, `PhonemeEngineProvider`, and `SongProvider`.
- `src/App.jsx` adds layered visual backgrounds and page transitions via Framer Motion.
- `src/components/Navigation/Navigation.jsx` reads `LINKS` from `src/data/library.js` to render top-level routes.
- `src/components/shared/ErrorBoundary.jsx` catches runtime errors and renders a fallback UI.

**Core Domains and Data Models**
- Schools: `src/data/schools.js` defines all school metadata, unlock XP, angles, and atmosphere settings.
- Tracks: `src/data/library.js` defines YouTube and SoundCloud sources and maps them to schools.
- Progression constants: `src/data/progression_constants.js` defines XP curve and tiers.
- Vowel palette: `src/data/vowelPalette.js` maps vowel families to colors and school affinities.
- Scrolls: `src/hooks/useScrolls.jsx` manages user-created scrolls stored in localStorage.
- Phoneme analysis: `src/lib/phoneme.engine.js` uses `cmudict` via `src/lib/cmu.phoneme.engine.js` with a fallback analyzer.
- Reference lookup: `src/lib/reference.engine.js` pulls definitions, synonyms, and rhymes.

**State Management and Persistence**
- Song state: `src/hooks/useCurrentSong.jsx` provides `currentSong` and `setCurrentKey`.
- Progression state: `src/hooks/useProgression.jsx` tracks XP and unlocked schools.
- Phoneme engine state: `src/hooks/usePhonemeEngine.jsx` initializes and exposes `PhonemeEngine`.
- LocalStorage key: `scholomance-progression-v2` stores XP and unlocks.
- LocalStorage key: `scholomance-scrolls-index-v2` stores scroll ID index.
- LocalStorage key: `scholomance-scroll-v2-*` stores per-scroll data.
- LocalStorage key: `mw_dict_key` stores Merriam-Webster dictionary API key.
- LocalStorage key: `mw_thes_key` stores Merriam-Webster thesaurus API key.
- Cache: `PhonemeEngine.WORD_CACHE` memoizes analyzed words.

**Page-by-Page Data Flow**
- Watch: `src/pages/Watch/WatchPage.jsx` consumes `useCurrentSong` and embeds YouTube via `currentSong.yt`.
- Listen: `src/pages/Listen/ListenPage.jsx` uses `useCurrentSong` and `useProgression` to gate schools and embed SoundCloud.
- Read: `src/pages/Read/ReadPage.jsx` uses `useScrolls`, `usePhonemeEngine`, `ReferenceEngine`, and `useProgression.addXP`.

**External Services and Embeds**
- Datamuse API for rhymes and synonyms in `src/lib/reference.engine.js`.
- Merriam-Webster APIs if keys are provided in localStorage and URLs in `.env`.
- Free Dictionary API fallback for definitions.
- YouTube embed in `src/pages/Watch/WatchPage.jsx`.
- SoundCloud embed in `src/pages/Listen/HolographicEmbed.jsx`.
- Environment variables: `VITE_DICTIONARY_API_URL`, `VITE_THESAURUS_API_URL` in `.env`.

**Styling and Theming System**
- Global tokens and base styles in `src/index.css`.
- School CSS variables in `src/lib/css/generated/school-styles.css`.
- School CSS generated by `scripts/generate-school-styles.js` from `src/lib/css/schoolStyles.js` and `src/data/schools.js`.
- Dynamic theme updates via `src/hooks/useAtmosphere.js` based on `currentSong.school`.
- Read-specific styles in `src/pages/Read/ReadPage.css`.

**Contracts (Architecture and Security)**
- `ARCH_CONTRACT.md` summary: semantic surfaces and data-role hooks are stable; state is class-driven; analysis logic is pure and must not touch the DOM.
- `ARCH_CONTRACT_SECURITY.md` summary: use allow-list validation for inputs, escape outputs in the correct context, and avoid dangerous patterns like `eval` and unsafe HTML injection.

**Tests**
- Test runner: Vitest configured in `vite.config.js`.
- Testing Library and jest-axe used for React and accessibility tests.
- `tests/lib/phoneme.engine.test.js` covers phoneme analysis.
- `tests/hooks/useProgression.test.jsx` covers progression behavior.
- `tests/accessibility.test.jsx` covers a11y baseline for app layout and scrolls.

**Known Gotchas and Legacy**
- `public/data/library.json` and `public/data/schools.json` appear unused by `src` and may be legacy or future-facing.
- `PhonemeEngine.init` expects `/phoneme_dictionary_v2.json` and `/rhyme_matching_rules_v2.json` to exist in `public/`.

**How to Extend**
- Add a school: update `src/data/schools.js` and run `node scripts/generate-school-styles.js`.
- Add a track: update `src/data/library.js` and associate a `school` entry.
- Add a page: create under `src/pages/`, add a route in `src/main.jsx`, and update `LINKS` in `src/data/library.js` if needed.
