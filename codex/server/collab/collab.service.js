import crypto from 'crypto';
import { collabPersistence } from './collab.persistence.js';
import {
    PIPELINE_DEFINITIONS,
    getRoleForPath,
    validateFileOwnership,
} from './collab.pipelines.js';

function uuid() {
    return crypto.randomUUID();
}

export class CollabServiceError extends Error {
    constructor(code, message, options = {}) {
        super(message);
        this.name = 'CollabServiceError';
        this.code = code;
        this.statusCode = options.statusCode ?? 500;
        this.details = options.details ?? {};
    }
}

function createError(code, message, statusCode, details = {}) {
    return new CollabServiceError(code, message, { statusCode, details });
}

function getAgentOrThrow(agentId) {
    const agent = collabPersistence.agents.getById(agentId);
    if (!agent) {
        throw createError('AGENT_NOT_FOUND', 'Agent not found', 404, { agent_id: agentId });
    }
    return agent;
}

function getTaskOrThrow(taskId) {
    const task = collabPersistence.tasks.getById(taskId);
    if (!task) {
        throw createError('TASK_NOT_FOUND', 'Task not found', 404, { task_id: taskId });
    }
    return task;
}

function getPipelineOrThrow(pipelineId) {
    const pipeline = collabPersistence.pipelines.getById(pipelineId);
    if (!pipeline) {
        throw createError('PIPELINE_NOT_FOUND', 'Pipeline not found', 404, { pipeline_id: pipelineId });
    }
    return pipeline;
}

function ensureOwnership({ filePaths, agent, override = false, hint }) {
    if (override || filePaths.length === 0) {
        return;
    }

    const validation = validateFileOwnership(filePaths, agent.role);
    if (!validation.valid) {
        throw createError('OWNERSHIP_CONFLICT', 'File ownership conflict', 409, {
            conflicts: validation.conflicts,
            ...(hint ? { hint } : {}),
        });
    }
}

function logActivity({ agent_id, action, target_type, target_id, details }) {
    collabPersistence.activity.log({
        agent_id,
        action,
        target_type,
        target_id,
        details,
    });
}

function resolveStageCandidate(stage, filePaths = []) {
    const agents = collabPersistence.agents
        .getAll()
        .filter(agent => agent.status !== 'offline');

    if (stage.role) {
        return agents.find(agent => agent.role === stage.role) ?? null;
    }

    const primaryRole = filePaths.length > 0 ? getRoleForPath(filePaths[0]) : null;
    if (!primaryRole) {
        return null;
    }

    return agents.find(agent => agent.role === primaryRole) ?? null;
}

function createPipelineStageTask({ pipelineId, pipelineLabel, stage, triggerTask }) {
    return collabPersistence.tasks.create({
        id: uuid(),
        title: `[Pipeline] ${pipelineLabel} - ${stage.name}`,
        description: stage.description,
        priority: 2,
        file_paths: triggerTask?.file_paths ?? [],
        depends_on: [],
        created_by: 'pipeline',
        pipeline_run_id: pipelineId,
    });
}

function autoAssignStageTask({ pipelineId, stage, stageTask, filePaths }) {
    const candidate = resolveStageCandidate(stage, filePaths);
    if (!candidate) {
        return {
            task: stageTask,
            assigned: false,
            reason: 'NO_CANDIDATE',
        };
    }

    try {
        const task = collabService.assignTask({
            task_id: stageTask.id,
            agent_id: candidate.id,
            override: stage.role !== null,
            actor_agent_id: candidate.id,
            activity_details: {
                auto_assigned: true,
                pipeline_run_id: pipelineId,
                stage_name: stage.name,
                override_reason: stage.role !== null ? 'pipeline_stage_role' : null,
            },
        });

        return {
            task,
            assigned: true,
            agent_id: candidate.id,
        };
    } catch (error) {
        if (
            error instanceof CollabServiceError &&
            (error.code === 'FILE_LOCK_CONFLICT' || error.code === 'OWNERSHIP_CONFLICT')
        ) {
            logActivity({
                agent_id: candidate.id,
                action: 'pipeline_auto_assignment_skipped',
                target_type: 'pipeline',
                target_id: pipelineId,
                details: {
                    stage_name: stage.name,
                    code: error.code,
                    ...error.details,
                },
            });

            return {
                task: stageTask,
                assigned: false,
                reason: error.code,
                details: error.details,
            };
        }

        throw error;
    }
}

export const collabService = {
    listAgents() {
        return collabPersistence.agents.getAll();
    },

    getAgent(id) {
        return getAgentOrThrow(id);
    },

    registerAgent(input) {
        const agent = collabPersistence.agents.register(input);
        logActivity({
            agent_id: agent.id,
            action: 'agent_registered',
            target_type: 'agent',
            target_id: agent.id,
            details: { role: agent.role },
        });
        return agent;
    },

    heartbeatAgent({ id, status, current_task_id }) {
        const agent = collabPersistence.agents.heartbeat(id, status, current_task_id);
        if (!agent) {
            throw createError('AGENT_NOT_FOUND', 'Agent not found', 404, { agent_id: id });
        }
        return agent;
    },

    listTasks({ status, agent, priority, limit, offset } = {}) {
        return collabPersistence.tasks.getAll(
            { status, agent, priority },
            { limit, offset },
        );
    },

    getTask(id) {
        return getTaskOrThrow(id);
    },

    createTask(input) {
        const task = collabPersistence.tasks.create({
            id: uuid(),
            ...input,
        });

        logActivity({
            agent_id: input.created_by,
            action: 'task_created',
            target_type: 'task',
            target_id: task.id,
            details: { title: task.title },
        });

        return task;
    },

    updateTask({ id, actor_agent_id = null, ...updates }) {
        getTaskOrThrow(id);

        const task = collabPersistence.tasks.update(id, updates);
        if (updates.status === 'done') {
            collabPersistence.locks.releaseForTask(id);
        }

        logActivity({
            agent_id: actor_agent_id,
            action: 'task_updated',
            target_type: 'task',
            target_id: id,
            details: updates,
        });

        return task;
    },

    deleteTask({ id, actor_agent_id = null }) {
        getTaskOrThrow(id);

        collabPersistence.locks.releaseForTask(id);
        collabPersistence.tasks.delete(id);

        logActivity({
            agent_id: actor_agent_id,
            action: 'task_deleted',
            target_type: 'task',
            target_id: id,
            details: {},
        });

        return { ok: true };
    },

    assignTask({
        task_id,
        agent_id,
        override = false,
        actor_agent_id = agent_id,
        activity_details = {},
    }) {
        const task = getTaskOrThrow(task_id);
        const agent = getAgentOrThrow(agent_id);

        ensureOwnership({
            filePaths: task.file_paths,
            agent,
            override,
            hint: 'Set override: true to bypass ownership checks',
        });

        const assignmentResult = collabPersistence.tasks.assignWithLocks(
            task_id,
            agent.id,
            task.file_paths,
            30,
        );

        if (assignmentResult.conflict) {
            throw createError('FILE_LOCK_CONFLICT', 'File lock conflict', 409, {
                file: assignmentResult.file,
                locked_by: assignmentResult.locked_by,
                task_id: assignmentResult.task_id,
            });
        }

        if (!assignmentResult.task) {
            throw createError('TASK_NOT_FOUND', 'Task not found', 404, { task_id });
        }

        logActivity({
            agent_id: actor_agent_id,
            action: 'task_assigned',
            target_type: 'task',
            target_id: task_id,
            details: {
                agent_id: agent.id,
                agent_name: agent.name,
                override,
                ...activity_details,
            },
        });

        return assignmentResult.task;
    },

    listLocks() {
        return collabPersistence.locks.getAll();
    },

    checkLock(path) {
        return collabPersistence.locks.check(path);
    },

    acquireLock({ file_path, agent_id, task_id, ttl_minutes, override = false }) {
        const agent = getAgentOrThrow(agent_id);
        ensureOwnership({
            filePaths: [file_path],
            agent,
            override,
        });

        if (task_id) {
            getTaskOrThrow(task_id);
        }

        const result = collabPersistence.locks.acquire({
            file_path,
            agent_id,
            task_id,
            ttl_minutes,
        });

        if (result.conflict) {
            throw createError('FILE_LOCK_CONFLICT', 'File already locked', 409, {
                locked_by: result.locked_by,
                task_id: result.task_id,
                file_path,
            });
        }

        logActivity({
            agent_id,
            action: 'lock_acquired',
            target_type: 'lock',
            target_id: file_path,
            details: { task_id: task_id ?? null, ttl_minutes },
        });

        return result;
    },

    releaseLock({ file_path, agent_id }) {
        getAgentOrThrow(agent_id);

        const released = collabPersistence.locks.release(file_path, agent_id);
        if (!released) {
            throw createError('LOCK_NOT_FOUND', 'Lock not found or not owned by you', 404, {
                file_path,
                agent_id,
            });
        }

        logActivity({
            agent_id,
            action: 'lock_released',
            target_type: 'lock',
            target_id: file_path,
            details: {},
        });

        return { ok: true };
    },

    listPipelines({ status, limit, offset } = {}) {
        return collabPersistence.pipelines.getAll({ status }, { limit, offset });
    },

    getPipeline(id) {
        return getPipelineOrThrow(id);
    },

    createPipeline({ pipeline_type, trigger_task_id, actor_agent_id = null }) {
        const definition = PIPELINE_DEFINITIONS[pipeline_type];
        if (!definition) {
            throw createError('VALIDATION_FAILED', `Unknown pipeline type: ${pipeline_type}`, 400, {
                pipeline_type,
            });
        }

        const pipelineId = uuid();
        const pipeline = collabPersistence.pipelines.create({
            id: pipelineId,
            pipeline_type,
            stages: definition.stages,
            trigger_task_id,
        });

        const triggerTask = trigger_task_id
            ? collabPersistence.tasks.getById(trigger_task_id)
            : null;
        const firstStage = definition.stages[0];
        const stageTask = createPipelineStageTask({
            pipelineId,
            pipelineLabel: definition.name,
            stage: firstStage,
            triggerTask,
        });
        const autoAssignment = autoAssignStageTask({
            pipelineId,
            stage: firstStage,
            stageTask,
            filePaths: stageTask.file_paths,
        });

        logActivity({
            agent_id: actor_agent_id,
            action: 'pipeline_started',
            target_type: 'pipeline',
            target_id: pipelineId,
            details: {
                type: pipeline_type,
                name: definition.name,
                stage_task_id: stageTask.id,
                auto_assignment: autoAssignment,
            },
        });

        return {
            pipeline,
            stage_task: autoAssignment.task,
            auto_assignment: autoAssignment,
        };
    },

    advancePipeline({ id, result = {}, actor_agent_id = null }) {
        const pipeline = getPipelineOrThrow(id);
        if (pipeline.status !== 'running') {
            return {
                pipeline,
                isComplete: pipeline.status === 'completed',
                nextStageIndex: null,
                terminal: true,
                stage_task: null,
                auto_assignment: null,
            };
        }

        const advancement = collabPersistence.pipelines.advance(id, result);
        let stageTask = null;
        let autoAssignment = null;

        if (!advancement.isComplete) {
            const nextPipeline = advancement.pipeline;
            const nextStage = nextPipeline.stages[advancement.nextStageIndex];
            const triggerTask = nextPipeline.trigger_task_id
                ? collabPersistence.tasks.getById(nextPipeline.trigger_task_id)
                : null;
            const pipelineLabel = PIPELINE_DEFINITIONS[nextPipeline.pipeline_type]?.name
                ?? nextPipeline.pipeline_type;

            stageTask = createPipelineStageTask({
                pipelineId: id,
                pipelineLabel,
                stage: nextStage,
                triggerTask,
            });
            autoAssignment = autoAssignStageTask({
                pipelineId: id,
                stage: nextStage,
                stageTask,
                filePaths: stageTask.file_paths,
            });
            stageTask = autoAssignment.task;
        }

        logActivity({
            agent_id: actor_agent_id,
            action: advancement.isComplete ? 'pipeline_completed' : 'pipeline_advanced',
            target_type: 'pipeline',
            target_id: id,
            details: {
                stage: advancement.isComplete ? 'done' : advancement.nextStageIndex,
                stage_task_id: stageTask?.id ?? null,
                auto_assignment: autoAssignment,
            },
        });

        return {
            ...advancement,
            terminal: false,
            stage_task: stageTask,
            auto_assignment: autoAssignment,
        };
    },

    failPipeline({ id, reason, actor_agent_id = null }) {
        const pipeline = getPipelineOrThrow(id);
        if (pipeline.status !== 'running') {
            return {
                pipeline,
                terminal: true,
            };
        }

        const failed = collabPersistence.pipelines.fail(id, reason);

        logActivity({
            agent_id: actor_agent_id,
            action: 'pipeline_failed',
            target_type: 'pipeline',
            target_id: id,
            details: { reason },
        });

        return {
            pipeline: failed,
            terminal: false,
        };
    },

    listActivity({ limit, offset, agent, action } = {}) {
        return collabPersistence.activity.getRecent(limit, { agent, action }, offset);
    },

    getStatus() {
        const agents = collabPersistence.agents.getAll();
        const tasks = collabPersistence.tasks.getAll();
        const pipelines = collabPersistence.pipelines.getAll({ status: 'running' });
        const locks = collabPersistence.locks.getAll();

        return {
            online_agents: agents.filter(agent => agent.status !== 'offline').length,
            total_agents: agents.length,
            active_tasks: tasks.filter(task => task.status !== 'done' && task.status !== 'backlog').length,
            total_tasks: tasks.length,
            running_pipelines: pipelines.length,
            active_locks: locks.length,
        };
    },
};
