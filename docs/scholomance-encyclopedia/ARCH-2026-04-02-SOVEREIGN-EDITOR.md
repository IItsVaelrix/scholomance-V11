# ARCH-2026-04-02-SOVEREIGN-EDITOR

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-003`

## Architecture: Sovereign Editor Principle

**Status:** Implemented (Foundational Principle)
**Classification:** Architectural + Privacy + Data Sovereignty
**Priority:** Critical
**Location:** `SHARED_PREAMBLE.md` Section 4

---

## Summary

**User work never leaves the browser without explicit consent.**

This is not a feature. This is not a policy. This is **architectural law** — enforced by code, not promises.

The Sovereign Editor Principle ensures that:
- Unsaved work exists only in browser memory (React state)
- No auto-save to cloud without user action
- No telemetry scans user content
- No admin panel can view drafts
- Server only receives explicitly saved scrolls

**This is privacy by architecture, not policy.**

---

## Problem Statement

### Industry Standard (2026)

Most platforms operate on a "trust us" model:

| Platform | Privacy Model | Reality |
|----------|--------------|---------|
| Google Docs | "We respect your privacy" | Scans all content, shares with law enforcement, trains AI |
| Notion | "Your data is yours" | Company can access, AI scans for features |
| GitHub Copilot | "Enterprise-safe" | Scans code for AI training |
| VS Code | "Local editor" | Telemetry, Copilot integration, cloud sync |
| Figma | "Design privacy" | Adobe can access designs |

**All enforceable only through lawsuits, not code.**

### The Scholomance Alternative

```
User's Browser (Sovereign Territory)
├── ScrollEditor Content (unsaved)
│   ├── React state only
│   ├── Never auto-saved
│   ├── Never telemetry-scanned
│   └── Never sent to server
│
├── User clicks "Save Scroll" (explicit consent)
│   └── POST /api/scrolls (data leaves browser)
│
└── Server (only receives explicit saves)
```

**Enforceable through code inspection.**

---

## Architectural Enforcement

### What This Required

| Component | Design Decision |
|-----------|-----------------|
| **State Management** | Client-side React `useState`, no server-synced stores for drafts |
| **Persistence** | Explicit "Save Scroll" button, no auto-save |
| **Backend API** | Only receives `POST /api/scrolls` on user action |
| **Database** | Only stores explicitly saved scrolls, no drafts table |
| **Analytics** | None that capture scroll content |
| **Telemetry** | None exists |
| **Admin Tools** | No admin panel to view user drafts |

### Code Verification

Any agent can verify this principle by reading:

```javascript
// src/pages/Read/ScrollEditor.jsx
const [content, setContent] = useState(initialContent);
// ↑ Exists ONLY in browser memory

// onSave handler (only sends on explicit user action)
const handleSave = useCallback(async () => {
  if (!content.trim()) return;
  setIsSaving(true);
  try {
    await onSave?.(title, content);  // ← Only here does data leave browser
  } finally {
    setIsSaving(false);
  }
}, [content, title, onSave]);
```

**No auto-save interval. No background sync. No telemetry.**

---

## Threat Model

| Threat | Scholomance Defense |
|--------|---------------------|
| **Server breach** | Only saved scrolls exposed, not drafts |
| **Admin access** | No admin panel exists |
| **Law enforcement subpoena** | Nothing to subpoena for unsaved work |
| **Employee curiosity** | No database query can retrieve drafts |
| **Analytics leak** | No analytics capture content |
| **AI training scan** | No AI scans user content |
| **Third-party integration** | No integrations have access |

**Security through absence.** You can't leak what you don't have.

---

## User Tradeoffs

### What Users Gain

| Benefit | Description |
|---------|-------------|
| ✅ True privacy | Architecturally enforced, not policy-promised |
| ✅ Full control | User decides what persists, when, how |
| ✅ No surveillance | No scanning for AI, ads, or engagement |
| ✅ No backdoor | Not even the developer can access drafts |

### What Users Accept

| Tradeoff | Description |
|----------|-------------|
| ⚠️ Ephemeral unsaved work | Closing tab without save = gone forever |
| ⚠️ No cross-device sync | Work lives on one device only |
| ⚠️ No auto-recovery | User is responsible for saving |
| ⚠️ No cloud backup | If device fails, unsaved work is lost |

**This is a conscious design choice.** Sovereignty over convenience.

---

## Related Movements

The Sovereign Editor Principle aligns with:

| Movement | Example | Connection |
|----------|---------|------------|
| **Local-first software** | Inc & Dec, Figma local mode | Data lives on user's device |
| **End-to-end encryption** | Signal, ProtonMail | Only endpoints can decrypt |
| **Self-sovereign identity** | SSI, verifiable credentials | User controls their data |
| **Data minimalism** | Privacy-focused tools | Collect only what's necessary |
| **Right to offline** | No mandatory cloud sync | User controls connectivity |

---

## Implementation Checklist

All agents must verify before implementing any feature:

- [ ] No auto-save to server without explicit user action
- [ ] No telemetry/analytics capture scroll content
- [ ] No admin panel to view user drafts
- [ ] No cloud sync without user consent
- [ ] React state is client-side only (no server-synced stores for drafts)
- [ ] Database only stores explicitly saved scrolls
- [ ] No AI scanning of user content (training or inference)

**Violation of this principle is a critical architecture bug.** Escalate immediately via `ESCALATION:` block.

---

## Why This Is Rare

### Startup Incentives

```
Investor: "How do you monetize?"
Founder: "We can't access user data, so we can't:"
  - Sell analytics
  - Train AI models
  - Target ads
  - Build engagement algorithms
  - Share with partners

Investor: "Then what's the business model?"
Founder: "..."
```

**Scholomance can do this because it's built for principles, not exit.**

### Developer Habits

```
Default assumption: "Of course we save everything to the database."

Scholomance assumption: "User's work is theirs. We only store what they explicitly send."
```

**This is privacy by default, not privacy as an afterthought.**

---

## Future Considerations

### What This Enables

| Feature | How Sovereignty Helps |
|---------|----------------------|
| **Encrypted scrolls** | End-to-end encryption for saved work |
| **Local-first sync** | Optional P2P sync (user controls keys) |
| **Export sovereignty** | User can export all data, delete account |
| **No vendor lock-in** | Data is portable, formats are open |

### What This Prevents

| Anti-Feature | Why It's Blocked |
|--------------|-----------------|
| Cloud auto-sync | Violates explicit consent principle |
| AI training on user scrolls | Violates no-scanning principle |
| Engagement algorithms | Requires content scanning |
| Targeted ads | Requires content scanning |

---

## Verification Steps

Any user can verify this principle:

1. **Open browser dev tools** → Network tab
2. **Write a scroll** (don't save)
3. **Check network requests** → No outbound requests with content
4. **Close tab** → Work is gone (no server recovery)
5. **Check server database** → No draft records exist

**This is verifiable by inspection.** Not trust.

---

## Related Encyclopedia Entries

- `BUG-2026-04-02-WHITESPACE-ALIGNMENT` - Font measurement architecture (same precision mindset)
- `ARCH-2026-04-02-FONT-ORACLE` - Font Audit Oracle PDR (measured reality over assumed capability)
- `VAELRIX_LAW.md` Law 13 - PDR Archive (documentation as architecture)

---

## Location in Documentation

- **Primary:** `SHARED_PREAMBLE.md` Section 4 — "The Sovereign Editor"
- **Law:** `VAELRIX_LAW.md` — Privacy by architecture principle
- **Implementation:** `src/pages/Read/ScrollEditor.jsx` — Client-side state

---

*Entry Status: FOUNDATIONAL | Created: 2026-04-02 | Author: Angel (IItsVaelrix)*
