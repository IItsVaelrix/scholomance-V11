/**
 * Scholomance MCP Bridge
 *
 * Transmutes the collab control plane into a formal Model Context Protocol
 * server without bypassing the authoritative orchestration layer.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as schemas from './collab.schemas.js';
import { CollabServiceError, collabService } from './collab.service.js';

function toJsonText(value) {
    return JSON.stringify(value, null, 2);
}

function createResourcePayload(uri, value) {
    return {
        contents: [{
            uri,
            mimeType: 'application/json',
            text: toJsonText(value),
        }],
    };
}

function createToolSuccess(tool, result) {
    return {
        content: [{
            type: 'text',
            text: toJsonText({
                ok: true,
                tool,
                result,
            }),
        }],
    };
}

function createToolError(error) {
    if (error instanceof CollabServiceError) {
        return {
            content: [{
                type: 'text',
                text: toJsonText({
                    ok: false,
                    code: error.code,
                    error: error.message,
                    details: error.details,
                }),
            }],
            isError: true,
        };
    }

    return {
        content: [{
            type: 'text',
            text: toJsonText({
                ok: false,
                code: 'INTERNAL_ERROR',
                error: error instanceof Error ? error.message : 'Unknown MCP bridge error',
            }),
        }],
        isError: true,
    };
}

function registerJsonResource(server, name, uri, reader) {
    server.resource(name, uri, async () => createResourcePayload(uri, await reader()));
}

function registerTool(server, name, inputSchema, handler) {
    server.tool(name, inputSchema, async (params) => {
        try {
            return createToolSuccess(name, await handler(params));
        } catch (error) {
            return createToolError(error);
        }
    });
}

export function registerCollabMcpBridge(server, service = collabService) {
    registerJsonResource(server, 'agents', 'collab://agents', () => service.listAgents());
    registerJsonResource(server, 'tasks', 'collab://tasks', () => service.listTasks());
    registerJsonResource(server, 'locks', 'collab://locks', () => service.listLocks());
    registerJsonResource(server, 'activity', 'collab://activity', () => service.listActivity({ limit: 50 }));
    registerJsonResource(server, 'pipelines', 'collab://pipelines', () => service.listPipelines());
    registerJsonResource(server, 'status', 'collab://status', () => service.getStatus());

    registerTool(server, 'collab_agent_register', {
        id: z.string().describe('Unique agent ID (e.g. merlin-cli)'),
        name: z.string().describe('Display name'),
        role: schemas.AgentRole.describe('Agent role'),
        capabilities: z.array(z.string()).optional().default([]).describe('List of agent capabilities'),
        metadata: z.record(z.unknown()).optional().describe('Opaque agent metadata'),
    }, params => service.registerAgent(params));

    registerTool(server, 'collab_agent_heartbeat', {
        id: z.string().describe('Agent ID'),
        status: z.enum(['online', 'busy', 'offline']).optional().default('online').describe('Heartbeat status'),
        current_task_id: z.string().nullable().optional().describe('Currently active task, if any'),
    }, params => service.heartbeatAgent(params));

    registerTool(server, 'collab_task_create', {
        title: z.string().describe('Task ritual title'),
        description: z.string().optional().describe('Detailed task purpose'),
        priority: z.number().int().min(0).max(3).optional().default(1).describe('Priority level (0-3)'),
        file_paths: z.array(z.string()).optional().default([]).describe('Relevant file substrates'),
        depends_on: z.array(z.string()).optional().default([]).describe('Task dependencies'),
        created_by: z.string().optional().default('human').describe('Origin of the task'),
        pipeline_run_id: z.string().optional().describe('Owning pipeline run, if any'),
    }, params => service.createTask(params));

    registerTool(server, 'collab_task_get', {
        id: z.string().describe('Task ID'),
    }, ({ id }) => service.getTask(id));

    registerTool(server, 'collab_task_assign', {
        task_id: z.string().describe('Task ID'),
        agent_id: z.string().describe('Agent ID'),
        override: z.boolean().optional().default(false).describe('Bypass ownership checks'),
    }, params => service.assignTask(params));

    registerTool(server, 'collab_task_update', {
        id: z.string().describe('Task ID'),
        actor_agent_id: z.string().optional().describe('Agent performing the update'),
        title: z.string().optional(),
        description: z.string().optional(),
        status: schemas.TaskStatus.optional(),
        priority: z.number().int().min(0).max(3).optional(),
        result: z.record(z.unknown()).optional(),
    }, params => service.updateTask(params));

    registerTool(server, 'collab_lock_acquire', {
        file_path: z.string().describe('Path to the file substrate to lock'),
        agent_id: z.string().describe('Agent acquiring the lock'),
        task_id: z.string().optional().describe('Related task, if any'),
        ttl_minutes: z.number().int().min(1).max(480).optional().default(30).describe('Lock duration in minutes'),
    }, params => service.acquireLock(params));

    registerTool(server, 'collab_lock_release', {
        file_path: z.string().describe('Path to the file substrate to unlock'),
        agent_id: z.string().describe('Lock owner releasing the lock'),
    }, params => service.releaseLock(params));

    registerTool(server, 'collab_pipeline_create', {
        pipeline_type: schemas.PipelineType.describe('Pipeline type'),
        trigger_task_id: z.string().optional().describe('Trigger task for file context'),
        actor_agent_id: z.string().optional().describe('Agent starting the pipeline'),
    }, params => service.createPipeline(params));

    registerTool(server, 'collab_pipeline_get', {
        id: z.string().describe('Pipeline ID'),
    }, ({ id }) => service.getPipeline(id));

    registerTool(server, 'collab_pipeline_advance', {
        id: z.string().describe('Pipeline ID'),
        agent_id: z.string().optional().describe('Agent advancing the pipeline'),
        result: z.record(z.unknown()).optional().default({}).describe('Stage result payload'),
    }, ({ id, agent_id, result }) => service.advancePipeline({
        id,
        actor_agent_id: agent_id ?? null,
        result,
    }));

    registerTool(server, 'collab_pipeline_fail', {
        id: z.string().describe('Pipeline ID'),
        agent_id: z.string().optional().describe('Agent failing the pipeline'),
        reason: z.string().min(1).max(1024).describe('Failure reason'),
    }, ({ id, agent_id, reason }) => service.failPipeline({
        id,
        actor_agent_id: agent_id ?? null,
        reason,
    }));

    registerTool(server, 'collab_status_get', {}, () => service.getStatus());
}

export function createCollabMcpServer(service = collabService) {
    const server = new McpServer({
        name: 'Scholomance Collab',
        version: '1.2.0',
    });

    registerCollabMcpBridge(server, service);
    return server;
}

export async function main() {
    const server = createCollabMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Scholomance Collab MCP Bridge initialized over stdio.');
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    main().catch((error) => {
        console.error('MCP Bridge failed to ignite:', error);
        process.exit(1);
    });
}
