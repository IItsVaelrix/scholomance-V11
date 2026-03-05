# Scroll Submission XP System

This document outlines the architecture and mechanics for the Scroll Submission XP system in Scholomance V10. This system incentivizes high-quality contributions and active participation in the CODEx.

## 1. XP Tiers (Mastery Levels)

User progression is measured through Mastery Tiers. Each tier represents a deeper connection to the Scholomance.

| Tier | Level Range | Title | Perks |
| :--- | :--- | :--- | :--- |
| Tier 0 | 1 - 20 | **Neophyte** | Basic submission access. |
| Tier I | 21 - 45 | **Adept** | Access to specialized schools, reduced submission cooldowns. |
| Tier II | 46 - 70 | **Expert** | Advanced analysis tools unlocked, "Scholar" role. |
| Tier III | 71 - 90 | **Master** | Priority review for submissions, "Master" role. |
| Tier IV | 91+ | **Godlike** | Infinite submission capacity, "Ancient" role, moderator candidate. |

## 2. XP Rewards & Bonuses

XP is awarded primarily upon the successful approval of a scroll by the CODEx Authority (or automated validation).

### Base Rewards
- **Basic Scroll Submission:** 100 XP
- **Complex Analysis Submission:** 250 XP (requires deep rhyme/meter data)
- **School-Specific Scroll:** 300 XP (aligned with a specific school's themes)

### XP Bonuses (Multipliers)
- **First Submission of the Week:** 2.0x bonus.
- **Consecutive Daily Submissions:** +0.1x per day (max 1.5x).
- **High-Quality Rating (from Masters):** +50% bonus.
- **Collaborative Scroll:** +25% bonus for all contributors.

## 3. Submission Limits & Throttling

To prevent spam and ensure quality, submissions are regulated based on user Tier.

| Tier | Max Submissions / 24h | Cooldown between submissions |
| :--- | :--- | :--- |
| Neophyte | 3 | 4 hours |
| Adept | 10 | 1 hour |
| Expert | 25 | 15 minutes |
| Master | 50 | 5 minutes |
| Godlike | Unlimited | None |

## 4. XP Decay (Atrophy)

To ensure the leaderboard reflects active scholars, XP decay is applied to inactive accounts.

- **Grace Period:** 14 days of inactivity.
- **Decay Rate:** After the grace period, users lose 1% of their current XP per day of continued inactivity.
- **Protection:** XP cannot decay below the floor of the user's current Mastery Tier (e.g., an Expert will never decay back to Adept).

## 5. XP Tracking & Event Logging

All XP-related events must be logged for auditing and transparency.

### Logged Events:
- `XP_AWARDED`: `userId`, `amount`, `source`, `timestamp`, `scrollId`
- `XP_DECAY_TRIGGERED`: `userId`, `amount`, `timestamp`
- `TIER_UPGRADE`: `userId`, `oldTier`, `newTier`, `timestamp`
- `SUBMISSION_REJECTED`: `userId`, `reason`, `timestamp`

## 6. Leaderboard Integration

A global leaderboard displays the most prestigious scholars.

- **Criteria:** Ranked by total XP.
- **Privacy:** Users can opt-out of the public leaderboard in settings.
- **Rewards:** Top 3 scholars receive a weekly "Aura of Excellence" visual effect in the UI.

## 7. Role Integration

XP and Tier status directly map to system roles, granting functional permissions.

- **Role: `scholar`**: Reached at Level 46. Grants permission to vote on others' scrolls.
- **Role: `curator`**: Reached at Level 71. Grants permission to review and approve/reject Neophyte scrolls.
- **Role: `archivist`**: Reached at Level 91. Full access to the CODEx historical archives.

## 8. Implementation Strategy

1.  **Backend:** Update `persistence.adapter.js` to support XP fields, submission timestamps, and decay logic.
2.  **API:** Implement `/api/leaderboard` and update `/api/scrolls` to handle approval-based XP.
3.  **Frontend:** Update `useProgression.jsx` to fetch and display tier-specific limits and leaderboard status.
4.  **Worker:** A scheduled job (CRON) to process XP decay and calculate weekly bonuses.
