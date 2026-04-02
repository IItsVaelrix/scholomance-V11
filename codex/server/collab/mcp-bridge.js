/**
 * Scholomance MCP Bridge
 * 
 * Transmutes the Collab Console orchestration layer into a formal
 * Model Context Protocol (MCP) server. This allows external agents
 * to synchronize with the swarm natively.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { collabPersistence } from "./collab.persistence.js";
import * as schemas from "./collab.schemas.js";

// --- Initialization ---

const server = new McpServer({
  name: "Scholomance Collab",
  version: "1.1.0",
});

// --- Resources (Linguistic Substrates) ---

server.resource(
  "agents",
  "collab://agents",
  async () => {
    const agents = collabPersistence.agents.getAll();
    return {
      contents: [{
        uri: "collab://agents",
        mimeType: "application/json",
        text: JSON.stringify(agents, null, 2)
      }]
    };
  }
);

server.resource(
  "tasks",
  "collab://tasks",
  async () => {
    const tasks = collabPersistence.tasks.getAll();
    return {
      contents: [{
        uri: "collab://tasks",
        mimeType: "application/json",
        text: JSON.stringify(tasks, null, 2)
      }]
    };
  }
);

server.resource(
  "locks",
  "collab://locks",
  async () => {
    const locks = collabPersistence.locks.getAll();
    return {
      contents: [{
        uri: "collab://locks",
        mimeType: "application/json",
        text: JSON.stringify(locks, null, 2)
      }]
    };
  }
);

server.resource(
  "activity",
  "collab://activity",
  async () => {
    const activity = collabPersistence.activity.getRecent(50);
    return {
      contents: [{
        uri: "collab://activity",
        mimeType: "application/json",
        text: JSON.stringify(activity, null, 2)
      }]
    };
  }
);

// --- Tools (Agent Actions) ---

server.tool(
  "collab_agent_register",
  {
    id: z.string().describe("Unique agent ID (e.g. merlin-cli)"),
    name: z.string().describe("Display name"),
    role: z.enum(["ui", "backend", "qa"]).describe("Agent role"),
    capabilities: z.array(z.string()).optional().describe("List of agent capabilities"),
  },
  async ({ id, name, role, capabilities }) => {
    const agent = collabPersistence.agents.register({
      id,
      name,
      role,
      capabilities: capabilities || [],
    });
    return {
      content: [{ type: "text", text: `Agent ${name} registered successfully.` }]
    };
  }
);

server.tool(
  "collab_lock_acquire",
  {
    file_path: z.string().describe("Path to the file substrate to lock"),
    agent_id: z.string().describe("The ID of the agent acquiring the lock"),
    ttl_minutes: z.number().optional().default(30).describe("Lock duration in minutes"),
  },
  async ({ file_path, agent_id, ttl_minutes }) => {
    const result = collabPersistence.locks.acquire({
      file_path,
      agent_id,
      ttl_minutes,
    });
    if (result.conflict) {
      return {
        content: [{ type: "text", text: `CONFLICT: File is already locked by ${result.locked_by}.` }],
        isError: true
      };
    }
    return {
      content: [{ type: "text", text: `LOCK SECURED: ${file_path} is now bound to ${agent_id}.` }]
    };
  }
);

server.tool(
  "collab_task_create",
  {
    title: z.string().describe("Task ritual title"),
    description: z.string().optional().describe("Detailed purpose of the task"),
    priority: z.number().min(0).max(3).optional().default(1).describe("Priority level (0-3)"),
    file_paths: z.array(z.string()).optional().default([]).describe("Relevant file substrates"),
    created_by: z.string().optional().default("human").describe("Origin of the task"),
  },
  async (params) => {
    const id = `task-${Date.now().toString(36)}`;
    const task = collabPersistence.tasks.create({ id, ...params });
    return {
      content: [{ type: "text", text: `TASK IGNITED: [${task.id}] ${task.title}` }]
    };
  }
);

server.tool(
  "collab_task_assign",
  {
    taskId: z.string().describe("The ID of the task packet"),
    agentId: z.string().describe("The ID of the agent to bind"),
  },
  async ({ taskId, agentId }) => {
    const task = collabPersistence.tasks.getById(taskId);
    if (!task) {
      return { content: [{ type: "text", text: "ERROR: Task not found." }], isError: true };
    }
    
    const result = collabPersistence.tasks.assignWithLocks(taskId, agentId, task.file_paths, 30);
    if (result.conflict) {
      return {
        content: [{ type: "text", text: `CONFLICT: Cannot assign. ${result.file} is locked by ${result.locked_by}.` }],
        isError: true
      };
    }
    
    return {
      content: [{ type: "text", text: `ASSIGNMENT COMPLETE: Agent ${agentId} is now working on ${taskId}.` }]
    };
  }
);

server.tool(
  "collab_task_update",
  {
    id: z.string().describe("Task ID"),
    status: z.enum(["backlog", "assigned", "in_progress", "review", "testing", "done"]).optional(),
    result: z.record(z.unknown()).optional().describe("Output of the task completion"),
  },
  async ({ id, ...updates }) => {
    const task = collabPersistence.tasks.update(id, updates);
    if (!task) {
      return { content: [{ type: "text", text: "ERROR: Task not found." }], isError: true };
    }
    
    if (updates.status === "done") {
      collabPersistence.locks.releaseForTask(id);
    }
    
    return {
      content: [{ type: "text", text: `TASK TRANSMUTED: [${id}] status updated to ${task.status}.` }]
    };
  }
);

// --- Transmutation Completion ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Scholomance Collab MCP Bridge initialized over stdio.");
}

main().catch((error) => {
  console.error("MCP Bridge failed to ignite:", error);
  process.exit(1);
});
