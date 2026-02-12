import crypto from 'crypto';
import { collabPersistence } from './collab.persistence.js';
import {
    PIPELINE_DEFINITIONS,
    validateFileOwnership,
    getRoleForPath,
} from './collab.pipelines.js';
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

function uuid() {
    return crypto.randomUUID();
}

function parseZod(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return { ok: false, errors };
    }
    return { ok: true, data: result.data };
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

        const agent = collabPersistence.agents.register(parsed.data);
        collabPersistence.activity.log({
            agent_id: agent.id,
            action: 'agent_registered',
            target_type: 'agent',
            target_id: agent.id,
            details: { role: agent.role },
        });
        return reply.code(200).send(agent);
    });

    fastify.post('/agents/:id/heartbeat', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(HeartbeatSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const agent = collabPersistence.agents.heartbeat(id, parsed.data.status, parsed.data.current_task_id);
        if (!agent) return reply.code(404).send({ error: 'Agent not found' });
        return reply.code(200).send(agent);
    });

    fastify.get('/agents', async (_request, reply) => {
        const agents = collabPersistence.agents.getAll();
        return reply.code(200).send(agents);
    });

    fastify.get('/agents/:id', async (request, reply) => {
        const agent = collabPersistence.agents.getById(request.params.id);
        if (!agent) return reply.code(404).send({ error: 'Agent not found' });
        return reply.code(200).send(agent);
    });

    // ========================
    //  TASKS
    // ========================

    fastify.get('/tasks', async (request, reply) => {
        const parsedQuery = parseZod(ListTasksQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const { status, agent, priority, limit, offset } = parsedQuery.data;
        const filters = {
            status,
            agent,
            priority,
        };
        const tasks = collabPersistence.tasks.getAll(filters, { limit, offset });
        return reply.code(200).send(tasks);
    });

    fastify.post('/tasks', async (request, reply) => {
        const parsed = parseZod(CreateTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const task = collabPersistence.tasks.create({ id: uuid(), ...parsed.data });
        collabPersistence.activity.log({
            agent_id: parsed.data.created_by,
            action: 'task_created',
            target_type: 'task',
            target_id: task.id,
            details: { title: task.title },
        });
        return reply.code(201).send(task);
    });

    fastify.get('/tasks/:id', async (request, reply) => {
        const task = collabPersistence.tasks.getById(request.params.id);
        if (!task) return reply.code(404).send({ error: 'Task not found' });
        return reply.code(200).send(task);
    });

    fastify.patch('/tasks/:id', async (request, reply) => {
        const { id } = request.params;
        const existing = collabPersistence.tasks.getById(id);
        if (!existing) return reply.code(404).send({ error: 'Task not found' });

        const parsed = parseZod(UpdateTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const task = collabPersistence.tasks.update(id, parsed.data);

        // Release file locks when task is done
        if (parsed.data.status === 'done') {
            collabPersistence.locks.releaseForTask(id);
        }

        collabPersistence.activity.log({
            agent_id: request.headers['x-agent-id'] || null,
            action: 'task_updated',
            target_type: 'task',
            target_id: id,
            details: parsed.data,
        });
        return reply.code(200).send(task);
    });

    fastify.delete('/tasks/:id', async (request, reply) => {
        const { id } = request.params;
        collabPersistence.locks.releaseForTask(id);
        const deleted = collabPersistence.tasks.delete(id);
        if (!deleted) return reply.code(404).send({ error: 'Task not found' });

        collabPersistence.activity.log({
            agent_id: request.headers['x-agent-id'] || null,
            action: 'task_deleted',
            target_type: 'task',
            target_id: id,
        });
        return reply.code(200).send({ ok: true });
    });

    fastify.post('/tasks/:id/assign', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(AssignTaskSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const task = collabPersistence.tasks.getById(id);
        if (!task) return reply.code(404).send({ error: 'Task not found' });

        const agent = collabPersistence.agents.getById(parsed.data.agent_id);
        if (!agent) return reply.code(404).send({ error: 'Agent not found' });

        // Validate file ownership unless override is set
        if (task.file_paths.length > 0 && !parsed.data.override) {
            const validation = validateFileOwnership(task.file_paths, agent.role);
            if (!validation.valid) {
                return reply.code(409).send({
                    error: 'File ownership conflict',
                    conflicts: validation.conflicts,
                    hint: 'Set override: true to bypass ownership checks',
                });
            }
        }

        const assignmentResult = collabPersistence.tasks.assignWithLocks(
            id,
            agent.id,
            task.file_paths,
            30,
        );
        if (assignmentResult.conflict) {
            return reply.code(409).send({
                error: 'File lock conflict',
                file: assignmentResult.file,
                locked_by: assignmentResult.locked_by,
            });
        }
        if (!assignmentResult.task) {
            return reply.code(404).send({ error: 'Task not found' });
        }

        collabPersistence.activity.log({
            agent_id: agent.id,
            action: 'task_assigned',
            target_type: 'task',
            target_id: id,
            details: { agent_name: agent.name },
        });
        return reply.code(200).send(assignmentResult.task);
    });

    // ========================
    //  FILE LOCKS
    // ========================

    fastify.get('/locks', async (_request, reply) => {
        const locks = collabPersistence.locks.getAll();
        return reply.code(200).send(locks);
    });

    fastify.post('/locks', async (request, reply) => {
        const parsed = parseZod(AcquireLockSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const result = collabPersistence.locks.acquire(parsed.data);
        if (result.conflict) {
            return reply.code(409).send({
                error: 'File already locked',
                locked_by: result.locked_by,
                task_id: result.task_id,
            });
        }
        return reply.code(200).send(result);
    });

    fastify.delete('/locks/:encodedPath', async (request, reply) => {
        const filePath = decodeURIComponent(request.params.encodedPath);
        const agentId = request.headers['x-agent-id'];
        if (!agentId) return reply.code(400).send({ error: 'X-Agent-ID header required' });

        const released = collabPersistence.locks.release(filePath, agentId);
        if (!released) return reply.code(404).send({ error: 'Lock not found or not owned by you' });
        return reply.code(200).send({ ok: true });
    });

    fastify.get('/locks/check', async (request, reply) => {
        const parsedQuery = parseZod(LockCheckQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });
        const filePath = parsedQuery.data.path;

        const lock = collabPersistence.locks.check(filePath);
        return reply.code(200).send({ locked: !!lock, lock });
    });

    // ========================
    //  PIPELINES
    // ========================

    fastify.get('/pipelines', async (request, reply) => {
        const parsedQuery = parseZod(ListPipelinesQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const { status, limit, offset } = parsedQuery.data;
        const filters = { status };
        const pipelines = collabPersistence.pipelines.getAll(filters, { limit, offset });
        return reply.code(200).send(pipelines);
    });

    fastify.post('/pipelines', async (request, reply) => {
        const parsed = parseZod(CreatePipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const definition = PIPELINE_DEFINITIONS[parsed.data.pipeline_type];
        if (!definition) return reply.code(400).send({ error: `Unknown pipeline type: ${parsed.data.pipeline_type}` });

        const pipelineId = uuid();
        const pipeline = collabPersistence.pipelines.create({
            id: pipelineId,
            pipeline_type: parsed.data.pipeline_type,
            stages: definition.stages,
            trigger_task_id: parsed.data.trigger_task_id,
        });

        // Auto-create a task for the first stage
        const firstStage = definition.stages[0];
        const triggerTask = parsed.data.trigger_task_id
            ? collabPersistence.tasks.getById(parsed.data.trigger_task_id)
            : null;

        const stageTask = collabPersistence.tasks.create({
            id: uuid(),
            title: `[Pipeline] ${definition.name} - ${firstStage.name}`,
            description: firstStage.description,
            priority: 2,
            file_paths: triggerTask ? triggerTask.file_paths : [],
            depends_on: [],
            created_by: 'pipeline',
            pipeline_run_id: pipelineId,
        });

        // Auto-assign if the stage has a specific role
        if (firstStage.role) {
            const agents = collabPersistence.agents.getAll();
            const candidate = agents.find(a => a.role === firstStage.role && a.status !== 'offline');
            if (candidate) {
                collabPersistence.tasks.update(stageTask.id, {
                    assigned_agent: candidate.id,
                    status: 'assigned',
                });
            }
        }

        collabPersistence.activity.log({
            agent_id: request.headers['x-agent-id'] || null,
            action: 'pipeline_started',
            target_type: 'pipeline',
            target_id: pipelineId,
            details: { type: parsed.data.pipeline_type, name: definition.name },
        });

        return reply.code(201).send(pipeline);
    });

    fastify.get('/pipelines/:id', async (request, reply) => {
        const pipeline = collabPersistence.pipelines.getById(request.params.id);
        if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
        return reply.code(200).send(pipeline);
    });

    fastify.post('/pipelines/:id/advance', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(AdvancePipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const result = collabPersistence.pipelines.advance(id, parsed.data.result);
        if (!result) return reply.code(404).send({ error: 'Pipeline not found' });

        // If there's a next stage, auto-create a task for it
        if (!result.isComplete) {
            const pipeline = result.pipeline;
            const nextStageDef = pipeline.stages[result.nextStageIndex];
            const triggerTask = pipeline.trigger_task_id
                ? collabPersistence.tasks.getById(pipeline.trigger_task_id)
                : null;

            const stageTask = collabPersistence.tasks.create({
                id: uuid(),
                title: `[Pipeline] ${pipeline.pipeline_type} - ${nextStageDef.name}`,
                description: nextStageDef.description,
                priority: 2,
                file_paths: triggerTask ? triggerTask.file_paths : [],
                depends_on: [],
                created_by: 'pipeline',
                pipeline_run_id: id,
            });

            // Auto-assign based on role
            if (nextStageDef.role) {
                const agents = collabPersistence.agents.getAll();
                const candidate = agents.find(a => a.role === nextStageDef.role && a.status !== 'offline');
                if (candidate) {
                    collabPersistence.tasks.update(stageTask.id, {
                        assigned_agent: candidate.id,
                        status: 'assigned',
                    });
                }
            } else if (triggerTask && triggerTask.file_paths.length > 0) {
                // For role=null stages, try to auto-assign by file ownership
                const primaryRole = getRoleForPath(triggerTask.file_paths[0]);
                if (primaryRole) {
                    const agents = collabPersistence.agents.getAll();
                    const candidate = agents.find(a => a.role === primaryRole && a.status !== 'offline');
                    if (candidate) {
                        collabPersistence.tasks.update(stageTask.id, {
                            assigned_agent: candidate.id,
                            status: 'assigned',
                        });
                    }
                }
            }
        }

        collabPersistence.activity.log({
            agent_id: request.headers['x-agent-id'] || null,
            action: result.isComplete ? 'pipeline_completed' : 'pipeline_advanced',
            target_type: 'pipeline',
            target_id: id,
            details: { stage: result.isComplete ? 'done' : result.nextStageIndex },
        });

        return reply.code(200).send(result.pipeline);
    });

    fastify.post('/pipelines/:id/fail', async (request, reply) => {
        const { id } = request.params;
        const parsed = parseZod(FailPipelineSchema, request.body);
        if (!parsed.ok) return reply.code(400).send({ error: 'Validation failed', details: parsed.errors });

        const pipeline = collabPersistence.pipelines.fail(id, parsed.data.reason);
        if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });

        collabPersistence.activity.log({
            agent_id: request.headers['x-agent-id'] || null,
            action: 'pipeline_failed',
            target_type: 'pipeline',
            target_id: id,
            details: { reason: parsed.data.reason },
        });

        return reply.code(200).send(pipeline);
    });

    // ========================
    //  ACTIVITY
    // ========================

    fastify.get('/activity', async (request, reply) => {
        const parsedQuery = parseZod(ListActivityQuerySchema, request.query);
        if (!parsedQuery.ok) return reply.code(400).send({ error: 'Validation failed', details: parsedQuery.errors });

        const { limit, offset, agent, action } = parsedQuery.data;
        const filters = {
            agent,
            action,
        };
        const activity = collabPersistence.activity.getRecent(limit, filters, offset);
        return reply.code(200).send(activity);
    });

    // ========================
    //  STATUS (health check)
    // ========================

    fastify.get('/status', async (_request, reply) => {
        const agents = collabPersistence.agents.getAll();
        const tasks = collabPersistence.tasks.getAll();
        const pipelines = collabPersistence.pipelines.getAll({ status: 'running' });

        return reply.code(200).send({
            online_agents: agents.filter(a => a.status !== 'offline').length,
            total_agents: agents.length,
            active_tasks: tasks.filter(t => t.status !== 'done' && t.status !== 'backlog').length,
            total_tasks: tasks.length,
            running_pipelines: pipelines.length,
        });
    });
}
