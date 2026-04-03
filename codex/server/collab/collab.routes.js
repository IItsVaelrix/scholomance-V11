import { CollabServiceError, collabService } from './collab.service.js';
import { collabAgentKeyAuth } from './collab.agent-auth.js';
import {
    RegisterAgentSchema,
    HeartbeatSchema,
    CreateTaskSchema,
    UpdateTaskSchema,
    AssignTaskSchema,
    AcquireLockSchema,
    CreatePipelineSchema,
    AdvancePipelineSchema,
    FailPipelineSchema,
    ListTasksQuerySchema,
    TaskAssignmentPreflightQuerySchema,
    ListPipelinesQuerySchema,
    ListActivityQuerySchema,
    LockCheckQuerySchema,
} from './collab.schemas.js';

function parseZod(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return { ok: false, errors };
    }
    return { ok: true, data: result.data };
}

function sendServiceError(reply, error) {
    if (!(error instanceof CollabServiceError)) {
        throw error;
    }

    return reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
        ...error.details,
    });
}

/**
 * Fastify plugin that registers all /collab/* routes.
 * Authentication is applied by the parent plugin when configured.
 */
export async function collabRoutes(fastify, _options) {
    // Agent key auth pre-handler: tries Bearer token auth, falls through to session auth.
    fastify.addHook('preHandler', collabAgentKeyAuth);

    // ========================
    //  AGENTS
    // ========================

    fastify.post('/agents/register', {
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const parsed = parseZod(RegisterAgentSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const agent = collabService.registerAgent(parsed.data);
            return reply.code(200).send(agent);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/agents/:id/heartbeat', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(HeartbeatSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const agent = collabService.heartbeatAgent({
                id,
                status: parsed.data.status,
                current_task_id: parsed.data.current_task_id,
            });
            return reply.code(200).send(agent);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/agents', async (_request, reply) => {
        const agents = collabService.listAgents();
        return reply.code(200).send(agents);
    });

    fastify.get('/agents/:id', async (request, reply) => {
        try {
            const agent = collabService.getAgent(request.params.id);
            return reply.code(200).send(agent);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.delete('/agents/:id', async (request, reply) => {
        try {
            const result = collabService.deleteAgent(request.params.id);
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    // ========================
    //  TASKS
    // ========================

    fastify.get('/tasks', async (request, reply) => {
        const parsedQuery = parseZod(ListTasksQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const tasks = collabService.listTasks(parsedQuery.data);
        return reply.code(200).send(tasks);
    });

    fastify.post('/tasks', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const parsed = parseZod(CreateTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const task = collabService.createTask(parsed.data);
            return reply.code(201).send(task);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/tasks/:id', async (request, reply) => {
        try {
            const task = collabService.getTask(request.params.id);
            return reply.code(200).send(task);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/tasks/:id/preflight', async (request, reply) => {
        const parsedQuery = parseZod(TaskAssignmentPreflightQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        try {
            const preflight = collabService.getTaskAssignmentPreflight({
                task_id: request.params.id,
                agent_id: parsedQuery.data.agent_id,
            });
            return reply.code(200).send(preflight);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.patch('/tasks/:id', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(UpdateTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const task = collabService.updateTask({
                id,
                actor_agent_id: request.headers['x-agent-id'] || null,
                ...parsed.data,
            });
            return reply.code(200).send(task);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.delete('/tasks/:id', async (request, reply) => {
        try {
            const result = collabService.deleteTask({
                id: request.params.id,
                actor_agent_id: request.headers['x-agent-id'] || null,
            });
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/tasks/:id/assign', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(AssignTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const task = collabService.assignTask({
                task_id: id,
                agent_id: parsed.data.agent_id,
                override: parsed.data.override,
                actor_agent_id: parsed.data.agent_id,
            });
            return reply.code(200).send(task);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    // ========================
    //  FILE LOCKS
    // ========================

    fastify.get('/locks', async (_request, reply) => {
        const locks = collabService.listLocks();
        return reply.code(200).send(locks);
    });

    fastify.post('/locks', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const parsed = parseZod(AcquireLockSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const result = collabService.acquireLock(parsed.data);
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.delete('/locks/:encodedPath', async (request, reply) => {
        const filePath = decodeURIComponent(request.params.encodedPath);
        const agentId = request.headers['x-agent-id'];
        if (!agentId) return reply.code(400).send({ error: 'X-Agent-ID header required' });

        try {
            const result = collabService.releaseLock({
                file_path: filePath,
                agent_id: agentId,
            });
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/locks/check', async (request, reply) => {
        const parsedQuery = parseZod(LockCheckQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });
        const filePath = parsedQuery.data.path;

        const lock = collabService.checkLock(filePath);
        return reply.code(200).send({ locked: !!lock, lock });
    });

    // ========================
    //  PIPELINES
    // ========================

    fastify.get('/pipelines', async (request, reply) => {
        const parsedQuery = parseZod(ListPipelinesQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const pipelines = collabService.listPipelines(parsedQuery.data);
        return reply.code(200).send(pipelines);
    });

    fastify.post('/pipelines', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const parsed = parseZod(CreatePipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const result = collabService.createPipeline({
                ...parsed.data,
                actor_agent_id: request.headers['x-agent-id'] || null,
            });
            return reply.code(201).send(result.pipeline);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/pipelines/:id', async (request, reply) => {
        try {
            const pipeline = collabService.getPipeline(request.params.id);
            return reply.code(200).send(pipeline);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/pipelines/:id/advance', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(AdvancePipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const result = collabService.advancePipeline({
                id,
                result: parsed.data.result,
                actor_agent_id: request.headers['x-agent-id'] || null,
            });
            return reply.code(200).send(result.pipeline);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/pipelines/:id/fail', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(FailPipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const result = collabService.failPipeline({
                id,
                reason: parsed.data.reason,
                actor_agent_id: request.headers['x-agent-id'] || null,
            });
            return reply.code(200).send(result.pipeline);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    // ========================
    //  BUG REPORTS
    // ========================

    fastify.get('/bugs', async (request, reply) => {
        const {
            ListBugsQuerySchema,
            CreateBugReportSchema,
            UpdateBugReportSchema,
            BytecodeParseSchema
        } = await import('./collab.schemas.js');

        const parsedQuery = parseZod(ListBugsQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const bugs = collabService.listBugReports(parsedQuery.data);
        return reply.code(200).send(bugs);
    });

    fastify.post('/bugs', {
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const { CreateBugReportSchema } = await import('./collab.schemas.js');
        const parsed = parseZod(CreateBugReportSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const bug = collabService.createBugReport(parsed.data);
            return reply.code(201).send(bug);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.get('/bugs/:id', async (request, reply) => {
        try {
            const bug = collabService.getBugReport(request.params.id);
            return reply.code(200).send(bug);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.patch('/bugs/:id', async (request, reply) => {
        const { UpdateBugReportSchema } = await import('./collab.schemas.js');
        const parsed = parseZod(UpdateBugReportSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const bug = collabService.updateBugReport({
                id: request.params.id,
                ...parsed.data,
            });
            return reply.code(200).send(bug);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.delete('/bugs/:id', async (request, reply) => {
        try {
            const result = collabService.deleteBugReport(request.params.id);
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/bugs/parse', async (request, reply) => {
        const { BytecodeParseSchema } = await import('./collab.schemas.js');
        const parsed = parseZod(BytecodeParseSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const result = collabService.parseBytecode(parsed.data.bytecode);
        return reply.code(200).send(result);
    });

    fastify.post('/bugs/:id/create-task', async (request, reply) => {
        try {
            const task = collabService.createTaskFromBug(
                request.params.id,
                request.headers['x-agent-id'] || null
            );
            return reply.code(201).send(task);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/bugs/import-qa', async (request, reply) => {
        try {
            const bugs = collabService.importQaResults(
                request.body,
                request.headers['x-agent-id'] || null
            );
            return reply.code(201).send(bugs);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    // ========================
    //  ACTIVITY
    // ========================

    fastify.get('/activity', async (request, reply) => {
        const parsedQuery = parseZod(ListActivityQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const activity = collabService.listActivity(parsedQuery.data);
        return reply.code(200).send(activity);
    });

    // ========================
    //  MEMORIES
    // ========================

    fastify.get('/memories', async (request, reply) => {
        const { GetMemorySchema } = await import('./collab.schemas.js');
        const agentId = request.query.agent_id || '';
        const key = request.query.key;

        // If key provided, get single memory
        if (key) {
            const parsed = parseZod(GetMemorySchema, { agent_id: agentId, key });
            if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });
            const memory = collabService.getMemory({ agent_id: agentId || null, key });
            return reply.code(200).send(memory);
        }

        // Otherwise list all memories (optionally filtered by agent_id)
        const memories = collabService.listMemories(agentId || null);
        return reply.code(200).send(memories);
    });

    fastify.post('/memories', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const { SetMemorySchema } = await import('./collab.schemas.js');
        const parsed = parseZod(SetMemorySchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const memory = collabService.setMemory(parsed.data);
            return reply.code(200).send(memory);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.delete('/memories', async (request, reply) => {
        const agentId = request.query.agent_id || '';
        const key = request.query.key;
        if (!key) return reply.code(400).send({ error: 'key query parameter required' });

        try {
            const result = collabService.deleteMemory({ agent_id: agentId || null, key });
            return reply.code(200).send(result);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    // ========================
    //  STATUS (health check)
    // ========================

    fastify.get('/status', async (_request, reply) => {
        return reply.code(200).send(collabService.getStatus());
    });
}
