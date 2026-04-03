import Fastify from 'fastify';
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

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(() => []),
  listPipelines: vi.fn(() => []),
  listActivity: vi.fn(() => []),
  acquireLock: vi.fn(),
}));

vi.mock('../../codex/server/collab/collab.service.js', () => ({
  CollabServiceError: hoisted.HoistedCollabServiceError,
  collabService: {
    listAgents: vi.fn(() => []),
    getAgent: vi.fn(),
    registerAgent: vi.fn(),
    heartbeatAgent: vi.fn(),
    listTasks: mocks.listTasks,
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    assignTask: vi.fn(),
    listLocks: vi.fn(() => []),
    checkLock: vi.fn(() => null),
    acquireLock: mocks.acquireLock,
    releaseLock: vi.fn(),
    listPipelines: mocks.listPipelines,
    getPipeline: vi.fn(),
    createPipeline: vi.fn(),
    advancePipeline: vi.fn(),
    failPipeline: vi.fn(),
    listActivity: mocks.listActivity,
    getStatus: vi.fn(() => ({
      online_agents: 0,
      total_agents: 0,
      active_tasks: 0,
      total_tasks: 0,
      running_pipelines: 0,
      active_locks: 0,
    })),
  },
}));

import { collabRoutes } from '../../codex/server/collab/collab.routes.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(collabRoutes, { prefix: '/collab' });
  return app;
}

describe('[Server] collab query validation + pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTasks.mockReturnValue([]);
    mocks.listPipelines.mockReturnValue([]);
    mocks.listActivity.mockReturnValue([]);
  });

  it('validates and forwards task list pagination', async () => {
    const expectedTasks = [{ id: 'task-1', title: 'Task 1', status: 'backlog' }];
    mocks.listTasks.mockReturnValue(expectedTasks);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/tasks?status=backlog&priority=2&limit=5&offset=3',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedTasks);
    expect(mocks.listTasks).toHaveBeenCalledWith({
      status: 'backlog',
      agent: undefined,
      priority: 2,
      limit: 5,
      offset: 3,
    });
  });

  it('returns 400 for invalid task query values', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/tasks?priority=NaN&limit=5000',
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    const payload = response.json();
    expect(payload.error).toBe('Validation failed');
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.some((detail) => detail.includes('priority') || detail.includes('limit'))).toBe(true);
  });

  it('validates and forwards pipelines query pagination', async () => {
    const expectedPipelines = [{ id: 'pipe-1', status: 'running' }];
    mocks.listPipelines.mockReturnValue(expectedPipelines);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/pipelines?status=running&limit=10&offset=4',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedPipelines);
    expect(mocks.listPipelines).toHaveBeenCalledWith({
      status: 'running',
      limit: 10,
      offset: 4,
    });
  });

  it('returns 400 for invalid activity pagination', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/activity?limit=0&offset=-1',
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    const payload = response.json();
    expect(payload.error).toBe('Validation failed');
    expect(payload.details.some((detail) => detail.includes('limit') || detail.includes('offset'))).toBe(true);
  });

  it('validates and forwards activity query filters', async () => {
    const expectedActivity = [{ id: 1, action: 'task_created' }];
    mocks.listActivity.mockReturnValue(expectedActivity);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/activity?agent=agent-ui&action=task_created&limit=7&offset=2',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedActivity);
    expect(mocks.listActivity).toHaveBeenCalledWith({
      agent: 'agent-ui',
      action: 'task_created',
      limit: 7,
      offset: 2,
    });
  });

  it('maps service conflicts into the HTTP error contract', async () => {
    mocks.acquireLock.mockImplementation(() => {
      throw new hoisted.HoistedCollabServiceError('AGENT_NOT_FOUND', 'Agent not found', {
        statusCode: 404,
        details: { agent_id: 'ghost' },
      });
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/collab/locks',
      payload: {
        file_path: 'src/pages/Test.jsx',
        agent_id: 'ghost',
        ttl_minutes: 30,
      },
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND',
      agent_id: 'ghost',
    });
  });
});
