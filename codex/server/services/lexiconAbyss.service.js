import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { applySqlitePragmas, runSqliteMigrations } from '../db/sqlite.migrations.js';
import { compileVerseToIR } from '../../../src/lib/truesight/compiler/compileVerseToIR.js';
import { serializeVerseIR } from '../../../src/lib/truesight/compiler/verseIRSerialization.js';
import {
  ABYSS_NEUTRAL_MULTIPLIER,
  classifyAbyssalState,
  computeAbyssalResonanceMultiplier,
  computeElapsedWholeDays,
  countAbyssWordOccurrences,
  decayAbyssUsageCount,
  extractAbyssWordSequence,
} from '../../core/lexicon.abyss.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const ABYSS_DB_NAMESPACE = 'abyss';

const ABYSS_MIGRATIONS = [
  {
    version: 1,
    name: 'create_abyss_tables',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS word_entropy (
          word TEXT PRIMARY KEY,
          usage_count_7d INTEGER NOT NULL DEFAULT 0,
          last_used TEXT,
          current_multiplier REAL NOT NULL DEFAULT 1.0
        );

        CREATE TABLE IF NOT EXISTS akashic_replays (
          combat_id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          player_id TEXT,
          opponent_id TEXT,
          verse_ir_json TEXT NOT NULL,
          score_response_json TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_word_entropy_last_used
          ON word_entropy(last_used DESC);

        CREATE INDEX IF NOT EXISTS idx_akashic_replays_timestamp
          ON akashic_replays(timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_akashic_replays_player
          ON akashic_replays(player_id, timestamp DESC);
      `);
    },
  },
];

function createLogger(log) {
  if (log && typeof log === 'object') {
    return {
      info: typeof log.info === 'function' ? log.info.bind(log) : () => {},
      warn: typeof log.warn === 'function' ? log.warn.bind(log) : () => {},
      error: typeof log.error === 'function' ? log.error.bind(log) : () => {},
    };
  }

  return {
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  };
}

function resolveDefaultAbyssDbPath() {
  if (typeof process.env.ABYSS_DB_PATH === 'string' && process.env.ABYSS_DB_PATH.trim()) {
    return path.resolve(process.env.ABYSS_DB_PATH.trim());
  }
  const dataDir = process.env.NODE_ENV === 'production' ? '/var/data' : PROJECT_ROOT;
  return path.join(dataDir, 'abyss.sqlite');
}

function normalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function toTimestampMs(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildTraceId(occurredAtMs) {
  return `combat-${occurredAtMs}-${randomUUID().slice(0, 8)}`;
}

function serializeVerseIRForAbyss(verseIR) {
  return serializeVerseIR(verseIR);
}

function buildNeutralSignal(tokenCount, source = 'neutral_fallback') {
  return {
    averageMultiplier: ABYSS_NEUTRAL_MULTIPLIER,
    tokenCount,
    tokenDetails: [],
    source,
  };
}

export function createLexiconAbyssService(options = {}) {
  const log = createLogger(options.log);
  const dbPath = options.dbPath ? path.resolve(options.dbPath) : resolveDefaultAbyssDbPath();

  let db = null;
  let closed = false;
  let dbState = {
    currentVersion: 0,
    pragmas: null,
  };

  try {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    dbState.pragmas = applySqlitePragmas(db, {
      busyTimeoutMs: process.env.ABYSS_DB_BUSY_TIMEOUT_MS,
    });
    const migrationState = runSqliteMigrations(db, {
      namespace: ABYSS_DB_NAMESPACE,
      migrations: ABYSS_MIGRATIONS,
    });
    dbState = {
      ...dbState,
      ...migrationState,
    };
    log.info?.(
      `[DB:abyss] Connected. version=${dbState.currentVersion}, journal=${dbState.pragmas?.journalMode}, busy_timeout=${dbState.pragmas?.busyTimeout}`,
    );
  } catch (error) {
    db = null;
    log.warn?.({ err: error, dbPath }, '[DB:abyss] Failed to initialize. Falling back to neutral resonance.');
  }

  const selectWordStmt = db?.prepare(`
    SELECT word, usage_count_7d, last_used, current_multiplier
    FROM word_entropy
    WHERE word = ?
  `) || null;

  const upsertWordStmt = db?.prepare(`
    INSERT INTO word_entropy (word, usage_count_7d, last_used, current_multiplier)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET
      usage_count_7d = excluded.usage_count_7d,
      last_used = excluded.last_used,
      current_multiplier = excluded.current_multiplier
  `) || null;

  const insertReplayStmt = db?.prepare(`
    INSERT INTO akashic_replays (
      combat_id,
      timestamp,
      player_id,
      opponent_id,
      verse_ir_json,
      score_response_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `) || null;

  const persistCombatTransaction = db?.transaction((payload) => {
    const entries = [...payload.counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));

    for (const [word, occurrences] of entries) {
      const existing = selectWordStmt.get(word);
      const elapsedDays = existing?.last_used
        ? computeElapsedWholeDays(existing.last_used, payload.occurredAtMs)
        : 7;
      const decayedUsage = decayAbyssUsageCount(existing?.usage_count_7d || 0, elapsedDays);
      const usageCount7d = Math.max(0, Math.round(decayedUsage + occurrences));
      const multiplier = computeAbyssalResonanceMultiplier({
        usageCount7d,
        lastUsedAt: payload.timestamp,
        evaluatedAt: payload.occurredAtMs,
      }).multiplier;

      upsertWordStmt.run(word, usageCount7d, payload.timestamp, multiplier);
    }

    insertReplayStmt.run(
      payload.traceId,
      payload.timestamp,
      payload.playerId,
      payload.opponentId,
      payload.verseIrJson,
      payload.scoreResponseJson,
    );
  }) || null;

  async function resolveResonance({ text = '', verseIR = null, evaluatedAt = Date.now() } = {}) {
    const resolvedVerseIR = verseIR || compileVerseToIR(text, { mode: 'balanced' });
    const tokenSequence = extractAbyssWordSequence(resolvedVerseIR);
    const tokenCount = tokenSequence.length;

    if (tokenCount === 0) {
      return buildNeutralSignal(0, db ? 'no_tokens' : 'unavailable');
    }

    const counts = countAbyssWordOccurrences(tokenSequence);
    const occurredAtMs = toTimestampMs(evaluatedAt);
    const tokenDetails = [];

    for (const [word, occurrences] of [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      const row = selectWordStmt ? selectWordStmt.get(word) : null;
      const snapshot = computeAbyssalResonanceMultiplier({
        usageCount7d: row?.usage_count_7d || 0,
        lastUsedAt: row?.last_used || null,
        evaluatedAt: occurredAtMs,
      });

      tokenDetails.push({
        token: word,
        occurrences,
        usageCount7d: Math.max(0, Number(row?.usage_count_7d) || 0),
        decayedUsageCount: snapshot.decayedUsageCount,
        lastUsedAt: row?.last_used || null,
        multiplier: snapshot.multiplier,
        state: classifyAbyssalState(snapshot.multiplier),
      });
    }

    const weightedTotal = tokenDetails.reduce(
      (sum, detail) => sum + (detail.multiplier * detail.occurrences),
      0,
    );

    return {
      averageMultiplier: Number((weightedTotal / tokenCount).toFixed(3)),
      tokenCount,
      tokenDetails,
      source: db ? 'public_combat_history' : 'unavailable',
    };
  }

  function createHeuristicProvider() {
    return async (doc) => resolveResonance({
      text: doc?.raw || '',
      evaluatedAt: Date.now(),
    });
  }

  async function recordCombatResolved({
    traceId = null,
    text = '',
    verseIR = null,
    scoreResponse = null,
    playerId = null,
    opponentId = null,
    occurredAt = Date.now(),
  } = {}) {
    const occurredAtMs = toTimestampMs(occurredAt);
    const timestamp = new Date(occurredAtMs).toISOString();
    const combatId = normalizeIdentifier(traceId) || buildTraceId(occurredAtMs);
    const resolvedVerseIR = verseIR || compileVerseToIR(text, { mode: 'balanced' });
    const counts = countAbyssWordOccurrences(extractAbyssWordSequence(resolvedVerseIR));

    if (!persistCombatTransaction) {
      return combatId;
    }

    persistCombatTransaction({
      traceId: combatId,
      timestamp,
      occurredAtMs,
      playerId: normalizeIdentifier(playerId),
      opponentId: normalizeIdentifier(opponentId),
      counts,
      verseIrJson: JSON.stringify(serializeVerseIRForAbyss(resolvedVerseIR)),
      scoreResponseJson: JSON.stringify({
        ...(scoreResponse && typeof scoreResponse === 'object' ? scoreResponse : {}),
        traceId: combatId,
      }),
    });

    return combatId;
  }

  function getStatus() {
    return {
      path: dbPath,
      available: Boolean(db),
      version: dbState.currentVersion,
      pragmas: dbState.pragmas,
    };
  }

  function close() {
    if (closed) return;
    closed = true;
    if (db?.open) {
      db.close();
      log.info?.('[DB:abyss] Connection closed.');
    }
  }

  return {
    resolveResonance,
    createHeuristicProvider,
    recordCombatResolved,
    getStatus,
    close,
  };
}
