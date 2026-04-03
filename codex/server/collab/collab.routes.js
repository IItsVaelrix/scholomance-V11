import { CollabServiceError, collabService } from './collab.service.js';
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

    // ========================
    //  AGENTS
    // ========================

    fastify.post('/agents/register', async (request, reply) => {
        const parsed = parseZod(RegisterAgentSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        try {
            const agent = collabService.registerAgent(parsed.data);
            return reply.code(200).send(agent);
        } catch (error) {
            return sendServiceError(reply, error);
        }
    });

    fastify.post('/agents/:id/heartbeat', async (request, reply) => {
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

    // ========================
    //  TASKS
    // ========================

    fastify.get('/tasks', async (request, reply) => {
        const parsedQuery = parseZod(ListTasksQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const tasks = collabService.listTasks(parsedQuery.data);
        return reply.code(200).send(tasks);
    });

    fastify.post('/tasks', async (request, reply) => {
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

    fastify.post('/tasks/:id/assign', async (request, reply) => {
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

    fastify.post('/locks', async (request, reply) => {
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

    fastify.post('/pipelines', async (request, reply) => {
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
    //  ACTIVITY
    // ========================

    fastify.get('/activity', async (request, reply) => {
        const parsedQuery = parseZod(ListActivityQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const activity = collabService.listActivity(parsedQuery.data);
        return reply.code(200).send(activity);
    });

    // ========================
    //  STATUS (health check)
    // ========================

    fastify.get('/status', async (_request, reply) => {
        return reply.code(200).send(collabService.getStatus());
    });
}
