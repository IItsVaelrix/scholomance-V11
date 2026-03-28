# SCHEMA_CONTRACT.md
> Read first: `SHARED_PREAMBLE.md` -> `VAELRIX_LAW.md` -> this file.

## Living Document - Owned by Codex, Read by All Agents

**Version: 1.13** | Last updated: 2026-03-28

> Bump the version on every schema change.
> Notify Claude for UI-consumed field changes.
> Notify Blackbox for fixture and regression-test changes.

---

## SCHEMA CHANGE NOTICE

- Schema: Phonemic Oracle contract
- Version: 1.12 -> 1.13
- Changed fields: added `OracleInsight`, `OracleSuggestion`, and `OraclePayload`; `/api/analysis/panels` response may include `oracle: OraclePayload | null`
- Breaking: no
- Claude impact: Analysis surfaces should render the new `oracle` commentary and suggestions when present
- Blackbox impact: panel-analysis fixtures can assert the new optional `oracle` payload

---

## SCHEMA CHANGE NOTICE

- Schema: VerseIR Synapse Slot contract
- Version: 1.11 -> 1.12
- Changed fields: added `VerseIRAmplifierArchetype`, `VerseIRAmplifierMatch`, `VerseIRAmplifierResult`, and `VerseIRAmplifierPayload`; `VerseIR` can now optionally expose `semanticDepth`, `archetypeResonance`, `elementMatches`, and `verseIRAmplifier`; `/api/analysis/panels` may include `analysis.verseIRAmplifier`
- Breaking: no
- Claude impact: Read analysis surfaces may render the optional Synapse Slot payload when present, but existing consumers remain valid without changes
- Blackbox impact: panel-analysis fixtures can assert the new optional payload and combat scoring fixtures may observe the new `verseir_amplifier` trace when combat services attach VerseIR amplifier context

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

interface TokenGraphNode {
  id: string;
  token: string;
  normalized: string;
  nodeType: "LEXEME" | "SCROLL_TOKEN" | "SCHOOL_ANCHOR" | "SEMANTIC_ANCHOR";
  schoolBias: Partial<Record<School, number>>;
  phoneticSignature?: {
    phonemes: string[];
    vowelSkeleton: string[];
    consonantSkeleton: string[];
    endingSignature: string;
    onsetSignature: string;
    stressPattern: string;
    syllableCount: number;
  };
  semanticTags?: string[];
  frequencyScore?: number;
}

interface TokenGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation:
    | "PHONETIC_SIMILARITY"
    | "SEMANTIC_ASSOCIATION"
    | "SYNTACTIC_COMPATIBILITY"
    | "SCHOOL_RESONANCE"
    | "MEMORY_AFFINITY"
    | "SEQUENTIAL_LIKELIHOOD";
  weight: number;
  evidence: string[];
  dimensions?: Record<string, number>;
}

interface ContextActivation {
  anchorNodeIds: string[];
  currentSchool: School | null;
  syntaxContext: {
    role?: string;
    lineRole?: string;
    stressRole?: string;
    rhymePolicy?: string;
  } | null;
  decay: number;
  maxDepth: number;
  maxFanout: number;
}

interface GraphCandidate {
  nodeId: string;
  token: string;
  activationScore: number;
  legalityScore: number;
  semanticScore: number;
  phoneticScore: number;
  schoolScore: number;
  noveltyScore: number;
  totalScore: number;
  trace: ScoreTrace[];
}

interface TruesightCompilerDescriptor {
  verseIRVersion: string;
  mode: TruesightAnalysisMode;
  tokenCount: number;
  lineCount: number;
  syllableWindowCount: number;
  lineBreakStyle: LineBreakStyle;
  whitespaceFidelity: boolean;
}

interface VerseLineIR {
  lineIndex: number;
  text: string;
  normalizedText: string;
  tokenIds: number[];
  charStart: number;
  charEnd: number;
  lineBreak: string;
  lineBreakStart: number;
  lineBreakEnd: number;
  rawSlice: string;
  isTerminalLine: boolean;
}

interface VerseTokenIR {
  id: number;
  text: string;
  normalized: string;
  normalizedUpper: string;
  lineIndex: number;
  tokenIndexInLine: number;
  globalTokenIndex: number;
  charStart: number;
  charEnd: number;
  syllableCount: number;
  phonemes: string[];
  stressPattern: string;
  onset: string[];
  nucleus: string[];
  coda: string[];
  vowelFamily: string[];
  primaryStressedVowelFamily: string | null;
  terminalVowelFamily: string | null;
  rhymeTailSignature: string;
  consonantSkeleton: string;
  extendedRhymeKeys: string[];
  flags: {
    isLineStart: boolean;
    isLineEnd: boolean;
    isStopWordLike: boolean;
    unknownPhonetics: boolean;
  };
}

interface SyllableWindowIR {
  id: number;
  tokenSpan: [number, number];
  lineSpan: [number, number];
  charStart: number;
  charEnd: number;
  syllableLength: number;
  phonemeSpan: string[];
  vowelSequence: string[];
  stressContour: string;
  codaContour: string;
  signature: string;
}

interface OracleInsight {
  id: string;
  category: "TECHNICAL" | "ARCANE" | "STRATEGIC" | "WARNING";
  message: string;
  evidence?: string[];
  scoreImpact?: number;
}

interface OracleSuggestion {
  original: string;
  suggested: string;
  reason: string;
  resonanceGain: number;
}

interface OraclePayload {
  version: string;
  persona: string;
  mood: "ENLIGHTENED" | "CRITICAL" | "OBSERVANT" | "AWE";
  summary: string;
  insights: OracleInsight[];
  suggestions: OracleSuggestion[];
}

interface VerseIRAmplifierArchetype {
  id: string;
  label: string;
  score: number;
}

interface VerseIRAmplifierMatch {
  id: string;
  label: string;
  hits: number;
  score: number;
  coverage: number;
  lineSpread: number;
  tokens: string[];
}

interface VerseIRAmplifierResult {
  id: string;
  label: string;
  tier: "COMMON" | "RARE" | "INEXPLICABLE";
  claimedWeight: number;
  signal: number;
  semanticDepth: number;
  raritySignal: number;
  effectiveSignal: number;
  effectiveSemanticDepth: number;
  effectiveRaritySignal: number;
  matches: VerseIRAmplifierMatch[];
  archetypes: VerseIRAmplifierArchetype[];
  diagnostics: Diagnostic[];
  commentary: string;
}

interface VerseIRAmplifierPayload {
  version: string;
  activeAmplifiers: number;
  noveltyBudget: number;
  claimedWeight: number;
  precisionScalar: number;
  latencyMultiplier: number;
  noveltySignal: number;
  semanticDepth: number;
  raritySignal: number;
  impactMultiplier: number;
  dominantTier: "COMMON" | "RARE" | "INEXPLICABLE" | "NONE";
  dominantArchetype: VerseIRAmplifierArchetype | null;
  archetypeResonance: VerseIRAmplifierArchetype[];
  elementMatches: {
    common: VerseIRAmplifierMatch[];
    rare: VerseIRAmplifierMatch[];
    inexplicable: VerseIRAmplifierMatch[];
  };
  diagnostics: Diagnostic[];
  amplifiers: VerseIRAmplifierResult[];
}

interface VerseIR {
  version: string;
  rawText: string;
  normalizedText: string;
  lines: VerseLineIR[];
  tokens: VerseTokenIR[];
  syllableWindows: SyllableWindowIR[];
  semanticDepth?: number;
  archetypeResonance?: VerseIRAmplifierArchetype[];
  elementMatches?: VerseIRAmplifierPayload["elementMatches"];
  verseIRAmplifier?: VerseIRAmplifierPayload | null;
  metadata: {
    mode: TruesightAnalysisMode;
    lineBreakStyle: LineBreakStyle;
    tokenCount: number;
    lineCount: number;
    syllableWindowCount: number;
    whitespaceFidelity: boolean;
  };
}

interface RhymeAstrologyQueryCompilerContext {
  verseIRVersion: string;
  mode: TruesightAnalysisMode | string;
  tokenCount: number;
  lineCount: number;
  syllableWindowCount: number;
  lineBreakStyle: LineBreakStyle | string;
  whitespaceFidelity: boolean;
  source: "provided" | "compiled";
  anchorTokenId?: number | null;
  anchorLineIndex?: number | null;
  activeTokenIds?: number[];
  activeWindowIds?: number[];
}

interface RhymeAstrologyQueryPattern {
  rawText: string;
  tokens: string[];
  resolvedNodes: Array<{
    id: string;
    token: string;
    normalized: string;
    endingSignature: string;
    onsetSignature: string;
    stressPattern: string;
    syllableCount: number;
    frequencyScore: number;
  }>;
  lineEndingSignature?: string;
  internalPattern?: string[];
  stressContour?: string;
  compiler?: RhymeAstrologyQueryCompilerContext;
}

interface RhymeAstrologyMatch {
  nodeId: string;
  token: string;
  overallScore: number;
  reasons: string[];
}

interface RhymeAstrologyConstellation {
  id: string;
  anchorId: string;
  label: string;
  dominantVowelFamily: string[];
  dominantStressPattern: string;
  members: string[];
  densityScore: number;
  cohesionScore: number;
}

interface RhymeAstrologyResult {
  query: RhymeAstrologyQueryPattern;
  topMatches: RhymeAstrologyMatch[];
  constellations: RhymeAstrologyConstellation[];
  diagnostics: {
    queryTimeMs: number;
    cacheHit: boolean;
    candidateCount: number;
  };
}

interface RhymeAstrologyAnchorCompilerRef {
  tokenId: number;
  lineIndex: number;
  tokenIndexInLine: number;
  tokenSpan: [number, number];
  activeWindowIds: number[];
  charStart: number;
  charEnd: number;
  syllableCount: number;
  stressPattern: string;
  rhymeTailSignature: string;
  primaryStressedVowelFamily: string | null;
  terminalVowelFamily: string | null;
  isLineStart: boolean;
  isLineEnd: boolean;
}

interface RhymeAstrologyInspectorAnchor {
  word: string;
  normalizedWord: string;
  lineIndex: number;
  wordIndex: number;
  charStart: number;
  charEnd: number;
  sign: string;
  dominantVowelFamily: string;
  tokenId: number;
  activeWindowIds: number[];
  compilerRef: RhymeAstrologyAnchorCompilerRef | null;
  topMatches: RhymeAstrologyMatch[];
  constellations: RhymeAstrologyConstellation[];
  diagnostics: {
    queryTimeMs: number;
    cacheHit: boolean;
    candidateCount: number;
  };
}

interface RhymeAstrologyWindowSummary {
  id: number;
  lineIndex: number;
  lineSpan: [number, number];
  tokenIds: number[];
  tokenSpan: [number, number];
  charStart: number;
  charEnd: number;
  syllableLength: number;
  signature: string;
  stressContour: string;
  codaContour: string;
  vowelSequence: string[];
  occurrenceCount: number;
  repeated: boolean;
  anchorTokenIds: number[];
  anchorWords: string[];
}

interface RhymeAstrologySpan {
  id: string;
  kind: "anchor_token" | "syllable_window";
  lineIndex: number;
  charStart: number;
  charEnd: number;
  tokenIds: number[];
  anchorTokenId: number | null;
  windowId: number | null;
  label: string;
  sign: string | null;
  clusterIds: string[];
}

interface RhymeAstrologyPanelPayload {
  enabled: boolean;
  features: {
    rhymeAffinityScore: number;
    constellationDensity: number;
    internalRecurrenceScore: number;
    phoneticNoveltyScore: number;
  } | null;
  inspector: {
    anchors: RhymeAstrologyInspectorAnchor[];
    clusters: Array<{
      id: string;
      label: string;
      anchorWord: string;
      sign: string;
      dominantVowelFamily: string[];
      dominantStressPattern: string;
      densityScore: number;
      cohesionScore: number;
      membersCount: number;
    }>;
    windows: RhymeAstrologyWindowSummary[];
    spans: RhymeAstrologySpan[];
  };
  diagnostics: {
    anchorCount: number;
    cacheHitCount: number;
    averageQueryTimeMs: number;
  };
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
  speechAct?: CombatSpeechAct | null;
  intonationTag?: string | null;
  cadenceTag?: CombatCadenceTag | null;
  bridgeIntent?: string | null;
  statusEffect?: CombatStatusEffect | null;
}

type CombatSpeechAct =
  | "COMMAND"
  | "INVOCATION"
  | "THREAT"
  | "PLEA"
  | "DECLARATION"
  | "TAUNT"
  | "QUESTION"
  | "BANISHMENT"
  | "CURSE"
  | "BLESSING";

type CombatCadenceTag =
  | "RESOLVED"
  | "SUSPENDED"
  | "CLIPPED"
  | "FALLING"
  | "RISING"
  | "LEVEL"
  | "SURGING"
  | "WITHHELD";

interface WeightedCombatLabel {
  label: string;
  weight: number;
}

interface WeightedSpeechAct {
  act: CombatSpeechAct;
  weight: number;
}

interface SubemotionSignal {
  id: string;
  label: string;
  school: School | null;
  weight: number;
}

interface VoiceProfileSnapshot {
  version: number;
  speakerId: string;
  speakerType: "PLAYER" | "OPPONENT";
  school: School;
  samples: number;
  preferredSpeechAct: CombatSpeechAct;
  preferredCadence: CombatCadenceTag;
  preferredFoot: string;
  preferredSeverity: string;
  contourAverages: {
    opening: number;
    crest: number;
    closure: number;
    volatility: number;
  };
}

interface CombatSpeakingAnalysis {
  school: School | null;
  speechAct: {
    primary: CombatSpeechAct;
    confidence: number;
    topActs: WeightedSpeechAct[];
  };
  prosody: {
    dominantFoot: string;
    metricalGrid: string;
    meterName: string;
    feetPerLine: number;
    beatAlignment: number;
    controlledVariance: number;
    closureScore: number;
    deviation?: number;
    cadence: {
      dominantTag: CombatCadenceTag;
      lineTags: Array<{
        lineIndex: number;
        tag: CombatCadenceTag;
        beatAlignment: number;
      }>;
    };
  };
  intonation: {
    mode: string;
    primaryTag: CombatSpeechAct;
    contour: {
      opening: number;
      crest: number;
      closure: number;
      volatility: number;
    };
    punctuation: {
      questionCount: number;
      exclamationCount: number;
      commaCount: number;
    };
  };
  affect: {
    primaryEmotion: string;
    scores: Array<{
      emotion: string;
      weight: number;
    }>;
    subemotions: SubemotionSignal[];
  };
  harmony: {
    score: number;
    adjacentLineScore: number;
    coupletScore: number;
    stanzaScore: number;
    alliterationScore: number;
    dominantVowel: string | null;
  };
  severity: {
    ladderId: School | null;
    label: string | null;
    topLexeme: string | null;
    tierIndex: number;
    severityScore: number;
    rarityAmplifier: number;
    potency: number;
    matches: Array<{
      token: string;
      label: string;
      tierIndex: number;
      rarity: number;
    }>;
  };
  voice: {
    speakerId: string;
    speakerType: "PLAYER" | "OPPONENT";
    resonance: number;
    profile: VoiceProfileSnapshot;
  };
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
  speechActMultiplier: number;
  prosodyMultiplier: number;
  harmonyMultiplier: number;
  severityMultiplier: number;
  voiceResonanceMultiplier: number;
  abyssalResonanceMultiplier: number;
  cohesionScore: number;
  rarity: CombatRarity;
  intent: CombatIntent;
  speaking: CombatSpeakingAnalysis | null;
  voiceProfile: VoiceProfileSnapshot | null;
  statusEffect: CombatStatusEffect | null;
  failureCast: boolean;
  commentary: string;
  traceId: string;
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
  speaking?: CombatSpeakingAnalysis | null;
  voiceProfile?: VoiceProfileSnapshot | null;
  voiceResonance?: number;
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

type TruesightAnalysisMode = "live_fast" | "balanced" | "deep_truesight";

type LineBreakStyle = "lf" | "crlf" | "cr" | "mixed" | "none";
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
- `abyssalResonanceMultiplier` is the average Lexicon Abyss multiplier applied from public combat speech entropy for the resolved cast.
- `traceId` is the authoritative Akashic replay handle recorded alongside the resolved cast.

```ts
GET /api/rhyme-astrology/query

query params:
  text: string
  mode?: "word" | "line"
  limit?: number
  minScore?: number
  includeConstellations?: boolean
  includeDiagnostics?: boolean

response body: RhymeAstrologyResult
```

Notes:
- The public route remains text-query based and backward compatible.
- Runtime implementations may internally compile a VerseIR substrate to resolve anchors and line/window context deterministically.
- `query.compiler` is optional and may appear when the runtime used VerseIR-backed context resolution.

```ts
POST /api/analysis/panels

request body: {
  text: string;
}

response body: {
  source: "server-analysis";
  data: {
    analysis: {
      compiler?: TruesightCompilerDescriptor | null;
      verseIRAmplifier?: VerseIRAmplifierPayload | null;
      [key: string]: unknown;
    } | null;
    rhymeAstrology: RhymeAstrologyPanelPayload | null;
    oracle: OraclePayload | null;
    [key: string]: unknown;
  };
}

Notes:
- `rhymeAstrology` is optional and feature-flag gated.
- `analysis.verseIRAmplifier` is optional and carries the Synapse Slot / VerseIR amplifier payload when the server compiled VerseIR context for the request.
- `oracle` is optional and carries the Phonemic Oracle commentary and suggestions.
- When enabled, inspector anchors/windows/spans are decorative client guidance only; the server remains authoritative for scoring and persistence.

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
| 1.7 | 2026-03-17 | Added combat speaking analysis, voice-profile snapshots, and speaking multipliers to combat payloads | no |
| 1.8 | 2026-03-21 | Added phonosemantic token-graph node/edge, activation, and graph-candidate contracts for prediction and judiciary traversal | no |
| 1.9 | 2026-03-26 | Added VerseIR compiler contracts, whitespace-fidelity line metadata, syllable windows, and optional Truesight compiler metadata for panel analysis | no |
| 1.10 | 2026-03-28 | Added compiler-aware rhyme astrology query/panel payload contracts, including VerseIR-backed anchors, windows, and spans | no |
| 1.11 | 2026-03-28 | Added abyssal resonance multiplier and Akashic trace handle to authoritative combat scoring | no |
| 1.12 | 2026-03-28 | Added VerseIR Synapse Slot amplifier payloads and optional panel-analysis exposure for semantic depth / archetype resonance | no |

---

## Authorship

This document is maintained by Codex with Angel's awareness.
All agents read it before acting on shared data contracts.
