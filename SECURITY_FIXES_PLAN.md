# Security Fixes Plan — 3 Targeted Fixes

**Date:** 2026-02-05
**For:** Gemini (CODEx owner)
**Scope:** `codex/server/` and `scripts/setup_database.js` only
**Goal:** Eliminate the 3 critical/high findings from SECURITY_ARCHITECTURE_V2.0 and bump the security grade from C+ toward B+.

---

## Fix 1: Password Hashing (Critical)

**Problem:** Passwords are stored and compared in plaintext. One DB leak = every account gone.

**Files to modify:**
- `codex/server/index.js` — login handler (line ~106)
- `scripts/setup_database.js` — seed user creation (line ~64)
- `codex/server/persistence.adapter.js` — add a `createUser` function for future registration

**Steps:**

1. **Install bcrypt:**
   ```bash
   npm install bcrypt
   ```

2. **Update `scripts/setup_database.js`:**
   - Import `bcrypt` at the top.
   - Replace the plaintext seed password on line 64:
   ```js
   // BEFORE
   insertUser.run(1, 'test', 'password');

   // AFTER
   import bcrypt from 'bcrypt';
   const SALT_ROUNDS = 12;
   const hashedPassword = bcrypt.hashSync('password', SALT_ROUNDS);
   insertUser.run(1, 'test', hashedPassword);
   ```
   - Note: `hashSync` is fine here because this is a one-shot setup script, not a request handler.

3. **Update `codex/server/index.js` login handler:**
   - Import `bcrypt` at the top of the file.
   - Replace the plaintext comparison on line 106:
   ```js
   // BEFORE
   if (!user || user.password !== password) {

   // AFTER
   import bcrypt from 'bcrypt';
   // ...
   if (!user) {
       // Perform a dummy hash to prevent timing-based username enumeration
       await bcrypt.hash(password, 12);
       return reply.status(401).send({ message: 'Invalid credentials' });
   }
   const valid = await bcrypt.compare(password, user.password);
   if (!valid) {
       return reply.status(401).send({ message: 'Invalid credentials' });
   }
   ```
   - Key detail: The dummy `bcrypt.hash()` on the `!user` branch prevents an attacker from distinguishing "user doesn't exist" (fast response) from "wrong password" (slow bcrypt compare). Both branches now take ~the same time.

4. **Add `createUser` to `persistence.adapter.js`** (for future registration):
   ```js
   function createUser(username, hashedPassword) {
       const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
       const result = stmt.run(username, hashedPassword);
       return { id: result.lastInsertRowid, username };
   }
   ```
   - Export it on the `persistence.users` object.
   - The caller (route handler) is responsible for hashing before calling this. The persistence layer stores what it's given — no crypto in the data layer.

5. **Delete and recreate the SQLite DB** after this change:
   ```bash
   rm scholomance_user.sqlite
   node scripts/setup_database.js
   ```
   - The old DB has a plaintext password for user `test`. It must be regenerated.

**Validation:**
- Start the server, attempt login with `test`/`password` — should succeed.
- Check the DB directly: `SELECT password FROM users WHERE username='test'` should show a `$2b$12$...` hash, not `password`.

---

## Fix 2: IDOR on Scroll Writes (Critical)

**Problem:** `saveScroll` in `persistence.adapter.js` uses `ON CONFLICT(id) DO UPDATE SET` without checking `userId`. If an authenticated user sends a POST to `/api/scrolls/:id` with another user's scroll ID, the content is silently overwritten.

**File to modify:**
- `codex/server/persistence.adapter.js` — `saveScroll` function (lines 68-87)

**Steps:**

1. **Add a `WHERE` clause to the `ON CONFLICT` update:**
   ```js
   // BEFORE (line 70-77)
   const stmt = db.prepare(`
       INSERT INTO scrolls (id, userId, title, content, createdAt, updatedAt)
       VALUES (:id, :userId, :title, :content, :createdAt, :updatedAt)
       ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       updatedAt = excluded.updatedAt
   `);

   // AFTER
   const stmt = db.prepare(`
       INSERT INTO scrolls (id, userId, title, content, createdAt, updatedAt)
       VALUES (:id, :userId, :title, :content, :createdAt, :updatedAt)
       ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       updatedAt = excluded.updatedAt
       WHERE scrolls.userId = excluded.userId
   `);
   ```

2. **Handle the silent no-op in the route handler** (`codex/server/index.js` line ~290):
   The `WHERE` clause means if someone tries to overwrite another user's scroll, the UPDATE silently does nothing and the INSERT fails (primary key conflict). The function currently calls `getScroll(scrollId, userId)` afterward which will return `undefined` since the scroll belongs to a different user. Update the route to check for this:
   ```js
   // BEFORE (line 290-293)
   fastify.post('/api/scrolls/:id', { preHandler: [requireAuth], schema: { body: scrollBodySchema } }, async (request, reply) => {
       const { id } = request.params;
       const scroll = persistence.scrolls.save(id, request.session.user.id, request.body);
       return scroll;
   });

   // AFTER
   fastify.post('/api/scrolls/:id', { preHandler: [requireAuth], schema: { body: scrollBodySchema } }, async (request, reply) => {
       const { id } = request.params;
       const scroll = persistence.scrolls.save(id, request.session.user.id, request.body);
       if (!scroll) {
           return reply.status(403).send({ message: 'Forbidden: You do not own this scroll.' });
       }
       return scroll;
   });
   ```

**Validation:**
- Create two users. User A creates a scroll. User B attempts `POST /api/scrolls/<A's scroll ID>` — should get 403.
- User A updates their own scroll — should succeed as before.
- User A creates a new scroll with a fresh ID — should succeed (INSERT path).

---

## Fix 3: Remove Hardcoded Session Secret (High)

**Problem:** Line 40 of `codex/server/index.js` has a hardcoded fallback: `process.env.SESSION_SECRET || 'a-very-secret-key-...'`. If `SESSION_SECRET` is unset (common in dev, catastrophic in prod), sessions are forgeable by anyone who reads this source code.

**File to modify:**
- `codex/server/index.js` — session registration block (lines 39-51)

**Steps:**

1. **Fail-fast if `SESSION_SECRET` is missing:**
   ```js
   // BEFORE (line 40)
   secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-should-be-at-least-32-chars-long',

   // AFTER — add this validation BEFORE the fastify.register(fastifySession, ...) block:
   if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
       console.error('FATAL: SESSION_SECRET environment variable is missing or too short (min 32 chars). Server cannot start.');
       process.exit(1);
   }

   // Then in the register call:
   secret: process.env.SESSION_SECRET,
   ```

2. **Update `.env.example`** (or create one if it doesn't exist) to document the requirement:
   ```env
   SESSION_SECRET=replace-me-with-a-random-32-char-string
   REDIS_URL=redis://localhost:6379
   ```

3. **Update the project's actual `.env`** (if it exists and is gitignored) with a real random secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output into `.env` as `SESSION_SECRET=<output>`.

**Validation:**
- Start the server WITHOUT `SESSION_SECRET` set — should crash with the fatal message.
- Start the server WITH a valid 32+ char `SESSION_SECRET` — should boot normally.

---

## Summary

| Fix | Severity | Files Changed | New Dependency |
|-----|----------|---------------|----------------|
| 1. Password hashing | Critical | `index.js`, `setup_database.js`, `persistence.adapter.js` | `bcrypt` |
| 2. IDOR ownership check | Critical | `persistence.adapter.js`, `index.js` | None |
| 3. Session secret fail-fast | High | `index.js`, `.env.example` | None |

**Order of operations:** Fix 3 first (smallest, unblocks safe dev), then Fix 1 (requires DB reset), then Fix 2 (most surgical).

**After all three:** Re-run the security review. The 2/5 overall rating should move to at least 3.5/5, and the grade from C+ to B+.
