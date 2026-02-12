import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

// Note: These tests import the persistence module which creates a real SQLite database.
// The database path can be overridden with COLLAB_DB_PATH env var for test isolation.
// In CI, set COLLAB_DB_PATH to a temp file.

let collabPersistence;
let testDbPath;

beforeAll(async () => {
    // Use OS temp dir to avoid creating repo artifacts.
    testDbPath = path.join(
        os.tmpdir(),
        `scholomance_collab_test_${Date.now()}_${process.pid}.sqlite`,
    );
    process.env.COLLAB_DB_PATH = testDbPath;

    const mod = await import('../../codex/server/collab/collab.persistence.js?test=collab-persistence-suite');
    collabPersistence = mod.collabPersistence;
});

afterAll(() => {
    try {
        collabPersistence?.close?.();
    } catch {
        // Best-effort close for test cleanup.
    }

    for (const suffix of ['', '-wal', '-shm']) {
        const candidate = `${testDbPath}${suffix}`;
        if (existsSync(candidate)) {
            try {
                rmSync(candidate, { force: true });
            } catch {
                // Ignore cleanup errors in test environment.
            }
        }
    }
});

describe('agents', () => {
    it('should register a new agent', () => {
        const agent = collabPersistence.agents.register({
            id: 'test-claude',
            name: 'Claude Test',
            role: 'ui',
            capabilities: ['jsx', 'css'],
        });
        expect(agent).toBeDefined();
        expect(agent.id).toBe('test-claude');
        expect(agent.name).toBe('Claude Test');
        expect(agent.role).toBe('ui');
        expect(agent.status).toBe('online');
    });

    it('should upsert on re-register', () => {
        collabPersistence.agents.register({
            id: 'test-claude',
            name: 'Claude Updated',
            role: 'ui',
            capabilities: ['jsx', 'css', 'animations'],
        });
        const agent = collabPersistence.agents.getById('test-claude');
        expect(agent.name).toBe('Claude Updated');
    });

    it('should get all agents', () => {
        collabPersistence.agents.register({
            id: 'test-gemini',
            name: 'Gemini Test',
            role: 'backend',
            capabilities: ['node', 'fastify'],
        });
        const agents = collabPersistence.agents.getAll();
        expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle heartbeat', () => {
        const agent = collabPersistence.agents.heartbeat('test-claude', 'busy', null);
        expect(agent).toBeDefined();
        expect(agent.status).toBe('busy');
    });

    it('should return null for heartbeat of unknown agent', () => {
        const result = collabPersistence.agents.heartbeat('nonexistent', 'online', null);
        expect(result).toBeNull();
    });
});

describe('tasks', () => {
    let taskId;

    it('should create a task', () => {
        const task = collabPersistence.tasks.create({
            id: 'task-001',
            title: 'Test task',
            description: 'A test task',
            priority: 2,
            file_paths: ['src/pages/Read/ReadPage.jsx'],
            depends_on: [],
            created_by: 'human',
        });
        taskId = task.id;
        expect(task).toBeDefined();
        expect(task.title).toBe('Test task');
        expect(task.status).toBe('backlog');
        expect(task.file_paths).toEqual(['src/pages/Read/ReadPage.jsx']);
    });

    it('should get task by id', () => {
        const task = collabPersistence.tasks.getById(taskId);
        expect(task).toBeDefined();
        expect(task.id).toBe(taskId);
    });

    it('should update task', () => {
        const task = collabPersistence.tasks.update(taskId, {
            status: 'in_progress',
            assigned_agent: 'test-claude',
        });
        expect(task.status).toBe('in_progress');
        expect(task.assigned_agent).toBe('test-claude');
    });

    it('should filter tasks by status', () => {
        collabPersistence.tasks.create({
            id: 'task-002',
            title: 'Backlog task',
            priority: 0,
            file_paths: [],
            depends_on: [],
            created_by: 'human',
        });
        const inProgress = collabPersistence.tasks.getAll({ status: 'in_progress' });
        expect(inProgress.every(t => t.status === 'in_progress')).toBe(true);
    });

    it('should paginate task listings with limit/offset', () => {
        const page = collabPersistence.tasks.getAll({}, { limit: 1, offset: 0 });
        expect(page).toHaveLength(1);
    });

    it('should set completed_at when marking done', () => {
        const task = collabPersistence.tasks.update(taskId, {
            status: 'done',
            result: { files_changed: ['ReadPage.jsx'] },
        });
        expect(task.status).toBe('done');
        expect(task.completed_at).toBeTruthy();
        expect(task.result).toEqual({ files_changed: ['ReadPage.jsx'] });
    });

    it('should delete a task', () => {
        const deleted = collabPersistence.tasks.delete('task-002');
        expect(deleted).toBe(true);
        expect(collabPersistence.tasks.getById('task-002')).toBeNull();
    });
});

describe('file locks', () => {
    it('should acquire a lock', () => {
        const result = collabPersistence.locks.acquire({
            file_path: 'src/pages/Test.jsx',
            agent_id: 'test-claude',
            task_id: null,
            ttl_minutes: 30,
        });
        expect(result.conflict).toBe(false);
        expect(result.locked_by).toBe('test-claude');
    });

    it('should detect lock conflict from different agent', () => {
        const result = collabPersistence.locks.acquire({
            file_path: 'src/pages/Test.jsx',
            agent_id: 'test-gemini',
            task_id: null,
            ttl_minutes: 30,
        });
        expect(result.conflict).toBe(true);
        expect(result.locked_by).toBe('test-claude');
    });

    it('should allow same agent to re-lock', () => {
        const result = collabPersistence.locks.acquire({
            file_path: 'src/pages/Test.jsx',
            agent_id: 'test-claude',
            task_id: null,
            ttl_minutes: 60,
        });
        expect(result.conflict).toBe(false);
    });

    it('should check lock status', () => {
        const lock = collabPersistence.locks.check('src/pages/Test.jsx');
        expect(lock).toBeTruthy();
        expect(lock.locked_by).toBe('test-claude');
    });

    it('should release a lock', () => {
        const released = collabPersistence.locks.release('src/pages/Test.jsx', 'test-claude');
        expect(released).toBe(true);
        expect(collabPersistence.locks.check('src/pages/Test.jsx')).toBeNull();
    });

    it('should not release a lock owned by another agent', () => {
        collabPersistence.locks.acquire({
            file_path: 'src/pages/Other.jsx',
            agent_id: 'test-claude',
            ttl_minutes: 30,
        });
        const released = collabPersistence.locks.release('src/pages/Other.jsx', 'test-gemini');
        expect(released).toBe(false);
    });
});

describe('task assignment transactions', () => {
    it('should assign and lock all files in one operation', () => {
        const taskId = `task-assign-success-${Date.now()}`;
        const fileA = `src/pages/TxnA-${Date.now()}.jsx`;
        const fileB = `src/pages/TxnB-${Date.now()}.jsx`;

        collabPersistence.tasks.create({
            id: taskId,
            title: 'Transactional assign success',
            priority: 2,
            file_paths: [fileA, fileB],
            depends_on: [],
            created_by: 'human',
        });

        const result = collabPersistence.tasks.assignWithLocks(taskId, 'test-claude', [fileA, fileB], 30);
        expect(result.conflict).toBe(false);
        expect(result.task).toBeTruthy();
        expect(result.task.status).toBe('assigned');
        expect(result.task.assigned_agent).toBe('test-claude');

        const lockA = collabPersistence.locks.check(fileA);
        const lockB = collabPersistence.locks.check(fileB);
        expect(lockA?.locked_by).toBe('test-claude');
        expect(lockB?.locked_by).toBe('test-claude');
    });

    it('should not leak partial locks when one file conflicts', () => {
        const stamp = Date.now();
        const taskId = `task-assign-conflict-${stamp}`;
        const freeFile = `src/pages/TxnFree-${stamp}.jsx`;
        const conflictedFile = `src/pages/TxnConflict-${stamp}.jsx`;

        collabPersistence.tasks.create({
            id: taskId,
            title: 'Transactional assign conflict',
            priority: 2,
            file_paths: [freeFile, conflictedFile],
            depends_on: [],
            created_by: 'human',
        });

        collabPersistence.locks.acquire({
            file_path: conflictedFile,
            agent_id: 'test-gemini',
            ttl_minutes: 30,
        });

        const result = collabPersistence.tasks.assignWithLocks(
            taskId,
            'test-claude',
            [freeFile, conflictedFile],
            30,
        );
        expect(result.conflict).toBe(true);
        expect(result.file).toBe(conflictedFile);
        expect(result.locked_by).toBe('test-gemini');

        const freeFileLock = collabPersistence.locks.check(freeFile);
        expect(freeFileLock).toBeNull();

        const task = collabPersistence.tasks.getById(taskId);
        expect(task.status).toBe('backlog');
        expect(task.assigned_agent).toBeNull();
    });
});

describe('pipeline runs', () => {
    let pipelineId;

    it('should create a pipeline run', () => {
        const pipeline = collabPersistence.pipelines.create({
            id: 'pipe-001',
            pipeline_type: 'code_review_test',
            stages: [
                { name: 'implement', role: null },
                { name: 'review', role: 'backend' },
                { name: 'test', role: 'qa' },
            ],
            trigger_task_id: null,
        });
        pipelineId = pipeline.id;
        expect(pipeline.status).toBe('running');
        expect(pipeline.current_stage).toBe(0);
        expect(pipeline.stages).toHaveLength(3);
    });

    it('should advance pipeline to next stage', () => {
        const result = collabPersistence.pipelines.advance(pipelineId, { approved: true });
        expect(result.isComplete).toBe(false);
        expect(result.nextStageIndex).toBe(1);
        expect(result.pipeline.current_stage).toBe(1);
    });

    it('should advance pipeline to completion', () => {
        collabPersistence.pipelines.advance(pipelineId, { reviewed: true });
        const result = collabPersistence.pipelines.advance(pipelineId, { tests_passed: true });
        expect(result.isComplete).toBe(true);
        expect(result.pipeline.status).toBe('completed');
        expect(result.pipeline.completed_at).toBeTruthy();
    });

    it('should fail a pipeline', () => {
        const pipeline = collabPersistence.pipelines.create({
            id: 'pipe-002',
            pipeline_type: 'bug_fix',
            stages: [{ name: 'diagnose', role: 'qa' }],
        });
        const failed = collabPersistence.pipelines.fail(pipeline.id, 'Could not reproduce');
        expect(failed.status).toBe('failed');
        expect(failed.results.failure_reason).toBe('Could not reproduce');
    });
});

describe('activity', () => {
    it('should log activity', () => {
        collabPersistence.activity.log({
            agent_id: 'test-claude',
            action: 'task_created',
            target_type: 'task',
            target_id: 'task-001',
            details: { title: 'Test task' },
        });
        const recent = collabPersistence.activity.getRecent(10);
        expect(recent.length).toBeGreaterThan(0);
        const entry = recent.find(a => a.target_id === 'task-001');
        expect(entry).toBeDefined();
        expect(entry.action).toBe('task_created');
    });

    it('should filter activity by agent', () => {
        collabPersistence.activity.log({
            agent_id: 'test-gemini',
            action: 'task_created',
            target_type: 'task',
            target_id: 'task-003',
        });
        const geminiActivity = collabPersistence.activity.getRecent(10, { agent: 'test-gemini' });
        expect(geminiActivity.every(a => a.agent_id === 'test-gemini')).toBe(true);
    });

    it('should paginate activity with offset', () => {
        const firstPage = collabPersistence.activity.getRecent(1, {});
        const secondPage = collabPersistence.activity.getRecent(1, {}, 1);
        expect(firstPage).toHaveLength(1);
        expect(secondPage).toHaveLength(1);
        expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });
});
