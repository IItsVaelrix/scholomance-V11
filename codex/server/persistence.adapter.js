import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applySqlitePragmas, runSqliteMigrations } from './db/sqlite.migrations.js';

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
      database.exec(`
        ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN verificationToken TEXT;
      `);
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

function createUser(username, email, hashedPassword, verificationToken) {
  const stmt = db.prepare('INSERT INTO users (username, email, password, verificationToken, verified) VALUES (?, ?, ?, ?, 0)');
  const result = stmt.run(username, email, hashedPassword, verificationToken);
  return { id: result.lastInsertRowid, username, email };
}

function verifyUser(userId) {
  const stmt = db.prepare('UPDATE users SET verified = 1, verificationToken = NULL WHERE id = ?');
  stmt.run(userId);
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

// --- Scrolls ---
function getScrolls(userId) {
  const stmt = db.prepare(
    'SELECT id, title, content, createdAt, updatedAt FROM scrolls WHERE userId = ? ORDER BY updatedAt DESC',
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

function saveScroll(scrollId, userId, { title, content }) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO scrolls (id, userId, title, content, createdAt, updatedAt)
    VALUES (:id, :userId, :title, :content, :createdAt, :updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      updatedAt = excluded.updatedAt
    WHERE scrolls.userId = excluded.userId
  `);
  stmt.run({
    id: scrollId,
    userId,
    title,
    content,
    createdAt: now,
    updatedAt: now,
  });
  return getScroll(scrollId, userId);
}

function deleteScroll(scrollId, userId) {
  const stmt = db.prepare('DELETE FROM scrolls WHERE id = ? AND userId = ?');
  const result = stmt.run(scrollId, userId);
  return result.changes > 0;
}

export const persistence = {
  users: {
    findByUsername: findUserByUsername,
    findByEmail: findUserByEmail,
    findById: findUserById,
    findByVerificationToken: findUserByVerificationToken,
    createUser: createUser,
    verifyUser: verifyUser,
  },
  progression: {
    get: getProgression,
    save: saveProgression,
    reset: resetProgression,
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

