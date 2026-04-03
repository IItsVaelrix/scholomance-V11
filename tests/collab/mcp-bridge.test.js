import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
    class HoistedCollabServiceError extends Error {
        constructor(code, message, options = {}) {
            super(message);
            this.name = 'CollabServiceError';
            this.code = code;
            this.statusCode = options.statusCode ?? 500;
            this.details = options.details ?? {};
        }
    }

    return { HoistedCollabServiceError };
});

vi.mock('../../codex/server/collab/collab.service.js', () => ({
    CollabServiceError: hoisted.HoistedCollabServiceError,
    collabService: {},
}));

import { registerCollabMcpBridge } from '../../codex/server/collab/mcp-bridge.js';

function createFakeServer() {
    const resources = new Map();
    const tools = new Map();

    return {
        resources,
        tools,
        resource(name, uri, handler) {
            resources.set(name, { uri, handler });
        },
        tool(name, schema, handler) {
            tools.set(name, { schema, handler });
        },
    };
}

function createMockService() {
    return {
        listAgents: vi.fn(() => [{ id: 'agent-ui' }]),
        listTasks: vi.fn(() => [{ id: 'task-1' }]),
        listLocks: vi.fn(() => []),
        listActivity: vi.fn(() => [{ id: 1, action: 'task_created' }]),
        listPipelines: vi.fn(() => [{ id: 'pipe-1', status: 'running' }]),
        getStatus: vi.fn(() => ({ total_agents: 1, running_pipelines: 1 })),
        registerAgent: vi.fn((params) => ({ ...params, status: 'online' })),
        heartbeatAgent: vi.fn((params) => ({ ...params })),
        createTask: vi.fn((params) => ({ id: 'task-created', ...params })),
        getTask: vi.fn((id) => ({ id, status: 'backlog' })),
        assignTask: vi.fn((params) => ({ id: params.task_id, assigned_agent: params.agent_id })),
        updateTask: vi.fn((params) => ({ id: params.id, status: params.status ?? 'backlog' })),
        acquireLock: vi.fn((params) => ({ conflict: false, file_path: params.file_path, locked_by: params.agent_id })),
        releaseLock: vi.fn(() => ({ ok: true })),
        createPipeline: vi.fn((params) => ({ pipeline: { id: 'pipe-created', pipeline_type: params.pipeline_type } })),
        getPipeline: vi.fn((id) => ({ id, status: 'running' })),
        advancePipeline: vi.fn((params) => ({ pipeline: { id: params.id, status: 'completed' }, terminal: false })),
        failPipeline: vi.fn((params) => ({ pipeline: { id: params.id, status: 'failed', reason: params.reason } })),
        deleteTask: vi.fn(() => ({ ok: true })),
        logActivity: vi.fn(),
    };
}

describe('collab MCP bridge parity', () => {
    let fakeServer;
    let service;

    beforeEach(() => {
        fakeServer = createFakeServer();
        service = createMockService();
        registerCollabMcpBridge(fakeServer, service);
    });

    it('registers the required PDR resources and tools', () => {
        expect(Array.from(fakeServer.resources.keys())).toEqual(
            expect.arrayContaining([
                'agents',
                'tasks',
                'locks',
                'activity',
                'pipelines',
                'status',
            ]),
        );

        expect(Array.from(fakeServer.tools.keys())).toEqual(
            expect.arrayContaining([
                'collab_agent_register',
                'collab_agent_heartbeat',
                'collab_task_create',
                'collab_task_assign',
                'collab_task_update',
                'collab_lock_acquire',
                'collab_lock_release',
                'collab_pipeline_create',
                'collab_pipeline_advance',
                'collab_pipeline_fail',
                'collab_status_get',
                'collab_task_get',
                'collab_task_delete',
                'collab_pipeline_get',
                'collab_fs_list',
                'collab_fs_read',
                'collab_execute_verification',
                'collab_memory_set',
                'collab_memory_get',
            ]),
        );
    });

    it('returns parseable JSON for resources and tool success payloads', async () => {
        const statusResource = fakeServer.resources.get('status');
        const statusPayload = await statusResource.handler();
        expect(statusPayload.contents[0].uri).toBe('collab://status');
        expect(JSON.parse(statusPayload.contents[0].text)).toEqual({ total_agents: 1, running_pipelines: 1 });

        const advanceTool = fakeServer.tools.get('collab_pipeline_advance');
        const toolPayload = await advanceTool.handler({
            id: 'pipe-created',
            agent_id: 'agent-ui',
            result: { ok: true },
        });

        expect(toolPayload.isError).toBeUndefined();
        const parsed = JSON.parse(toolPayload.content[0].text);
        expect(parsed.ok).toBe(true);
        expect(parsed.tool).toBe('collab_pipeline_advance');
        expect(parsed.result.pipeline.id).toBe('pipe-created');
    });

    it('supports setting and getting memories through tools', async () => {
        service.setMemory = vi.fn((params) => ({ ...params, updated_at: 'now' }));
        service.getMemory = vi.fn((params) => ({ ...params, value: 'remembered', updated_at: 'now' }));

        const setTool = fakeServer.tools.get('collab_memory_set');
        const setPayload = await setTool.handler({ key: 'test', value: 'foo' });
        expect(JSON.parse(setPayload.content[0].text).ok).toBe(true);

        const getTool = fakeServer.tools.get('collab_memory_get');
        const getPayload = await getTool.handler({ key: 'test' });
        const getResult = JSON.parse(getPayload.content[0].text);
        expect(getResult.ok).toBe(true);
    });

    it('maps domain conflicts into consistent MCP errors', async () => {
        service.releaseLock.mockImplementation(() => {
            throw new hoisted.HoistedCollabServiceError('LOCK_NOT_FOUND', 'Lock not found or not owned by you', {
                statusCode: 404,
                details: { file_path: 'src/pages/Test.jsx', agent_id: 'agent-ui' },
            });
        });

        const releaseTool = fakeServer.tools.get('collab_lock_release');
        const toolPayload = await releaseTool.handler({
            file_path: 'src/pages/Test.jsx',
            agent_id: 'agent-ui',
        });
        const parsed = JSON.parse(toolPayload.content[0].text);

        expect(toolPayload.isError).toBe(true);
        expect(parsed).toEqual({
            ok: false,
            code: 'LOCK_NOT_FOUND',
            error: 'Lock not found or not owned by you',
            details: {
                file_path: 'src/pages/Test.jsx',
                agent_id: 'agent-ui',
            },
        });
    });
});
