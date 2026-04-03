# Change: Passwordless Agent Connection

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-AGENT-AUTH-001`

## Date
2026-04-02

## Author
Qwen Code

---

## Summary

Removed password/authentication requirement from the agent login flow in the Collab UI. Agents can now connect directly to the collab plane without user credentials.

---

## Problem Description

### Original Implementation

The `AgentLoginModal` component required:
- Username
- Password
- CSRF token fetch
- Auth login flow
- Then agent registration

**Flow:**
```
1. Fetch CSRF token → /auth/csrf-token
2. Login user → /auth/login (username + password)
3. Register agent → /collab/agents/register
4. Send heartbeat → /collab/agents/:id/heartbeat
```

### Why This Was Wrong

1. **Wrong abstraction layer**: The collab plane is for **agent coordination**, not user authentication
2. **Unnecessary friction**: Every agent connection required valid user credentials
3. **Security theater**: Local development doesn't need user-level auth for agent registration
4. **Architectural confusion**: Mixing user auth with agent presence

### VAELRIX_LAW Reference

From `VAELRIX_LAW.md` §14.1:
> **MCP is a local process transport and does not use the browser/session login cookie**

The law already distinguishes between:
- HTTP/CLI (requires login + session cookie)
- MCP (local stdio, no auth)

The UI should follow the same pattern — agent registration is a local coordination concern, not a user auth concern.

---

## Root Cause

The original implementation conflated two separate concerns:
1. **User authentication** (who is the human operator?)
2. **Agent registration** (which AI agent is participating in collab?)

These are orthogonal:
- A single user can run multiple agents
- Agents can be registered without a specific user context
- The collab plane tracks agents, not users

---

## Thought Process

### Step 1: Identify the friction
User requested "remove password from connecting agents". This revealed the underlying design flaw.

### Step 2: Analyze the flow
Why are we authenticating users for agent registration? The collab service doesn't use user context — it only cares about agent ID, role, and capabilities.

### Step 3: Check the law
VAELRIX_LAW.md §14 distinguishes between HTTP (auth required) and MCP (no auth). The UI should match the MCP model — direct agent registration.

### Step 4: Evaluate security impact
- **Risk**: Anyone can register agents on the collab plane
- **Mitigation**: This is local development only. Production would use proper auth.
- **Benefit**: Frictionless agent onboarding

### Step 5: Implement the change
Remove username/password fields, skip auth flow, register agent directly.

---

## Changes Made

### Files Modified

| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `src/pages/Collab/AgentLoginModal.jsx` | 1-120 (simplified) | Removed auth flow, username/password fields |
| `src/pages/Collab/AgentLoginModal.jsx` | 121-200 (updated schema) | Removed `username` and `password` from Zod schema |
| `src/pages/Collab/AgentLoginModal.jsx` | 201-280 (updated form) | Removed username/password form fields |

### Code Changes

**Before:**
```javascript
const AgentLoginSchema = z.object({
    agentId: z.string().min(1, 'Agent ID is required'),
    name: z.string().min(1, 'Display name is required'),
    role: z.enum(['ui', 'backend', 'qa']),
    capabilities: z.string().optional(),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

// handleSubmit:
const csrfResponse = await fetch('/auth/csrf-token');
const csrfToken = csrfData.token;

const loginResponse = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ username, password }),
});

const registerResponse = await fetch('/collab/agents/register', {...});
```

**After:**
```javascript
const AgentLoginSchema = z.object({
    agentId: z.string().min(1, 'Agent ID is required'),
    name: z.string().min(1, 'Display name is required'),
    role: z.enum(['ui', 'backend', 'qa']),
    capabilities: z.string().optional(),
});

// handleSubmit:
const registerResponse = await fetch('/collab/agents/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, role, capabilities }),
});
```

### New Flow

```
1. Register agent → /collab/agents/register
2. Send heartbeat → /collab/agents/:id/heartbeat
```

**Reduced from 4 steps to 2 steps.**

---

## Testing

### Manual Testing

1. Open Collab page (`/collab`)
2. Navigate to "AGENTS" tab
3. Click "Log In" button on any agent card
4. Fill in:
   - Agent ID: `test-agent`
   - Name: `Test Agent`
   - Role: `backend`
   - Capabilities: (optional) `test,debug`
5. Click "Connect Agent"
6. Verify agent appears online in the agents list

### Expected Behavior

- ✓ No username/password fields shown
- ✓ Agent registers successfully
- ✓ Agent appears online immediately
- ✓ Heartbeat sent automatically
- ✓ No auth errors in console

### Build Verification

```bash
npm run build
# ✓ built in ~15s with no errors
```

---

## Lessons Learned

### 1. Separate Concerns

User authentication ≠ Agent registration. Keep them separate:
- **User auth**: Who is the human operator? (for audit logs, permissions)
- **Agent registration**: Which AI agent is participating? (for coordination)

### 2. Match Transport to Purpose

From VAELRIX_LAW.md:
- HTTP/CLI → User auth required (session cookie)
- MCP → No auth (local stdio)
- UI Agent Login → No auth (direct registration)

### 3. Friction vs. Security

For local development:
- **Friction**: Every agent connection requires credentials
- **Security benefit**: None (local only)
- **Decision**: Remove friction

For production:
- Would need proper agent auth (API keys, tokens)
- Separate from user auth
- Out of scope for this change

### 4. Law-Guided Design

When in doubt, check VAELRIX_LAW.md. The law already distinguished between HTTP and MCP auth models — the UI should follow the same pattern.

---

## Related Documents

- **VAELRIX_LAW.md** §14: Collab Login and MCP Access Protocol
- **PDR**: `docs/PDR-archive/mcp_bridge_enhancements_pdr.md` — MCP bridge enhancements
- **UI Component**: `src/pages/Collab/AgentLoginModal.jsx`
- **Backend**: `codex/server/collab/collab.routes.js` — `/collab/agents/register` endpoint

---

## Future Considerations

### Production Auth

If/when this goes to production:

1. **Agent API Keys**: Each agent gets an API key (separate from user credentials)
2. **Token-based auth**: Agents authenticate with JWT tokens
3. **Rate limiting**: Prevent agent spam
4. **Audit logging**: Track which user registered which agent

### Agent Identity

Consider adding:
- Agent public keys (for message signing)
- Agent capabilities verification
- Agent reputation/trust scores

---

**Status:** ✅ Implemented  
**Build:** ✓ Passing  
**Tested:** Manual verification complete
