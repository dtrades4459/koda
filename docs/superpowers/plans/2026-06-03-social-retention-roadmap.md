# Social + Circles Retention Roadmap

Companion to `2026-06-03-engagement-loop.md`. The engagement loop plan covers items #1, #2, and #10 from the Garry-Tan-lens audit — **all three SHIPPED 2026-06-03 as PR #23 (merged `b3cb61c`).** This document tracks the remaining 7 items as future implementation plans — write each one in detail when you're ready to ship it.

**Status update (2026-06-03):**
- ✅ Item #1 (read/unread chat) — shipped
- ✅ Item #2 (follow/circle-join/reaction/like push notifications) — shipped
- ✅ Item #10 (weekly digest + Activity inbox) — shipped
- 🔜 Item #5 (KV → Postgres unification) **JUMPED IN PRIORITY** — chat membership lives in KV but the strict `circle_messages` RLS expects Postgres, so the policy is currently reverted to `USING (true)` (open) until backfill lands. Do this BEFORE item #3 (moderation) so we can re-secure the policy.
- Items #3, #4, #6, #7, #8, #9 — unchanged

**Suggested execution order is top-to-bottom.** Each item depends on prior items being live: e.g., moderation only matters once volume exists, badges only matter once stats are visible enough to brag about. Don't skip ahead.

---

## 1. Moderation system

**Why it matters:** Trading communities attract pumpers, scam DMs, PnL flexers, and rage-posters. One screenshot of unmoderated content is a brand fire. You need this before the first 50 active users.

**Scope:**
- Report button on every chat message, shared trade, feed trade, idea
- New `reports` table: `(id, reporter_uid, target_kind, target_id, reason, created_at, resolved_at)`
- Soft-delete columns (`deleted_at`) on `circle_messages`, `circle_shared_trades`, `ideas` — keep rows for audit
- Auto-hide content with N≥3 reports in a 24h window (configurable)
- Admin endpoint to review queue; admins identified by `profiles.is_admin = true`
- Basic word-filter as a separate light layer (configurable blocklist in env or KV)

**Files to touch:**
- New migration: `supabase/migrations/<date>_reports_and_soft_delete.sql`
- New endpoint: `api/moderation.ts` (report, list-queue, resolve)
- Modify: `src/TradingCircles.tsx`, `src/FriendsFeed.tsx`, `src/IdeasScreen.tsx` (report buttons)
- New: `src/AdminModeration.tsx` (queue view, gated by `is_admin`)

**Effort:** ~2 days

**Sequencing note:** Ship the report button + soft delete first. The admin queue and auto-hide can land in a v1.1.

---

## 2. Leaderboard integrity

**Why it matters:** Auto-publish runs off `statsFingerprint` with zero verification that trades are real. A user fakes 20 winners → dominates KODA-GLOBAL → leaderboard loses credibility → product loses credibility. For a trading product specifically, this is existential.

**Scope:**
- Add `trade.source` enum: `manual` | `csv_import` | `broker_sync`
- Add `verified` boolean on leaderboard entries — true only if a threshold (e.g. ≥80%) of the trader's recent trades are `broker_sync`
- Two-board UI on each circle: "Verified" (default tab) and "All" — switch via toggle
- Verified badge (small icon) next to a trader's handle anywhere stats are shown
- Reuse the existing Tradovate sync infrastructure (live sync is on the whiteboard parking lot — bring forward)

**Files to touch:**
- New migration: `supabase/migrations/<date>_trade_source.sql`
- Modify: `src/lib/stats.ts` (compute `verifiedPct`)
- Modify: `src/hooks/useCircles.ts:471-513` (`publishToCircle` writes `verifiedPct`)
- Modify: `src/data/circles.ts:515-561` (`fetchCircleLeaderboard` filters by verified when tab selected)
- Modify: `src/TradingCircles.tsx` (Verified/All toggle, badge)

**Effort:** ~2 days (assumes Tradovate sync stays as-is)

**Hard requirement:** Don't ship public leaderboard expansion (e.g. featured circles, week-ago snapshots) until this lands. Bad leaderboards age into permanent product credibility damage.

---

## 3. KV → Postgres schema unification

**Why it matters:** Ideas runs on Postgres. Circles runs on KV. Follows dual-writes both. Every new social feature now requires "which storage layer?" + dual-write migration. Iteration speed tax compounds.

**Scope:**
- Migrate circle metadata (`koda_circle_<CODE>`) → `public.circles` table
- Migrate member rows → `public.circle_members` (already partially exists per the audit)
- Migrate leaderboard entries → either a materialised view computed from `trades`, or a `public.circle_leaderboard_entries` table refreshed by trigger
- Backfill script + dual-read fallback period
- Cut over reads after backfill validation; keep KV writes for 1 week as paranoid fallback
- Remove KV writes; archive KV rows

**Files to touch:**
- Migration: `supabase/migrations/<date>_circles_v2.sql` (or extend the existing v2 tables noted in the audit)
- New script: `scripts/backfill-circles-kv-to-pg.ts`
- Modify: `src/data/circles.ts` (read from PG, gated behind a flag)
- Modify: `src/hooks/useCircles.ts` (write to PG, dual-write to KV during cutover)
- Remove KV writes once cutover is verified at 7 days

**Effort:** ~3 days including backfill verification

**Sequencing note:** This is a refactor with no user-visible value, but it pays back on every future feature. Do it between user-facing improvements when you need a "quiet week."

---

## 4. Ideas → Feed integration

**Why it matters:** Ideas is a separate tab in `IdeasScreen.tsx`. New surfaces that require dedicated navigation die. Cross-posting to the friends feed (where people already look) makes Ideas discoverable.

**Scope:**
- When a user posts an idea, write a feed row (existing feed mechanism) pointing at the idea
- Feed item renders an Idea card variant (small chart thumbnail if `chartUrl`, title, direction badge, instrument, like count)
- Tap → opens the full idea modal (already exists in IdeasScreen)
- Filter chip on feed: "Trades" / "Ideas" / "All"
- Optional: post-to-circles as well (let user choose which circles when composing an idea)

**Files to touch:**
- Modify: `api/ideas.ts` (`create` action also writes a feed row for the author's followers)
- Modify: `src/FriendsFeed.tsx` (render `kind: "idea"` items with the Idea variant)
- Modify: `src/IdeasScreen.tsx` IdeaComposer (optional circle target picker)
- Migration: extend feed row schema if needed to carry `kind` discriminator and `idea_id` reference

**Effort:** ~1.5 days

**Sequencing note:** This is the cheapest item with the biggest discoverability win. Consider it the next-next plan after the engagement loop.

---

## 5. Badges / achievements

**Why it matters:** Every badge is a screenshot-worthy asset that posts to Twitter naturally. For a trading journal, this converts the existing stats engine into a viral loop at near-zero marginal cost.

**Scope:**
- Define ~15 initial badges: "First Profitable Week", "10-Day Streak", "Strategy Master (50+ trades on one strategy ≥60% WR)", "Top 1% Avg R this month (per circle)", "Disciplined (Discipline Score ≥90 for 4 weeks)", "100 Trades", etc.
- New `user_badges` table: `(user_id, badge_id, earned_at, data jsonb)`
- Background job (nightly cron) evaluates badge rules per user
- New `<BadgeCard/>` component — shareable artwork (gradient + badge name + handle + date), download-as-PNG
- Badges shown on `ProfileModal`, on circle leaderboard hover, on the user's stats page
- Push notification on badge earned (reuses the engagement loop infrastructure)
- Optional: rare/legendary tier with capped issuance ("First 100 to hit X")

**Files to touch:**
- Migration: `supabase/migrations/<date>_badges.sql`
- New: `src/lib/badges.ts` (badge definitions + rule evaluator, mirrors `stats.ts` style)
- New cron handler: `handleEvaluateBadges` in `api/cron.ts`
- New: `src/components/BadgeCard.tsx` + `<BadgeShelf/>`
- Modify: `src/ProfileModal.tsx` (show shelf)
- Modify: `src/Koda.tsx` Stats tab (show shelf)
- Push trigger via the engagement loop's `deliverNotification` (new `kind: "badge"`)

**Effort:** ~3 days for the framework + 15 initial badges. Plan a separate, smaller follow-up to expand the badge catalogue based on which ones get the most shares.

**Sequencing note:** Ship moderation first. Badges without moderation = pumpers gaming them.

---

## 6. Comment threads

**Why it matters:** Reactions are calorie-free engagement. Comments are where community forms. Reddit, Discord, Twitter — all built on comment threads. Feed and Ideas have reactions but no depth.

**Scope:**
- New `comments` table: `(id, surface_kind, surface_id, author_uid, body, created_at, deleted_at)` with `surface_kind ∈ ('feed_trade', 'shared_trade', 'idea')`
- Comment input + thread display on each surface
- Notification trigger on comment received (extend the engagement loop's `notify-reaction` action to also cover comments, or add a `notify-comment` action)
- Soft-delete + report (depends on moderation system shipping first)
- Threading depth: flat (no replies-to-replies) for v1 — Twitter-style. Add nesting in v2 if needed.

**Files to touch:**
- Migration: `supabase/migrations/<date>_comments.sql`
- New: `api/comments.ts` (list, create, delete)
- New: `src/components/CommentThread.tsx`
- Modify: `src/FriendsFeed.tsx`, `src/IdeasScreen.tsx`, `src/TradingCircles.tsx` (where shared trades show) — wire in CommentThread
- Modify: `api/push.ts` (add notify-comment action; depends on engagement loop landing)

**Effort:** ~2 days

**Sequencing note:** Comments amplify everything else, including bad behaviour. Ship moderation first. Hard rule.

---

## 7. Viral invite loop

**Why it matters:** Invite codes for circles exist. Share-to-Twitter button exists. But no incentive structure ties them into a growth loop. Need a reason for users to actually invite people.

**Scope:**
- Invite tracking: when a user clicks an invite link, capture the inviter; on signup, write a `referrals(inviter_uid, invitee_uid, created_at)` row
- Reward: inviter gets 1 month Pro for free per 3 successful invitees (signed up + completed onboarding + logged 1 trade). Tunable.
- Invitee gets a small first-week reward (e.g. unlock one Pro feature for 7 days) to make the invite link itself attractive
- "Your invite stats" panel on the Settings screen: invitees count, pending rewards, share UTM
- Notification when an invitee signs up + when a reward unlocks
- Anti-fraud: hash IP, reject duplicate device fingerprints, manual review queue for suspicious bursts

**Files to touch:**
- Migration: `supabase/migrations/<date>_referrals.sql`
- New: `api/referrals.ts` (track click, mark conversion, list stats)
- New: invite link router — accept `?ref=<code>` on landing page, set a referral cookie
- Modify: signup flow — read cookie, attach inviter on profile creation
- Modify: `src/SettingsScreen.tsx` — invite stats panel
- Notification triggers via engagement loop infrastructure

**Effort:** ~3 days including the anti-fraud heuristics

**Sequencing note:** This is the highest-variance item. Could 5x signups or could attract scammers. Ship it AFTER moderation and AFTER analytics dashboards exist so you can see what's happening fast.

---

## Total effort estimate

| Item | Effort | Earliest sensible ship order |
|------|--------|------------------------------|
| Engagement loop (separate plan) | 2-3 days | Now |
| Ideas → Feed | 1.5 days | After engagement loop |
| Moderation | 2 days | Before badges, before comments |
| Leaderboard integrity | 2 days | Before public-leaderboard expansion |
| Badges | 3 days | After moderation |
| Comments | 2 days | After moderation |
| Viral invite loop | 3 days | After moderation + analytics |
| KV → Postgres unification | 3 days | "Quiet week" filler — anytime |
| **Total** | **~18-19 days** | **~4 calendar weeks of focused founder time** |

---

## What this roadmap is NOT

- It is not a Q3 plan. It's an ordered backlog. Re-evaluate after each item ships, based on what the retention curve actually does.
- It is not a substitute for talking to users. Every item above is an inference from the codebase, not from interviews. Before building badges, ask 5 users what they wish their profile showed. Before building viral invites, ask 5 users why they haven't invited anyone yet.
- It does not include UX polish, design pass, or copy work. Each implementation plan must include its own design review checkpoint.
