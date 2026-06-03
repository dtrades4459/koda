# Engagement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three-piece retention unlock — read/unread chat state, expanded push notifications on social events, and a weekly digest — so users feel seen by the system and have a reason to return tomorrow.

**Architecture:**
- **Read/unread:** new Postgres `chat_reads(user_id, circle_code, last_read_at)` table; client upserts on chat tab open; client queries unread counts on circles list render.
- **Notifications:** extend `api/push.ts` with four new actions (`notify-follow`, `notify-circle-join`, `notify-reaction`, `notify-like`). Each action also writes a row to a new `notification_feed` table so the in-app inbox has a paper trail. Client triggers the actions after the source mutation succeeds (RLS keeps source mutations safe; missed notification on rare client failure is acceptable).
- **Digest:** new Vercel cron `weekly-digest` runs Sunday 18:00 UTC, aggregates the week's `notification_feed` per user, sends one consolidated push and marks the rows aggregated. New `<NotificationFeed/>` component renders the inbox inside the Social tab.

**Tech Stack:** Supabase Postgres + Realtime, Vercel serverless (Node.js runtime), TypeScript, React 19, Web Push API, existing VAPID keys.

**Out of scope (v2):** email digest, bell-icon dropdown UI, DM read receipts (no DMs exist yet), notification preferences UI (we hard-code opt-out via existing PWA permission only).

---

## Task 0: Discovery preflight — code-to-UID resolution

Notification routing needs to convert a "member code" (the public string used in KV keys like `koda_circle_member_<CODE>_<memberCode>`) into the Supabase `auth.users.id` UUID we use to look up notification subscriptions. Before writing routing logic, confirm where this mapping lives.

**Files:**
- Read: `src/data/follows.ts` (look for code↔uid helpers)
- Read: `src/data/circles.ts` (look for owner-uid lookup)
- Read: `api/push.ts:65-112` (existing `notify-circle` action — see how it routes by circle code)
- Read: `supabase/migrations/` (any `profiles` table schema)

- [ ] **Step 1: Find the helper or note its absence**

Grep for likely names: `codeToUid`, `uidFromCode`, `resolveUid`, `profile.code`, `auth_uid`. Read `api/push.ts` `notify-circle` implementation closely — it must already do this resolution to fan out to circle members.

- [ ] **Step 2: Record findings in this plan**

If a helper exists, note its path + signature here (edit this file). If only an inline pattern exists in `api/push.ts`, copy the relevant snippet into the notes below. If neither, plan Task 0.5 to add a `resolveUidByCode(code: string): Promise<string | null>` helper in `api/lib/identity.ts`.

**Notes (filled in by implementer):**
- Helper found at: _____
- Pattern used in api/push.ts: _____
- Decision: _____

- [ ] **Step 3: No commit (research only)**

---

## Phase 1 — Read/unread chat state

### Task 1: Migration for `chat_reads` table

**Files:**
- Create: `supabase/migrations/20260603_chat_reads.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260603_chat_reads.sql
create table if not exists public.chat_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_code text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, circle_code)
);

create index if not exists chat_reads_user_idx on public.chat_reads (user_id);

alter table public.chat_reads enable row level security;

create policy chat_reads_self_select on public.chat_reads
  for select using (auth.uid() = user_id);

create policy chat_reads_self_upsert on public.chat_reads
  for insert with check (auth.uid() = user_id);

create policy chat_reads_self_update on public.chat_reads
  for update using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or run the SQL directly against the staging DB if the user works that way — check `CLAUDE.md` for the project's convention).
Expected: table exists, indexes created, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260603_chat_reads.sql
git commit -m "feat(chat): add chat_reads table for unread tracking"
```

### Task 2: Data layer — `getUnreadCounts` and `markChatRead`

**Files:**
- Create: `src/data/chatReads.ts`
- Test: `src/data/chatReads.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/data/chatReads.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { supabase } from "../lib/supabase";
import { markChatRead } from "./chatReads";

describe("markChatRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a row with the current user_id and now() last_read_at", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert });

    await markChatRead("KODA-ABC1");

    expect(supabase.from).toHaveBeenCalledWith("chat_reads");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", circle_code: "KODA-ABC1" }),
      expect.objectContaining({ onConflict: "user_id,circle_code" })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test src/data/chatReads.test.ts`
Expected: FAIL with "Cannot find module './chatReads'".

- [ ] **Step 3: Implement `chatReads.ts`**

```typescript
// src/data/chatReads.ts
import { supabase } from "../lib/supabase";

export async function markChatRead(circleCode: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from("chat_reads").upsert(
    {
      user_id: uid,
      circle_code: circleCode,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,circle_code" }
  );
}

/**
 * Returns a map of circle_code → unread message count for the current user.
 * Counts messages in each requested circle whose created_at is after the
 * user's last_read_at, or all messages if no last_read row exists.
 */
export async function getUnreadCounts(
  circleCodes: string[]
): Promise<Record<string, number>> {
  if (circleCodes.length === 0) return {};
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return {};

  const { data: reads } = await supabase
    .from("chat_reads")
    .select("circle_code, last_read_at")
    .eq("user_id", uid)
    .in("circle_code", circleCodes);

  const lastRead: Record<string, string> = {};
  for (const r of reads ?? []) lastRead[r.circle_code] = r.last_read_at;

  // One round-trip per circle keeps the SQL simple; circle counts per user
  // are small (typically <10), so the cost is negligible.
  const result: Record<string, number> = {};
  await Promise.all(
    circleCodes.map(async (code) => {
      let q = supabase
        .from("circle_messages")
        .select("id", { count: "exact", head: true })
        .eq("circle_code", code);
      const since = lastRead[code];
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      result[code] = count ?? 0;
    })
  );
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test src/data/chatReads.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/chatReads.ts src/data/chatReads.test.ts
git commit -m "feat(chat): data layer for mark-read and unread counts"
```

### Task 3: Wire `markChatRead` on chat tab open in TradingCircles

**Files:**
- Modify: `src/TradingCircles.tsx` (around the chat tab activation — search for `circle_chat_` subscription)

- [ ] **Step 1: Import the helper**

```typescript
import { markChatRead } from "./data/chatReads";
```

- [ ] **Step 2: Call on chat tab activation**

Find the effect that runs when the active tab becomes "chat" (the realtime subscription effect). Inside that effect, after the initial fetch resolves, call:

```typescript
if (activeCircle?.code) void markChatRead(activeCircle.code);
```

Also call it whenever a new realtime message arrives **while the chat tab is visible** (so the badge resets):

```typescript
// inside the realtime payload handler, after appending the new message
if (document.visibilityState === "visible" && activeTab === "chat") {
  void markChatRead(activeCircle.code);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/TradingCircles.tsx
git commit -m "feat(chat): mark circle chat as read on open"
```

### Task 4: Unread badges on circles list

**Files:**
- Modify: `src/TradingCircles.tsx` (the circles list render — search for the list rendering each joined circle)

- [ ] **Step 1: Load unread counts**

Near the top of the component (after circles are loaded), add:

```typescript
const [unread, setUnread] = useState<Record<string, number>>({});

useEffect(() => {
  if (!circles?.length) return;
  let alive = true;
  (async () => {
    const counts = await getUnreadCounts(circles.map((c) => c.code));
    if (alive) setUnread(counts);
  })();
  return () => { alive = false; };
}, [circles]);
```

Import the helper:

```typescript
import { getUnreadCounts, markChatRead } from "./data/chatReads";
```

- [ ] **Step 2: Render badge on each circle row**

Inside the circle list item render, next to the circle name, add:

```tsx
{unread[circle.code] > 0 && (
  <span
    aria-label={`${unread[circle.code]} unread`}
    style={{
      minWidth: 16,
      height: 16,
      borderRadius: 999,
      background: C.accent,
      color: C.bg,
      fontFamily: MONO,
      fontSize: 9,
      fontWeight: 700,
      padding: "0 5px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {unread[circle.code] > 99 ? "99+" : unread[circle.code]}
  </span>
)}
```

- [ ] **Step 3: Refresh counts when chat is marked read**

After the existing `markChatRead` call in Task 3, locally zero the count to avoid waiting on a re-fetch:

```typescript
setUnread((u) => ({ ...u, [activeCircle.code]: 0 }));
```

- [ ] **Step 4: Verify in-browser**

Run: `npm run dev`
Open two browser sessions as two different users, send messages from one, verify the badge increments on the other and clears when the other opens that circle's chat.

- [ ] **Step 5: Commit**

```bash
git add src/TradingCircles.tsx
git commit -m "feat(chat): unread badge on circle list"
```

### Task 5: "X NEW" divider line in chat

**Files:**
- Modify: `src/TradingCircles.tsx` (chat message render loop)

- [ ] **Step 1: Capture `firstUnreadId` on chat open**

When the chat tab opens, before calling `markChatRead`, capture the boundary so the divider stays put during the session:

```typescript
const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

useEffect(() => {
  if (activeTab !== "chat" || !activeCircle?.code) return;
  (async () => {
    const { data } = await supabase
      .from("chat_reads")
      .select("last_read_at")
      .eq("circle_code", activeCircle.code)
      .maybeSingle();
    const since = data?.last_read_at ?? null;
    if (!since) return;
    const firstUnread = messages.find(
      (m) => new Date(m.created_at).getTime() > new Date(since).getTime()
    );
    setFirstUnreadId(firstUnread?.id ?? null);
  })();
}, [activeTab, activeCircle?.code]);
```

- [ ] **Step 2: Render divider above the first unread message**

In the message render loop:

```tsx
{messages.map((m) => (
  <Fragment key={m.id}>
    {m.id === firstUnreadId && (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        margin: "6px 0", fontFamily: MONO, fontSize: 9,
        letterSpacing: "0.14em", color: C.accent,
      }}>
        <div style={{ flex: 1, height: 1, background: C.accent, opacity: 0.4 }} />
        NEW
        <div style={{ flex: 1, height: 1, background: C.accent, opacity: 0.4 }} />
      </div>
    )}
    {/* existing message render */}
  </Fragment>
))}
```

- [ ] **Step 3: Commit**

```bash
git add src/TradingCircles.tsx
git commit -m "feat(chat): show NEW divider above first unread message"
```

### Task 6: Aggregate total social unread on bottom nav

**Files:**
- Modify: `src/Koda.tsx` (around the `NAV_TABS` rendering — search for `tab.id === "circles"` or `tab.id === "social"`)

- [ ] **Step 1: Compute total unread**

Lift the `getUnreadCounts` call into a shared hook so both Koda.tsx (for nav badge) and TradingCircles.tsx (for list badges) can use it.

Create: `src/hooks/useUnreadCircles.ts`

```typescript
import { useEffect, useState } from "react";
import { getUnreadCounts } from "../data/chatReads";

export function useUnreadCircles(circleCodes: string[]): {
  perCircle: Record<string, number>;
  total: number;
  refresh: () => Promise<void>;
} {
  const [perCircle, setPerCircle] = useState<Record<string, number>>({});

  const refresh = async () => {
    if (circleCodes.length === 0) {
      setPerCircle({});
      return;
    }
    const counts = await getUnreadCounts(circleCodes);
    setPerCircle(counts);
  };

  useEffect(() => {
    void refresh();
    // re-poll every 30s as a backstop for missed realtime events
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [circleCodes.join(",")]);

  const total = Object.values(perCircle).reduce((a, b) => a + b, 0);
  return { perCircle, total, refresh };
}
```

- [ ] **Step 2: Use the hook in TradingCircles.tsx**

Replace the local `unread` state from Task 4 with:

```typescript
const { perCircle: unread, refresh: refreshUnread } = useUnreadCircles(
  circles?.map((c) => c.code) ?? []
);
```

After `markChatRead`, call `refreshUnread()` instead of manually zeroing.

- [ ] **Step 3: Use the hook in Koda.tsx for the nav badge**

In Koda.tsx, near the NAV_TABS render:

```typescript
import { useUnreadCircles } from "./hooks/useUnreadCircles";

// inside the component
const { total: circlesUnread } = useUnreadCircles(circles.map((c) => c.code));
```

Render a small dot badge on the "Circles" nav tab when `circlesUnread > 0`:

```tsx
{tab.id === "circles" && circlesUnread > 0 && (
  <span style={{
    position: "absolute", top: 6, right: 6, width: 8, height: 8,
    borderRadius: 999, background: C.accent,
  }} />
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUnreadCircles.ts src/TradingCircles.tsx src/Koda.tsx
git commit -m "feat(chat): nav badge for total unread circle messages"
```

---

## Phase 2 — Push notification expansion

### Task 7: Migration for `notification_feed` table

**Files:**
- Create: `supabase/migrations/20260603_notification_feed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260603_notification_feed.sql
create table if not exists public.notification_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('follow', 'circle_join', 'reaction', 'idea_like', 'digest')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  aggregated_at timestamptz
);

create index if not exists notification_feed_user_unread_idx
  on public.notification_feed (user_id, created_at desc)
  where read_at is null;

create index if not exists notification_feed_digest_idx
  on public.notification_feed (user_id, created_at)
  where aggregated_at is null;

alter table public.notification_feed enable row level security;

-- Users can see their own notifications
create policy notif_feed_self_select on public.notification_feed
  for select using (auth.uid() = user_id);

-- Users can mark their own as read
create policy notif_feed_self_update on public.notification_feed
  for update using (auth.uid() = user_id);

-- Inserts come from server-side push handlers only (service role bypasses RLS).
-- No insert policy → no client-side writes.
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: table exists, partial indexes created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260603_notification_feed.sql
git commit -m "feat(notifs): add notification_feed table"
```

### Task 8: Shared notification helper in `api/push.ts`

**Files:**
- Modify: `api/push.ts` (add a shared `deliverNotification` helper used by all four new actions)

- [ ] **Step 1: Add the helper**

Near the top of `api/push.ts` after the existing imports, add:

```typescript
type NotifKind = "follow" | "circle_join" | "reaction" | "idea_like";

interface DeliverOpts {
  targetUid: string;
  kind: NotifKind;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

async function deliverNotification(opts: DeliverOpts): Promise<void> {
  const admin = getAdminClient();
  // 1. Write to in-app feed
  await admin.from("notification_feed").insert({
    user_id: opts.targetUid,
    kind: opts.kind,
    data: { title: opts.title, body: opts.body, ...opts.data },
  });
  // 2. Push to all subscribed endpoints
  const { data: subs } = await admin
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", opts.targetUid);
  if (!subs?.length) return;
  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    data: { kind: opts.kind, ...opts.data },
  });
  await Promise.all(
    subs.map((s) =>
      sendPush(s.endpoint, s.p256dh, s.auth_key, payload).catch((err) => {
        console.error("[push] deliver failed:", err);
      })
    )
  );
}
```

If `sendPush` doesn't exist yet, factor it out from the existing `notify-circle` action — copy the `webpush.sendNotification(...)` call into a helper of that name. Reuse the existing dead-endpoint cleanup logic (410/404 handling).

- [ ] **Step 2: Commit**

```bash
git add api/push.ts
git commit -m "refactor(push): extract deliverNotification helper"
```

### Task 9: `notify-follow` action

**Files:**
- Modify: `api/push.ts` (extend the router)
- Modify: `src/data/follows.ts:105` (call the action after followUser succeeds)

- [ ] **Step 1: Add the action handler**

In the router section of `api/push.ts`, add a branch:

```typescript
if (action === "notify-follow") {
  const uid = await getUserIdFromJwt(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const { targetUid, followerName, followerHandle } = req.body as {
    targetUid?: string;
    followerName?: string;
    followerHandle?: string;
  };
  if (!targetUid || typeof targetUid !== "string") {
    return res.status(400).json({ error: "targetUid required" });
  }
  if (targetUid === uid) return res.status(200).json({ ok: true }); // no self-notify
  await deliverNotification({
    targetUid,
    kind: "follow",
    title: followerName ?? followerHandle ?? "Someone",
    body: "started following you",
    data: { followerUid: uid, followerHandle: followerHandle ?? null },
  });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Call from `followUser`**

In `src/data/follows.ts`, after the successful follow row write, add:

```typescript
async function notifyFollow(targetUid: string, myName?: string, myHandle?: string) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    await fetch("/api/push?action=notify-follow", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetUid, followerName: myName, followerHandle: myHandle }),
    });
  } catch { /* notifications are best-effort */ }
}
```

You need `targetUid` (the followed user's auth UID), not `targetCode`. The existing `followUser` takes a code. Either:
- (a) Extend `followUser` signature to optionally accept `targetUid`, fetched by the caller from the profile lookup that resolved `targetCode`, or
- (b) Resolve `targetCode` → `targetUid` inside `followUser` via the `profiles` table (lookup by handle or by a code-keyed row).

Pick whichever matches the Task 0 finding. Document the choice in this step before coding.

Call `notifyFollow(targetUid, ...)` at the end of the success path of `followUser`.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Log in as user A on one browser, user B on another. Have B follow A (or vice versa). Verify a push notification arrives on A's device (PWA must be installed and permission granted) AND a row appears in `notification_feed` for A.

- [ ] **Step 4: Commit**

```bash
git add api/push.ts src/data/follows.ts
git commit -m "feat(notifs): push + feed on follow"
```

### Task 10: `notify-circle-join` action

**Files:**
- Modify: `api/push.ts` (router + handler)
- Modify: `src/hooks/useCircles.ts:353-400` (after `joinCircle` succeeds, fire the notification to the circle owner)

- [ ] **Step 1: Add the action handler**

```typescript
if (action === "notify-circle-join") {
  const uid = await getUserIdFromJwt(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const { circleCode, ownerUid, joinerName, joinerHandle } = req.body as {
    circleCode?: string;
    ownerUid?: string;
    joinerName?: string;
    joinerHandle?: string;
  };
  if (!circleCode || !ownerUid) {
    return res.status(400).json({ error: "circleCode and ownerUid required" });
  }
  if (ownerUid === uid) return res.status(200).json({ ok: true }); // creator joining their own
  await deliverNotification({
    targetUid: ownerUid,
    kind: "circle_join",
    title: joinerName ?? joinerHandle ?? "Someone",
    body: `joined ${circleCode}`,
    data: { circleCode, joinerUid: uid, joinerHandle: joinerHandle ?? null },
  });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Call from `joinCircle`**

In `src/hooks/useCircles.ts`, after `joinCircle` writes the member row successfully:

```typescript
try {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (token && circleMeta.created_by && circleMeta.created_by !== currentUid) {
    await fetch("/api/push?action=notify-circle-join", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        circleCode: code,
        ownerUid: circleMeta.created_by,
        joinerName: profile.name,
        joinerHandle: profile.handle,
      }),
    });
  }
} catch { /* best-effort */ }
```

The circle metadata read in `joinCircle` already includes `created_by` (per the audit). If not, fetch it first.

- [ ] **Step 3: Commit**

```bash
git add api/push.ts src/hooks/useCircles.ts
git commit -m "feat(notifs): push + feed when someone joins your circle"
```

### Task 11: `notify-reaction` action

**Files:**
- Modify: `api/push.ts` (router + handler)
- Modify: `src/data/circlesSharedTrades.ts` (after reaction is added)
- Modify: `src/FriendsFeed.tsx` (after a feed-trade reaction is added — the existing `reactToFeed` flow)

- [ ] **Step 1: Add the action handler**

```typescript
if (action === "notify-reaction") {
  const uid = await getUserIdFromJwt(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const { targetUid, surface, emoji, contextLabel } = req.body as {
    targetUid?: string;
    surface?: "feed_trade" | "shared_trade";
    emoji?: string;
    contextLabel?: string;
  };
  if (!targetUid || !surface || !emoji) {
    return res.status(400).json({ error: "targetUid, surface, emoji required" });
  }
  if (targetUid === uid) return res.status(200).json({ ok: true });
  await deliverNotification({
    targetUid,
    kind: "reaction",
    title: "New reaction",
    body: `${emoji} on your ${surface === "feed_trade" ? "trade" : "shared trade"}${contextLabel ? ` (${contextLabel})` : ""}`,
    data: { surface, emoji, fromUid: uid },
  });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Call from reaction handlers**

Inside the existing reaction code path in `src/data/circlesSharedTrades.ts` (and `FriendsFeed.tsx`'s `reactToFeed`), after the reaction is persisted successfully, fire:

```typescript
async function notifyReaction(opts: {
  targetUid: string;
  surface: "feed_trade" | "shared_trade";
  emoji: string;
  contextLabel?: string;
  currentUid: string;
}) {
  if (opts.targetUid === opts.currentUid) return; // no self-notify
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    await fetch("/api/push?action=notify-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        targetUid: opts.targetUid,
        surface: opts.surface,
        emoji: opts.emoji,
        contextLabel: opts.contextLabel,
      }),
    });
  } catch { /* best-effort */ }
}
```

In `FriendsFeed.tsx`'s `reactToFeed`, the feed item's `authorCode` resolves to `authorUid` via the lookup pattern recorded in Task 0. In `circlesSharedTrades.ts`, use the row's `author_uid` if it exists, otherwise resolve from `author_code` via Task 0's pattern.

Call with `surface: "feed_trade"` from FriendsFeed and `surface: "shared_trade"` from circlesSharedTrades. Pass an optional `contextLabel` like the instrument or strategy name so the push body has signal (e.g. `"🔥 on your trade (ES short)"`).

- [ ] **Step 3: Commit**

```bash
git add api/push.ts src/data/circlesSharedTrades.ts src/FriendsFeed.tsx
git commit -m "feat(notifs): push + feed on reactions"
```

### Task 12: `notify-like` action (idea likes)

**Files:**
- Modify: `api/push.ts` (router + handler)
- Modify: `api/ideas.ts` (after the like row is inserted in the `action === "like"` branch)

- [ ] **Step 1: Add the action handler**

```typescript
if (action === "notify-like") {
  const uid = await getUserIdFromJwt(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  const { targetUid, ideaId, ideaTitle } = req.body as {
    targetUid?: string;
    ideaId?: string;
    ideaTitle?: string;
  };
  if (!targetUid || !ideaId) {
    return res.status(400).json({ error: "targetUid and ideaId required" });
  }
  if (targetUid === uid) return res.status(200).json({ ok: true });
  await deliverNotification({
    targetUid,
    kind: "idea_like",
    title: "Idea liked",
    body: ideaTitle ? `Someone liked "${ideaTitle}"` : "Someone liked your idea",
    data: { ideaId, fromUid: uid },
  });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Wire from server-side `api/ideas.ts` like handler**

Inside the existing like flow in `api/ideas.ts`, after the like row insert succeeds:

```typescript
// fetch the idea author + title in the same round-trip, then:
if (idea.author_uid !== uid) {
  await deliverNotification({
    targetUid: idea.author_uid,
    kind: "idea_like",
    title: "Idea liked",
    body: `Someone liked "${idea.title}"`,
    data: { ideaId: idea.id, fromUid: uid },
  });
}
```

This is a same-process call (both files run in serverless), so import `deliverNotification` directly from `./push` rather than going through HTTP. Export the helper from `api/push.ts`:

```typescript
export { deliverNotification };
```

- [ ] **Step 3: Commit**

```bash
git add api/push.ts api/ideas.ts
git commit -m "feat(notifs): push + feed when your idea is liked"
```

---

## Phase 3 — Weekly digest + in-app inbox

### Task 13: `weekly-digest` cron handler

**Files:**
- Modify: `api/cron.ts` (add a new job branch)
- Modify: `vercel.json` (schedule the cron)

- [ ] **Step 1: Add the handler**

In `api/cron.ts`, alongside the existing job handlers, add:

```typescript
async function handleWeeklyDigest(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  const admin = getAdminClient();

  // 1. Pull all distinct user_ids with notifications in the past 7 days that
  //    haven't been aggregated yet.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from("notification_feed")
    .select("user_id, kind, data, id")
    .gte("created_at", sevenDaysAgo)
    .is("aggregated_at", null);

  if (!rows?.length) return res.status(200).json({ ok: true, users: 0 });

  // 2. Group by user_id, count by kind.
  const byUser: Record<string, { ids: string[]; counts: Record<string, number> }> = {};
  for (const r of rows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { ids: [], counts: {} };
    byUser[r.user_id].ids.push(r.id);
    byUser[r.user_id].counts[r.kind] = (byUser[r.user_id].counts[r.kind] ?? 0) + 1;
  }

  // 3. For each user: build summary text, deliver, mark aggregated.
  const userCount = Object.keys(byUser).length;
  for (const [uid, agg] of Object.entries(byUser)) {
    const parts: string[] = [];
    if (agg.counts.follow) parts.push(`${agg.counts.follow} new follower${agg.counts.follow > 1 ? "s" : ""}`);
    if (agg.counts.circle_join) parts.push(`${agg.counts.circle_join} circle join${agg.counts.circle_join > 1 ? "s" : ""}`);
    if (agg.counts.reaction) parts.push(`${agg.counts.reaction} reaction${agg.counts.reaction > 1 ? "s" : ""}`);
    if (agg.counts.idea_like) parts.push(`${agg.counts.idea_like} idea like${agg.counts.idea_like > 1 ? "s" : ""}`);

    const body = `This week: ${parts.join(" · ")}`;

    await deliverNotification({
      targetUid: uid,
      kind: "digest",
      title: "Your Kōda week",
      body,
      data: { counts: agg.counts },
    });

    await admin
      .from("notification_feed")
      .update({ aggregated_at: new Date().toISOString() })
      .in("id", agg.ids);
  }

  return res.status(200).json({ ok: true, users: userCount });
}
```

Wire into the router:

```typescript
if (job === "weekly-digest") return handleWeeklyDigest(req, res);
```

Import `deliverNotification` from `./push.js`.

- [ ] **Step 2: Schedule it**

Edit `vercel.json` and add to the `crons` array:

```json
{
  "path": "/api/cron?job=weekly-digest",
  "schedule": "0 18 * * 0"
}
```

(Sunday 18:00 UTC = early Sunday afternoon US Eastern, early Sunday evening UK.)

- [ ] **Step 3: Manual smoke**

Run: `curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron?job=weekly-digest"`
Expected: `{"ok": true, "users": N}`. Verify a `digest` row appeared in `notification_feed` for users with prior activity.

- [ ] **Step 4: Commit**

```bash
git add api/cron.ts vercel.json
git commit -m "feat(notifs): weekly-digest cron consolidates the week"
```

### Task 14: `<NotificationFeed/>` component

**Files:**
- Create: `src/components/NotificationFeed.tsx`
- Create: `src/data/notificationFeed.ts`

- [ ] **Step 1: Data layer helpers**

```typescript
// src/data/notificationFeed.ts
import { supabase } from "../lib/supabase";

export interface FeedNotif {
  id: string;
  kind: "follow" | "circle_join" | "reaction" | "idea_like" | "digest";
  data: { title?: string; body?: string; [k: string]: unknown };
  created_at: string;
  read_at: string | null;
}

export async function listNotifications(limit = 30): Promise<FeedNotif[]> {
  const { data, error } = await supabase
    .from("notification_feed")
    .select("id, kind, data, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as FeedNotif[];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("notification_feed")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
}
```

- [ ] **Step 2: Component**

```tsx
// src/components/NotificationFeed.tsx
import { useEffect, useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY } from "../shared";
import { listNotifications, markNotificationsRead, type FeedNotif } from "../data/notificationFeed";

interface Props { C: Theme }

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

export function NotificationFeed({ C }: Props) {
  const [items, setItems] = useState<FeedNotif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listNotifications(30);
      if (!alive) return;
      setItems(list);
      setLoading(false);
      const unread = list.filter((n) => !n.read_at).map((n) => n.id);
      if (unread.length) await markNotificationsRead(unread);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return null;
  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: C.muted, fontFamily: MONO, fontSize: 11 }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: BODY }}>
      {items.map((n) => (
        <div key={n.id} style={{
          padding: 10,
          borderRadius: 8,
          background: n.read_at ? C.panel : `color-mix(in oklch, ${C.accent} 8%, ${C.panel})`,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
            <strong>{n.data.title}</strong> {n.data.body}
          </div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: MONO, marginTop: 3, letterSpacing: "0.06em" }}>
            {relativeAgo(n.created_at).toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationFeed.tsx src/data/notificationFeed.ts
git commit -m "feat(notifs): NotificationFeed component + data layer"
```

### Task 15: Wire `<NotificationFeed/>` into Social tab

**Files:**
- Modify: `src/Koda.tsx` (Social view rendering) — find the Social section render and add an "Activity" sub-tab

- [ ] **Step 1: Add the sub-tab**

In `src/Koda.tsx`, find the existing `social` view render and the `subNavFor("social")` configuration. Add an "Activity" section to the social subnav alongside the existing sections:

```typescript
const SOCIAL_SECTIONS = [
  { id: "feed", label: "Feed" },
  { id: "ideas", label: "Ideas" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
];
```

Render the component when `socialSection === "activity"`:

```tsx
{socialSection === "activity" && <NotificationFeed C={C} />}
```

Import:

```typescript
import { NotificationFeed } from "./components/NotificationFeed";
```

- [ ] **Step 2: Activity unread badge on Social nav tab**

Reuse the dot-badge pattern from Task 6. Add a `useUnreadNotifications` hook:

```typescript
// src/hooks/useUnreadNotifications.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("notification_feed")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (alive) setCount(c ?? 0);
    };
    void fetchCount();
    const id = setInterval(() => void fetchCount(), 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return count;
}
```

Use it in Koda.tsx and render the dot on the Social tab same way as Circles.

- [ ] **Step 3: Verify end-to-end**

Run `npm run dev`. Trigger one of each notification (follow, circle join, reaction, idea like) across two browser sessions. Confirm:
- Notification_feed rows are created
- Push notifications fire (PWA installed + permission granted)
- The Activity tab shows the items in reverse chronological order
- The dot badge appears on the Social nav tab until you open Activity

- [ ] **Step 4: Commit**

```bash
git add src/Koda.tsx src/hooks/useUnreadNotifications.ts
git commit -m "feat(notifs): Activity tab + unread badge on Social"
```

---

## Task 16: Final verification + deploy

**Files:**
- No code changes — verification only.

- [ ] **Step 1: Run typecheck + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.api.json --noEmit`
Expected: no output (success).

Run: `npx eslint . --ext .ts,.tsx`
Expected: clean.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: all green, including new `chatReads.test.ts`.

- [ ] **Step 3: Manual end-to-end check**

Two browser sessions, two accounts. Walk through:
- A follows B → B sees push + feed row + activity badge
- A joins B's circle → B sees push + feed row
- A reacts to B's shared trade → B sees push + feed row
- A likes B's idea → B sees push + feed row
- B opens Activity → all rows marked read, dot disappears
- B opens A's circle chat → unread badge clears, NEW divider visible above the most recent batch

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

Wait for Vercel deploy. Trigger the weekly-digest cron manually once via:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://kodatrade.co.uk/api/cron?job=weekly-digest"
```

Expected: `{"ok": true, "users": N}` with N reflecting your test accounts. Verify the digest push arrives.

---

## Notes

- **Email digest is intentionally out of scope.** Adding email requires picking a vendor (Resend recommended), wiring template rendering, sender reputation setup, and unsubscribe management. That's its own plan, written next once this loop ships and you see the retention bump.
- **Notification preferences UI is also out of scope.** Users can already revoke push permission at the OS / browser level; that's good enough for v1. Per-kind opt-out comes after we see which kinds actually fire.
- **Realtime updates for the Activity tab itself are out of scope.** A 30s poll is fine for this surface; realtime adds complexity without changing the retention math.
