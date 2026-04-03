# Scholomance MCP VS Code Integration Guide

## 📡 Canonical Configuration
To connect VS Code AI extensions (like **Roo Code**, **Cline**, or **Claude Desktop**) to the Scholomance Collab Control Plane, use the following configuration snippet:

```json
{
  "mcpServers": {
    "scholomance-collab": {
      "command": "node",
      "args": [
        "--env-file=/home/deck/Downloads/scholomance-V11/.env",
        "/home/deck/Downloads/scholomance-V11/codex/server/collab/mcp-bridge.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 🛠️ VS Code Quick Access
I have created a `.vscode/tasks.json` in this workspace. You can now:
1. Press `Ctrl+Shift+P`
2. Select **Tasks: Run Task**
3. Select **Scholomance: Start Collab MCP Bridge**

This will spin up the stdio bridge so your AI extension can communicate with the project's living laws.

## ✅ Verification
Once connected, your VS Code AI agent should be able to:
- **Register itself** using `collab_agent_register`
- **Track work** using `collab_task_create`
- **Acquire locks** on files using `collab_lock_acquire`

## 🔗 Collab Rituals
Current Integration Task: `8e7a5627-52f0-4514-875e-f7f4de918b64`
Status: **IN_PROGRESS**
