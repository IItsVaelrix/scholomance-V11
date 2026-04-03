/**
 * Scholomance MCP Bridge
 *
 * Transmutes the collab control plane into a formal Model Context Protocol
 * server without bypassing the authoritative orchestration layer.
 */

import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as schemas from './collab.schemas.js';
import { CollabServiceError, collabService } from './collab.service.js';
import { collabDiagnostic } from './collab.diagnostic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');

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

function registerJsonResourceTemplate(server, name, uriTemplate, reader) {
    server.resource(
        name,
        new ResourceTemplate(uriTemplate, {}),
        async (uri, variables) => createResourcePayload(uri.href, await reader(variables)),
    );
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
    registerJsonResource(server, 'bugs', 'collab://bugs', () => service.listBugReports());
    registerJsonResource(server, 'status', 'collab://status', () => service.getStatus());
    registerJsonResource(server, 'memories', 'collab://memories', () => service.listMemories());

    registerJsonResourceTemplate(server, 'agent-memories', 'collab://agents/{id}/memories', async ({ id }) => {
        return service.listMemories(id);
    });

    registerJsonResourceTemplate(server, 'task-notes', 'collab://tasks/{id}/notes', async ({ id }) => {
        const task = await service.getTask(id);
        return task?.notes || [];
    });

    registerJsonResourceTemplate(server, 'bug-report', 'collab://bugs/{id}', async ({ id }) => {
        return service.getBugReport(id);
    });

    registerTool(server, 'collab_bug_report_create', {
        title: z.string().describe('Short title of the bug'),
        summary: z.string().optional().describe('Detailed summary'),
        source_type: z.enum(['human', 'runtime', 'qa', 'pipeline', 'agent']).describe('Source of the report'),
        reporter_agent_id: z.string().optional().describe('Agent ID filing the report'),
        priority: z.number().int().min(0).max(3).optional().default(1).describe('Priority (0-3)'),
        bytecode: z.string().optional().describe('PixelBrain bytecode error string'),
        repro_steps: z.array(z.string()).optional().describe('Steps to reproduce'),
        observed_behavior: z.string().optional().describe('What actually happened'),
        expected_behavior: z.string().optional().describe('What should have happened'),
    }, params => service.createBugReport(params));

    registerTool(server, 'collab_bug_report_update', {
        id: z.string().describe('Bug report ID'),
        status: z.string().optional().describe('New status (triaged, fixed, etc)'),
        priority: z.number().int().min(0).max(3).optional(),
        assigned_agent_id: z.string().optional().nullable(),
        summary: z.string().optional(),
    }, params => service.updateBugReport(params));

    registerTool(server, 'collab_bug_report_list', {
        status: z.string().optional(),
        severity: z.string().optional(),
        assigned_agent_id: z.string().optional(),
    }, params => service.listBugReports(params));

    registerTool(server, 'collab_bug_report_get', {
        id: z.string().describe('Bug report ID'),
    }, ({ id }) => service.getBugReport(id));

    registerTool(server, 'collab_bug_report_parse_bytecode', {
        bytecode: z.string().describe('Raw bytecode to parse and verify'),
    }, ({ bytecode }) => service.parseBytecode(bytecode));

    registerTool(server, 'collab_bug_report_create_task', {
        id: z.string().describe('Bug report ID to convert to task'),
        actor_agent_id: z.string().optional(),
    }, ({ id, actor_agent_id }) => service.createTaskFromBug(id, actor_agent_id));

    registerTool(server, 'collab_agent_register', {
        id: z.string().describe('Unique agent ID (e.g. merlin-cli)'),
        name: z.string().describe('Display name'),
        role: schemas.AgentRole.describe('Agent role'),
        capabilities: z.array(z.string()).optional().default([]).describe('List of agent capabilities'),
        metadata: z.record(z.string(), z.unknown()).optional().describe('Opaque agent metadata'),
    }, params => service.registerAgent(params));

    registerTool(server, 'collab_agent_heartbeat', {
        id: z.string().describe('Agent ID'),
        status: z.enum(['online', 'busy', 'offline']).optional().default('online').describe('Heartbeat status'),
        current_task_id: z.string().nullable().optional().describe('Currently active task, if any'),
    }, params => service.heartbeatAgent(params));

    registerTool(server, 'collab_agent_delete', {
        id: z.string().describe('Agent ID to remove from the control plane (terminates presence)'),
    }, ({ id }) => service.deleteAgent(id));

    registerTool(server, 'collab_task_create', {
        title: z.string().describe('Task ritual title'),
        description: z.string().optional().describe('Detailed task purpose'),
        note: z.string().optional().describe('Initial status note for the task'),
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
        note: z.string().describe('REQUIRED: Note of what was performed (Call Center Style)'),
        title: z.string().optional(),
        description: z.string().optional(),
        status: schemas.TaskStatus.optional(),
        priority: z.number().int().min(0).max(3).optional(),
        result: z.record(z.string(), z.unknown()).optional(),
    }, params => service.updateTask(params));

    registerTool(server, 'collab_task_delete', {
        id: z.string().describe('Task ID to remove from the ritual record'),
        actor_agent_id: z.string().optional().describe('Agent performing the deletion'),
    }, params => service.deleteTask(params));

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
        result: z.record(z.string(), z.unknown()).optional().default({}).describe('Stage result payload'),
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

    registerTool(server, 'collab_memory_set', {
        agent_id: z.string().min(1).nullable().optional().default(null).describe('Agent ID for specific memory, or null for global'),
        key: z.string().min(1).max(128).describe('Unique key for the memory'),
        value: z.any().describe('Value to persist (JSON-serializable)'),
    }, (params) => service.setMemory(params));

    registerTool(server, 'collab_memory_get', {
        agent_id: z.string().min(1).nullable().optional().default(null).describe('Agent ID for specific memory, or null for global'),
        key: z.string().min(1).max(128).describe('Key to retrieve'),
    }, (params) => service.getMemory(params));

    registerTool(server, 'collab_memory_delete', {
        agent_id: z.string().min(1).nullable().optional().default(null).describe('Agent ID for specific memory, or null for global'),
        key: z.string().min(1).max(128).describe('Key to delete'),
    }, (params) => service.deleteMemory(params));

    registerTool(server, 'collab_fs_list', {
        directory: z.string().optional().default('.').describe('The relative directory substrate to list (relative to project root)'),
        recursive: z.boolean().optional().default(false).describe('Whether to descend recursively into sub-archives'),
    }, async ({ directory, recursive }) => {
        const absDir = path.resolve(ROOT, directory);
        if (!absDir.startsWith(ROOT)) throw new Error('Security Breach: Out of bounds access attempt to external substrates.');
        if (!fs.existsSync(absDir)) return [];

        const results = [];
        const maxDepth = 3;

        function walk(currentPath, depth) {
            if (depth > maxDepth) return;
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                // Ignore node_modules and hidden files
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

                const fullPath = path.join(currentPath, entry.name);
                const relPath = path.relative(ROOT, fullPath);

                if (entry.isDirectory()) {
                    results.push(relPath + '/');
                    if (recursive) {
                        walk(fullPath, depth + 1);
                    }
                } else {
                    results.push(relPath);
                }
            }
        }

        try {
            walk(absDir, 0);
            return results;
        } catch (e) {
            throw new Error(`Failed to list substrate: ${e.message}`);
        }
    });

    registerTool(server, 'collab_fs_read', {
        path: z.string().describe('The relative path of the file substrate to read'),
    }, async ({ path: filePath }) => {
        const absPath = path.resolve(ROOT, filePath);
        if (!absPath.startsWith(ROOT)) throw new Error('Security Breach: Out of bounds read attempt.');
        if (!fs.existsSync(absPath)) throw new Error('Ritual Failure: File substrate does not exist at the requested path.');
        
        try {
            return fs.readFileSync(absPath, 'utf8');
        } catch (e) {
            throw new Error(`Failed to read substrate: ${e.message}`);
        }
    });

    registerTool(server, 'collab_execute_verification', {
        suite: z.enum(['e2e', 'qa', 'visual', 'stasis']).describe('The test ritual to execute'),
        task_id: z.string().optional().describe('Task ID to link this verification to'),
    }, async ({ suite, task_id }) => {
        const commandMap = {
            e2e: 'npm run test:e2e',
            qa: 'npm run test:qa',
            visual: 'npm run test:visual',
            stasis: 'npm run test:qa:stasis',
        };

        const command = commandMap[suite];
        console.error(`[MCP] Executing Verification Ritual: ${command}`);

        try {
            // Log the start of the ritual
            service.logActivity({
                agent_id: null,
                action: 'verification_started',
                target_type: 'test_suite',
                target_id: suite,
                details: { task_id, command }
            });

            const output = execSync(command, { encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
            
            service.logActivity({
                agent_id: null, // No agent context here from tool params, using service directly
                action: 'verification_completed',
                target_type: 'test_suite',
                target_id: suite,
                details: { task_id, status: 'pass' }
            });

            return {
                status: 'PASS',
                suite,
                message: `Ritual of Verification complete for ${suite}.`,
                summary: output.slice(-500) // Return last 500 chars of log
            };
        } catch (error) {
            const errorMessage = error.stderr || error.stdout || error.message;
            
            service.logActivity({
                action: 'verification_failed',
                target_type: 'test_suite',
                target_id: suite,
                details: { task_id, status: 'fail', error: errorMessage.slice(0, 200) }
            });

            return {
                status: 'FAIL',
                suite,
                message: `Ritual of Verification failed for ${suite}.`,
                error: errorMessage.slice(-500)
            };
        }
    });

    registerTool(server, 'collab_diagnostic_scan', {}, () => collabDiagnostic.scan());
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
