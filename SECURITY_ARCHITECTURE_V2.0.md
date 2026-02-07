# SECURITY_ARCHITECTURE_V2.0

Date: 2026-02-05
Owner: Scholomance CODEx

This document summarizes the current security posture of this codebase based on actual implementation, not intent. It supersedes the prior SECURITY_ARCHITECTURE.md.

**Scope**
Files reviewed include (not exhaustive):
- `codex/server/index.js`
- `codex/server/auth-pre-handler.js`
- `codex/server/persistence.adapter.js`
- `scripts/setup_database.js`
- `src/hooks/useScrolls.jsx`
- `src/hooks/useProgression.jsx`
- `src/lib/reference.engine.js`
- `src/lib/scholomanceDictionary.api.js`
- `src/components/shared/ErrorBoundary.jsx`
- `src/pages/Watch/WatchPage.jsx`
- `src/pages/Listen/HolographicEmbed.jsx`

---

## System Overview (Current State)
- Frontend: React + Vite.
- Backend: Fastify server in `codex/server/index.js` with session auth, rate limiting, and CSP headers.
- Persistence: SQLite (`scholomance_user.sqlite`) via `better-sqlite3`.
- Sessions: Redis session store (connect-redis) with `httpOnly`, `secure` in prod, and `SameSite=Strict` cookies.
- External APIs: Dictionary/Thesaurus proxies via server, optional Scholomance Dictionary API from client.
- Embeds: YouTube and SoundCloud iframes on Watch/Listen pages.

---

## Rating Scale
- 1 = Dog shit
- 2 = Weak
- 3 = Partial
- 4 = Standard (industry baseline)
- 5 = Nuclear grade

---

## Overall Rating
**2/5 (Weak)**
The app now has real server-side auth, validation, and rate limiting, but critical issues remain: plaintext passwords, insecure fallback secrets, and an IDOR path in scroll writes.

---

## Security Vector Ratings
| Vector | Current State (Evidence) | Rating | Gap vs Standard | Priority |
| --- | --- | --- | --- | --- |
| Authentication | Session-based auth exists with `@fastify/session` and Redis store. | 3 | No registration flow, no password hashing, no MFA. | High |
| Password Storage | Passwords stored and compared in plaintext. | 1 | Must hash with bcrypt/argon2 and use timing-safe compare. | Critical |
| Authorization (IDOR) | Scroll saves upsert by `id` without ownership check in `saveScroll`. | 1 | Must enforce ownership on write. | Critical |
| Session Security | `httpOnly`, `SameSite=Strict`, `secure` in prod. | 4 | Hardcoded fallback session secret must be removed. | High |
| CSRF | SameSite cookies reduce risk, no CSRF token. | 2 | Add CSRF for state-changing endpoints if any cross-site use is expected. | Medium |
| Input Validation | Zod schemas used for route bodies/params. | 4 | Add stricter bounds and sanitize untrusted text (especially long content). | Medium |
| SQL Injection | Parameterized SQL via `better-sqlite3` prepared statements. | 4 | Maintain current practice. | Low |
| Rate Limiting | Global + per-route limits via `@fastify/rate-limit`. | 4 | Add per-user keying and stricter limits for expensive endpoints. | Medium |
| Secrets Management | `.env` present; server uses env vars. | 3 | Hardcoded fallback secret is unsafe; avoid shipping local `.env`. | High |
| Security Headers / CSP | Helmet with CSP allowing YouTube/SoundCloud. | 4 | Tune CSP for inline styles and connect-src by environment. | Medium |
| Error Exposure | ErrorBoundary hides stack traces in prod. | 4 | Add server-side error redaction/logging pipeline. | Medium |
| Dependency Hygiene | No evidence of automated audits or SBOM. | 2 | Add `npm audit` or SCA to CI. | Medium |
| Supply Chain | No package allowlist or verification. | 2 | Add lockfile integrity checks in CI. | Medium |
| Client Data Handling | No localStorage use in app hooks for scrolls/progression anymore. | 4 | Ensure no sensitive client storage reintroduced. | Low |
| External Integrations | Server-side proxy in place, input is not URL-encoded. | 3 | Encode/normalize external API inputs. | Medium |

---

## Key Findings (Evidence-Based)
- **Plaintext passwords** are stored in SQLite and compared directly. This is a critical security flaw. `scripts/setup_database.js`, `codex/server/index.js`.
- **IDOR on scroll writes**: `saveScroll` upserts by `id` without checking ownership, enabling overwrite if an ID is guessed or leaked. `codex/server/persistence.adapter.js`.
- **Hardcoded fallback session secret** is present. If used in production, sessions are trivially forgeable. `codex/server/index.js`.
- **CSRF protection is implicit only** via SameSite cookies; no explicit CSRF tokens. `codex/server/index.js`.
- **External API input is not normalized** on the server proxy routes. `codex/server/index.js`.

---

## Recommendations (Prioritized)
1. **Fix password storage immediately**
   - Use bcrypt or argon2.
   - Replace direct string comparison with hash verification.

2. **Close the IDOR path in scroll saves**
   - Enforce ownership on write: only update when `id` belongs to `request.session.user.id`.
   - If `id` does not exist for that user, create with new server-side ID.

3. **Remove hardcoded session secret**
   - Fail startup if `SESSION_SECRET` is missing.
   - Use a 32+ byte random secret in production.

4. **Add CSRF defenses**
   - If any cross-site embedding or non-SameSite usage is expected, add CSRF tokens for state-changing endpoints.

5. **Normalize external API input**
   - `encodeURIComponent` for path or query parameters in proxy routes.

6. **Improve audit and dependency hygiene**
   - Add `npm audit` or SCA in CI.
   - Document upgrade cadence for critical packages.

---

## Quick Wins (Low Effort)
- Encode external API inputs on the server proxy routes.
- Fail-fast on missing `SESSION_SECRET`.
- Add basic audit logging for auth events and data mutations.

---

## Out of Scope Notes
- Deployment infrastructure and WAF are not implemented in repo.
- Visual fidelity and accessibility are documented elsewhere.

---

## Appendix: Known Good Practices in Current Code
- Parameterized SQL queries in SQLite adapter.
- Helmet CSP with explicit `frameSrc` for YouTube/SoundCloud.
- Rate limiting in Fastify with per-route overrides.
- ErrorBoundary hides stack traces in production.
