# Session log — 2026-06-03 — Engagement Loop + Garry Tan audit

**Outcome:** The "engagement loop unlock" (items 1, 2, 10 from a Garry-Tan-lens social audit) is in production. Plus a handful of independent fixes that landed in the same session.

---

## What shipped (in order)

### Pre-engagement-loop work (commits 0da9d4c → f3f6f7a)
- News calendar source switched from ForexFactory free feed (no actuals) → Finnhub free tier (actuals included). Required `FINNHUB_API_KEY` env var; user added it before the build call.
- News calendar stale threshold dropped from 6h → 15min so actuals populate within ~15min of release rather than next-day cron.
- News impact filter chips restored on `NewsScreen.tsx`; later trimmed to HIGH + MED only (no LOW / HOLIDAY).
- `ComputedBadge` component extracted; colour switched from `C.live` (mint, reserved for go-CTAs) → `C.accent` (blue, informational). Deployed on home stats triplet, discipline card header, and PDF footer.
- Home subnav now stays visible on Rules & Checklist + Journal sub-views (desktop sidebar treats `view === "checklist" | "history"` as still-Home).

### Engagement loop (PR #23, merged as `b3cb61c`)

17 tasks executed via `superpowers:subagent-driven-development` skill. Branch `feat/engagement-loop`, 19 commits including 5 review-fix commits.

**Phase 1 — Read/unread chat state**
- New `chat_reads(user_id, circle_code, last_read_at)` Postgres table.
- `src/data/chatReads.ts` — `markChatRead(code)` + `getUnreadCounts(codes)`, both tested.
- Wired `markChatRead` into chat tab open (immediate) and realtime callback (per-message while chat is visible). Stale-closure-safe via `circleTabRef`.
- Unread badge on circles list (featured card + secondary list, both with `flexShrink: 0`); NEW divider above first unread message in chat (guarded against `i === 0` to avoid orphan render); Circles nav-tab dot on desktop sidebar + mobile bottom nav with halo via `boxShadow: 0 0 0 1.5px ${C.bg}`.
- `useUnreadCircles` hook polls 30s as backstop.

**Phase 2 — Push notification expansion**
- New `notification_feed` table with kind enum (follow/circle_join/reaction/idea_like/digest), partial indexes for unread-count + digest-aggregation.
- `api/push.ts` exports shared `deliverNotification(opts)` helper: writes a feed row + fans out web push to all the target's subscriptions, with 410/404 cleanup factored into `sendPush`.
- Four new actions: `notify-follow`, `notify-circle-join`, `notify-reaction`, `notify-like`.
- Wired from `followUser` (`src/data/follows.ts`), `joinCircle` (`src/hooks/useCircles.ts`, queries `circle_members` for owner UID), reaction handlers (`circlesSharedTrades.ts` + `FriendsFeed.tsx`), and server-side `api/ideas.ts` like flow (direct `deliverNotification` import, no HTTP self-call).
- All client wirings best-effort (try/catch, void fetch).

**Phase 3 — Weekly digest + Activity inbox**
- `weekly-digest` cron in `api/cron.ts` runs Sunday 18:00 UTC. Aggregates last 7 days of un-aggregated `notification_feed` per user, sends one consolidated push, marks rows aggregated only on successful delivery.
- `src/components/NotificationFeed.tsx` Activity inbox: kind-specific 16×16 SVG icons (person+plus / overlapping circles / heart / lightbulb / lined card), 4-row skeleton with shimmer matching real row geometry, polished empty state with bell icon, error state with retry button. Read-on-mount with optimistic 250ms fade.
- Social tab now has 4 sub-sections (Feed / Ideas / People / Activity). FriendsFeed's internal tab state was **lifted into `Koda.tsx`** to avoid the double-tab-bar bug the first design-review pass caught.
- Social nav-tab gets the same dot-badge treatment as Circles, driven by `useUnreadNotifications`. Badge clears immediately on opening Activity via a `refresh` callback exposed by the hook.

### Post-merge fixes
- Chat box height bumped: `minHeight: 260 → 420`, `maxHeight: min(60dvh, 520px) → min(72dvh, 720px)` (`af66a71`).
- **Chat outage diagnosed and unblocked:** the `circle_messages` SELECT policy from `20260603_circle_messages_members_only.sql` requires a row in `public.circle_members`, but the codebase only writes membership to KV (`koda_circle_member_*`). Table was empty → every read blocked → "completely blank chat panel." Temporary unblock: revert the policy to `USING (true)`. Proper fix tracked on whiteboard (backfill `circles` + `circle_members` from KV, then re-apply the strict policy).

---

## Garry Tan audit — full list of 10 items

This audit drove everything else this session. All 10 items now on the physical whiteboard + tracked in repo docs:

1. ✅ **Read/unread state on circle chat** — shipped (engagement loop, Phase 1)
2. ✅ **Follow + circle-join + reaction + like notifications** — shipped (engagement loop, Phase 2)
3. 🔜 **Moderation** — report button, soft delete, word filter, auto-hide ≥3 reports (~2 days)
4. 🔜 **Leaderboard integrity** — verified-only board, broker-sync vs manual trade source flag (~2 days)
5. 🔜 **KV → Postgres schema unification** — JUMPED IN PRIORITY because `circle_messages` strict RLS now depends on it (~3 days)
6. 🔜 **Ideas → Feed cross-posting** (~1.5 days)
7. 🔜 **Badges/achievements** (~3 days, after moderation)
8. 🔜 **Comment threads** (~2 days, after moderation)
9. 🔜 **Viral invite loop** (~3 days, after moderation + analytics)
10. ✅ **Weekly digest + Activity inbox** — shipped (engagement loop, Phase 3)

Roadmap detail at `docs/superpowers/plans/2026-06-03-social-retention-roadmap.md`.

---

## Migrations applied to live Supabase this session

User applied manually via Supabase SQL Editor:

1. `20260603_chat_reads.sql` — `chat_reads` table + RLS ✅
2. `20260603_notification_feed.sql` — `notification_feed` table + partial indexes + RLS ✅
3. Inline revert of `circle_messages_select` policy to `USING (true)` ⚠️ temporary

---

## Notable subagent / design-review decisions

- Used `superpowers:writing-plans` for the engagement loop spec, then `superpowers:subagent-driven-development` for execution.
- Five "🔴 should fix" items caught by the design review subagent (double tab bar, badge stuck after Activity open, orphan NEW divider, missing `flexShrink: 0`, undistinguishable error vs empty state) — all addressed in fix commit `9f5b3e1` before opening the PR.
- One "nit" review item ignored: a 2-space vs 3-space whitespace alignment in `drop policy if exists` lines (no functional impact, no tooling enforcement).

---

## Whiteboard + memory file state

`C:\Users\Dylon\.claude\projects\C--Users-Dylon--local-bin\memory\project_koda_whiteboard.md` is current:
- All 10 Garry Tan audit items captured with status
- New entry: "circle_members backfill + restore strict RLS"
- New entry: "Social subnav sync" (FriendsFeed lift gap)
- New entry: "Add to Home Screen flow" (PWA install onboarding tail)

---

## Open immediate next steps

- Backfill `circles` + `circle_members` from KV → re-apply strict `circle_messages` policy
- Verify weekly-digest cron fires correctly on first Sunday (manual `curl` test against `/api/cron?job=weekly-digest` with `CRON_SECRET` will exercise it before then)
- Confirm PWA install + push permission flow end-to-end with a beta tester to validate the full follow → push → in-app feed loop

Everything else is on the roadmap or in the whiteboard.
