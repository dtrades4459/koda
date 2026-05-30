# Kōda Thesis Audit
**Date:** 2026-05-30  
**Scope:** In-app intervention layer (Section A) · Circles UI (Section B) · Circles backend (Section C)  
**Method:** Read-only codebase walk. No changes made.  
**Verdict format:** ✅ Present & working · ⚠️ Present but broken/incomplete · ❌ Missing

---

## Why this audit exists

Kōda's core thesis is two-part:

1. **Discipline enforcement** — not just data logging, but active intervention that stops a trader from blowing up a day, an eval account, or a self-belief.
2. **Community accountability** — Circles as a social layer where peer visibility creates pressure to trade well, not just often.

If those two things work, Kōda is meaningfully different from TraderSync, Edgewonk, and every broker's built-in stats page. If they don't, it's a prettier journal with a worse retention story.

This audit answers: *how much of that thesis is real right now?*

---

## Section A: Intervention Layer

### A1 — Kill switch (daily max loss halt)

**Status: ⚠️ Present — display-only, logging not blocked**

**What's there:** `Koda.tsx:1753-1773`  
When `todayPnl <= -maxLoss`, the home feed renders a "KILL SWITCH ACTIVE" red banner. It tells the user to step away. There's an Override button behind a `window.confirm()` that clears `maxDailyLoss`.

**The gap:** Nothing stops the user from tapping the Log tab and adding more trades. The kill switch is a notification, not a circuit breaker. The `LogTradeScreen` receives `todayPnl` and `maxDailyLoss` but there is no `atDailyLossLimit` guard equivalent to the trade-count `atTradeLimit` check. A trader who has already blown their daily limit can log new trades with zero friction.

**Fix needed:** Compute `killSwitchTripped` in `LogTradeScreen` and either disable the submit button or render a blocking state that requires the same Override confirmation. Mirror the kill switch banner at the top of the log form.

---

### A2 — Daily trade limit (max trades per day)

**Status: ⚠️ Present — advisory only, not enforced**

**What's there:** `LogTradeScreen.tsx:74,103-118`  
`atTradeLimit` and `nearTradeLimit` render colour-coded banners at the top of the log form. The wording is correct ("Adding another is a plan deviation").

**The gap:** The submit button's `enabled` flag is:
```ts
const enabled = !!(form.pair && form.date && form.outcome && !savingTrade);
```
`atTradeLimit` is not in this expression. The user can tap Save with the red banner on screen. The banner is friction; it is not a block.

**Fix needed:** Add `&& !atTradeLimit` to `enabled`, or render a separate hard-stop state when `atTradeLimit` with an explicit override flow (like the kill switch has).

---

### A3 — Consecutive loss streak warning

**Status: ⚠️ Present — wrong streak direction**

**What's there:** `Koda.tsx:2594-2600`, `LogTradeScreen.tsx:119-126`  
The streak is calculated at the Log view as:
```ts
const _lossStreak = (() => {
  let count = 0;
  for (const t of trades) {
    if (t.outcome === "Loss") { count++; } else { break; }
  }
  return count;
})();
```
The banner fires at `lossStreak >= 2`.

**The gap:** `trades` is stored in insertion order (newest first based on `setTrades` from localStorage). The loop counts from `trades[0]` forward and breaks on the first non-loss. This is correct **only if** trades are always sorted newest-first. If a user logs a backdated trade, the sort order is wrong and the streak will be miscounted or zeroed. There is no explicit sort guarantee before this calculation. The fix is cheap — sort by date descending before the loop — but the current code is fragile.

---

### A4 — Daily loss approach warning (60% threshold)

**Status: ⚠️ Present — inconsistent threshold vs home screen**

**What's there:** `LogTradeScreen.tsx:76,127-134`  
Fires when `todayPnl <= -(maxDailyLoss * 0.6)`.

**The gap:** The home screen dashboard (`Koda.tsx:1816`) fires its "approaching" warning at 75%:
```ts
todayPnl <= -(maxLoss * 0.75)
```
Two different thresholds for the same concept. One of them is wrong. The home screen is passive; the log screen is active. The log screen probably wants the tighter threshold (60%), but the mismatch means the user sees different states depending on which screen they're on.

---

### A5 — Pre-trade checklist

**Status: ⚠️ Present — zero enforcement, no logging linkage**

**What's there:** `Koda.tsx:1006-1017` + checklist view  
Full checklist with per-strategy items, custom add/delete, reset, a configurable threshold (`minCount`), and a tab for "Rules" vs "Pre-trade". Rule adherence is stored per-trade as `ruleAdherence: boolean | null`.

**The gap:**
- The checklist and the log form are on separate views. There is no flow that presents the checklist before the log form.
- The `ruleAdherence` field in `LogTradeScreen` is set by the user manually (a toggle), not derived from whether the checklist was checked.
- A user can log a trade with `ruleAdherence: true` without ever touching the checklist — or log with all boxes unchecked and still claim adherence.
- The threshold (`minCount`) is stored but never displayed to the user as a warning when they submit with fewer than threshold checks done.

This is the most important gap in the intervention layer. The checklist is a data collection tool with no behavioral teeth.

---

### A6 — Discipline score (rule adherence analytics)

**Status: ✅ Present and correct**

`Koda.tsx:3121-3142` — the monthly discipline score card calculates `followedPct` from trades tagged with `ruleAdherence !== null`. Grades correctly: 80%+ Excellent, 60%+ Good, 40%+ Needs work, <40% Struggling. Requires ≥3 tagged trades before rendering (good UX). Colour-coded correctly.

**Minor gap:** Requires the user to manually tag adherence. See A5 above. The score is trustworthy only if the input is honest.

---

### A7 — Prop firm eval progress overlay

**Status: ✅ Present — dollar-only, not R-consistent**

`Koda.tsx:3144-3199` — three progress bars: profit target, daily loss limit, max drawdown. Warn at 75% (red bar transition). "Edit targets" CTA links to settings.

**Gap:** The personal daily kill switch (A1) is R-denominated (`maxDailyLoss` is in R). The prop firm overlay is dollar-denominated. A user who has both `propFirmMode` on and a personal `maxDailyLoss` set will see two different tracking systems in different units. No bridge between them.

---

### A8 — Emotion/mistake tagging

**Status: ⚠️ Present — collected, not analyzed**

`EMOTION_TAGS`, `MISTAKE_TAGS` in `tradeConstants.ts` are captured on the log form. There is no dashboard view that correlates emotion tags with P&L outcomes, win rates, or time-of-day patterns. The data is sitting in trades but no insight is surfaced.

---

### A9 — MAE/MFE data

**Status: ⚠️ Present — collected, charted, not used in warnings**

MAE/MFE fields exist on `Trade` and the `MAEMFEChart` is in the stats page. Nothing uses MAE data to warn a user that they're cutting winners early or letting losers run. This would be the most credible "edge insight" Kōda could surface.

---

### A10 — Pattern recognition / proactive insights

**Status: ❌ Missing**

The "Insights" tab (formerly "AI") lives under Stats. `generateInsights()` in `charts.tsx` produces rule-based insights (e.g. best session, best strategy). These are descriptive, not prescriptive, and do not trigger any intervention. There is no:
- "You lose 3× more on Fridays" warning before Friday trades
- "Your win rate drops to 20% after 2pm London" pre-session alert
- "You've overtraded on 4 of the last 5 Tuesdays" pattern alert

This is the gap between Kōda as a journal and Kōda as a co-pilot. The data for all of these exists in `trades[]`.

---

### A: Summary — Differentiator Gap

The claim: *Kōda doesn't just show you what happened — it stops the next bad trade from happening.*

The reality: every intervention in the current codebase is advisory. Not one of them prevents submission. The kill switch is a banner. The trade limit is a banner. The consecutive loss warning is a banner. Until at least A1 and A2 are hard-blocked, the thesis is aspirational.

**Priority order for next sprint:**
1. Block submit when kill switch is active (A1) — 1 line change
2. Block submit when at trade limit (A2) — 1 line change  
3. Fix streak sort direction (A3) — 3 line change
4. Reconcile 60%/75% thresholds (A4) — 1 line change
5. Surface checklist check count before log form submit (A5) — medium effort

---

## Section B: Circles UI

### B1 — Circle discovery

**Status: ❌ Missing (fake tab)**

`TradingCircles.tsx:413-418` — the browse view renders two pills: "Joined" and "Discover". The "Joined" pill is always active (`i === 0`). The "Discover" pill has no onClick handler that switches state. Clicking it does nothing. There is no discovery mechanism — no search, no public circle listing, no invite link from a directory.

Users can only join a circle they already know the code for. Viral growth via discovery is entirely absent.

---

### B2 — isPro check in TradingCircles.tsx

**Status: ❌ Wrong computation**

`TradingCircles.tsx:40`:
```ts
const isPro = profile?.plan === "pro" || profile?.plan === "elite";
```

The fix applied in `Koda.tsx` to remove the paywall for beta users reads:
```ts
const isPro = !isFlagOn("paywall") || FOUNDER_EMAILS.has(...) || profile.plan === "pro" || ...
```

The TradingCircles component has its own `isPro` that ignores the flag. During the beta (paywall off), this means:
- **Start New Challenge** button is only visible to users with `plan === "pro"` or `"elite"`.
- During the closed beta, no user has that plan unless manually set.
- Pro owners using the founder bypass also need `plan` set correctly.

Result: challenge creation is effectively disabled for the entire beta period.

**Fix:** Remove the local `isPro` in TradingCircles and pass it down as a prop from Koda.tsx where the correct computation lives.

---

### B3 — Week sort on leaderboard

**Status: ❌ Broken**

`TradingCircles.tsx:762-767` renders "ALL TIME" / "THIS WEEK" sort buttons that update `lbSort` state. But `fetchCircleLeaderboard` (called in `useCircles.ts:500-542`) always sorts by the circle's all-time metric. It never receives nor applies `lbSort`. The "THIS WEEK" button changes the button's active state; the leaderboard data does not change.

**Fix:** Either pass `lbSort` into `fetchCircleLeaderboard` and filter entries by `updatedAt` within the current week, or remove the "THIS WEEK" button until date-filtered leaderboards are implemented.

---

### B4 — Feed + Chat are the same data

**Status: ⚠️ Confusing UX**

Both the Feed tab and the Chat tab read from `circle_messages` with `eq("circle_code", ...)`. The Feed is newest-first and includes trades + challenge events interleaved. The Chat is oldest-first, text-only, iMessage-style. They share the same underlying data but present it differently.

A message posted in Chat also appears in Feed. There is no indication to users that these are the same data source. This creates UX confusion: "Did I say that in chat or feed?" The fix is either to unify them or to introduce a separate `source` column to route messages to one view or the other.

---

### B5 — Avatar rendering

**Status: ⚠️ Always shows 👤**

`TradingCircles.tsx:1016`:
```ts
m.avatar ? (m.avatar.length <= 8 && !m.avatar.startsWith("http") && !m.avatar.startsWith("data:") ? m.avatar : "👤") : "👤"
```

If `m.avatar` is a URL (from Supabase Storage, which is where avatars are migrated to), the condition `m.avatar.startsWith("http")` returns `false` for the emoji branch, so it renders "👤". Avatar images from Supabase Storage are never displayed in the members list. The initials avatar fallback in the leaderboard (gradient circle with initials) is better than this logic.

---

### B6 — Circle code format

**Status: ⚠️ Diverges from KODA- convention**

`useCircles.ts:317-320`:
```ts
const code =
  circleForm.name.replace(/\s+/g, "").toUpperCase().slice(0, 6) +
  "-" +
  Math.random().toString(36).slice(2, 6).toUpperCase();
```

Generated codes look like `LONDON-AB3Z`. The join placeholder shows `KODA-ABCD-EFGH` (three segments). The `KODA_GLOBAL_CODE` is `"KODA-GLOBAL"`. There is no consistency. Short circle names (one word) produce confusing codes. Two circles named "London" and "London ICT" could produce identical prefixes with only the random suffix differentiating them.

---

### B7 — Notifications

**Status: ❌ Missing**

No push notification, in-app badge, or email when:
- Someone joins your circle
- A challenge starts in a circle you're in
- You climb or fall in rank
- A challenge you're leading is about to expire

The `NotificationsDrawer` component exists but is wired to trade comments/reactions, not circle events.

---

### B8 — Compose bar z-index

**Status: ⚠️ Mobile layout risk**

`TradingCircles.tsx:1127`:
```ts
position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", ...zIndex: 10
```

The compose bar is fixed to the bottom of the viewport. On mobile, the browser's keyboard will push the viewport up. Combined with the bottom nav pill (also fixed, higher z-index), the compose bar can be obscured or clip behind the nav on some devices. The bottom nav should use a higher z-index than content overlays.

---

### B9 — Leaderboard staleness indicator

**Status: ❌ Missing**

`updatedAt` is stored on every leaderboard entry and displayed in the expanded row (`Last published · {timestamp}`). But there is no visual staleness indicator on the leaderboard row itself — a member who published 3 weeks ago and a member who published this morning look identical at a glance. A "stale" badge after 7 days of no update would improve competitive signal quality.

---

### B: Summary

Circles' most compelling product promise is a **live, meritocratic leaderboard** where publishing your real trades earns rank. The current gaps undermine that:
- Week sort doesn't work, so "this week's best" is not actually this week.
- Discovery doesn't work, so organic growth is impossible.
- Notifications don't exist, so the competitive pull is invisible.
- Challenge creation is gated behind a flag check that doesn't respect the beta paywall removal.

The social scaffolding is strong — real-time channels, feed + chat, challenges, trophies. The three missing pieces are: working weekly sort, a discoverable public circle directory, and push notifications. Without those, Circles is a feature; with them, it's the product.

---

## Section C: Circles Backend

### C1 — Schema verification

**Status: ⚠️ Unverifiable — no migration files found**

`supabase/migrations/` does not exist in the repo. The RLS policies, indexes, and schema described in `src/lib/storage.ts` and `src/data/circles.ts` comments cannot be verified against actual SQL. This audit must treat schema claims as aspirational until migrations are committed.

Tables referenced in application code:
- `shared_kv` (key, value jsonb, owner_id uuid)
- `user_kv` (user_id uuid, key text, value jsonb)
- `circle_messages` (id, circle_code, sender_id, sender_name, sender_handle, sender_avatar, text, created_at)
- `circle_shared_trades` (id, circle_code, shared_at, reactions jsonb, ...)
- `circle_challenges` (id, circle_code, title, metric, started_at, ends_at, created_by, status)
- `circle_challenge_results` (id, circle_code, challenge_id, winner details, snapshot_at)

**Recommendation:** Add `supabase/migrations/` and commit each table as a dated migration file before launch. Without this, schema drift is inevitable and undetectable.

---

### C2 — Realtime subscription efficiency

**Status: ❌ Broadcasts all shared_kv changes to every circle subscriber**

`src/data/circles.ts:220-248`:
```ts
.on("postgres_changes", { event: "*", schema: "public", table: "shared_kv" }, ...)
```

There is no server-side `filter` on the subscription. Every change to any row in `shared_kv` fires on every circle's realtime channel, then the client filters by key prefix. As the platform grows, this means:
- 100 users × 3 circles each = 300 channels, each receiving every `shared_kv` mutation.
- A single leaderboard publish fires 300 client-side filter evaluations.

Supabase supports row-level filters on realtime subscriptions (e.g. `filter: "key=like.koda_circle_MYCODE%"`). Using that would eliminate the broadcast problem. The `circle_messages`, `circle_shared_trades`, and `circle_challenges` channels in `TradingCircles.tsx` already use correct per-circle filters — only the `shared_kv` subscription in `circles.ts` is wrong.

---

### C3 — Week leaderboard sort — backend non-existent

**Status: ❌ Not implemented at the data layer**

As noted in B3, `fetchCircleLeaderboard` returns all-time stats. The entry object includes `weekPnL` as a field (`useCircles.ts:38`) but it is only populated at publish time from the current week's trades. There is no date-filtered query path. Implementing weekly sort requires:
1. Adding `week_pnl` as a separate stored field on the entry row (already partially done), OR
2. Querying `circle_shared_trades` filtered by date, which doesn't exist yet.

---

### C4 — Two divergent leaderboard implementations

**Status: ❌ Data inconsistency risk**

`src/data/circles.ts:104-124` (`readLeaderboard`) always sorts by `b.totalPnL - a.totalPnL` ignoring circle metric.

`src/hooks/useCircles.ts:500-542` (`fetchCircleLeaderboard`) sorts correctly per metric (dollar, r, winrate, trades, avgr).

The `useCircles` version is the one actually called in the app. The `circles.ts` version appears unused by the UI but is the "canonical data layer." If anything ever calls `readLeaderboard` from `circles.ts`, it will show wrong sort order for non-R metric circles.

**Fix:** Delete `readLeaderboard` from `circles.ts` or update it to accept a metric argument.

---

### C5 — Message sender identity is client-supplied

**Status: ❌ Impersonation possible**

`TradingCircles.tsx:165-168`:
```ts
await supabase.from("circle_messages").insert({
  circle_code: activeCircle.code,
  sender_id: profile.uid,
  sender_name: profile.name || "Trader",
  sender_handle: profile.handle || "",
  text,
});
```

`sender_name` and `sender_handle` are strings written directly from the client. If the RLS policy only checks `sender_id = auth.uid()`, a user could write any arbitrary name or handle in those fields — impersonating another user by name if not by UUID.

**Fix:** Use a database trigger or generated column to resolve `sender_name` and `sender_handle` from `public.profiles` on insert, treating `sender_id` as the authoritative identity. Never trust client-supplied display names for public-facing content.

---

### C6 — Kick/ban bypass

**Status: ⚠️ Soft ban, not hard ban**

`useCircles.ts:416-434` (`kickMember`) writes the member code to a ban list at `koda_circle_bans_<CODE>` in `shared_kv`. The ban list is checked during `readCircleMembers`. However:

1. The banned member's member row (`koda_circle_member_<CODE>_<memberCode>`) still exists in `shared_kv`.
2. On the next sync tick, `syncCircles` will call `readCircleMembers` which filters bans — so they won't appear in the members list.
3. But their leaderboard entry (`koda_circle_entry_<CODE>_<memberCode>`) also remains.
4. If the banned member still has the circle code, they can re-join (`joinCircle` in `useCircles.ts:349-389`) — this writes a new member row and does not check the ban list before joining.

**Fix:** Check the ban list in `joinCircle` before writing a new member row. Also delete the leaderboard entry on kick.

---

### C7 — Challenge completion via client-side cron call

**Status: ⚠️ Fragile**

`TradingCircles.tsx:259-262`:
```ts
if (challenge && new Date(challenge.endsAt) < new Date()) {
  fetch("/api/cron/complete-challenges", { method: "POST" }).catch(() => {});
  setTimeout(() => fetchActiveChallenge(circle.code).then(...), 2000);
}
```

Challenge completion is triggered by any client that opens a circle with an expired challenge. This is:
- **Not atomic** — multiple clients can fire simultaneously, potentially writing multiple completion records.
- **Not reliable** — if no client opens the circle, the challenge never completes.
- **Not authorized** — the `/api/cron/complete-challenges` endpoint presumably has a cron secret; calling it from the client without that secret will fail silently (`.catch(() => {})`).

**Fix:** Use a proper cron (Vercel Cron, Supabase pg_cron, or a scheduled edge function) to run challenge completion on a schedule. The client-side trigger should be removed.

---

### C8 — Missing database indexes

**Status: ⚠️ Probable — unverifiable without migrations**

Based on the queries in the code:

| Table | Query pattern | Index needed |
|-------|--------------|-------------|
| `circle_messages` | `eq("circle_code", ...).order("created_at", desc).limit(50)` | `(circle_code, created_at DESC)` |
| `circle_shared_trades` | `eq("circle_code", ...).limit(50)` | `(circle_code, shared_at DESC)` |
| `circle_challenges` | `eq("circle_code", ...).order("started_at", desc)` | `(circle_code, started_at DESC)` |
| `shared_kv` | `like("key", "koda_circle_member_CODE_%")` | `(key text_pattern_ops)` — requires `LIKE` index |

Without these, every circle tab open becomes a sequential scan. At current beta scale this is invisible; at 1,000 circles with 20 members each, it becomes a problem.

---

### C9 — Auto-publish thundering herd

**Status: ⚠️ Low risk now, medium risk at scale**

`useCircles.ts:195-203`:
```ts
useEffect(() => {
  if (loading) return;
  if (!myCircles.length) return;
  const publish = _publishRef.current;
  const t = setTimeout(() => {
    myCircles.forEach((c: Circle) => { publish(c.code, true); });
  }, 800);
  return () => clearTimeout(t);
}, [statsFingerprint, myCircles, loading]);
```

Every time the stats fingerprint changes (any trade logged, edited, or deleted), all circles auto-publish after 800ms. At beta scale (2–3 circles per user, infrequent trades), this is fine. If a user has 10 circles and logs 20 trades from a CSV import, this fires the auto-publish 20 times × 10 circles = 200 `storage.set` calls in rapid succession. The 800ms debounce only resets per render — CSV imports batch via `setTrades` which may coalesce renders.

**Fix:** Debounce the entire effect (not just the timeout), or only auto-publish at most once per 30 seconds regardless of how many stats changes arrive.

---

### C10 — leaveCircle inconsistency between data layer and hook

**Status: ⚠️ Minor but a maintenance trap**

`useCircles.ts:437-453` (hook's `leaveCircle`) deletes both the member row AND the entry row:
```ts
await Promise.all([
  storage.del(`koda_circle_member_${circleCode}_${myCode}`, true),
  storage.del(`koda_circle_entry_${circleCode}_${myCode}`, true),
]);
```

`src/data/circles.ts:177-184` (data layer's `leaveCircle`) only deletes the member row.

The hook is what the app calls. The data layer function is never called for leave. When the data layer is eventually used (e.g. in a server-side API route), it will leave ghost leaderboard entries. Delete both rows in both implementations.

---

### C: Summary

The Circles backend is architecturally sound — per-owner-row isolation in `shared_kv` is correct and prevents the RLS bugs that plagued the early build. The three issues that need fixing before beta scale:

**P0 (fix now):**
- C5: Message impersonation (sender display name is client-trusted)
- C6: Ban bypass (kicked members can rejoin)

**P1 (fix this sprint):**
- C2: Realtime subscription broadcasts all shared_kv — add a server-side key filter
- C7: Replace client-side cron trigger with a real scheduled job
- C4: Delete the unused `readLeaderboard` from `circles.ts` to avoid future divergence

**P2 (before public launch):**
- C1: Commit migration SQL files
- C8: Add database indexes
- C9: Improve auto-publish debouncing for CSV import bulk loads

---

## Overall thesis gap assessment

| Area | Claim | Reality | Gap |
|------|-------|---------|-----|
| Kill switch | Stops trading after max loss | Shows banner only | **Critical** |
| Trade limit | Enforces max trades per day | Shows banner only | **Critical** |
| Checklist link | Pre-trade adherence enforced | Optional, no submit gate | **High** |
| Weekly leaderboard | Compete this week | Broken — shows all-time | **High** |
| Circle discovery | Organic growth | Fake tab, code-only | **High** |
| Notifications | Competitive pull | Not implemented | **Medium** |
| Emotion analytics | Insight from tags | Data collected, not surfaced | **Medium** |
| Message trust | Identity verified | Client-supplied names | **Critical** |
| Ban enforcement | Kick = permanent removal | Soft ban, bypassable | **High** |

The product is ahead of most journaling tools on design and structure. The differentiator gap is real but closeable — most of these are 1–5 day fixes, not fundamental redesigns. The two that require the most care are the intervention enforcement (blocking submit, not just warning) and the Circles backend trust model (server-side identity resolution for messages).

---

*This document is a point-in-time audit. It describes the state of the codebase as of 2026-05-30. No code was modified during this review.*
