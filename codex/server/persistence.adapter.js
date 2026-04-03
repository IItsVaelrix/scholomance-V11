import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applySqlitePragmas, runSqliteMigrations } from './db/sqlite.migrations.js';
import {
  DEFAULT_WORLD_ENTITIES,
  DEFAULT_WORLD_ROOMS,
} from '../core/world.entity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.USER_DB_PATH
  ? path.resolve(process.env.USER_DB_PATH)
  : path.join(ROOT, 'scholomance_user.sqlite');

const USER_DB_NAMESPACE = 'user';

const USER_MIGRATIONS = [
  {
    version: 1,
    name: 'create_users_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          recoveryTokenHash TEXT,
          recoveryTokenExpiry DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 2,
    name: 'create_user_progression_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS user_progression (
          userId INTEGER PRIMARY KEY,
          xp INTEGER NOT NULL DEFAULT 0,
          unlockedSchools TEXT NOT NULL DEFAULT '["SONIC"]',
          FOREIGN KEY (userId) REFERENCES users (id)
        );
      `);
    },
  },
  {
    version: 3,
    name: 'create_scrolls_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS scrolls (
          id TEXT PRIMARY KEY,
          userId INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id)
        );
      `);
    },
  },
  {
    version: 4,
    name: 'add_scroll_indexes',
    up(database) {
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_scrolls_user_updated_at
          ON scrolls(userId, updatedAt DESC);
      `);
    },
  },
  {
    version: 5,
    name: 'add_email_verification',
    up(database) {
      addSqliteColumnIfMissing(database, 'users', 'verified', 'verified INTEGER DEFAULT 0');
      addSqliteColumnIfMissing(database, 'users', 'verificationToken', 'verificationToken TEXT');
    },
  },
  {
    version: 6,
    name: 'create_world_rooms_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS world_rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          school TEXT,
          state_json TEXT NOT NULL DEFAULT '{}',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 7,
    name: 'create_world_entities_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS world_entities (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          lexeme TEXT NOT NULL,
          roomId TEXT,
          ownerUserId INTEGER,
          seed TEXT NOT NULL,
          actions_json TEXT NOT NULL DEFAULT '["inspect"]',
          state_json TEXT NOT NULL DEFAULT '{}',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          inspect_count INTEGER NOT NULL DEFAULT 0,
          last_inspected_at DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (roomId) REFERENCES world_rooms (id),
          FOREIGN KEY (ownerUserId) REFERENCES users (id)
        );
        CREATE INDEX IF NOT EXISTS idx_world_entities_room ON world_entities(roomId, updatedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_world_entities_owner ON world_entities(ownerUserId, updatedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_world_entities_lexeme ON world_entities(lexeme);
      `);
    },
  },
  {
    version: 8,
    name: 'create_user_settings_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          userId INTEGER PRIMARY KEY,
          settings_json TEXT NOT NULL DEFAULT '{}',
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id)
        );
      `);
    },
  },
  {
    version: 9,
    name: 'add_scroll_submission_timestamp',
    up(database) {
      addSqliteColumnIfMissing(database, 'scrolls', 'submittedAt', 'submittedAt DATETIME');
    },
  },
  {
    version: 10,
    name: 'create_email_outbox_table',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS email_outbox (
          id TEXT PRIMARY KEY,
          template_key TEXT NOT NULL,
          recipient TEXT NOT NULL,
          subject TEXT NOT NULL,
          text_body TEXT NOT NULL,
          html_body TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'console',
          status TEXT NOT NULL DEFAULT 'queued',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 5,
          last_error TEXT,
          provider_message_id TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          locked_at TEXT,
          sent_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_email_outbox_status_next_attempt
          ON email_outbox(status, next_attempt_at);

        CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient_created
          ON email_outbox(recipient, created_at DESC);
      `);
    },
  },
  {
    version: 11,
    name: 'create_collab_tasks_unified',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS collab_tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'backlog',
          priority INTEGER NOT NULL DEFAULT 1,
          assigned_agent TEXT,
          created_by TEXT,
          depends_on TEXT DEFAULT '[]',
          file_paths TEXT DEFAULT '[]',
          pipeline_run_id TEXT,
          notes_json TEXT DEFAULT '[]',
          result_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON collab_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON collab_tasks(assigned_agent);
      `);
    },
  },
  {
    version: 12,
    name: 'fix_task_column_names',
    up(database) {
      const columns = database.prepare('PRAGMA table_info("collab_tasks")').all();
      const hasCreatedAt = columns.some(c => c.name === 'createdAt');
      if (hasCreatedAt) {
        database.exec(`
          ALTER TABLE collab_tasks RENAME COLUMN createdAt TO created_at;
          ALTER TABLE collab_tasks RENAME COLUMN updatedAt TO updated_at;
          ALTER TABLE collab_tasks RENAME COLUMN completedAt TO completed_at;
        `);
      }
    },
  },
];

let db;
let dbState = {
  currentVersion: 0,
  appliedVersions: [],
  pragmas: null,
};
let isClosed = false;

function escapeSqliteIdentifier(identifier) {
  return String(identifier || '').replaceAll('"', '""');
}

function hasSqliteColumn(database, tableName, columnName) {
  const safeTableName = escapeSqliteIdentifier(tableName);
  const columns = database.prepare(`PRAGMA table_info("${safeTableName}")`).all();
  return columns.some((column) => column.name === columnName);
}

function addSqliteColumnIfMissing(database, tableName, columnName, columnDefinition) {
  if (hasSqliteColumn(database, tableName, columnName)) {
    return false;
  }

  const safeTableName = escapeSqliteIdentifier(tableName);
  database.exec(`ALTER TABLE "${safeTableName}" ADD COLUMN ${columnDefinition};`);
  return true;
}

function parseJsonObject(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeWorldRoomRow(row) {
  if (!row) return null;
  return {
    ...row,
    state: parseJsonObject(row.state_json),
  };
}

function normalizeWorldEntityRow(row) {
  if (!row) return null;
  return {
    ...row,
    actions: parseJsonArray(row.actions_json),
    state: parseJsonObject(row.state_json),
    metadata: parseJsonObject(row.metadata_json),
    inspectCount: Number(row.inspect_count) || 0,
  };
}

function ensureWorldSeedData(database) {
  const upsertRoomStmt = database.prepare(`
    INSERT INTO world_rooms (id, name, description, school, state_json, createdAt, updatedAt)
    VALUES (:id, :name, :description, :school, :state_json, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      school = excluded.school,
      state_json = excluded.state_json,
      updatedAt = datetime('now')
  `);
  const upsertEntityStmt = database.prepare(`
    INSERT INTO world_entities (
      id, kind, lexeme, roomId, ownerUserId, seed, actions_json, state_json, metadata_json,
      inspect_count, createdAt, updatedAt
    )
    VALUES (
      :id, :kind, :lexeme, :roomId, :ownerUserId, :seed, :actions_json, :state_json, :metadata_json,
      :inspect_count, datetime('now'), datetime('now')
    )
    ON CONFLICT(id) DO NOTHING
  `);

  const applySeeds = database.transaction(() => {
    for (const room of DEFAULT_WORLD_ROOMS) {
      upsertRoomStmt.run({
        id: room.id,
        name: room.name,
        description: room.description,
        school: room.school || null,
        state_json: JSON.stringify(room.state || {}),
      });
    }

    for (const entity of DEFAULT_WORLD_ENTITIES) {
      upsertEntityStmt.run({
        id: entity.id,
        kind: entity.kind,
        lexeme: entity.lexeme,
        roomId: entity.roomId || null,
        ownerUserId: entity.ownerUserId ?? null,
        seed: entity.seed,
        actions_json: JSON.stringify(entity.actions || ['inspect']),
        state_json: JSON.stringify(entity.state || {}),
        metadata_json: JSON.stringify(entity.metadata || {}),
        inspect_count: Number(entity.inspectCount) || 0,
      });
    }
  });

  applySeeds();
}

try {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);

  dbState.pragmas = applySqlitePragmas(db, {
    busyTimeoutMs: process.env.DB_BUSY_TIMEOUT_MS,
  });
  const migrationResult = runSqliteMigrations(db, {
    namespace: USER_DB_NAMESPACE,
    migrations: USER_MIGRATIONS,
  });
  dbState = {
    ...dbState,
    ...migrationResult,
  };
  ensureWorldSeedData(db);

  console.log(
    `[DB:user] Connected. version=${dbState.currentVersion}, journal=${dbState.pragmas.journalMode}, foreign_keys=${dbState.pragmas.foreignKeys}, busy_timeout=${dbState.pragmas.busyTimeout}`,
  );
} catch (error) {
  console.error(`[DB:user] Failed to connect to database at ${DB_PATH}.`);
  console.error(error);
  process.exit(1);
}

function closeDatabase() {
  if (isClosed) return;
  isClosed = true;
  if (db?.open) {
    db.close();
    console.log('[DB:user] Connection closed.');
  }
}

process.on('exit', closeDatabase);

function getStatus() {
  return {
    path: DB_PATH,
    namespace: USER_DB_NAMESPACE,
    version: dbState.currentVersion,
    pragmas: dbState.pragmas,
  };
}

// --- User ---
function findUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function findUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

function findUserByVerificationToken(token) {
  const stmt = db.prepare('SELECT * FROM users WHERE verificationToken = ?');
  return stmt.get(token);
}

function findUserByRecoveryTokenHash(tokenHash) {
  const stmt = db.prepare('SELECT * FROM users WHERE recoveryTokenHash = ?');
  return stmt.get(tokenHash);
}

function createUser(username, email, hashedPassword, verificationToken) {
  const stmt = db.prepare('INSERT INTO users (username, email, password, verificationToken, verified) VALUES (?, ?, ?, ?, 0)');
  const result = stmt.run(username, email, hashedPassword, verificationToken);
  return { id: result.lastInsertRowid, username, email };
}

function verifyUser(userId) {
  const stmt = db.prepare('UPDATE users SET verified = 1, verificationToken = NULL WHERE id = ?');
  stmt.run(userId);
}

function setVerificationToken(userId, verificationToken) {
  const stmt = db.prepare(`
    UPDATE users
    SET verificationToken = ?,
        verified = 0
    WHERE id = ?
  `);
  stmt.run(verificationToken, userId);
  return findUserById(userId);
}

function setRecoveryToken(userId, recoveryTokenHash, recoveryTokenExpiry) {
  const stmt = db.prepare(`
    UPDATE users
    SET recoveryTokenHash = ?,
        recoveryTokenExpiry = ?
    WHERE id = ?
  `);
  stmt.run(recoveryTokenHash, recoveryTokenExpiry, userId);
  return findUserById(userId);
}

function clearRecoveryToken(userId) {
  const stmt = db.prepare(`
    UPDATE users
    SET recoveryTokenHash = NULL,
        recoveryTokenExpiry = NULL
    WHERE id = ?
  `);
  stmt.run(userId);
  return findUserById(userId);
}

function updatePasswordHash(userId, hashedPassword) {
  const stmt = db.prepare(`
    UPDATE users
    SET password = ?,
        recoveryTokenHash = NULL,
        recoveryTokenExpiry = NULL
    WHERE id = ?
  `);
  stmt.run(hashedPassword, userId);
  return findUserById(userId);
}

// --- Progression ---
function getProgression(userId) {
  let stmt = db.prepare('SELECT * FROM user_progression WHERE userId = ?');
  let progression = stmt.get(userId);
  if (!progression) {
    const insertStmt = db.prepare('INSERT INTO user_progression (userId, xp, unlockedSchools) VALUES (?, ?, ?)');
    insertStmt.run(userId, 0, '["SONIC"]');
    progression = { userId, xp: 0, unlockedSchools: '["SONIC"]' };
  }
  progression.unlockedSchools = JSON.parse(progression.unlockedSchools);
  return progression;
}

function saveProgression(userId, { xp, unlockedSchools }) {
  const stmt = db.prepare(`
    INSERT INTO user_progression (userId, xp, unlockedSchools)
    VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      xp = excluded.xp,
      unlockedSchools = excluded.unlockedSchools
  `);
  stmt.run(userId, xp, JSON.stringify(unlockedSchools));
  return getProgression(userId);
}

function resetProgression(userId) {
  return saveProgression(userId, { xp: 0, unlockedSchools: ['SONIC'] });
}

// --- World ---
function getWorldRoom(roomId) {
  const row = db.prepare(`
    SELECT id, name, description, school, state_json, createdAt, updatedAt
    FROM world_rooms
    WHERE id = ?
  `).get(roomId);
  return normalizeWorldRoomRow(row);
}

function getWorldRooms() {
  const rows = db.prepare(`
    SELECT id, name, description, school, state_json, createdAt, updatedAt
    FROM world_rooms
    ORDER BY id ASC
  `).all();
  return rows.map(normalizeWorldRoomRow).filter(Boolean);
}

function getWorldEntity(entityId) {
  const row = db.prepare(`
    SELECT id, kind, lexeme, roomId, ownerUserId, seed, actions_json, state_json, metadata_json,
           inspect_count, last_inspected_at, createdAt, updatedAt
    FROM world_entities
    WHERE id = ?
  `).get(entityId);
  return normalizeWorldEntityRow(row);
}

function getWorldEntitiesByRoom(roomId) {
  const rows = db.prepare(`
    SELECT id, kind, lexeme, roomId, ownerUserId, seed, actions_json, state_json, metadata_json,
           inspect_count, last_inspected_at, createdAt, updatedAt
    FROM world_entities
    WHERE roomId = ?
    ORDER BY createdAt ASC, id ASC
  `).all(roomId);
  return rows.map(normalizeWorldEntityRow).filter(Boolean);
}

function recordWorldEntityInspect(entityId) {
  const stmt = db.prepare(`
    UPDATE world_entities
    SET inspect_count = inspect_count + 1,
        last_inspected_at = datetime('now'),
        updatedAt = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(entityId);
  if (result.changes === 0) return null;
  return getWorldEntity(entityId);
}

// --- Scrolls ---
function getScrolls(userId) {
  const stmt = db.prepare(
    'SELECT id, title, content, createdAt, updatedAt, submittedAt FROM scrolls WHERE userId = ? ORDER BY updatedAt DESC',
  );
  return stmt.all(userId);
}

function getScroll(scrollId, userId) {
  const stmt = db.prepare('SELECT * FROM scrolls WHERE id = ? AND userId = ?');
  return stmt.get(scrollId, userId);
}

function findScrollById(scrollId) {
  const stmt = db.prepare('SELECT * FROM scrolls WHERE id = ?');
  return stmt.get(scrollId);
}

function saveScroll(scrollId, userId, { title, content, submit = false }) {
  const now = new Date().toISOString();
  const existing = getScroll(scrollId, userId);
  const createdAt = existing?.createdAt || now;
  const submittedAt = existing?.submittedAt || (submit ? now : null);
  const stmt = db.prepare(`
    INSERT INTO scrolls (id, userId, title, content, createdAt, updatedAt, submittedAt)
    VALUES (:id, :userId, :title, :content, :createdAt, :updatedAt, :submittedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      updatedAt = excluded.updatedAt,
      submittedAt = excluded.submittedAt
    WHERE scrolls.userId = excluded.userId
  `);
  stmt.run({
    id: scrollId,
    userId,
    title,
    content,
    createdAt,
    updatedAt: now,
    submittedAt,
  });
  return getScroll(scrollId, userId);
}

function deleteScroll(scrollId, userId) {
  const stmt = db.prepare('DELETE FROM scrolls WHERE id = ? AND userId = ?');
  const result = stmt.run(scrollId, userId);
  return result.changes > 0;
}

// --- Tasks ---
function normalizeTaskRow(row) {
  if (!row) return null;
  return {
    ...row,
    notes: parseJsonArray(row.notes_json),
    file_paths: parseJsonArray(row.file_paths),
    depends_on: parseJsonArray(row.depends_on),
    result: parseJsonObject(row.result_json),
  };
}

function createTask({ id, title, description, priority = 1, file_paths = [], depends_on = [], created_by, pipeline_run_id, notes = [] }) {
  const stmt = db.prepare(`
    INSERT INTO collab_tasks (id, title, description, priority, file_paths, depends_on, created_by, pipeline_run_id, notes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    title,
    description || null,
    priority,
    JSON.stringify(file_paths),
    JSON.stringify(depends_on),
    created_by || null,
    pipeline_run_id || null,
    JSON.stringify(notes)
  );
  return getTask(id);
}

function getTask(id) {
  const row = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(id);
  return normalizeTaskRow(row);
}

function getAllTasks(filters = {}, pagination = {}) {
  const limit = Number.isInteger(pagination.limit) ? pagination.limit : 50;
  const offset = Number.isInteger(pagination.offset) ? pagination.offset : 0;

  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.agent) {
    clauses.push('assigned_agent = ?');
    params.push(filters.agent);
  }
  if (filters.priority !== undefined) {
    clauses.push('priority = ?');
    params.push(filters.priority);
  }

  let query = 'SELECT * FROM collab_tasks';
  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }
  query += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params).map(normalizeTaskRow).filter(Boolean);
}

function updateTask(id, updates) {
  const fields = [];
  const params = [];

  const ALLOWED_COLUMNS = [
    'title', 'description', 'status', 'priority', 'assigned_agent', 'pipeline_run_id'
  ];

  for (const col of ALLOWED_COLUMNS) {
    if (updates[col] !== undefined) {
      fields.push(`${col} = ?`);
      params.push(updates[col]);
    }
  }

  if (updates.notes) {
    fields.push('notes_json = ?');
    params.push(JSON.stringify(updates.notes));
  }
  if (updates.result) {
    fields.push('result_json = ?');
    params.push(JSON.stringify(updates.result));
  }

  if (fields.length === 0) return getTask(id);

  if (updates.status === 'done') {
    fields.push("completed_at = datetime('now')");
  }

  fields.push("updated_at = datetime('now')");
  const query = `UPDATE collab_tasks SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);

  const result = db.prepare(query).run(...params);
  if (result.changes === 0) return null;
  return getTask(id);
}

function assignTaskWithLocks(taskId, agentId, _filePaths = [], _ttlMinutes = 30) {
  const query = `
    UPDATE collab_tasks
    SET assigned_agent = ?, status = 'assigned', updated_at = datetime('now')
    WHERE id = ?
  `;
  const result = db.prepare(query).run(agentId, taskId);
  if (result.changes === 0) {
    return { conflict: false, task: null };
  }
  return { conflict: false, task: getTask(taskId) };
}

function deleteTask(id) {
  const stmt = db.prepare('DELETE FROM collab_tasks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- Settings ---
function getSettings(userId) {
  const stmt = db.prepare('SELECT settings_json FROM user_settings WHERE userId = ?');
  const row = stmt.get(userId);
  return parseJsonObject(row?.settings_json);
}

function saveSettings(userId, settings) {
  const stmt = db.prepare(`
    INSERT INTO user_settings (userId, settings_json, updatedAt)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(userId) DO UPDATE SET
      settings_json = excluded.settings_json,
      updatedAt = excluded.updatedAt
  `);
  stmt.run(userId, JSON.stringify(settings || {}));
  return getSettings(userId);
}

function normalizeEmailOutboxRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    templateKey: row.template_key,
    recipient: row.recipient,
    subject: row.subject,
    textBody: row.text_body,
    htmlBody: row.html_body,
    provider: row.provider,
    status: row.status,
    attempts: Number(row.attempts) || 0,
    maxAttempts: Number(row.max_attempts) || 0,
    lastError: row.last_error || null,
    providerMessageId: row.provider_message_id || null,
    metadata: parseJsonObject(row.metadata_json),
    nextAttemptAt: row.next_attempt_at || null,
    lockedAt: row.locked_at || null,
    sentAt: row.sent_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function queueEmail({
  id,
  templateKey,
  recipient,
  subject,
  textBody,
  htmlBody,
  provider = 'console',
  maxAttempts = 5,
  metadata = {},
  nextAttemptAt = new Date().toISOString(),
}) {
  const stmt = db.prepare(`
    INSERT INTO email_outbox (
      id, template_key, recipient, subject, text_body, html_body, provider,
      status, attempts, max_attempts, metadata_json, next_attempt_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  stmt.run(
    id,
    templateKey,
    recipient,
    subject,
    textBody,
    htmlBody,
    provider,
    maxAttempts,
    JSON.stringify(metadata || {}),
    nextAttemptAt,
    now,
    now,
  );
  return getQueuedEmail(id);
}

function getQueuedEmail(id) {
  const stmt = db.prepare('SELECT * FROM email_outbox WHERE id = ?');
  return normalizeEmailOutboxRow(stmt.get(id));
}

function listQueuedEmails(filters = {}, pagination = {}) {
  const allowedStatuses = Array.isArray(filters.statuses)
    ? filters.statuses.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const limit = Number.isInteger(pagination.limit) ? pagination.limit : 100;
  const clauses = [];
  const params = [];

  if (allowedStatuses.length > 0) {
    clauses.push(`status IN (${allowedStatuses.map(() => '?').join(', ')})`);
    params.push(...allowedStatuses);
  }

  let query = 'SELECT * FROM email_outbox';
  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params).map(normalizeEmailOutboxRow).filter(Boolean);
}

function claimQueuedEmails(limit = 10) {
  const candidateRows = db.prepare(`
    SELECT *
    FROM email_outbox
    WHERE status IN ('queued', 'retry')
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit);
  const nowMs = Date.now();
  const claimStmt = db.prepare(`
    UPDATE email_outbox
    SET status = 'processing',
        attempts = attempts + 1,
        locked_at = ?,
        updated_at = ?
    WHERE id = ?
      AND status IN ('queued', 'retry')
  `);

  const claimed = [];
  for (const row of candidateRows) {
    const nextAttemptMs = Date.parse(row.next_attempt_at || '');
    if (Number.isFinite(nextAttemptMs) && nextAttemptMs > nowMs) {
      continue;
    }
    const now = new Date().toISOString();
    const result = claimStmt.run(now, now, row.id);
    if (result.changes > 0) {
      claimed.push(normalizeEmailOutboxRow({
        ...row,
        status: 'processing',
        attempts: Number(row.attempts || 0) + 1,
        locked_at: now,
        updated_at: now,
      }));
    }
  }
  return claimed;
}

function markQueuedEmailSent(id, providerMessageId = null) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE email_outbox
    SET status = 'sent',
        provider_message_id = ?,
        sent_at = ?,
        locked_at = NULL,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(providerMessageId, now, now, id);
  return getQueuedEmail(id);
}

function markQueuedEmailFailed(id, {
  lastError,
  nextAttemptAt = null,
  terminal = false,
} = {}) {
  const now = new Date().toISOString();
  const nextStatus = terminal ? 'failed' : 'retry';
  const stmt = db.prepare(`
    UPDATE email_outbox
    SET status = ?,
        last_error = ?,
        next_attempt_at = ?,
        locked_at = NULL,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(nextStatus, lastError || null, nextAttemptAt || now, now, id);
  return getQueuedEmail(id);
}

function requeueStaleProcessingEmails(staleBeforeIso) {
  const stmt = db.prepare(`
    UPDATE email_outbox
    SET status = 'retry',
        locked_at = NULL,
        updated_at = ?
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < ?
  `);
  const now = new Date().toISOString();
  const result = stmt.run(now, staleBeforeIso);
  return Number(result.changes) || 0;
}

export const persistence = {
  users: {
    findByUsername: findUserByUsername,
    findByEmail: findUserByEmail,
    findById: findUserById,
    findByVerificationToken: findUserByVerificationToken,
    findByRecoveryTokenHash: findUserByRecoveryTokenHash,
    createUser: createUser,
    verifyUser: verifyUser,
    setVerificationToken: setVerificationToken,
    setRecoveryToken: setRecoveryToken,
    clearRecoveryToken: clearRecoveryToken,
    updatePasswordHash: updatePasswordHash,
  },
  mail: {
    queue: queueEmail,
    getOne: getQueuedEmail,
    getAll: listQueuedEmails,
    claimDue: claimQueuedEmails,
    markSent: markQueuedEmailSent,
    markFailed: markQueuedEmailFailed,
    requeueStaleProcessing: requeueStaleProcessingEmails,
  },
  settings: {
    get: getSettings,
    save: saveSettings,
  },
  progression: {
    get: getProgression,
    save: saveProgression,
    reset: resetProgression,
  },
  tasks: {
    create: createTask,
    getById: getTask,
    getAll: getAllTasks,
    update: updateTask,
    assignWithLocks: assignTaskWithLocks,
    delete: deleteTask,
  },
  world: {
    getRoom: getWorldRoom,
    getRooms: getWorldRooms,
    getEntity: getWorldEntity,
    getEntitiesByRoom: getWorldEntitiesByRoom,
    recordInspect: recordWorldEntityInspect,
  },
  scrolls: {
    getAll: getScrolls,
    getOne: getScroll,
    findById: findScrollById,
    save: saveScroll,
    delete: deleteScroll,
  },
  close: closeDatabase,
  getStatus,
};
