# Circles Improvements — Design Spec
**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Three additive features on top of the existing Circles system

---

## Overview

Circles currently provides leaderboards, group chat, and auto-published aggregate stats. This spec adds three features that together make Circles both competitive and community-driven:

1. **Owner-initiated challenges** with a permanent trophy shelf
2. **Trade sharing** — full trade cards posted into a circle
3. **Unified activity feed** — merges chat, shared trades, and challenge events into one timeline

---

## 1. Data Model

### `circle_challenges`
Stores active and completed challenges created by circle owners.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `circle_code` | text | FK → circle |
| `title` | text | e.g. "Best R This Week" |
| `metric` | text | `dollar \| r \| winrate \| trades \| avgr` |
| `started_at` | timestamptz | |
| `ends_at` | timestamptz | |
| `created_by` | text | member code of owner |
| `status` | text | `active \| completed` |

### `circle_challenge_results`
Written once when a challenge completes. Permanent record.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `challenge_id` | uuid | FK → circle_challenges |
| `circle_code` | text | |
| `winner_code` | text | |
| `winner_name` | text | |
| `winner_handle` | text | |
| `winning_value` | numeric | The winning metric value |
| `snapshot_at` | timestamptz | When the result was recorded |

### `circle_shared_trades`
One row per trade shared to a circle.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `circle_code` | text | |
| `author_code` | text | |
| `author_name` | text | |
| `author_handle` | text | |
| `author_avatar` | text | |
| `trade_id` | text | Client-side trade ID (Date.now() string) |
| `pair` | text | |
| `side` | text | `long \| short` |
| `outcome` | text | `win \| loss \| be` |
| `pnl` | numeric | |
| `rr` | numeric | nullable |
| `strategy` | text | nullable |
| `notes` | text | nullable |
| `screenshot` | text | URL, nullable |
| `date` | text | YYYY-MM-DD |
| `shared_at` | timestamptz | |
| `reactions` | jsonb | `{ emoji: string[] }` — array of member codes per reaction |

**Duplicate guard:** unique constraint on `(circle_code, author_code, trade_id)`.

---

## 2. Challenges

### Creating a challenge (Pro circle owners only)

- "Start Challenge" button appears above the leaderboard for circle owners with a Pro plan.
- Opens a bottom sheet with:
  - **Title** — free text (required)
  - **Metric** — picker: $ P&L · R-Multiple · Win Rate · Most Trades · Avg R
  - **Duration** — 3d / 7d / 14d / 30d / custom end date
  - Start immediately (no scheduling in v1)
- Inserts a row into `circle_challenges` with `status = active`.

### Active challenge UX

- While a challenge is running, the leaderboard tab shows a countdown banner at the top: "🏆 Best R This Week · 4d 12h left"
- The leaderboard automatically sorts by the challenge metric for the duration of the challenge.
- Only one active challenge per circle at a time. The "Start Challenge" button is hidden while one is running.

### Challenge completion

- A Vercel cron job checks for challenges where `ends_at < now()` and `status = active` every 5 minutes.
- On completion:
  1. Reads the current leaderboard entries for the circle.
  2. Finds the winner by the challenge metric.
  3. Writes a row to `circle_challenge_results`.
  4. Updates `circle_challenges.status = completed`.
  5. Posts an auto-message to `circle_messages`: "🏆 Challenge over — @handle wins [metric] with [value]"
- Fallback: if no cron fires (cold start gap), the next user to open the circle triggers completion client-side if `ends_at` has passed.

### Trophy shelf

- New tab inside the circle: `feed | leaderboard | chat | members | trophies`
- Reverse-chronological list of completed challenges.
- Each entry shows: challenge title, metric, winner avatar + handle, winning value, date.
- Pro circle owners see a "Start New Challenge" button at the top of the trophy shelf.

### Pro gating

- **Free:** Can view challenges, participate in leaderboard, see trophy shelf.
- **Pro (owner only):** Can create challenges.

---

## 3. Trade Sharing

### How to share

- Each trade card in the trade history gets a "Share" icon button (alongside existing react/comment actions).
- Tapping opens a circle picker — a list of the user's circles.
- User selects one circle and confirms.
- Creates a row in `circle_shared_trades`.
- Duplicate guard: if `(circle_code, author_code, trade_id)` already exists, silently no-op and show toast: "Already shared to this circle."

### Trade card in feed

Displayed as a card with:
- Author avatar, handle, relative time ("2h ago")
- Pair + side chip + outcome badge (WIN / LOSS / BE colored)
- P&L and R-multiple
- Strategy tag (if set)
- Notes (full text, no truncation)
- Screenshot (if attached)
- Reaction bar — same 6 reactions as the friends feed (🔥 💎 👍 🎯 💀 🤯)

### Privacy

- Shared trades are visible only to circle members.
- Private circles: trades are not discoverable or indexable outside the circle.

### Who can share

- Any member, free or Pro. Trade sharing is not paywalled — it drives community engagement.

---

## 4. Unified Activity Feed

### New tab order

```
feed | leaderboard | chat | members | trophies
```

`feed` is the default tab when opening a circle.

### Feed content (merged, sorted by timestamp descending)

| Event type | Source |
|---|---|
| Shared trade card | `circle_shared_trades` |
| Chat message | `circle_messages` |
| Challenge started | `circle_challenges` (status change) |
| Challenge ended / winner | auto-message in `circle_messages` |
| Member joined | auto-message in `circle_messages` |

The merge is done client-side: fetch the last 50 rows across all three sources on open, sort by timestamp. Infinite scroll loads older batches of 50.

### Compose bar

Single input bar at the bottom of the feed:
- Typing and submitting → sends a chat message (writes to `circle_messages`).
- Tapping the attach/share icon → opens the trade picker (writes to `circle_shared_trades`).
- No context switching needed between chat and trade sharing.

### Chat tab

Still exists as a standalone tab. Shows only `circle_messages` — no trade cards. For members who prefer a clean text chat experience. Messages sent from the chat tab appear in the feed too (same data source).

### Realtime

Supabase Realtime subscriptions (already wired for `circle_messages`) are extended to `circle_shared_trades` and `circle_challenges`. New items appear in the feed without a refresh.

---

## Pro Gating Summary

| Feature | Free | Pro |
|---|---|---|
| View challenges | ✅ | ✅ |
| Participate in challenges | ✅ | ✅ |
| View trophy shelf | ✅ | ✅ |
| Create challenges | ❌ | ✅ (owners only) |
| Share trades to circles | ✅ | ✅ |
| View activity feed | ✅ | ✅ |

---

## Out of Scope (v1)

- Challenge scheduling (start at a future time)
- Challenge notifications (push/email)
- Challenge brackets or head-to-head format
- Trade sharing to multiple circles simultaneously in one action
- Editing or deleting a shared trade post
- Circle discovery / public circle browser
