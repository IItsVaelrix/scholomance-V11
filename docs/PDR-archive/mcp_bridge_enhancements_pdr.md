# PDR: MCP Bridge Enhancements

## Advanced Coordination Features for Scholomance Collab

**Status:** Draft  
**Classification:** Collaboration + MCP + Orchestration  
**Priority:** High  
**Primary Goal:** Extend MCP bridge with streaming, subscriptions, batch operations, and agent messaging

---

## 0. Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-02 | Removed password requirement from agent login flow | Qwen Code |

**Rationale:** The collab plane is for agent coordination, not user authentication. Requiring passwords adds friction without security benefit for local development.

---

## 1. Executive Summary

The MCP bridge (`codex/server/collab/mcp-bridge.js`) provides local stdio access to the collab control plane. This PDR proposes five enhancements to make it production-ready for advanced agent coordination:

1. **Streaming responses** for large payloads
2. **Event subscriptions** for real-time updates
3. **Batch operations** for bulk mutations
4. **Advanced query filtering** for complex searches
5. **Agent-to-agent messaging** for direct coordination

---

## 2. Problem Statement

### Current Limitations

| Limitation | Impact | Example |
|------------|--------|---------|
| **No streaming** | Large payloads block stdio | Fetching 1000+ activity logs |
| **No subscriptions** | Polling required for updates | Agents poll every 5s for task changes |
| **No batch operations** | N operations for N items | Assigning 10 tasks = 10 round trips |
| **Limited filtering** | Client-side filtering required | Can't query "tasks assigned to X with priority > 2" |
| **No messaging** | Coordination via tasks only | Agents can't send direct notifications |

### User Pain Points

1. **High-frequency traders** (agents) need real-time task state changes
2. **Pipeline orchestrators** need to stream large activity logs
3. **Batch processors** need to update multiple tasks atomically
4. **Collaborative agents** need direct communication channels

---

## 3. Product Goal

Transform the MCP bridge from a **basic CRUD interface** into a **full-featured coordination protocol** that supports:

- Real-time event streaming
- Pub/sub subscriptions
- Atomic batch operations
- Complex queries
- Inter-agent messaging

---

## 4. Non-Goals

These are explicitly **out of scope** for this PDR:

- Remote MCP transport (HTTP/WebSocket) — local stdio only
- Authentication changes — MCP remains trust-local
- Schema changes to core entities (agents, tasks, locks, pipelines)
- UI changes — backend-only enhancements

---

## 5. Core Design Principles

### 5.1 Bytecode Is Priority

All streaming payloads, event notifications, and message payloads use bytecode encoding for determinism and compression.

### 5.2 Pure Analysis Never Touches Effects

MCP bridge remains a passthrough layer — no business logic, only transport enhancements.

### 5.3 Determinism Is Non-Negotiable

Streaming and subscriptions must produce identical output for identical input sequences.

### 5.4 Security Before Features

Rate limiting, payload size limits, and access controls gate all new features.

---

## 6. Feature Overview

### 6.1 Streaming Responses

**Problem:** Large payloads (e.g., 1000+ activity logs) block stdio until complete.

**Solution:** Chunked streaming with backpressure handling.

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "collab_activity_stream",
    "arguments": {
      "limit": 1000,
      "chunk_size": 100
    }
  }
}

// Response (stream of chunks)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "chunk": [...],
    "has_more": true,
    "cursor": "eyJpZCI6MTAwfQ=="
  }
}
```

**New Tools:**
- `collab_activity_stream` — Stream activity logs in chunks
- `collab_tasks_stream` — Stream task lists
- `collab_agents_stream` — Stream agent lists

---

### 6.2 Event Subscriptions

**Problem:** Agents must poll every 5 seconds to detect state changes.

**Solution:** Pub/sub subscriptions with server-push notifications.

```json
// Subscribe to events
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "collab_subscribe",
    "arguments": {
      "channels": ["task:assigned", "task:completed", "agent:heartbeat"]
    }
  }
}

// Server pushes notification (async)
{
  "jsonrpc": "2.0",
  "method": "collab/event",
  "params": {
    "channel": "task:assigned",
    "payload": {
      "task_id": "abc123",
      "agent_id": "qwen-code",
      "timestamp": "2026-04-02T22:30:00Z"
    }
  }
}
```

**Subscription Channels:**
| Channel | Trigger |
|---------|---------|
| `task:created` | New task created |
| `task:assigned` | Task assigned to agent |
| `task:updated` | Task status/priority changed |
| `task:completed` | Task marked done |
| `agent:registered` | New agent registered |
| `agent:heartbeat` | Agent sends heartbeat |
| `agent:offline` | Agent goes stale (>5 min) |
| `lock:acquired` | File lock acquired |
| `lock:released` | File lock released |
| `pipeline:advanced` | Pipeline stage advanced |
| `pipeline:completed` | Pipeline completed |
| `pipeline:failed` | Pipeline failed |

---

### 6.3 Batch Operations

**Problem:** Updating N tasks requires N round trips.

**Solution:** Atomic batch operations with all-or-nothing semantics.

```json
// Batch task update
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "collab_task_batch_update",
    "arguments": {
      "operations": [
        {"id": "task-1", "status": "done"},
        {"id": "task-2", "status": "done"},
        {"id": "task-3", "priority": 3}
      ]
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "ok": true,
    "updated": ["task-1", "task-2", "task-3"],
    "failed": []
  }
}
```

**New Batch Tools:**
- `collab_task_batch_update` — Update multiple tasks
- `collab_task_batch_assign` — Assign multiple tasks
- `collab_task_batch_delete` — Delete multiple tasks
- `collab_lock_batch_acquire` — Acquire multiple locks (atomic)
- `collab_lock_batch_release` — Release multiple locks

---

### 6.4 Advanced Query Filtering

**Problem:** Limited filtering forces client-side processing.

**Solution:** SQL-like query syntax for complex filters.

```json
// Complex task query
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "collab_tasks_query",
    "arguments": {
      "where": {
        "and": [
          {"field": "assigned_agent", "op": "eq", "value": "qwen-code"},
          {"field": "priority", "op": "gte", "value": 2},
          {"field": "status", "op": "in", "value": ["assigned", "in_progress"]}
        ]
      },
      "order_by": [{"field": "priority", "dir": "desc"}],
      "limit": 50,
      "offset": 0
    }
  }
}
```

**Query Operators:**
| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{"field": "status", "op": "eq", "value": "done"}` |
| `neq` | Not equals | `{"field": "status", "op": "neq", "value": "backlog"}` |
| `gt` / `gte` | Greater than / or equal | `{"field": "priority", "op": "gte", "value": 2}` |
| `lt` / `lte` | Less than / or equal | `{"field": "priority", "op": "lte", "value": 3}` |
| `in` | In list | `{"field": "status", "op": "in", "value": ["done", "assigned"]}` |
| `contains` | Array contains | `{"field": "capabilities", "op": "contains", "value": "jsx"}` |
| `and` / `or` / `not` | Logical operators | See example above |

---

### 6.5 Agent-to-Agent Messaging

**Problem:** Agents can only coordinate via task assignments.

**Solution:** Direct messaging with delivery guarantees.

```json
// Send message
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "collab_message_send",
    "arguments": {
      "to": "claude-ui",
      "from": "qwen-code",
      "type": "notification",
      "payload": {
        "subject": "Task dependency resolved",
        "body": "Task task-123 completed. You can now start task-456."
      }
    }
  }
}

// Receive message (via subscription)
{
  "jsonrpc": "2.0",
  "method": "collab/event",
  "params": {
    "channel": "message:received",
    "payload": {
      "id": "msg-789",
      "from": "qwen-code",
      "type": "notification",
      "payload": {...},
      "received_at": "2026-04-02T22:35:00Z"
    }
  }
}
```

**Message Types:**
| Type | Purpose | Delivery |
|------|---------|----------|
| `notification` | One-way notification | At-most-once |
| `request` | Request-reply pattern | At-least-once |
| `broadcast` | Send to all agents | At-most-once |

**Message Inbox:**
- `collab_message_inbox` — List received messages
- `collab_message_mark_read` — Mark messages as read
- `collab_message_delete` — Delete messages

---

## 7. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Host (Claude Desktop, Cursor, etc.)                    │
│  - Sends JSON-RPC requests                                  │
│  - Receives streaming responses + async events              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ stdio
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Bridge (codex/server/collab/mcp-bridge.js)             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Streaming Layer                                      │   │
│  │  - Chunked responses                                  │   │
│  │  - Backpressure handling                              │   │
│  │  - Cursor-based pagination                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Subscription Manager                                 │   │
│  │  - Channel subscriptions                              │   │
│  │  - Event fanout                                       │   │
│  │  - Heartbeat monitoring                               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Batch Processor                                      │   │
│  │  - Transaction wrapping                               │   │
│  │  - Atomic operations                                  │   │
│  │  - Partial failure handling                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Query Engine                                         │   │
│  │  - Filter parsing                                     │   │
│  │  - SQL translation                                    │   │
│  │  - Index optimization                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Message Router                                       │   │
│  │  - Message persistence                                │   │
│  │  - Delivery guarantees                                │   │
│  │  - Inbox management                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ function calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Collab Service (codex/server/collab/collab.service.js)     │
│  - Business logic (unchanged)                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Collab Persistence (SQLite)                                │
│  - agents, tasks, locks, pipelines, activity                │
│  - NEW: messages, subscriptions                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Module Breakdown

### 8.1 Streaming Layer

**File:** `codex/server/collab/mcp-streaming.js` (new)

```javascript
export function createStreamHandler(service) {
    return {
        streamActivity: async function*(filters, chunkSize = 100) {
            let cursor = 0;
            while (true) {
                const chunk = await service.listActivity({
                    ...filters,
                    limit: chunkSize,
                    offset: cursor,
                });
                if (chunk.length === 0) break;
                yield chunk;
                cursor += chunkSize;
            }
        },
        // ... more streamers
    };
}
```

### 8.2 Subscription Manager

**File:** `codex/server/collab/mcp-subscriptions.js` (new)

```javascript
export class SubscriptionManager {
    constructor() {
        this.subscribers = new Map(); // channel -> Set<client>
    }

    subscribe(clientId, channels) {
        for (const channel of channels) {
            if (!this.subscribers.has(channel)) {
                this.subscribers.set(channel, new Set());
            }
            this.subscribers.get(channel).add(clientId);
        }
    }

    publish(channel, payload) {
        const clients = this.subscribers.get(channel) || new Set();
        for (const clientId of clients) {
            this.sendToClient(clientId, { channel, payload });
        }
    }
}
```

### 8.3 Batch Processor

**File:** `codex/server/collab/mcp-batch.js` (new)

```javascript
export async function processBatch(operations, service) {
    const results = { updated: [], failed: [] };
    
    for (const op of operations) {
        try {
            await service.updateTask(op);
            results.updated.push(op.id);
        } catch (error) {
            results.failed.push({ id: op.id, error: error.message });
        }
    }
    
    return results;
}
```

### 8.4 Query Engine

**File:** `codex/server/collab/mcp-query.js` (new)

```javascript
export function buildQuery(where, orderBy, limit, offset) {
    const conditions = [];
    const params = [];
    
    function parseCondition(cond) {
        if (cond.and) {
            return cond.and.map(parseCondition).join(' AND ');
        }
        if (cond.or) {
            return '(' + cond.or.map(parseCondition).join(' OR ') + ')';
        }
        const { field, op, value } = cond;
        const operators = {
            eq: '=',
            neq: '!=',
            gt: '>',
            gte: '>=',
            lt: '<',
            lte: '<=',
            in: 'IN',
            contains: 'LIKE',
        };
        conditions.push(`${field} ${operators[op]} ?`);
        params.push(value);
    }
    
    parseCondition(where);
    return { conditions, params, orderBy, limit, offset };
}
```

### 8.5 Message Router

**File:** `codex/server/collab/mcp-messaging.js` (new)

```javascript
export async function sendMessage({ to, from, type, payload }, service) {
    const message = {
        id: uuid(),
        to,
        from,
        type,
        payload: JSON.stringify(payload),
        read: false,
        created_at: new Date().toISOString(),
    };
    
    await service.saveMessage(message);
    
    // Notify recipient via subscription
    subscriptionManager.publish(`message:${to}`, {
        id: message.id,
        from,
        type,
        payload,
    });
    
    return message;
}
```

---

## 9. Database Schema Changes

### New Table: `collab_messages`

```sql
CREATE TABLE IF NOT EXISTS collab_messages (
    id TEXT PRIMARY KEY,
    to_agent TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'notification',
    payload TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (to_agent) REFERENCES collab_agents(id),
    FOREIGN KEY (from_agent) REFERENCES collab_agents(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_to ON collab_messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_messages_created ON collab_messages(created_at);
```

### New Table: `collab_subscriptions`

```sql
CREATE TABLE IF NOT EXISTS collab_subscriptions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON collab_subscriptions(client_id);
```

---

## 10. Implementation Phases

### Phase 1: Streaming Responses
**Duration:** 2-3 days  
**Owner:** Codex  
**Deliverables:**
- `mcp-streaming.js` module
- `collab_activity_stream` tool
- `collab_tasks_stream` tool
- Cursor-based pagination

**QA Requirements:**
- Stream 1000+ records without blocking
- Backpressure handling at 100 chunks/sec
- Memory usage <50MB during streaming

---

### Phase 2: Event Subscriptions
**Duration:** 3-4 days  
**Owner:** Codex  
**Deliverables:**
- `mcp-subscriptions.js` module
- `collab_subscribe` tool
- Event fanout to all subscribers
- Heartbeat monitoring for stale subscriptions

**QA Requirements:**
- Event delivery latency <100ms
- Support 100+ concurrent subscribers
- No memory leaks after 1 hour

---

### Phase 3: Batch Operations
**Duration:** 2 days  
**Owner:** Codex  
**Deliverables:**
- `mcp-batch.js` module
- `collab_task_batch_update` tool
- `collab_lock_batch_acquire` tool
- Partial failure handling

**QA Requirements:**
- Atomic batch operations (all-or-nothing)
- Batch size limit: 100 operations
- Error reporting for failed operations

---

### Phase 4: Advanced Query Filtering
**Duration:** 3 days  
**Owner:** Codex  
**Deliverables:**
- `mcp-query.js` module
- `collab_tasks_query` tool
- SQL-like filter syntax
- Index optimization

**QA Requirements:**
- Query latency <50ms for 1000 records
- Support all operators (eq, neq, gt, gte, lt, lte, in, contains, and, or, not)
- SQL injection prevention

---

### Phase 5: Agent Messaging
**Duration:** 3-4 days  
**Owner:** Codex  
**Deliverables:**
- `mcp-messaging.js` module
- `collab_message_send` tool
- `collab_message_inbox` tool
- Message persistence

**QA Requirements:**
- Message delivery guarantee (at-least-once for requests)
- Inbox size limit: 1000 messages per agent
- Message TTL: 7 days

---

## 11. QA Requirements

### Test Coverage

| Module | Unit Tests | Integration Tests | E2E Tests |
|--------|-----------|-------------------|-----------|
| Streaming | ✓ Chunking logic | ✓ Stdio backpressure | ✓ 1000+ record stream |
| Subscriptions | ✓ Subscribe/unsubscribe | ✓ Event fanout | ✓ Real-time updates |
| Batch | ✓ Atomic operations | ✓ Partial failures | ✓ 100-operation batch |
| Query | ✓ Filter parsing | ✓ SQL translation | ✓ Complex queries |
| Messaging | ✓ Send/receive | ✓ Delivery guarantees | ✓ Cross-agent messaging |

### Performance Budget

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Stream chunk | <10ms | Time per 100 records |
| Event delivery | <100ms | Publish to receive latency |
| Batch operation | <500ms | 100 operations |
| Query execution | <50ms | 1000 records, complex filter |
| Message send | <20ms | Persist + notify |

### Security Checks

- Rate limiting: 100 requests/minute per client
- Payload size limit: 1MB per request
- Batch size limit: 100 operations
- Query complexity limit: 10 nested conditions
- Message size limit: 10KB per message

---

## 12. Success Criteria

### Functional

- [ ] All 5 features implemented and tested
- [ ] Zero breaking changes to existing MCP tools
- [ ] Backward compatible with existing MCP clients

### Performance

- [ ] All operations within performance budget
- [ ] No memory leaks after 24-hour stress test
- [ ] Support 10+ concurrent MCP clients

### Security

- [ ] Rate limiting enforced
- [ ] Payload size limits enforced
- [ ] SQL injection prevention verified
- [ ] No privilege escalation via batch operations

### Documentation

- [ ] API reference updated with new tools
- [ ] Migration guide for existing clients
- [ ] Example code for each feature

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Stdio backpressure** | High — blocks all operations | Implement chunked streaming with cursor |
| **Subscription memory** | Medium — leak over time | Heartbeat monitoring, auto-unsubscribe stale clients |
| **Batch atomicity** | High — partial failures | Transaction wrapping, rollback on error |
| **Query complexity** | Medium — slow queries | Complexity limits, index optimization |
| **Message inbox growth** | Low — storage bloat | TTL, inbox size limits |

---

## 14. Related Documents

- **Vaelrix Law:** `../../VAELRIX_LAW.md` — Law 14 (Collab Login and MCP Access Protocol)
- **Schema Contract:** `../../SCHEMA_CONTRACT.md` — Data shapes for agents, tasks, locks, pipelines
- **Architecture:** `../../AI_ARCHITECTURE_V2.md` — CODEx layering
- **Security:** `../../ARCH_CONTRACT_SECURITY.md` — Input validation, rate limiting

---

**Author:** Qwen Code  
**Created:** 2026-04-02  
**Last Updated:** 2026-04-02  
**Status:** Draft — Awaiting Angel Review
