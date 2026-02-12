import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  tasksGetAll: vi.fn(() => []),
  pipelinesGetAll: vi.fn(() => []),
  activityGetRecent: vi.fn(() => []),
}));

vi.mock('../../codex/server/collab/collab.persistence.js', () => ({
  collabPersistence: {
    agents: {
      register: vi.fn(),
      heartbeat: vi.fn(),
      getAll: vi.fn(() => []),
      getById: vi.fn(() => null),
    },
    tasks: {
      create: vi.fn(),
      getAll: mocks.tasksGetAll,
      getById: vi.fn(() => null),
      update: vi.fn(),
      assignWithLocks: vi.fn(),
      delete: vi.fn(() => false),
    },
    locks: {
      acquire: vi.fn(),
      release: vi.fn(() => false),
      releaseForTask: vi.fn(),
      check: vi.fn(() => null),
      getAll: vi.fn(() => []),
    },
    pipelines: {
      create: vi.fn(),
      getAll: mocks.pipelinesGetAll,
      getById: vi.fn(() => null),
      advance: vi.fn(),
      fail: vi.fn(),
    },
    activity: {
      log: vi.fn(),
      getRecent: mocks.activityGetRecent,
    },
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
  });

  it('validates and forwards task list pagination', async () => {
    const expectedTasks = [{ id: 'task-1', title: 'Task 1', status: 'backlog' }];
    mocks.tasksGetAll.mockReturnValue(expectedTasks);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/tasks?status=backlog&priority=2&limit=5&offset=3',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedTasks);
    expect(mocks.tasksGetAll).toHaveBeenCalledWith(
      { status: 'backlog', agent: undefined, priority: 2 },
      { limit: 5, offset: 3 },
    );
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
    mocks.pipelinesGetAll.mockReturnValue(expectedPipelines);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/pipelines?status=running&limit=10&offset=4',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedPipelines);
    expect(mocks.pipelinesGetAll).toHaveBeenCalledWith(
      { status: 'running' },
      { limit: 10, offset: 4 },
    );
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
    mocks.activityGetRecent.mockReturnValue(expectedActivity);

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/collab/activity?agent=agent-ui&action=task_created&limit=7&offset=2',
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedActivity);
    expect(mocks.activityGetRecent).toHaveBeenCalledWith(
      7,
      { agent: 'agent-ui', action: 'task_created' },
      2,
    );
  });
});

