#!/usr/bin/env node
/**
 * Lightweight collaboration client for AI agent sessions.
 *
 * Usage as CLI:
 *   AGENT_ID=claude-opus node scripts/collab-client.js register --name "Claude (Opus)" --role ui --capabilities jsx,css
 *   AGENT_ID=claude-opus node scripts/collab-client.js heartbeat --status busy
 *   AGENT_ID=claude-opus node scripts/collab-client.js tasks
 *   AGENT_ID=claude-opus node scripts/collab-client.js claim <task-id>
 *   AGENT_ID=claude-opus node scripts/collab-client.js complete <task-id>
 *   node scripts/collab-client.js status
 *
 * Usage as module:
 *   import { createCollabClient } from './scripts/collab-client.js';
 *   const client = createCollabClient('claude-opus');
 *   await client.register('Claude (Opus)', 'ui', ['jsx', 'css']);
 */

const BASE_URL = process.env.COLLAB_URL || 'http://localhost:3000/collab';

async function collabFetch(path, agentId, options = {}) {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(agentId ? { 'X-Agent-ID': agentId } : {}),
            ...options.headers,
        },
    });
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export function createCollabClient(agentId) {
    return {
        register: (name, role, capabilities = []) =>
            collabFetch('/agents/register', agentId, {
                method: 'POST',
                body: JSON.stringify({ id: agentId, name, role, capabilities }),
            }),

        heartbeat: (status = 'online', currentTaskId = null) =>
            collabFetch(`/agents/${agentId}/heartbeat`, agentId, {
                method: 'POST',
                body: JSON.stringify({ status, current_task_id: currentTaskId }),
            }),

        getAgents: () => collabFetch('/agents', agentId),

        getTasks: (filters = {}) => {
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)),
            ).toString();
            return collabFetch(`/tasks${params ? `?${params}` : ''}`, agentId);
        },

        createTask: (title, options = {}) =>
            collabFetch('/tasks', agentId, {
                method: 'POST',
                body: JSON.stringify({ title, created_by: agentId, ...options }),
            }),

        claimTask: (taskId, override = false) =>
            collabFetch(`/tasks/${taskId}/assign`, agentId, {
                method: 'POST',
                body: JSON.stringify({ agent_id: agentId, override }),
            }),

        updateTask: (taskId, updates) =>
            collabFetch(`/tasks/${taskId}`, agentId, {
                method: 'PATCH',
                body: JSON.stringify(updates),
            }),

        completeTask: (taskId, result = {}) =>
            collabFetch(`/tasks/${taskId}`, agentId, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'done', result }),
            }),

        startPipeline: (pipelineType, triggerTaskId = null) =>
            collabFetch('/pipelines', agentId, {
                method: 'POST',
                body: JSON.stringify({ pipeline_type: pipelineType, trigger_task_id: triggerTaskId }),
            }),

        advancePipeline: (pipelineId, result = {}) =>
            collabFetch(`/pipelines/${pipelineId}/advance`, agentId, {
                method: 'POST',
                body: JSON.stringify({ result }),
            }),

        getPipelines: () => collabFetch('/pipelines', agentId),

        getActivity: (limit = 50) => collabFetch(`/activity?limit=${limit}`, agentId),

        getStatus: () => collabFetch('/status', agentId),

        acquireLock: (filePath, taskId = null, ttlMinutes = 30) =>
            collabFetch('/locks', agentId, {
                method: 'POST',
                body: JSON.stringify({ file_path: filePath, agent_id: agentId, task_id: taskId, ttl_minutes: ttlMinutes }),
            }),

        releaseLock: (filePath) =>
            collabFetch(`/locks/${encodeURIComponent(filePath)}`, agentId, {
                method: 'DELETE',
            }),

        getLocks: () => collabFetch('/locks', agentId),
    };
}

// --- CLI Mode ---
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const agentId = process.env.AGENT_ID;

    if (!command) {
        console.log('Usage: AGENT_ID=<id> node collab-client.js <command> [options]');
        console.log('Commands: register, heartbeat, tasks, claim, complete, status, agents, pipelines, activity');
        process.exit(0);
    }

    const client = createCollabClient(agentId);

    try {
        switch (command) {
            case 'register': {
                const name = getFlag(args, '--name') || agentId;
                const role = getFlag(args, '--role') || 'backend';
                const caps = (getFlag(args, '--capabilities') || '').split(',').filter(Boolean);
                const result = await client.register(name, role, caps);
                console.log('Registered:', JSON.stringify(result, null, 2));
                break;
            }
            case 'heartbeat': {
                const status = getFlag(args, '--status') || 'online';
                const result = await client.heartbeat(status);
                console.log('Heartbeat:', JSON.stringify(result, null, 2));
                break;
            }
            case 'tasks': {
                const status = getFlag(args, '--status');
                const result = await client.getTasks(status ? { status } : {});
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            case 'claim': {
                const taskId = args[1];
                if (!taskId) { console.error('Task ID required'); process.exit(1); }
                const result = await client.claimTask(taskId);
                console.log('Claimed:', JSON.stringify(result, null, 2));
                break;
            }
            case 'complete': {
                const taskId = args[1];
                if (!taskId) { console.error('Task ID required'); process.exit(1); }
                const result = await client.completeTask(taskId);
                console.log('Completed:', JSON.stringify(result, null, 2));
                break;
            }
            case 'status': {
                const result = await client.getStatus();
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            case 'agents': {
                const result = await client.getAgents();
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            case 'pipelines': {
                const result = await client.getPipelines();
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            case 'activity': {
                const limit = getFlag(args, '--limit') || '20';
                const result = await client.getActivity(Number(limit));
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        if (err.data) console.error(JSON.stringify(err.data, null, 2));
        process.exit(1);
    }
}

function getFlag(args, flag) {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return null;
    return args[idx + 1];
}

// Run CLI if executed directly
const isMainModule = process.argv[1] && (
    process.argv[1].endsWith('collab-client.js') ||
    process.argv[1].endsWith('collab-client')
);
if (isMainModule) {
    main();
}
