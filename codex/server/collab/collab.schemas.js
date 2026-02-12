import { z } from 'zod';

// --- Agent Schemas ---

export const AgentRole = z.enum(['ui', 'backend', 'qa']);

export const RegisterAgentSchema = z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(128),
    role: AgentRole,
    capabilities: z.array(z.string()).default([]),
    metadata: z.record(z.unknown()).optional(),
});

export const HeartbeatSchema = z.object({
    status: z.enum(['online', 'busy', 'offline']).default('online'),
    current_task_id: z.string().nullable().optional(),
});

// --- Task Schemas ---

export const TaskStatus = z.enum([
    'backlog', 'assigned', 'in_progress', 'review', 'testing', 'done',
]);

export const CreateTaskSchema = z.object({
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    priority: z.number().int().min(0).max(3).default(1),
    file_paths: z.array(z.string()).default([]),
    depends_on: z.array(z.string()).default([]),
    created_by: z.string().default('human'),
    pipeline_run_id: z.string().optional(),
});

export const UpdateTaskSchema = z.object({
    title: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).optional(),
    status: TaskStatus.optional(),
    priority: z.number().int().min(0).max(3).optional(),
    result: z.record(z.unknown()).optional(),
});

export const AssignTaskSchema = z.object({
    agent_id: z.string().min(1),
    override: z.boolean().default(false),
});

// --- File Lock Schemas ---

export const AcquireLockSchema = z.object({
    file_path: z.string().min(1),
    agent_id: z.string().min(1),
    task_id: z.string().optional(),
    ttl_minutes: z.number().int().min(1).max(480).default(30),
});

// --- Pipeline Schemas ---

export const PipelineType = z.enum([
    'code_review_test', 'schema_change', 'bug_fix', 'ui_feature',
]);

export const CreatePipelineSchema = z.object({
    pipeline_type: PipelineType,
    trigger_task_id: z.string().optional(),
});

export const AdvancePipelineSchema = z.object({
    result: z.record(z.unknown()).default({}),
});

export const FailPipelineSchema = z.object({
    reason: z.string().min(1).max(1024),
});

// --- Query Schemas (pagination + strict list filters) ---

export const MAX_PAGE_LIMIT = 100;

export const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

export const ListTasksQuerySchema = PaginationQuerySchema.extend({
    status: TaskStatus.optional(),
    agent: z.string().min(1).max(64).optional(),
    priority: z.coerce.number().int().min(0).max(3).optional(),
});

export const PipelineRunStatus = z.enum([
    'pending', 'running', 'completed', 'failed',
]);

export const ListPipelinesQuerySchema = PaginationQuerySchema.extend({
    status: PipelineRunStatus.optional(),
});

export const ListActivityQuerySchema = PaginationQuerySchema.extend({
    agent: z.string().min(1).max(64).optional(),
    action: z.string().min(1).max(128).optional(),
});

export const LockCheckQuerySchema = z.object({
    path: z.string().min(1).max(1024),
});
