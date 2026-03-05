# Scholomance v10 — TypeScript Migration Guide

> **Audience:** AI agents (Claude Code, OpenAI Codex, Google Gemini PRO)
> **Strategy:** Gradual, phased migration — no big-bang rewrite
> **Goal:** Convert all JS logic to TypeScript while preserving 100% test pass rate at each phase boundary

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State](#2-current-state)
3. [Global Rules — All Phases](#3-global-rules--all-phases)
4. [Phase 1 — Shared Types & Interfaces (Claude Code)](#4-phase-1--shared-types--interfaces-claude-code)
5. [Phase 2 — Core Engines (OpenAI Codex)](#5-phase-2--core-engines-openai-codex)
6. [Phase 3 — Libraries & Utilities (Google Gemini PRO)](#6-phase-3--libraries--utilities-google-gemini-pro)
7. [Type Reference Catalog](#7-type-reference-catalog)
8. [Dependency Graph](#8-dependency-graph)
9. [Config Changes Required](#9-config-changes-required)
10. [Verification Protocol](#10-verification-protocol)

---

## 1. Architecture Overview

```
scholomance-v10-main-main/
├── src/                          # React frontend (Vite + React 18)
│   ├── components/               # UI components (.jsx)
│   ├── pages/                    # Page-level components (.jsx)
│   ├── hooks/                    # React hooks (.jsx, 2 already .ts)
│   ├── lib/                      # ← PHASE 3 — Linguistic engines & utilities
│   │   ├── ambient/              # Audio ambient system
│   │   ├── pls/                  # Poetic Language Server + providers
│   │   └── css/                  # Style utilities
│   ├── data/                     # Static constants & configuration
│   └── types/                    # ← PHASE 1 CREATES THIS — Shared TS interfaces
├── codex/                        # Backend core
│   ├── core/                     # ← PHASE 2 — Scoring, analysis, heuristics
│   │   ├── heuristics/           # 7 heuristic scorers
│   │   └── rhyme/                # Rhyme prediction pipeline
│   ├── runtime/                  # Cache, eventBus, rateLimit, pipeline
│   ├── server/                   # Fastify routes & services (NOT in scope)
│   └── services/                 # External API adapters (NOT in scope)
├── tests/                        # 51 test files (Vitest + Playwright)
├── tsconfig.json                 # Frontend TS config (strict: true, allowJs: true)
├── tsconfig.checkjs.json         # Server-side type-checking config
├── vite.config.js                # Build config
└── package.json                  # type: "module", all ES Modules
```

### Key Technology Stack

| Layer | Technology | TS Support |
|-------|-----------|------------|
| Build | Vite 7.3 + esbuild | Native — zero config |
| Frontend | React 18.2 | Excellent — `@types/react` installed |
| Backend | Fastify 5.2 | Excellent — built-in types |
| Validation | Zod 4.3 | Excellent — `z.infer<>` |
| Testing | Vitest 4.0 | Excellent — native TS |
| E2E | Playwright 1.58 | Excellent — written in TS |
| TypeScript | 5.9.3 | Already installed |

---

## 2. Current State

### Already TypeScript (3 files — do NOT touch)
- `src/hooks/useAmbientPlayer.ts`
- `src/lib/audioAdminApi.ts`
- `src/pages/Listen/ListenPage.tsx`

### Existing TypeScript Config

**`tsconfig.json`** (frontend):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**`tsconfig.checkjs.json`** (server):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["codex/server/audioAuth.js"]
}
```

### Module System
- `package.json` has `"type": "module"` — **100% ES Modules**
- All files use `import`/`export` — zero `require()` calls
- No path aliases configured — all imports use relative paths

### Existing Conventions (from the 3 TS files)
1. Use `interface` for object shapes (not `type` for objects)
2. Use `type` for unions and aliases
3. Zod schemas use `z.infer<typeof Schema>` for type derivation
4. No barrel exports (`index.ts`) exist yet
5. No path aliases — stick with relative imports
6. `@typescript-eslint/no-explicit-any` is **off** (allows `any` during migration)
7. Unused args use `_` prefix: `argsIgnorePattern: "^_"`

---

## 3. Global Rules — All Phases

### MUST Follow

1. **Do NOT modify any file outside your assigned phase scope.** If you need a type from another phase, import it from `src/types/` (created in Phase 1).

2. **Do NOT rename files that are imported by test files** without updating the test imports. Check for test references before renaming. Test files live in `tests/` and use patterns like:
   ```js
   import { analyzeText } from '../../codex/core/analysis.pipeline.js';
   ```

3. **Preserve `.js` extensions in all import paths.** Vite resolves `.ts` files from `.js` import specifiers. This means:
   ```ts
   // CORRECT — keep .js extension even when importing .ts files
   import { analyzeText } from './analysis.pipeline.js';

   // WRONG — do not change import extensions
   import { analyzeText } from './analysis.pipeline.ts';
   import { analyzeText } from './analysis.pipeline';
   ```

4. **All renamed files:** `.js` → `.ts`, `.jsx` → `.tsx`. Do NOT change the base filename.

5. **Preserve all existing runtime behavior.** TypeScript is a compile-time-only change. Do NOT:
   - Add runtime type checks where none existed
   - Change function signatures or return values
   - Remove or reorder existing code
   - Add default parameters that didn't exist
   - Change `export` structure (named vs default)

6. **Do NOT add `any` as a permanent type.** If a type is complex, use `unknown` with type guards or define a proper interface. The only acceptable `any` is on the existing React hook returns (e.g., `useAmbientPlayer` returns `any` — leave it for now).

7. **Zod schema type derivation pattern:**
   ```ts
   import { z } from 'zod';

   const ScrollSchema = z.object({
     id: z.string(),
     title: z.string(),
     content: z.string(),
   });

   // Derive type from schema — single source of truth
   export type Scroll = z.infer<typeof ScrollSchema>;
   ```

8. **Run verification after EACH file conversion:**
   ```bash
   npx tsc -p tsconfig.json --noEmit        # Type check
   npx vitest run                            # Unit tests
   ```

9. **JSDoc `@typedef` blocks should be REMOVED** from files that are converted to `.ts`. The TypeScript interfaces in `src/types/` replace them. Do NOT leave dead JSDoc typedefs in converted files.

10. **Commit after each logical batch** (e.g., after converting all heuristic files, after converting all phoneme files). Do NOT accumulate a massive uncommitted diff.

### File Extension Rules

| Original | Converted To | When |
|----------|-------------|------|
| `.js` (pure logic) | `.ts` | Always |
| `.jsx` (React component) | `.tsx` | Always |
| `.js` (config files: `vite.config.js`, `playwright.config.js`) | Keep as `.js` | Do NOT convert config files |
| `tests/**/*.js` | Keep as `.js` | Do NOT convert test files in these phases |

---

## 4. Phase 1 — Shared Types & Interfaces (Claude Code)

### Objective
Create `src/types/` with all shared TypeScript interfaces extracted from JSDoc `@typedef` blocks and Zod schemas. This provides the foundation that Phase 2 and Phase 3 depend on.

### Scope
- **Create:** `src/types/` directory with organized type files
- **Modify:** `tsconfig.json` to include the new types directory
- **Do NOT** rename or convert any `.js` files

### Files to Create

#### `src/types/index.ts` — Barrel export
Re-exports everything from the sub-modules below.

#### `src/types/analysis.ts` — Document Analysis Types
Extract from: `codex/core/schemas.js` (lines 64-103)

```ts
export interface AnalyzedWord {
  text: string;
  normalized?: string;
  start: number;
  end: number;
  lineNumber?: number;
  phonetics: PhonemeAnalysis | null;
  deepPhonetics: DeepWordAnalysis | null;
  syllableCount?: number;
  stressPattern?: string;
  leadingSound?: string;
  isStopWord?: boolean;
  isContentWord?: boolean;
}

export interface AnalyzedLine {
  text: string;
  number: number;
  start: number;
  end: number;
  words: AnalyzedWord[];
  syllableCount: number;
  stressPattern?: string;
  wordCount?: number;
  contentWordCount?: number;
  avgWordLength?: number;
  hasTerminalPunctuation?: boolean;
  terminalPunctuation?: string | null;
}

export interface DocumentStats {
  wordCount: number;
  lineCount: number;
  totalSyllables: number;
  uniqueWordCount: number;
  uniqueStemCount: number;
  contentWordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  avgSyllablesPerWord: number;
  lexicalDiversity: number;
  contentWordRatio: number;
  longWordRatio: number;
}

export interface DocumentParsed {
  wordFrequency: Record<string, number>;
  contentWordFrequency: Record<string, number>;
  stemFrequency: Record<string, number>;
  repeatedWords: Array<{
    token: string;
    count: number;
    spans: Array<{ start: number; end: number; lineNumber: number }>;
  }>;
  repeatedBigrams: Array<{ bigram: string; count: number }>;
  lineStarters: Array<{ token: string; count: number; lineNumbers: number[] }>;
  lineEnders: Array<{ token: string; count: number; lineNumbers: number[] }>;
  sentenceLengths: number[];
  enjambment: { count: number; ratio: number };
  stressProfile: { dominantFoot: string; coherence: number; error: number };
}

export interface AnalyzedDocument {
  raw: string;
  lines: AnalyzedLine[];
  allWords: AnalyzedWord[];
  stats: DocumentStats;
  parsed?: DocumentParsed;
}
```

#### `src/types/phoneme.ts` — Phoneme & Syllable Types
Extract from: `src/lib/phoneme.engine.js` JSDoc typedefs

```ts
export interface PhonemeAnalysis {
  vowelFamily: string;
  phonemes: string[];
  coda: string | null;
  rhymeKey: string;
  syllableCount: number;
}

export interface SyllableAnalysis {
  index: number;
  vowel: string;
  vowelFamily: string;
  onset: string;
  coda: string;
  stress: number;
  onsetPhonemes: string[];
  codaPhonemes: string[];
}

export interface DeepWordAnalysis {
  word: string;
  vowelFamily: string;
  phonemes: string[];
  syllables: SyllableAnalysis[];
  syllableCount: number;
  rhymeKey: string;
  extendedRhymeKeys: string[];
  stressPattern: string;
}

export interface MultiSyllableMatch {
  syllablesMatched: number;
  score: number;
  type: 'masculine' | 'feminine' | 'dactylic' | 'none';
}
```

#### `src/types/scoring.ts` — Scoring & Combat Types
Extract from: `codex/core/schemas.js` (lines 27-52)

```ts
export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'success';

export interface Diagnostic {
  start: number;
  end: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ScoreTrace {
  heuristic: string;
  rawScore: number;
  weight: number;
  contribution: number;
  explanation: string;
  diagnostics?: Diagnostic[];
}

export interface ScoringResult {
  totalScore: number;
  traces: ScoreTrace[];
}

export interface Heuristic {
  name: string;
  scorer: (doc: AnalyzedDocument) => ScoreTrace | Promise<ScoreTrace>;
  weight: number;
}

export interface ScoringEngine {
  calculateScore: (input: string | AnalyzedDocument) => Promise<ScoringResult>;
  registerHeuristic: (heuristic: Heuristic) => void;
  reset: () => void;
  getHeuristics: () => Heuristic[];
}
```

#### `src/types/combat.ts` — Combat Types
Extract from: `codex/core/schemas.js` (lines 19-43)

```ts
import type { ScoreTrace } from './scoring.js';

export interface CombatAction {
  scrollId: string;
  lines: string[];
  timestamp: number;
  playerId: string;
}

export interface CombatResult {
  damage: number;
  statusEffects: string[];
  resourceChanges: Record<string, number>;
  explainTrace: ScoreTrace[];
}
```

#### `src/types/rhyme.ts` — Rhyme Analysis Types
Extract from: `src/lib/deepRhyme.engine.js` and `src/lib/rhymeScheme.detector.js`

```ts
import type { DeepWordAnalysis } from './phoneme.js';

export type RhymeType = 'perfect' | 'near' | 'slant' | 'assonance' | 'consonance' | 'identity';
export type RhymeSubtype = 'masculine' | 'feminine' | 'dactylic' | 'none';

export interface WordPosition {
  lineIndex: number;
  wordIndex: number;
  charStart: number;
  charEnd: number;
  word: string;
}

export interface SyntaxGate {
  gate: string;
  multiplier: number;
  reasons: string[];
}

export interface RhymeConnection {
  type: RhymeType;
  subtype: RhymeSubtype;
  score: number;
  syllablesMatched: number;
  phoneticWeight: number;
  wordA: WordPosition;
  wordB: WordPosition;
  groupLabel: string | null;
  syntax?: SyntaxGate;
}

export interface LineAnalysis {
  lineIndex: number;
  text: string;
  words: Array<{
    word: string;
    lineIndex: number;
    wordIndex: number;
    charStart: number;
    charEnd: number;
    analysis: DeepWordAnalysis | null;
    syntaxToken?: unknown;
  }>;
  syllableTotal: number;
  stressPattern: string;
  internalRhymes: RhymeConnection[];
  endRhymeKey: string | null;
  endWord: DeepWordAnalysis | null;
}

export interface SyntaxGatingStats {
  enabled: boolean;
  totalCandidates: number;
  suppressedPairs: number;
  weakenedPairs: number;
  keptPairs: number;
}

export interface DocumentAnalysis {
  lines: LineAnalysis[];
  endRhymeConnections: RhymeConnection[];
  internalRhymeConnections: RhymeConnection[];
  allConnections: RhymeConnection[];
  rhymeGroups: Map<string, number[]>;
  schemePattern: string;
  syntaxSummary: unknown;
  statistics: {
    totalLines: number;
    totalWords: number;
    totalSyllables: number;
    perfectCount: number;
    nearCount: number;
    slantCount: number;
    internalCount: number;
    multiSyllableCount: number;
    endRhymeCount: number;
    syntaxGating: SyntaxGatingStats;
  };
}

export interface SchemeDetection {
  id: string;
  name: string;
  pattern: string;
  description: string;
  lore?: string;
  confidence: number;
  groups: Map<string, number[]>;
}

export interface MeterDetection {
  footType: string;
  footName: string;
  feetPerLine: number;
  meterName: string;
  consistency: number;
  stressPattern: string;
}
```

#### `src/types/lexical.ts` — Dictionary & Lookup Types
Extract from: `codex/core/schemas.js` (lines 105-126)

```ts
export interface Definition {
  text: string;
  partOfSpeech: string;
  source: string;
}

export interface LexicalEntry {
  word: string;
  definition: Definition | null;
  definitions: string[];
  pos: string[];
  synonyms: string[];
  antonyms: string[];
  rhymes: string[];
  slantRhymes: string[];
  etymology?: string;
  ipa?: string;
  lore?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}
```

#### `src/types/scroll.ts` — Scroll & XP Types
Extract from: `codex/core/schemas.js` (lines 1-52)

```ts
export interface Scroll {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  authorId: string;
}

export interface XPEvent {
  source: string;
  amount: number;
  timestamp: number;
  playerId: string;
  context?: Record<string, unknown>;
}
```

#### `src/types/literary.ts` — Literary Device Types
Extract from: `src/lib/literaryDevices.detector.js`

```ts
export type LiteraryDeviceId =
  | 'ALLITERATION'
  | 'ANAPHORA'
  | 'EPISTROPHE'
  | 'ENJAMBMENT'
  | 'REPETITION'
  | 'SIMILE'
  | 'METAPHOR';

export interface LiteraryDevice {
  id: LiteraryDeviceId;
  name: string;
  definition: string;
  count: number;
  examples: string[];
}

export type Emotion =
  | 'Joy'
  | 'Melancholy'
  | 'Rage'
  | 'Defiance'
  | 'Wonder'
  | 'Dread'
  | 'Neutral';
```

#### `src/types/judiciary.ts` — Judiciary Types
Extract from: `codex/core/judiciary.js`

```ts
export type JudiciaryLayer = 'PHONEME' | 'SPELLCHECK' | 'PREDICTOR';

export interface JudiciaryCandidate {
  word: string;
  layer: JudiciaryLayer;
  confidence: number;
}

export interface JudiciaryResult {
  word: string;
  confidence: number;
  consensus: boolean;
  breakdown: Record<string, Array<{ layer: string; score: number }>>;
}
```

#### `src/types/pls.ts` — Poetic Language Server Types
Extract from: `src/lib/poeticLanguageServer.js`

```ts
export interface PLSContext {
  prefix: string;
  prevWord: string;
  prevLineEndWord: string;
  currentLineWords: string[];
  targetSyllableCount: number;
  priorLineSyllableCounts: number[];
}

export interface ScoredCandidate {
  token: string;
  score: number;
  scores: Record<string, number>;
  badges: string[];
  ghostLine?: string;
}
```

#### `src/types/runtime.ts` — Runtime Utility Types
Extract from: `codex/runtime/` modules

```ts
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

export type EventCallback<T = unknown> = (data: T) => void;
export type Unsubscribe = () => void;

export interface DictionaryAdapter {
  name: string;
  lookup: (word: string) => Promise<Partial<import('./lexical.js').LexicalEntry> | null>;
}
```

#### `src/types/phonological.ts` — Phonological Process Types
Extract from: `src/lib/phonologicalProcesses.js`

```ts
export interface PhonologicalRuleTrace {
  ruleId: string;
  index: number;
  before: string;
  after: string;
}

export interface ApplyProcessOptions {
  trace?: boolean;
}

export interface PhonologicalProcessResult {
  phonemes: string[];
  trace?: PhonologicalRuleTrace[];
}
```

### Phase 1 Checklist

- [ ] Create `src/types/` directory
- [ ] Create all type files listed above
- [ ] Create `src/types/index.ts` barrel export
- [ ] Update `tsconfig.json` `include` to: `["src/**/*.ts", "src/**/*.tsx"]` (already covers `src/types/`)
- [ ] Run `npx tsc -p tsconfig.json --noEmit` — must pass with zero errors
- [ ] Run `npx vitest run` — all tests must still pass (no runtime changes)
- [ ] Commit: `feat: add shared TypeScript type definitions for migration`

### Phase 1 does NOT:
- Rename any `.js` files
- Modify any existing source code
- Change any imports
- Touch any test files
- Modify build config

---

## 5. Phase 2 — Core Engines (OpenAI Codex)

### Objective
Convert all files in `codex/core/` from `.js` to `.ts`, using the shared types from `src/types/`.

### Prerequisites
- Phase 1 is complete — `src/types/` exists with all interfaces
- All tests pass before starting

### Scope — Files to Convert (24 files)

#### Priority 1: Foundation (convert first)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `codex/core/schemas.js` → `.ts` | Central typedef file | All types from `src/types/` — **remove JSDoc typedefs, re-export from src/types** |
| `codex/core/tokenizer.js` → `.ts` | Text tokenizer | `AnalyzedWord` |
| `codex/core/trie.js` → `.ts` | Trie predictor | `string` in/out |

#### Priority 2: Analysis Pipeline (depends on Foundation)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `codex/core/analysis.pipeline.js` → `.ts` | Main text analysis | `AnalyzedDocument`, `AnalyzedLine`, `AnalyzedWord`, `PhonemeAnalysis`, `DeepWordAnalysis` |

#### Priority 3: Scoring (depends on Analysis Pipeline)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `codex/core/scoring.engine.js` → `.ts` | Score calculator | `ScoringEngine`, `Heuristic`, `ScoringResult`, `AnalyzedDocument`, `ScoreTrace` |

#### Priority 4: Heuristics (depends on Scoring, all 7 can be done in parallel)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `codex/core/heuristics/alliteration_density.js` → `.ts` | Alliteration scoring | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic` |
| `codex/core/heuristics/meter_regularity.js` → `.ts` | Meter scoring | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic` |
| `codex/core/heuristics/rhyme_quality.js` → `.ts` | Rhyme scoring | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic`, `DocumentAnalysis` |
| `codex/core/heuristics/phoneme_density.js` → `.ts` | Phoneme density | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic` |
| `codex/core/heuristics/literary_device_richness.js` → `.ts` | Literary devices | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic`, `LiteraryDevice` |
| `codex/core/heuristics/vocabulary_richness.js` → `.ts` | Vocabulary scoring | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic` |
| `codex/core/heuristics/phonetic_hacking.js` → `.ts` | Phonetic hacking | `AnalyzedDocument`, `ScoreTrace`, `Diagnostic` |

#### Priority 5: Combat & Judiciary (depends on Scoring)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `codex/core/combat.engine.js` → `.ts` | Combat resolution | `CombatAction`, `CombatResult`, `ScoringEngine` |
| `codex/core/judiciary.js` → `.ts` | Candidate voting | `JudiciaryCandidate`, `JudiciaryResult`, `JudiciaryLayer` |
| `codex/core/predictor.js` → `.ts` | Word prediction | `string` in/out + `JudiciaryResult` |

#### Priority 6: Rhyme Submodules
| File | Description |
|------|-------------|
| `codex/core/rhyme/dataset.js` → `.ts` | DOCX parser |
| `codex/core/rhyme/phonology.js` → `.ts` | Line phonology |
| `codex/core/rhyme/training.js` → `.ts` | Pair builder |
| `codex/core/rhyme/predictor.js` → `.ts` | Rhyme key prediction |
| `codex/core/rhyme/generator.js` → `.ts` | Line generation |
| `codex/core/rhyme/validator.js` → `.ts` | Line scoring |
| `codex/core/rhyme/index.js` → `.ts` | Barrel re-export |

#### Also convert (if present):
| File | Description |
|------|-------------|
| `codex/core/spellchecker.js` → `.ts` | Spellcheck engine |
| `codex/core/phonetic_matcher.js` → `.ts` | Phonetic matching |

### Conversion Pattern for Each File

**Step 1:** Rename `filename.js` → `filename.ts`

**Step 2:** Add type imports at the top:
```ts
import type { AnalyzedDocument, ScoreTrace, Diagnostic } from '../../src/types/index.js';
```

**Step 3:** Annotate function parameters and return types:
```ts
// BEFORE (JS)
export function createScoringEngine(initialHeuristics = []) {
  // ...
  async function calculateScore(input) { ... }
}

// AFTER (TS)
import type {
  AnalyzedDocument,
  Heuristic,
  ScoringEngine,
  ScoringResult,
  ScoreTrace,
} from '../../src/types/index.js';
import { analyzeText } from './analysis.pipeline.js';

export function createScoringEngine(initialHeuristics: Heuristic[] = []): ScoringEngine {
  const heuristics: Heuristic[] = [...initialHeuristics];

  async function calculateScore(input: string | AnalyzedDocument): Promise<ScoringResult> {
    // ... body unchanged
  }

  // ... rest unchanged
  return { calculateScore, registerHeuristic, reset, getHeuristics };
}
```

**Step 4:** Remove JSDoc `@typedef`, `@param`, `@returns` annotations that are now redundant. Keep JSDoc comments that explain *why* (business logic), remove those that only describe *what* (type info).

**Step 5:** Verify:
```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run tests/core/
```

### Special Cases

#### `codex/core/schemas.js` → `.ts`
This file is mostly JSDoc typedefs. Convert it to re-export from `src/types/`:
```ts
// codex/core/schemas.ts
// Re-export shared types for backward compatibility
export type {
  Scroll,
  PhonemeAnalysis,
  CombatAction,
  ScoreTrace,
  CombatResult,
  XPEvent,
  Diagnostic,
  AnalyzedWord,
  AnalyzedLine,
  AnalyzedDocument,
  Definition,
  LexicalEntry,
} from '../../src/types/index.js';

// Keep runtime exports
export function createEmptyLexicalEntry(word: string): LexicalEntry { ... }
export function mergeLexicalEntries(base: LexicalEntry, overlay: Partial<LexicalEntry>): LexicalEntry { ... }
export const schemas = {};
```

#### `codex/core/analysis.pipeline.js` → `.ts`
This file imports from `src/lib/` which will still be JS during Phase 2. Since `allowJs: true`, this works. Type the imports explicitly:
```ts
import { PhonemeEngine } from '../../src/lib/phoneme.engine.js';
// PhonemeEngine is still JS — TS will infer as 'any' unless you cast
// Use type assertions where needed:
const analysis = PhonemeEngine.analyzeWord(word) as PhonemeAnalysis;
```

#### Heuristic files pattern
All 7 heuristics follow the same pattern. Each exports a single object:
```ts
import type { AnalyzedDocument, ScoreTrace, Diagnostic } from '../../../src/types/index.js';

export const heuristicName = {
  name: 'heuristic_name' as const,
  scorer: async (doc: AnalyzedDocument): Promise<ScoreTrace> => {
    // ... body unchanged
  },
  weight: 0.XX,
};
```

### tsconfig Changes for Phase 2
Update `tsconfig.json` `include`:
```json
"include": ["src/**/*.ts", "src/**/*.tsx", "codex/core/**/*.ts"]
```

Alternatively, create `codex/tsconfig.json` extending the base — discuss with team.

### Phase 2 Checklist

- [ ] Verify Phase 1 types exist in `src/types/`
- [ ] Convert `schemas.js` → re-export from `src/types/`
- [ ] Convert foundation files: `tokenizer.js`, `trie.js`
- [ ] Convert `analysis.pipeline.js`
- [ ] Convert `scoring.engine.js`
- [ ] Convert all 7 heuristic files
- [ ] Convert `combat.engine.js`, `judiciary.js`, `predictor.js`
- [ ] Convert `codex/core/rhyme/` submodules
- [ ] Convert remaining files (`spellchecker.js`, `phonetic_matcher.js`)
- [ ] Update `tsconfig.json` include path
- [ ] Run `npx tsc -p tsconfig.json --noEmit` — zero errors
- [ ] Run `npx vitest run` — all tests pass
- [ ] Commit: `feat: convert codex/core to TypeScript`

### Phase 2 does NOT:
- Touch any files in `src/lib/` (that's Phase 3)
- Touch any files in `codex/server/` or `codex/services/`
- Touch any files in `codex/runtime/`
- Modify test files (tests import via `.js` extensions which Vite resolves)
- Change any runtime behavior

---

## 6. Phase 3 — Libraries & Utilities (Google Gemini PRO)

### Objective
Convert all files in `src/lib/` from `.js` to `.ts`, using the shared types from `src/types/`.

### Prerequisites
- Phase 1 is complete — `src/types/` exists
- Phase 2 does NOT need to be complete (Phase 3 is independent from Phase 2)
- All tests pass before starting

### Scope — Files to Convert (~35 files)

#### Priority 1: Leaf Dependencies (no imports from other src/lib files)
Convert these first — they have no internal dependencies:

| File | Description | Key Types Used |
|------|-------------|----------------|
| `src/lib/phoneme.constants.js` → `.ts` | ARPAbet constants | Pure constants, no types needed |
| `src/lib/vowelFamily.js` → `.ts` | Vowel normalization | `string` in/out |
| `src/lib/wordTokenization.js` → `.ts` | Word regex + tokenization | `RegExp`, `string` |
| `src/lib/storage.js` → `.ts` | Browser storage | `string`, `unknown` |
| `src/lib/musicEmbeds.js` → `.ts` | Music embed utilities | `string` |
| `src/lib/progressionUtils.js` → `.ts` | XP/level calculations | `number` in/out |

#### Priority 2: Phonetic Foundation (depends on Priority 1)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `src/lib/phonotactics.js` → `.ts` | Phonotactic constraints | `string[]` |
| `src/lib/syllabifier.js` → `.ts` | Syllable splitting | `SyllableAnalysis`, `string[][]` |
| `src/lib/phoneticSimilarity.js` → `.ts` | Phoneme similarity | `PhonemeAnalysis`, `number` |
| `src/lib/phoneticWeighting.js` → `.ts` | Weight calculations | `number` |
| `src/lib/phonologicalProcesses.js` → `.ts` | Phonological rules | `PhonologicalRuleTrace`, `ApplyProcessOptions` |
| `src/lib/cmu.phoneme.engine.js` → `.ts` | CMU dictionary bridge | `PhonemeAnalysis` |

#### Priority 3: Core Engines (depends on Priority 2)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `src/lib/phoneme.engine.js` → `.ts` | **Central phoneme engine** | `PhonemeAnalysis`, `DeepWordAnalysis`, `SyllableAnalysis`, `MultiSyllableMatch` |
| `src/lib/deepRhyme.engine.js` → `.ts` | Deep rhyme analysis | `DocumentAnalysis`, `RhymeConnection`, `LineAnalysis`, `DeepWordAnalysis` |
| `src/lib/literaryDevices.detector.js` → `.ts` | Device detection | `LiteraryDevice`, `Emotion` |
| `src/lib/rhymeScheme.detector.js` → `.ts` | Scheme detection | `SchemeDetection`, `MeterDetection` |
| `src/lib/literaryClassifier.js` → `.ts` | Literary classification | `LiteraryDevice` |
| `src/lib/phoneticHacking.engine.js` → `.ts` | Phonetic hacking | `PhonemeAnalysis` |

#### Priority 4: Higher-Level Systems (depends on Priority 3)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `src/lib/colorCodex.js` → `.ts` | Color mapping | `Map`, `DeepWordAnalysis` |
| `src/lib/reference.engine.js` → `.ts` | Word lookup | `LexicalEntry`, `Definition` |
| `src/lib/syntax.layer.js` → `.ts` | Syntax processing | Various |
| `src/lib/scholomanceDictionary.api.js` → `.ts` | Dictionary API | `LexicalEntry` |

#### Priority 5: Poetic Language Server (depends on Priority 3-4)
| File | Description | Key Types Used |
|------|-------------|----------------|
| `src/lib/poeticLanguageServer.js` → `.ts` | PLS core | `PLSContext`, `ScoredCandidate` |
| `src/lib/pls/rhymeIndex.js` → `.ts` | Rhyme indexing | `string`, `Map` |
| `src/lib/pls/ranker.js` → `.ts` | Candidate ranking | `ScoredCandidate` |
| `src/lib/pls/providers/rhymeProvider.js` → `.ts` | Rhyme completions | `PLSContext`, `ScoredCandidate` |
| `src/lib/pls/providers/prefixProvider.js` → `.ts` | Prefix completions | `PLSContext`, `ScoredCandidate` |
| `src/lib/pls/providers/meterProvider.js` → `.ts` | Meter completions | `PLSContext`, `ScoredCandidate` |
| `src/lib/pls/providers/colorProvider.js` → `.ts` | Color completions | `PLSContext`, `ScoredCandidate` |

#### Priority 6: Ambient Audio (isolated, can be done anytime)
| File | Description |
|------|-------------|
| `src/lib/ambient/ambientPlayer.service.js` → `.ts` |
| `src/lib/ambient/schoolAudio.config.js` → `.ts` |

#### Do NOT convert (already TypeScript):
- `src/lib/audioAdminApi.ts` — already done

### Conversion Pattern for Each File

Same as Phase 2. Example for the most complex file:

```ts
// src/lib/phoneme.engine.ts
import { z } from 'zod';
import type {
  PhonemeAnalysis,
  DeepWordAnalysis,
  SyllableAnalysis,
  MultiSyllableMatch,
} from '../types/index.js';
import { CmuPhonemeEngine } from './cmu.phoneme.engine.js';
import { normalizeVowelFamily } from './vowelFamily.js';
import { Syllabifier } from './syllabifier.js';
import { Phonotactics } from './phonotactics.js';
import { PhoneticSimilarity } from './phoneticSimilarity.js';
import { ScholomanceDictionaryAPI } from './scholomanceDictionary.api.js';
import { applyPhonologicalProcesses } from './phonologicalProcesses.js';

const PhonemeDictSchema = z.object({
  vowel_families: z.array(z.unknown()),
}).passthrough();

const PhonemeRulesSchema = z.record(z.unknown());

const WORD_CACHE = new Map<string, PhonemeAnalysis>();
const AUTHORITY_CACHE = new Map<string, string>();

// ... rest of implementation with type annotations on function signatures
```

### Special Cases

#### `src/lib/phoneme.engine.js` — Singleton Module Pattern
This exports an object, not a class. Preserve the pattern:
```ts
export const PhonemeEngine = {
  DICT_V2: null as Record<string, unknown> | null,
  RULES_V2: null as Record<string, unknown> | null,
  WORD_CACHE,
  AUTHORITY_CACHE,
  clearCache(): void { ... },
  async init(): Promise<void> { ... },
  analyzeWord(word: string): PhonemeAnalysis { ... },
  analyzeDeep(word: string): DeepWordAnalysis { ... },
  async ensureAuthorityBatch(words: string[]): Promise<void> { ... },
};
```

#### `src/lib/syntax.layer.js` — Circular Dependency
This file imports `stemWord` from `codex/core/analysis.pipeline.js`, creating a cross-boundary dependency. During Phase 3, `analysis.pipeline` may or may not be converted yet (Phase 2). Handle this:
```ts
// If codex/core/analysis.pipeline.ts exists (Phase 2 done):
import { stemWord } from '../../codex/core/analysis.pipeline.js';

// If it's still .js — works fine because allowJs: true
import { stemWord } from '../../codex/core/analysis.pipeline.js';

// Either way, keep the .js extension — Vite resolves both
```

#### Zod Schemas in `src/lib/`
Several files (phoneme.engine.js, reference.engine.js) use Zod for runtime validation. Use `z.infer<>`:
```ts
const DefinitionObjectSchema = z.object({
  text: z.string(),
  partOfSpeech: z.string().optional(),
  source: z.string().optional(),
});
type DefinitionObject = z.infer<typeof DefinitionObjectSchema>;
```

#### Class vs Module Pattern
- `DeepRhymeEngine` — **class** with `new DeepRhymeEngine()` — add `implements` if useful
- `PoeticLanguageServer` — **class**
- `Syllabifier` — **static methods** on class
- `Phonotactics` — **static methods** on class
- `PhonemeEngine` — **singleton object** (not a class)
- `RhymeIndex` — **class**

### Phase 3 Checklist

- [ ] Verify Phase 1 types exist in `src/types/`
- [ ] Convert Priority 1: leaf dependencies (6 files)
- [ ] Run `npx tsc --noEmit && npx vitest run tests/lib/` after Priority 1
- [ ] Convert Priority 2: phonetic foundation (6 files)
- [ ] Run verification after Priority 2
- [ ] Convert Priority 3: core engines (6 files)
- [ ] Run verification after Priority 3
- [ ] Convert Priority 4: higher-level systems (4 files)
- [ ] Run verification after Priority 4
- [ ] Convert Priority 5: Poetic Language Server (7 files)
- [ ] Run verification after Priority 5
- [ ] Convert Priority 6: ambient audio (2 files)
- [ ] Run full verification: `npx tsc --noEmit && npx vitest run`
- [ ] Commit: `feat: convert src/lib to TypeScript`

### Phase 3 does NOT:
- Touch any files in `codex/` (that's Phase 2)
- Touch React components in `src/components/` or `src/pages/`
- Touch React hooks in `src/hooks/`
- Touch data files in `src/data/`
- Modify test files
- Change any runtime behavior

---

## 7. Type Reference Catalog

Quick lookup for which type to use where:

| When you see this JSDoc | Use this TypeScript type | Defined in |
|------------------------|------------------------|------------|
| `@type {AnalyzedDocument}` | `AnalyzedDocument` | `src/types/analysis.ts` |
| `@type {AnalyzedLine}` | `AnalyzedLine` | `src/types/analysis.ts` |
| `@type {AnalyzedWord}` | `AnalyzedWord` | `src/types/analysis.ts` |
| `@type {PhonemeAnalysis}` | `PhonemeAnalysis` | `src/types/phoneme.ts` |
| `@type {DeepWordAnalysis}` | `DeepWordAnalysis` | `src/types/phoneme.ts` |
| `@type {SyllableAnalysis}` | `SyllableAnalysis` | `src/types/phoneme.ts` |
| `@type {ScoreTrace}` | `ScoreTrace` | `src/types/scoring.ts` |
| `@type {Diagnostic}` | `Diagnostic` | `src/types/scoring.ts` |
| `@type {CombatAction}` | `CombatAction` | `src/types/combat.ts` |
| `@type {CombatResult}` | `CombatResult` | `src/types/combat.ts` |
| `@type {LexicalEntry}` | `LexicalEntry` | `src/types/lexical.ts` |
| `@type {Definition}` | `Definition` | `src/types/lexical.ts` |
| `@type {Scroll}` | `Scroll` | `src/types/scroll.ts` |
| `@type {XPEvent}` | `XPEvent` | `src/types/scroll.ts` |
| `@type {RhymeConnection}` | `RhymeConnection` | `src/types/rhyme.ts` |
| `@type {DocumentAnalysis}` | `DocumentAnalysis` | `src/types/rhyme.ts` |

### Import Pattern
```ts
// Always import types from the barrel
import type { AnalyzedDocument, ScoreTrace } from '../../src/types/index.js';

// Or from specific file if preferred
import type { AnalyzedDocument } from '../../src/types/analysis.js';
```

---

## 8. Dependency Graph

### Cross-Phase Dependencies

```
src/types/ (Phase 1)
    ↑ imported by
    ├── codex/core/* (Phase 2)
    └── src/lib/*    (Phase 3)

src/lib/* (Phase 3)
    ↑ imported by
    ├── codex/core/analysis.pipeline.ts   ← imports PhonemeEngine
    ├── codex/core/heuristics/rhyme_quality.ts  ← imports DeepRhymeEngine
    └── codex/core/heuristics/literary_device_richness.ts ← imports analyzeLiteraryDevices
```

**Key insight:** Phase 2 imports from Phase 3's files. But since `allowJs: true`, Phase 2 can import `.js` files from `src/lib/` without issues. Phase 2 and Phase 3 can run in parallel.

### Internal `src/lib/` Dependency Order

```
phoneme.constants.js          (leaf — no imports)
vowelFamily.js                (leaf)
wordTokenization.js           (leaf)
    ↓
phonotactics.js               (imports phoneme.constants)
    ↓
syllabifier.js                (imports phoneme.constants, phonotactics)
    ↓
phoneticSimilarity.js         (imports phoneme.constants)
phonologicalProcesses.js      (leaf)
cmu.phoneme.engine.js         (imports phoneme.engine — circular-safe)
    ↓
phoneme.engine.js             (imports cmu, vowelFamily, syllabifier, phonotactics,
                               phoneticSimilarity, scholomanceDictionary, phonologicalProcesses)
    ↓
deepRhyme.engine.js           (imports phoneme.engine, vowelFamily, wordTokenization)
literaryDevices.detector.js   (leaf — no lib imports)
rhymeScheme.detector.js       (imports from data/)
    ↓
colorCodex.js                 (imports deepRhyme)
poeticLanguageServer.js       (imports phoneme.engine + pls/ providers)
reference.engine.js           (uses Zod, standalone)
syntax.layer.js               (imports from codex/core — cross-boundary!)
```

---

## 9. Config Changes Required

### tsconfig.json Updates (Phase 1)
```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```
This already covers `src/types/` — no change needed if types go in `src/`.

### tsconfig.json Updates (Phase 2)
Add codex/core to the include:
```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "codex/core/**/*.ts"]
}
```

### tsconfig.checkjs.json Updates (Phase 2)
Remove `codex/server/audioAuth.js` from the include once it's converted, or leave as-is since it's out of scope.

### .eslintrc.json
No changes needed — the TypeScript override already handles `**/*.ts` and `**/*.tsx` files.

### vite.config.js
No changes needed — Vite auto-detects `.ts` files via esbuild.

### package.json
No changes needed — `"type": "module"` works with both `.js` and `.ts`.

---

## 10. Verification Protocol

### After Each File

```bash
# Type check
npx tsc -p tsconfig.json --noEmit

# Run relevant tests
npx vitest run tests/core/     # for Phase 2 files
npx vitest run tests/lib/      # for Phase 3 files
```

### After Each Priority Batch

```bash
# Full type check
npx tsc -p tsconfig.json --noEmit

# Full test suite
npx vitest run

# Build check
npx vite build
```

### After Each Phase Complete

```bash
# Full type check
npx tsc -p tsconfig.json --noEmit

# Full unit test suite
npx vitest run

# Full build
npx vite build

# Visual tests (if applicable)
npx playwright test --project=chromium --workers=1

# Lint
npx eslint . --ext js,jsx,ts,tsx --report-unused-disable-directives --max-warnings 0
```

### Known Test Files That Import from Phase 2/3 Targets

These test files import from `codex/core/` or `src/lib/` using `.js` extensions. Vite resolves `.ts` files from `.js` import paths, so tests should work without modification. However, verify these specifically:

**Phase 2 test dependencies (in `tests/core/`):**
- Tests for `analysis.pipeline`, `scoring.engine`, `combat.engine`
- Tests for individual heuristics
- Tests for `judiciary`, `predictor`, `trie`

**Phase 3 test dependencies (in `tests/lib/`):**
- Tests for `phoneme.engine`, `deepRhyme.engine`
- Tests for `literaryDevices.detector`, `rhymeScheme.detector`
- Tests for `syllabifier`, `colorCodex`
- Tests for `poeticLanguageServer`, `reference.engine`

If any test fails due to import resolution, check that:
1. The import path still uses `.js` extension
2. The file was renamed correctly (`.js` → `.ts`, not `.js` → `.typescript`)
3. No circular dependency was introduced
4. No export was accidentally removed or renamed

---

## Appendix: Troubleshooting

### "Cannot find module" errors
- Check that import paths use `.js` extension (Vite convention)
- Check that `allowJs: true` is set in tsconfig
- Check that the file exists with the new `.ts` extension

### "Type 'X' is not assignable to type 'Y'"
- Check if you need to use a type assertion: `as PhonemeAnalysis`
- Check if the interface in `src/types/` matches the actual runtime shape
- Run the test to see if the runtime value actually matches

### Tests fail after rename
- Check if the test file imports using a path that Vite can resolve
- Check if `vi.mock()` calls reference the old filename
- Check setup files in `tests/setup.js`

### Circular dependency warnings
- `syntax.layer.js` ↔ `analysis.pipeline.js` is a known circular dependency
- TypeScript handles `import type` without circular issues — use `import type` where possible

### cmudict / better-sqlite3 / bcrypt
- These are excluded from the browser bundle in `vite.config.js`
- They don't have great type definitions
- Use `declare module 'cmudict'` in a `src/types/vendor.d.ts` file if needed

---

## 11. Migration Update Log

> **Instructions for AI agents:** After completing any phase or making significant changes, add an entry below with the date, phase, agent name, and summary of what was done. Include any deviations from the plan, issues encountered, and decisions made.

### Log Format
```
### [Date] — Phase X — [Agent Name]
**Status:** Completed | In Progress | Blocked
**Files created/modified:** (list)
**Deviations from plan:** (any changes to the original spec)
**Issues encountered:** (any problems and how they were resolved)
**Verification results:** tsc ✓/✗ | vitest ✓/✗ | build ✓/✗
**Notes:** (anything the next agent should know)
```

---

### 2026-02-22 — Phase 1 — Claude Code (Opus 4.6)
**Status:** Completed

**Files created:**
- `src/types/index.ts` — Barrel re-export
- `src/types/core/analysis.ts` — AnalyzedWord, AnalyzedLine, DocumentStats, DocumentParsed, AnalyzedDocument
- `src/types/core/scoring.ts` — DiagnosticSeverity, Diagnostic, ScoreTrace, ScoringResult, Heuristic, ScoringEngine
- `src/types/core/combat.ts` — CombatAction, CombatResult
- `src/types/core/scroll.ts` — Scroll, XPEvent
- `src/types/core/lexical.ts` — Definition, LexicalEntry
- `src/types/core/judiciary.ts` — JudiciaryLayer, JudiciaryCandidate, JudiciaryResult
- `src/types/lib/phoneme.ts` — PhonemeAnalysis, SyllableAnalysis, DeepWordAnalysis, MultiSyllableMatch
- `src/types/lib/rhyme.ts` — RhymeType, RhymeSubtype, WordPosition, SyntaxGate, RhymeConnection, LineAnalysis, SyntaxGatingStats, DocumentAnalysis, SchemeDetection, MeterDetection
- `src/types/lib/literary.ts` — LiteraryDeviceId, LiteraryDevice, Emotion
- `src/types/lib/pls.ts` — PLSContext, ScoredCandidate
- `src/types/lib/phonological.ts` — PhonologicalRuleTrace, ApplyProcessOptions, PhonologicalProcessResult
- `src/types/runtime/runtime.ts` — CacheEntry\<T\>, EventCallback\<T\>, Unsubscribe, DictionaryAdapter
- `src/types/_reference/` — 10 original JS source files copied for team reference

**Deviations from plan:**
- Organized types into subfolders by layer (`core/`, `lib/`, `runtime/`) instead of flat structure in `src/types/`. This changes import paths from `./scoring.js` to `./core/scoring.js` etc. The barrel `index.ts` re-exports everything so consumers can still use `import type { X } from '../types/index.js'`.
- Added `src/types/_reference/` directory with copies of the original JS source files for team reference.

**Issues encountered:**
- Pre-existing tsc error in `src/hooks/useAmbientPlayer.ts:47` (AudioFilePayload type mismatch) — not caused by Phase 1 changes, exists on main branch.

**Verification results:** tsc ✓ (only pre-existing error) | vitest ✓ (54 files, 401 tests passed) | build — not run (no runtime changes)

**Notes for Phase 2/3 agents:**
- Import types from `../../src/types/index.js` (barrel) or from specific subpaths like `../../src/types/core/scoring.js`.
- All imports use `.js` extensions per Vite convention.
- The `_reference/` folder contains snapshots of the original JS files at the time of Phase 1 completion — do not modify these.
