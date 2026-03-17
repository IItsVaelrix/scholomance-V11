# SCHEMA_CONTRACT.md
> Read first: `SHARED_PREAMBLE.md` -> `VAELRIX_LAW.md` -> this file.

## Living Document - Owned by Codex, Read by All Agents

**Version: 1.6** | Last updated: 2026-03-16

> Bump the version on every schema change.
> Notify Claude for UI-consumed field changes.
> Notify Blackbox for fixture and regression-test changes.

---

## SCHEMA CHANGE NOTICE

- Schema: Core combat, lexical, runtime bus, and world inspection contract
- Version: 1.5 -> 1.6
- Changed fields: published `WorldEntityRef`, `WorldRoomSnapshot`, `InspectableEntity`, and `InspectWorldEntityActionResponse`; added world inspection HTTP routes
- Breaking: no
- Claude impact: UI can render a room snapshot and inspect clicked world objects through one authoritative payload instead of splitting lexicon lookup from world-state lookup
- Blackbox impact: add fixtures for seeded room/entity inspection and ensure inspect actions increment persistent inspect counts without mutating CODEx lexical fields

---

## Precedence

- This file is the active shared contract for schemas and runtime payloads.
- If this file conflicts with anything under `ARCHIVE REFERENCE DOCS/`, this file and `VAELRIX_LAW.md` win.
- If a shape is missing, escalate and have Codex publish it here before it spreads across multiple files.

---

## Core Schemas

These are the current shared shapes used across `codex/core/`, `src/types/`, and bridge hooks.

```ts
interface Scroll {
  id: string; // "scroll-{timestamp}-{7char}"
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  authorId: string;
}

interface PhonemeAnalysis {
  vowelFamily: VowelFamily;
  phonemes: string[];
  coda: string | null;
  rhymeKey: string;
}

interface Diagnostic {
  start: number;
  end: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface ScoreTrace {
  heuristic: string;
  rawScore: number;
  weight: number;
  contribution: number;
  explanation: string;
  commentary?: string;
  diagnostics?: Diagnostic[];
}

interface CombatAction {
  scrollId: string;
  lines: string[];
  timestamp: number;
  playerId: string;
}

interface CombatResult {
  damage: number;
  statusEffects: string[];
  resourceChanges: Record<string, number>;
  explainTrace: ScoreTrace[];
}

interface XPEvent {
  source: string;
  amount: number;
  timestamp: number;
  playerId: string;
  context?: string | Record<string, unknown>;
}

interface Definition {
  text: string;
  partOfSpeech: string;
  source: string;
}

interface LexicalEntry {
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
  raw?: unknown;
}

interface WorldEntityRef {
  entityId: string;
  kind: "item" | "npc" | "location" | "glyph";
  lexeme?: string | null;
  roomId?: string | null;
  instanceId?: string | null;
}

interface WorldRoom {
  id: string;
  name: string;
  description: string;
  school: School | null;
  state: Record<string, unknown>;
}

interface WorldRoomEntitySummary {
  entityId: string;
  kind: "item" | "npc" | "location" | "glyph";
  lexeme: string | null;
  name: string;
  summary: string;
  roomId: string | null;
  actions: string[];
  school: School | null;
  rarity: string;
  inspectCount: number;
}

interface WorldRoomSnapshot {
  room: WorldRoom | null;
  entities: WorldRoomEntitySummary[];
}

interface InspectableEntity {
  ref: WorldEntityRef;
  title: string;
  summary: string | null;
  codex: {
    word: string | null;
    headword: string;
    definition: string | null;
    partOfSpeech: string | string[] | null;
    ipa: string | null;
    etymology: string | null;
    synonyms: string[];
    antonyms: string[];
    rhymes: string[];
    rhymeFamily: string | null;
    tags: string[];
    school: School | null;
    loreSeed: string | null;
  };
  mud: {
    entityType: string;
    rarity: string;
    school: School | null;
    roomId: string | null;
    roomName: string | null;
    actions: string[];
    state: Record<string, unknown>;
    ownership: string | number | null;
    inspectCount: number;
    flavorText: string;
  };
  room: WorldRoom | null;
}

interface InspectWorldEntityActionResponse {
  action: "inspect";
  entity: InspectableEntity;
  performedAt: string;
}

interface CombatScoreRequest {
  scrollText: string;
  weave?: string;
  playerId?: string;
  arenaSchool?: School;
  opponentSchool?: School;
}

interface CombatIntent {
  healing: boolean;
  terrain: boolean;
  buff: boolean;
  debuff: boolean;
  failureDisposition: "BUFF" | "DEBUFF" | "NEUTRAL";
  statusEffect?: CombatStatusEffect | null;
}

interface CombatRarity {
  id: "COMMON" | "UNCOMMON" | "GRIMOIRE" | "MYTHIC" | "LEGENDARY" | "SOURCE";
  label: string;
  minScore: number;
  bonusMultiplier: number;
  totalMultiplier: number;
  ordinal: number;
  score: number;
  praise: string;
}

interface CombatSchoolDensity {
  SONIC: number;
  PSYCHIC: number;
  VOID: number;
  ALCHEMY: number;
  WILL: number;
}

interface CombatStatusEffect {
  school: School;
  chainId: string;
  label: string;
  tier: 1 | 2 | 3 | 4 | 5;
  turns: number;
  turnsRemaining: number;
  magnitude: number;
  sourceBonus: string | null;
  disposition: "BUFF" | "DEBUFF";
  averageRarity: number;
  hitCount: number;
  matchedKeywords: string[];
}

interface CombatScoreResponse {
  damage: number;
  healing: number;
  totalScore: number;
  school: School;
  schoolDensity: CombatSchoolDensity;
  arenaSchool: School;
  opponentSchool: School | null;
  arenaResonanceMultiplier: number;
  schoolAffinityMultiplier: number;
  syntaxControlMultiplier: number;
  cohesionScore: number;
  rarity: CombatRarity;
  intent: CombatIntent;
  statusEffect: CombatStatusEffect | null;
  failureCast: boolean;
  commentary: string;
  traces: ScoreTrace[];
  explainTrace: ScoreTrace[];
}

interface OpponentSpell {
  spell: string;
  damage: number;
  school: School;
  traces: ScoreTrace[];
  explainTrace: ScoreTrace[];
  rarity: CombatRarity;
  schoolAffinityMultiplier: number;
  memoryLinesUsed: number;
  counterTokens: string[];
}
```

---

## Type Enumerations

```ts
type VowelFamily =
  | "A" | "AE" | "AO" | "AW" | "AY"
  | "EH" | "ER" | "EY"
  | "IH" | "IY"
  | "OH" | "OW" | "OY"
  | "UH" | "UW";

type School = "SONIC" | "PSYCHIC" | "VOID" | "ALCHEMY" | "WILL";

type DiagnosticSeverity = "info" | "warning" | "error" | "success";
```

---

## Implemented Runtime Event Bus

This is the current runtime bus in `codex/runtime/`. It is string-event plus payload. It is not yet the structured `CODExEvent<T>` envelope described in older docs.

```ts
declare function emit(eventName: string, payload?: unknown): void;
declare function on(eventName: string, callback: (payload: unknown) => void): () => void;

type RuntimeEventName =
  | "ui:word_lookup_requested"
  | "runtime:word_lookup_result"
  | "runtime:word_lookup_result:error"
  | "ui:word_analysis_requested"
  | "ui:combat_action_submitted";

interface RuntimePayloadMap {
  "ui:word_lookup_requested": {
    word: string;
    requestId?: string;
    responseEvent?: string;
  };
  "runtime:word_lookup_result": {
    word: string;
    requestId?: string;
    data: LexicalEntry | null;
    source: string;
  };
  "runtime:word_lookup_result:error": {
    word: string;
    requestId?: string;
    error: string;
    code?: string;
  };
  "ui:word_analysis_requested": {
    word: string;
    responseEventName: string;
  };
  "ui:combat_action_submitted": {
    responseEventName: string;
    [key: string]: unknown;
  };
}
```

### Runtime Bus Rules

- `runtime:word_lookup_result:error` is emitted as `${responseEvent}:error`.
- `requestId` is the current request-correlation mechanism.
- `traceId` is a future-state concept. Do not assume it exists in runtime payloads yet.
- UI surface files do not import the runtime bus directly. Current sanctioned bridges live in Codex-owned logic hooks and providers such as `src/hooks/useCODExPipeline.jsx` and `src/hooks/useWordLookup.jsx`.

---

## Reserved Future Event Names

These names are reserved for future typed gameplay/runtime events. They are not guaranteed to be emitted by the current runtime implementation yet.

```ts
type ReservedEventName =
  | "COMBAT_PREVIEW"
  | "COMBAT_RESOLVED"
  | "XP_AWARDED"
  | "SCHOOL_UNLOCKED"
  | "SCROLL_SAVED"
  | "RATE_LIMITED"
  | "ENGINE_READY"
  | "ENGINE_ERROR";
```

Until these are implemented in the runtime, no UI or test should assume they exist.

---

## Implemented HTTP Contracts

```ts
POST /api/combat/score

request body: CombatScoreRequest
response body: CombatScoreResponse
```

Notes:
- `scrollText` is capped to 100 characters at the route boundary for MVP combat.
- `weave` is optional and capped to 100 characters. When present, it feeds the authoritative Syntactic Bridge / spellweave calculation.
- `playerId` is optional metadata. The current authoritative response does not depend on client-submitted damage or trace values.
- `arenaSchool` and `opponentSchool` are optional context values that let the server apply arena resonance and defender affinity consistently.
- `traces` is the canonical combat breakdown array. `explainTrace` is returned as an alias for existing consumers that still read the older field name.
- `healing` is authoritative and may accompany offensive damage for alchemical/supportive casts.
- `commentary` carries CODEx rarity praise for powerful spells.

```ts
GET /api/world/rooms/:roomId

response body: WorldRoomSnapshot

GET /api/world/entities/:entityId

response body: InspectableEntity

POST /api/world/entities/:entityId/actions/inspect

request body: {
  roomId?: string;
}

response body: InspectWorldEntityActionResponse
```

Notes:
- World routes require the same session gate as lexicon browsing: an authenticated user session or a guest session established through `/auth/csrf-token`.
- `POST /api/world/entities/:entityId/actions/inspect` also requires the standard CSRF header once that session is established.
- The `codex` block describes what the object is linguistically and semantically.
- The `mud` block describes what the object is in the world right now, including inspect count, actions, and room presence.
- `GET /api/world/entities/:entityId` is non-mutating state fetch. `POST .../actions/inspect` is the authoritative interaction that increments persistent inspect count.

---

## Handoff Matrix

| If you are delivering... | Deliver to... | Format |
|--------------------------|---------------|--------|
| A new mechanic spec | Codex (to implement) + Claude (if UI surface needed) | `MECHANIC SPEC` block |
| A new schema or contract change | All agents | `SCHEMA CHANGE NOTICE` block |
| A new runtime event | Claude (consumer) + Blackbox (fixtures/tests) | Event name + payload shape |
| A failing test | Owning agent (Gemini / Codex / Claude) | `MERLIN DATA REPORT` |
| A domain conflict | Angel | `ESCALATION` block |
| A visual regression | Claude | `WEAVE REPORT` entry |

---

## Schema Change Notice Format

When any schema or runtime event changes, Codex issues this notice:

```text
SCHEMA CHANGE NOTICE - v[old] -> v[new] - [date]

Changed: [interface/type name]
Field: [field name]
Change: [added / removed / renamed / type changed]
Breaking: [yes / no]

Consumers affected:
- Claude: [yes/no - which component/hook reads this field]
- Blackbox: [yes/no - which fixtures/tests use this field]

Migration:
[what each affected agent needs to do]

Backward compatible until: [date or "immediate breaking change"]
```

---

## Version Log

| Version | Date | Change | Breaking |
|---------|------|--------|----------|
| 1.0 | 2026-03-10 | Initial schema contract established | no |
| 1.1 | 2026-03-10 | Aligned combat/runtime contract to implemented types and current event-bus behavior | no |
| 1.2 | 2026-03-10 | Added `POST /api/combat/score` request/response contract for server-authoritative combat scoring | no |
| 1.3 | 2026-03-10 | Expanded combat scoring payload with school/rarity/healing metadata and published `OpponentSpell` | no |
| 1.4 | 2026-03-14 | Added semantic status-effect payloads and cohesion metadata to authoritative combat scoring | no |
| 1.5 | 2026-03-16 | Added optional `weave` to `CombatScoreRequest` and aligned authoritative combat scoring with Spellweave input | no |
| 1.6 | 2026-03-16 | Added authoritative world room/entity inspection schemas and HTTP contracts | no |

---

## Authorship

This document is maintained by Codex with Angel's awareness.
All agents read it before acting on shared data contracts.
