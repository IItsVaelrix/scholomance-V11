import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

let collabService;
let CollabServiceError;
let collabPersistence;
let testDbPath;

function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

beforeAll(async () => {
    testDbPath = path.join(
        os.tmpdir(),
        `scholomance_collab_service_${Date.now()}_${process.pid}.sqlite`,
    );

    process.env.COLLAB_DB_PATH = testDbPath;
    vi.resetModules();

    const serviceMod = await import('../../codex/server/collab/collab.service.js?test=collab-service');
    const persistenceMod = await import('../../codex/server/collab/collab.persistence.js');

    collabService = serviceMod.collabService;
    CollabServiceError = serviceMod.CollabServiceError;
    collabPersistence = persistenceMod.collabPersistence;

    collabService.registerAgent({
        id: 'agent-ui',
        name: 'UI Agent',
        role: 'ui',
        capabilities: ['jsx', 'css'],
    });
    collabService.registerAgent({
        id: 'agent-backend',
        name: 'Backend Agent',
        role: 'backend',
        capabilities: ['node', 'fastify'],
    });
    collabService.registerAgent({
        id: 'agent-qa',
        name: 'QA Agent',
        role: 'qa',
        capabilities: ['vitest'],
    });
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

describe('collab service hardening', () => {
    it('rejects direct lock acquisition for unknown agents', () => {
        expect(() => {
            collabService.acquireLock({
                file_path: 'src/pages/Read/Unknown.jsx',
                agent_id: 'ghost-agent',
                ttl_minutes: 30,
            });
        }).toThrowError(CollabServiceError);

        try {
            collabService.acquireLock({
                file_path: 'src/pages/Read/Unknown.jsx',
                agent_id: 'ghost-agent',
                ttl_minutes: 30,
            });
        } catch (error) {
            expect(error.code).toBe('AGENT_NOT_FOUND');
            expect(error.statusCode).toBe(404);
        }
    });

    it('rejects direct lock acquisition outside ownership boundaries', () => {
        try {
            collabService.acquireLock({
                file_path: 'codex/server/index.js',
                agent_id: 'agent-ui',
                ttl_minutes: 30,
            });
            throw new Error('Expected ownership conflict');
        } catch (error) {
            expect(error).toBeInstanceOf(CollabServiceError);
            expect(error.code).toBe('OWNERSHIP_CONFLICT');
            expect(error.statusCode).toBe(409);
            expect(error.details.conflicts[0].owner_role).toBe('backend');
        }
    });

    it('auto-assigns pipeline stage tasks through lock-aware assignment', () => {
        const filePath = `src/pages/Collab/${uniqueId('pipeline-ui')}.jsx`;
        const triggerTask = collabService.createTask({
            title: 'Trigger UI pipeline',
            description: 'Establish file context for the UI pipeline',
            priority: 2,
            file_paths: [filePath],
            depends_on: [],
            created_by: 'human',
        });

        const result = collabService.createPipeline({
            pipeline_type: 'ui_feature',
            trigger_task_id: triggerTask.id,
            actor_agent_id: 'agent-ui',
        });

        expect(result.pipeline.status).toBe('running');
        expect(result.stage_task.assigned_agent).toBe('agent-ui');
        expect(result.stage_task.status).toBe('assigned');
        expect(result.auto_assignment.assigned).toBe(true);

        const lock = collabService.checkLock(filePath);
        expect(lock?.locked_by).toBe('agent-ui');
        expect(lock?.task_id).toBe(result.stage_task.id);
    });

    it('does not represent pipeline tasks as assigned when lock acquisition conflicts', () => {
        const filePath = `src/pages/Collab/${uniqueId('pipeline-conflict')}.jsx`;

        collabService.acquireLock({
            file_path: filePath,
            agent_id: 'agent-backend',
            ttl_minutes: 30,
            override: true,
        });

        const triggerTask = collabService.createTask({
            title: 'Trigger conflicting UI pipeline',
            priority: 2,
            file_paths: [filePath],
            depends_on: [],
            created_by: 'human',
        });

        const result = collabService.createPipeline({
            pipeline_type: 'ui_feature',
            trigger_task_id: triggerTask.id,
            actor_agent_id: 'agent-ui',
        });

        expect(result.auto_assignment.assigned).toBe(false);
        expect(result.auto_assignment.reason).toBe('FILE_LOCK_CONFLICT');
        expect(result.stage_task.assigned_agent).toBeNull();
        expect(result.stage_task.status).toBe('backlog');

        const lock = collabService.checkLock(filePath);
        expect(lock?.locked_by).toBe('agent-backend');
    });

    it('keeps completed pipelines stable under repeated advance and fail calls', () => {
        const created = collabService.createPipeline({
            pipeline_type: 'bug_fix',
            actor_agent_id: 'agent-qa',
        });

        const pipelineId = created.pipeline.id;

        const first = collabService.advancePipeline({
            id: pipelineId,
            actor_agent_id: 'agent-qa',
            result: { diagnose: true },
        });
        const second = collabService.advancePipeline({
            id: pipelineId,
            actor_agent_id: 'agent-backend',
            result: { fix: true },
        });
        const third = collabService.advancePipeline({
            id: pipelineId,
            actor_agent_id: 'agent-qa',
            result: { verify: true },
        });
        const repeatedAdvance = collabService.advancePipeline({
            id: pipelineId,
            actor_agent_id: 'agent-qa',
            result: { ignored: true },
        });
        const repeatedFail = collabService.failPipeline({
            id: pipelineId,
            actor_agent_id: 'agent-qa',
            reason: 'too late',
        });

        expect(first.pipeline.status).toBe('running');
        expect(second.pipeline.status).toBe('running');
        expect(third.pipeline.status).toBe('completed');
        expect(repeatedAdvance.terminal).toBe(true);
        expect(repeatedAdvance.pipeline.status).toBe('completed');
        expect(repeatedAdvance.stage_task).toBeNull();
        expect(repeatedFail.terminal).toBe(true);
        expect(repeatedFail.pipeline.status).toBe('completed');
    });
});
