# Scholomance CODEx: Junior Engineer Onboarding Guide

Welcome, Initiate. This document outlines your path from Neophyte to Architect within the Scholomance V10 project. You are joining a team building a "Ritual-Themed Language IDE & MMORPG Engine."

---

## 1. Role Expectations: The "Scribe-Engineer"
As a Junior Engineer, your primary focus is **Linguistic Data Integrity** and **Modular Feature Implementation**.
- **Accuracy**: Data is our "physics." You must ensure linguistic data (phonemes, syllables) is 100% accurate.
- **Safety**: Follow the `SECURITY_ARCHITECTURE.md`. Never commit secrets; always use CSRF protection.
- **Documentation**: If it's not in a `.md` file, it doesn't exist. Update the docs as you code.
- **Iterative Growth**: You are expected to fail fast in local branches, but only merge verified, linted code.

---

## 2. Foundational Training (The "Curriculum")
Complete these readings in order before your first commit:
1.  **Project Map**: `GEMINI.md` & `README.md` (The "What" and "How").
2.  **Architecture**: `ARCH.md` (The "Why" and the current problems).
3.  **Security**: `SECURITY_ARCHITECTURE_V2.0.md` (The "Shield").
4.  **The Vision**: `docs/architecture/ARCH_DICTIONARY_MUD.md` (The "Future").

**Technical Stack Proficiency Check:**
- React 18 (Hooks, Context, Suspense).
- Fastify (Routes, Plugins, PreHandlers).
- SQLite (FTS5, JSON1 extension).
- Python 3.10+ (For dictionary data processing).

---

## 3. Initial Tasks (Phase 1: Foundation)
Your first "Ritual" is to help build the **Linguistic Bedrock**.

- **Task 1: Environment Setup**: Clone the repo, run `npm ci`, and successfully boot the server (`npm run start`) and frontend (`npm run dev`).
- **Task 2: Data Inspection**: Run `python scripts/serve_scholomance_dict.py` and query the `/api/lexicon/lookup/time` endpoint. Explain the JSON structure to your mentor.
- **Task 3: Schema Migration**: Add the `phonetics` table to `build_scholomance_dict.py` (Follow the plan in `docs/architecture/ARCH_DICTIONARY_MUD.md`).

---

## 4. Regular Check-ins & Mentorship
- **The Daily Stand-up (Async)**: Post your progress in the dev channel: *Yesterday I [Completed], Today I [Plan], Blockers [None/Issue].*
- **The Weekly Ritual (Sync)**: 30-minute 1-on-1 with your mentor to review code quality and "Arcane Taxonomy" progress.
- **Code Reviews**: All PRs require 1 approval. We use "Constructive Critique"—we don't just find bugs; we suggest better patterns.

---

## 5. Key Processes & Workflows
- **Feature Branching**: `feat/description` or `fix/description`.
- **The "Build Before Commit" Rule**:
    1. `npm run lint` (Must have 0 warnings).
    2. `npm test` (All suites must pass).
    3. `npm run build` (Verify the production bundle).
- **Dictionary Updates**: Use `scripts/build_scholomance_dict.py`. Never edit the SQLite file manually; update the script so the build is reproducible.

---

## 6. Performance Metrics (KPIs)
- **Code Quality**: Percentage of PRs that pass lint/test on the first CI run.
- **Knowledge Depth**: Ability to explain the "Phoneme Density" heuristic logic.
- **Reliability**: Successful implementation of the `phonetics` table within the first 2 weeks.
- **Collaboration**: Quality and frequency of documentation updates.

---

## 7. Knowledge Transfer & Culture
- **The "Living Document" Culture**: We treat markdown files as part of the code. If you learn something new about the system, add it to `GEMINI.md`.
- **Knowledge Share**: After completing a phase, you will give a 10-minute "Tech Talk" (or write a blog post in the internal wiki) about how that module works.
- **Language Obsession**: We aren't just coders; we are linguists. Learn the difference between a *monophthong* and a *diphthong*. It matters for our scoring engine.

---

## 8. Continuous Feedback
- **Review Points**: At 30, 60, and 90 days, we will evaluate your "Progression Level" (Neophyte -> Apprentice -> Journeyman -> Architect).
- **Direct Feedback**: We use the "Sandwich Method" for feedback: *Specific Praise -> Actionable Improvement -> Encouraging Outlook.*
