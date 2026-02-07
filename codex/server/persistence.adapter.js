import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Navigate up from 'codex/server' to the project root
const ROOT = path.resolve(__dirname, '..', '..'); 
const DB_PATH = process.env.USER_DB_PATH
    ? path.resolve(process.env.USER_DB_PATH)
    : path.join(ROOT, 'scholomance_user.sqlite');

function ensureSchema(database) {
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

        CREATE TABLE IF NOT EXISTS user_progression (
            userId INTEGER PRIMARY KEY,
            xp INTEGER NOT NULL DEFAULT 0,
            unlockedSchools TEXT NOT NULL DEFAULT '["SONIC"]',
            FOREIGN KEY (userId) REFERENCES users (id)
        );

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
}

let db;
try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    ensureSchema(db);
    console.log('Connected to the user database.');
} catch (error) {
    console.error(`Failed to connect to the database at ${DB_PATH}.`);
    console.error(error);
    process.exit(1);
}

process.on('exit', () => db.close());

// --- User ---
function findUserByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
}

function findUserByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
}

function createUser(username, email, hashedPassword) {
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(username, email, hashedPassword);
    return { id: result.lastInsertRowid, username, email };
}

// --- Progression ---
function getProgression(userId) {
    let stmt = db.prepare('SELECT * FROM user_progression WHERE userId = ?');
    let progression = stmt.get(userId);
    if (!progression) {
        // If no progression exists for the user, create a default entry
        const insertStmt = db.prepare('INSERT INTO user_progression (userId, xp, unlockedSchools) VALUES (?, ?, ?)');
        insertStmt.run(userId, 0, '["SONIC"]');
        progression = { userId, xp: 0, unlockedSchools: '["SONIC"]' };
    }
    // Parse the JSON string before returning
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
    // Stringify the array for storage
    const unlockedSchoolsJson = JSON.stringify(unlockedSchools);
    stmt.run(userId, xp, unlockedSchoolsJson);
    return getProgression(userId);
}

// --- Scrolls ---
function getScrolls(userId) {
    const stmt = db.prepare('SELECT id, title, content, createdAt, updatedAt FROM scrolls WHERE userId = ? ORDER BY updatedAt DESC');
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
        createUser: createUser,
    },
    progression: {
        get: getProgression,
        save: saveProgression,
    },
    scrolls: {
        getAll: getScrolls,
        getOne: getScroll,
        findById: findScrollById,
        save: saveScroll,
        delete: deleteScroll,
    },
};
