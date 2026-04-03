# PDR: Postfix Integration
## Self-Hosted Mail Delivery Substrate

**Status:** Draft
**Classification:** Infrastructure | Security | Communications
**Priority:** High
**Primary Goal:** Enable robust, self-hosted transactional email delivery via local or remote Postfix MTA.

---

# 1. Executive Summary
This PDR defines the formal integration path for Postfix as a primary mail delivery agent for Scholomance. While the system currently supports generic SMTP, this integration formalizes the "Postfix" provider alias and provides specialized handling for local Unix socket delivery and typical Postfix-specific security constraints.

# 2. Problem Statement
Currently, users must use the generic `smtp` provider for Postfix. This requires detailed manual configuration of ports, TLS, and auth, which can be error-prone. There is no explicit documentation or implementation logic for connecting to a local Postfix instance via Unix sockets or optimized loopback delivery.

# 3. Product Goal
- Provide a first-class `postfix` provider alias in `MAIL_PROVIDER`.
- Support local Unix socket delivery (`/var/spool/postfix/public/pickup` or similar) to bypass SMTP network overhead where applicable.
- Formalize Postfix-specific configuration defaults (e.g., standard TLS settings for self-signed certificates).

# 4. Non-Goals
- Installing or configuring the Postfix service on the host OS (outside application scope).
- Handling incoming mail or IMAP/POP3 (delivery only).

# 5. Core Design Principles
- **Resilience:** Leverage the existing `email_outbox` for queueing.
- **Simplicity:** Provide a "zero-config" path for local Postfix instances.
- **Security:** Default to opportunistic TLS but allow strict enforcement.

# 6. Feature Overview
- New `postfix` adapter in `MailerService`.
- Enhanced environment variable mapping for `POSTFIX_*` keys.
- Integration documentation for Postfix `main.cf` hardening.

# 7. Architecture
The `PostfixMailerAdapter` will extend `MailerAdapter`. It will internally utilize `SmtpMailerAdapter` for network delivery but will add logic for local pipe delivery if configured.

# 8. Module Breakdown
- `codex/server/services/mailer.service.js`: Register `postfix` provider.
- `codex/server/services/postfix.client.js`: (Optional) Specialized local delivery logic.
- `.env.example`: Add Postfix configuration templates.

# 9. ByteCode IR Design
N/A. This is a transport-layer implementation.

# 10. Implementation Phases
- **Phase 1:** Add `postfix` alias to `MailerService` pointing to `SmtpMailerAdapter` with optimized defaults.
- **Phase 2:** Update documentation and `.env.example`.
- **Phase 3:** (Stretch) Implement direct local spool delivery.

# 11. QA Requirements
- Verification that `MAIL_PROVIDER=postfix` correctly maps to SMTP delivery.
- Unit tests for Postfix configuration parsing.
- Integration test with a mock SMTP server simulating Postfix response banners.

# 12. Success Criteria
- Successful mail delivery using `MAIL_PROVIDER=postfix`.
- Clear, reproducible documentation for connecting Scholomance to a standard Postfix instance.
