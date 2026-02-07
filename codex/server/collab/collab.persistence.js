import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DB_PATH = process.env.COLLAB_DB_PATH
    ? path.resolve(process.env.COLLAB_DB_PATH)
    : path.join(ROOT, 'scholomance_collab.sqlite');

function ensureSchema(database) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS collab_agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            capabilities TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'offline',
            current_task_id TEXT,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT DEFAULT '{}'
        );

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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            result TEXT
        );

        CREATE TABLE IF NOT EXISTS collab_file_locks (
            file_path TEXT PRIMARY KEY,
            locked_by TEXT NOT NULL,
            task_id TEXT,
            locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS collab_pipeline_runs (
            id TEXT PRIMARY KEY,
            pipeline_type TEXT NOT NULL,
            stages TEXT NOT NULL,
            current_stage INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            trigger_task_id TEXT,
            results TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS collab_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            details TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status ON collab_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_agent ON collab_tasks(assigned_agent);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON collab_activity(created_at);
        CREATE INDEX IF NOT EXISTS idx_pipeline_status ON collab_pipeline_runs(status);
    `);
}

let db;
try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    ensureSchema(db);
    console.log('[COLLAB] Connected to collaboration database.');
} catch (error) {
    console.error(`[COLLAB] Failed to connect to database at ${DB_PATH}.`);
    console.error(error);
    process.exit(1);
}

process.on('exit', () => db.close());

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

// --- Agents ---

function registerAgent({ id, name, role, capabilities, metadata }) {
    const stmt = db.prepare(`
        INSERT INTO collab_agents (id, name, role, capabilities, status, last_seen, metadata)
        VALUES (?, ?, ?, ?, 'online', datetime('now'), ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            capabilities = excluded.capabilities,
            status = 'online',
            last_seen = datetime('now'),
            metadata = excluded.metadata
    `);
    stmt.run(id, name, role, JSON.stringify(capabilities), JSON.stringify(metadata || {}));
    return getAgent(id);
}

function heartbeatAgent(id, status, currentTaskId) {
    const stmt = db.prepare(`
        UPDATE collab_agents
        SET status = ?, current_task_id = ?, last_seen = datetime('now')
        WHERE id = ?
    `);
    const result = stmt.run(status, currentTaskId ?? null, id);
    if (result.changes === 0) return null;
    return getAgent(id);
}

function getAllAgents() {
    const rows = db.prepare('SELECT * FROM collab_agents').all();
    const now = Date.now();
    return rows.map(row => {
        const lastSeen = new Date(row.last_seen + 'Z').getTime();
        const isStale = (now - lastSeen) > STALE_THRESHOLD_MS;
        return {
            ...row,
            capabilities: JSON.parse(row.capabilities),
            metadata: JSON.parse(row.metadata),
            status: isStale && row.status !== 'offline' ? 'offline' : row.status,
        };
    });
}

function getAgent(id) {
    const row = db.prepare('SELECT * FROM collab_agents WHERE id = ?').get(id);
    if (!row) return null;
    return {
        ...row,
        capabilities: JSON.parse(row.capabilities),
        metadata: JSON.parse(row.metadata),
    };
}

// --- Tasks ---

function createTask({ id, title, description, priority, file_paths, depends_on, created_by, pipeline_run_id }) {
    const stmt = db.prepare(`
        INSERT INTO collab_tasks (id, title, description, priority, file_paths, depends_on, created_by, pipeline_run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, description || null, priority, JSON.stringify(file_paths), JSON.stringify(depends_on), created_by, pipeline_run_id || null);
    return getTask(id);
}

function getAllTasks(filters = {}) {
    let query = 'SELECT * FROM collab_tasks WHERE 1=1';
    const params = [];

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }
    if (filters.agent) {
        query += ' AND assigned_agent = ?';
        params.push(filters.agent);
    }
    if (filters.priority !== undefined) {
        query += ' AND priority = ?';
        params.push(filters.priority);
    }

    query += ' ORDER BY priority DESC, created_at ASC';
    const rows = db.prepare(query).all(...params);
    return rows.map(parseTaskRow);
}

function getTask(id) {
    const row = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(id);
    if (!row) return null;
    return parseTaskRow(row);
}

function updateTask(id, updates) {
    const fields = [];
    const params = [];

    if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description); }
    if (updates.status !== undefined) {
        fields.push('status = ?');
        params.push(updates.status);
        if (updates.status === 'done') {
            fields.push("completed_at = datetime('now')");
        }
    }
    if (updates.priority !== undefined) { fields.push('priority = ?'); params.push(updates.priority); }
    if (updates.result !== undefined) { fields.push('result = ?'); params.push(JSON.stringify(updates.result)); }
    if (updates.assigned_agent !== undefined) { fields.push('assigned_agent = ?'); params.push(updates.assigned_agent); }
    if (updates.pipeline_run_id !== undefined) { fields.push('pipeline_run_id = ?'); params.push(updates.pipeline_run_id); }

    if (fields.length === 0) return getTask(id);

    fields.push("updated_at = datetime('now')");
    const stmt = db.prepare(`UPDATE collab_tasks SET ${fields.join(', ')} WHERE id = ?`);
    params.push(id);
    stmt.run(...params);
    return getTask(id);
}

function deleteTask(id) {
    const result = db.prepare('DELETE FROM collab_tasks WHERE id = ?').run(id);
    return result.changes > 0;
}

function parseTaskRow(row) {
    return {
        ...row,
        file_paths: JSON.parse(row.file_paths),
        depends_on: JSON.parse(row.depends_on),
        result: row.result ? JSON.parse(row.result) : null,
    };
}

// --- File Locks ---

function acquireLock({ file_path, agent_id, task_id, ttl_minutes }) {
    expireStaleLocks();
    const existing = db.prepare('SELECT * FROM collab_file_locks WHERE file_path = ?').get(file_path);
    if (existing && existing.locked_by !== agent_id) {
        return { conflict: true, locked_by: existing.locked_by, task_id: existing.task_id };
    }
    const stmt = db.prepare(`
        INSERT INTO collab_file_locks (file_path, locked_by, task_id, locked_at, expires_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now', '+' || ? || ' minutes'))
        ON CONFLICT(file_path) DO UPDATE SET
            locked_by = excluded.locked_by,
            task_id = excluded.task_id,
            locked_at = excluded.locked_at,
            expires_at = excluded.expires_at
    `);
    stmt.run(file_path, agent_id, task_id || null, ttl_minutes);
    return { conflict: false, file_path, locked_by: agent_id };
}

function releaseLock(filePath, agentId) {
    const result = db.prepare('DELETE FROM collab_file_locks WHERE file_path = ? AND locked_by = ?').run(filePath, agentId);
    return result.changes > 0;
}

function releaseLocksForAgent(agentId) {
    const result = db.prepare('DELETE FROM collab_file_locks WHERE locked_by = ?').run(agentId);
    return result.changes;
}

function releaseLocksForTask(taskId) {
    const result = db.prepare('DELETE FROM collab_file_locks WHERE task_id = ?').run(taskId);
    return result.changes;
}

function checkLock(filePath) {
    expireStaleLocks();
    return db.prepare('SELECT * FROM collab_file_locks WHERE file_path = ?').get(filePath) || null;
}

function getAllLocks() {
    expireStaleLocks();
    return db.prepare('SELECT * FROM collab_file_locks ORDER BY locked_at DESC').all();
}

function expireStaleLocks() {
    db.prepare("DELETE FROM collab_file_locks WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
}

// --- Pipeline Runs ---

function createPipelineRun({ id, pipeline_type, stages, trigger_task_id }) {
    const stmt = db.prepare(`
        INSERT INTO collab_pipeline_runs (id, pipeline_type, stages, trigger_task_id, status)
        VALUES (?, ?, ?, ?, 'running')
    `);
    stmt.run(id, pipeline_type, JSON.stringify(stages), trigger_task_id || null);
    return getPipelineRun(id);
}

function getAllPipelineRuns(filters = {}) {
    let query = 'SELECT * FROM collab_pipeline_runs WHERE 1=1';
    const params = [];

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params);
    return rows.map(parsePipelineRow);
}

function getPipelineRun(id) {
    const row = db.prepare('SELECT * FROM collab_pipeline_runs WHERE id = ?').get(id);
    if (!row) return null;
    return parsePipelineRow(row);
}

function advancePipelineRun(id, stageResult) {
    const pipeline = getPipelineRun(id);
    if (!pipeline) return null;
    if (pipeline.status !== 'running') return pipeline;

    const results = pipeline.results;
    results[`stage_${pipeline.current_stage}`] = stageResult;

    const nextStage = pipeline.current_stage + 1;
    const isComplete = nextStage >= pipeline.stages.length;

    const stmt = db.prepare(`
        UPDATE collab_pipeline_runs
        SET current_stage = ?, results = ?, status = ?, updated_at = datetime('now'),
            completed_at = CASE WHEN ? THEN datetime('now') ELSE NULL END
        WHERE id = ?
    `);
    stmt.run(
        isComplete ? pipeline.current_stage : nextStage,
        JSON.stringify(results),
        isComplete ? 'completed' : 'running',
        isComplete ? 1 : 0,
        id,
    );

    return { pipeline: getPipelineRun(id), isComplete, nextStageIndex: isComplete ? null : nextStage };
}

function failPipelineRun(id, reason) {
    const pipeline = getPipelineRun(id);
    if (!pipeline) return null;

    const results = pipeline.results;
    results.failure_reason = reason;

    const stmt = db.prepare(`
        UPDATE collab_pipeline_runs
        SET status = 'failed', results = ?, updated_at = datetime('now'), completed_at = datetime('now')
        WHERE id = ?
    `);
    stmt.run(JSON.stringify(results), id);
    return getPipelineRun(id);
}

function parsePipelineRow(row) {
    return {
        ...row,
        stages: JSON.parse(row.stages),
        results: JSON.parse(row.results),
    };
}

// --- Activity Log ---

function logActivity({ agent_id, action, target_type, target_id, details }) {
    const stmt = db.prepare(`
        INSERT INTO collab_activity (agent_id, action, target_type, target_id, details)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(agent_id || null, action, target_type || null, target_id || null, JSON.stringify(details || {}));
}

function getRecentActivity(limit = 50, filters = {}) {
    let query = 'SELECT * FROM collab_activity WHERE 1=1';
    const params = [];

    if (filters.agent) {
        query += ' AND agent_id = ?';
        params.push(filters.agent);
    }
    if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return rows.map(row => ({
        ...row,
        details: JSON.parse(row.details),
    }));
}

// --- Export ---

export const collabPersistence = {
    agents: {
        register: registerAgent,
        heartbeat: heartbeatAgent,
        getAll: getAllAgents,
        getById: getAgent,
    },
    tasks: {
        create: createTask,
        getAll: getAllTasks,
        getById: getTask,
        update: updateTask,
        delete: deleteTask,
    },
    locks: {
        acquire: acquireLock,
        release: releaseLock,
        releaseForAgent: releaseLocksForAgent,
        releaseForTask: releaseLocksForTask,
        check: checkLock,
        getAll: getAllLocks,
    },
    pipelines: {
        create: createPipelineRun,
        getAll: getAllPipelineRuns,
        getById: getPipelineRun,
        advance: advancePipelineRun,
        fail: failPipelineRun,
    },
    activity: {
        log: logActivity,
        getRecent: getRecentActivity,
    },
};
