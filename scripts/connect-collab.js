#!/usr/bin/env node
/**
 * Connect to collab server with authentication.
 * 
 * Usage:
 *   node scripts/connect-collab.js --agent-id qwen-coder --name "Qwen Coder" --role ui
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const COLLAB_BASE = process.env.COLLAB_URL || 'http://localhost:3000/collab';

// Simple cookie jar
let _sessionCookie = null;

async function apiFetch(path, options = {}, useCollabBase = false) {
    const base = useCollabBase ? COLLAB_BASE : API_BASE;
    const url = `${base}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    // Attach session cookie if available
    if (_sessionCookie) {
        headers['Cookie'] = _sessionCookie;
    }
    
    const res = await fetch(url, {
        ...options,
        headers,
    });
    
    // Capture session cookie from response
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        const match = setCookie.match(/connect\.sid=([^;]+)/);
        if (match) {
            _sessionCookie = `connect.sid=${match[1]}`;
        }
    }
    
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.message || data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

async function getCsrfToken() {
    const data = await apiFetch('/auth/csrf-token');
    return data.token;
}

async function login(username, password) {
    const csrfToken = await getCsrfToken();
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        headers: {
            'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
    });
    return data;
}

async function registerAgent(agentId, name, role, capabilities = []) {
    const data = await apiFetch('/agents/register', {
        method: 'POST',
        body: JSON.stringify({ id: agentId, name, role, capabilities }),
    }, true);
    return data;
}

async function getCollabStatus() {
    const data = await apiFetch('/status', {}, true);
    return data;
}

async function getAgents() {
    const data = await apiFetch('/agents', {}, true);
    return data;
}

async function getTasks(filters = {}) {
    const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)),
    ).toString();
    const data = await apiFetch(`/tasks${params ? `?${params}` : ''}`, {}, true);
    return data;
}

// Parse command line args
function parseArgs(args) {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            result[key] = value;
            if (value !== true) i++;
        }
    }
    return result;
}

// Main
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
        console.log(`
Collab Connection Client

Usage: node scripts/connect-collab.js <command> [options]

Commands:
  connect   - Login and register an agent
  status    - Get collab server status
  agents    - List all registered agents
  tasks     - List tasks
  
Options for 'connect':
  --agent-id <id>       Agent identifier (required)
  --name <name>         Display name (defaults to agent-id)
  --role <role>         Agent role: ui, backend, qa, docs (default: ui)
  --capabilities <caps> Comma-separated list of capabilities
  --username <user>     Username for login (default: test)
  --password <pass>     Password for login (default: password)

Examples:
  node scripts/connect-collab.js connect --agent-id qwen-coder --name "Qwen Coder" --role ui
  node scripts/connect-collab.js status
  node scripts/connect-collab.js agents
`);
        process.exit(0);
    }
    
    try {
        switch (command) {
            case 'connect': {
                const opts = parseArgs(args.slice(1));
                const agentId = opts['agent-id'] || process.env.AGENT_ID;
                if (!agentId) {
                    console.error('Error: --agent-id is required');
                    process.exit(1);
                }
                
                const username = opts.username || 'test';
                const password = opts.password || 'password';
                const name = opts.name || agentId;
                const role = opts.role || 'ui';
                const capabilities = opts.capabilities 
                    ? opts.capabilities.split(',').filter(Boolean) 
                    : ['jsx', 'css', 'analysis'];
                
                console.log(`Logging in as "${username}"...`);
                const loginResult = await login(username, password);
                console.log('✓ Login successful');
                
                console.log(`Registering agent "${name}" (${agentId})...`);
                const agent = await registerAgent(agentId, name, role, capabilities);
                console.log('✓ Agent registered');
                console.log('\nAgent details:');
                console.log(JSON.stringify(agent, null, 2));
                break;
            }
            
            case 'status': {
                console.log('Getting collab status...\n');
                const status = await getCollabStatus();
                console.log(JSON.stringify(status, null, 2));
                break;
            }
            
            case 'agents': {
                console.log('Registered agents:\n');
                const agents = await getAgents();
                console.log(JSON.stringify(agents, null, 2));
                break;
            }
            
            case 'tasks': {
                const opts = parseArgs(args.slice(1));
                const statusFilter = opts.status;
                console.log('Tasks:\n');
                const tasks = await getTasks(statusFilter ? { status: statusFilter } : {});
                console.log(JSON.stringify(tasks, null, 2));
                break;
            }
            
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        if (err.data) {
            console.error(JSON.stringify(err.data, null, 2));
        }
        process.exit(1);
    }
}

main();
