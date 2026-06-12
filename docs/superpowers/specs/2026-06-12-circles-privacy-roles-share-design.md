# Circles Growth Architecture — Privacy Toggles, Mentor Roles, Share Cards

**Date:** 2026-06-12
**Status:** Design — not yet implemented
**Author:** Claude (session with Dylon)

Three upgrades to Circles: (1) per-circle metric visibility toggles ("Hide P&L"),
(2) Owner/Moderator/Member roles + an Instructor Dashboard for coaches,
(3) a `/api/share` discipline-card endpoint with a `kodatrade.co.uk/join?ref=` growth loop.

---

## 0. How this maps to the codebase that actually exists

The request assumed a classic REST backend that assembles a circle feed and can
"filter the payload before sending it." **Kōda does not work that way**, and the
design below is different (and stronger) because of it:

1. **Leaderboards have no backend read path.** Each member's client *publishes*
   a JSON stats blob into `shared_kv` (`koda_circle_entry_<CODE>_<memberCode>`,
   built in `useCircles.ts → publishToCircle`). Other members read those rows
   directly via PostgREST. There is no controller to filter — so privacy must be
   enforced **at publish time**: hidden metrics are simply never written to the
   shared row. Data that never leaves the user's device cannot be leaked by any
   API, which is strictly stronger than response filtering.

2. **Today, every published $ P&L is readable by ANY signed-in user.**
   `shared_kv_select` is `USING (true)` for `authenticated`
   (`20260523_shared_kv_rls.sql`). Anyone with the anon key + a session can
   `listByPrefix('koda_circle_entry_')` across *all* circles, members or not.
   Feature 1 closes this in two layers: publish-time omission (the real fix)
   plus a member-only RLS policy on entry rows (defense in depth).

3. **Roles already half-exist.** `circle_members` (v2 relational, migration
   `002`) has `role in ('owner','member','banned')`, owner-update RLS, the
   `is_circle_member()` SECURITY DEFINER helper (20260610), and a complete
   backfill from KV member rows (security sprint, 2026-06-10). Feature 2 is an
   *extension* of this table, not a new system.

4. **Discipline data is already on the leaderboard wire.** `publishToCircle`
   ships `disciplineScore`/`disciplineGrade`, and `METRIC_VALUE` already
   supports `metric: "discipline"` circles. The Instructor Dashboard is a new
   *view* + two new published fields, not a new pipeline.

5. **Vercel Hobby budget: 9 of 12 functions used**
   (`account, broker/[action], businesstats, cron, ideas, news, push, stripe,
   telegram`). Feature 3 adds **one** (`api/share.ts`) → 10/12. AutoJournal's
   inbound-email webhook will want #11. Do not add more without consolidating.

**Interaction with the 6/15 competition:** competitors must NOT be able to hide
P&L from the 50K-EVAL-2026 board. Solved via "required metrics" (§2.4) with a
hardcoded fallback for `COMP_CIRCLE_CODE`.

---

## 1. Feature 1 — Granular per-circle visibility ("Hide P&L")

### 1.1 Where preferences live

In `user_kv` (private, RLS self-only — already exists, **zero migration**):

| Key | Meaning |
|---|---|
| `koda_viz_default` | account-wide default toggles |
| `koda_viz_<CIRCLE_CODE>` | per-circle override (merged over default) |

```ts
// src/lib/circleVisibility.ts  (new)
export interface CircleVisibility {
  /** Absolute cash amounts: totalPnLDollar, weekPnL, pnlPercent. R-multiples stay visible — they reveal no cash size. */
  pnl: boolean;
  winRate: boolean;
  /** disciplineScore + disciplineGrade + breakdown */
  discipline: boolean;
  avgRR: boolean;
  /** Gates sharing trades into the circle feed (circle_shared_trades) */
  tradeLogs: boolean;
}

export const VIZ_ALL_VISIBLE: CircleVisibility = {
  pnl: true, winRate: true, discipline: true, avgRR: true, tradeLogs: true,
};

export const vizKeys = {
  default: () => "koda_viz_default",
  circle: (code: string) => `koda_viz_${code}`,
};

/** Per-circle override merged over account default merged over all-visible. */
export async function readVisibility(code: string): Promise<CircleVisibility> {
  const [def, per] = await Promise.all([
    storage.get(vizKeys.default()),        // user_kv (private)
    storage.get(vizKeys.circle(code)),
  ]);
  const parse = (r: { value: string } | null) => {
    try { return r ? JSON.parse(r.value) : {}; } catch { return {}; }
  };
  return { ...VIZ_ALL_VISIBLE, ...parse(def), ...parse(per) };
}
```

Defaults are **all-visible** so existing leaderboards don't go blank on deploy.
The feature is the toggle, not a new default.

### 1.2 Enforcement at publish time (`useCircles.ts → publishToCircle`)

```ts
async function publishToCircle(circleCode: string, silent = false) {
  // ... existing stats selection unchanged ...

  // Visibility: per-circle prefs, overridden by circle-required metrics (§2.4).
  const viz = applyRequiredMetrics(
    await readVisibility(circleCode),
    await readRequiredMetrics(circleCode), // ['pnl','discipline',...] from meta
    circleCode, // hardcoded fallback: COMP_CIRCLE_CODE requires pnl+winRate+discipline
  );

  const entry = {
    memberCode: myCode,
    name: p.name || "Trader",
    handle: p.handle || "@trader",
    avatar: p.avatar || "",
    alias: p.alias?.trim() || myCode,
    wins: s.wins,
    losses: s.losses,
    total: s.total,
    // null = "withheld by user". UI renders a "Private" chip, not 0.
    winRate:        viz.winRate ? s.winRate : null,
    totalPnL:       parseFloat(s.totalPnL),               // R-units — not cash, always visible
    totalPnLDollar: viz.pnl ? s.totalPnlDollar : null,
    weekPnL:        viz.pnl ? s.weekPnL : null,
    pnlPercent:     viz.pnl ? pnlPercent : null,
    avgRR:          viz.avgRR ? (s.avgRR === "—" ? 0 : parseFloat(s.avgRR)) : null,
    streak: s.streak.count > 0 ? { type: s.streak.type, count: s.streak.count } : null,
    topStrategy: /* unchanged */,
    disciplineScore:   viz.discipline ? s.disciplineScore : null,
    disciplineGrade:   viz.discipline ? s.disciplineGrade : null,
    // NEW for instructor dashboard + share card (§2.3, §3):
    ruleCompliancePct: viz.discipline ? s.ruleCompliancePct : null,
    taggedCount:       viz.discipline ? s.taggedCount : null,
    // Echo the toggles so the UI can distinguish "Private" from "no data yet":
    viz: { pnl: viz.pnl, winRate: viz.winRate, discipline: viz.discipline, avgRR: viz.avgRR },
    updatedAt: new Date().toISOString(),
    // ... comp shotsMissing / staff spread unchanged ...
  };
  // write unchanged
}
```

`CircleStats` grows `ruleCompliancePct` + `taggedCount`, surfaced from
`calcDisciplineScore`'s existing `breakdown.rules` (`earned/max*100`) and
`taggedCount` — already computed in `src/lib/stats.ts:325`, just not exposed
on the snapshot.

### 1.3 Scrub on toggle change

Old entries containing `$` P&L stay in `shared_kv` until overwritten. The
settings screen must call `publishToCircle(code, true)` **immediately** when a
toggle is saved — that overwrites the shared row and scrubs the previous value.
(Auto-publish would do it eventually via `statsFingerprint`, but toggling
privacy must not wait for the next trade.)

### 1.4 Hidden ≠ zero in the UI and sort

- `METRIC_VALUE.dollar` maps `null → 0` already (`Number(null)||0`), so a
  P&L-hider in a `metric:"dollar"` circle ranks as 0. Render `—` + a `Private`
  chip (check `entry.viz.pnl === false`) rather than `$0`.
- `fetchCircleLeaderboard`'s placeholder entries (members who never published)
  keep `viz` absent → UI shows the existing "no data" state.

### 1.5 `tradeLogs` toggle

Sharing a trade into a circle is already an explicit user action
(`circle_shared_trades` via `src/data/circlesSharedTrades.ts`). The toggle:
1. hides the "Share to circle" action for that circle in the trade UI, and
2. guards in the data layer (`shareTradeToCircle` throws if
   `!(await readVisibility(code)).tradeLogs`) so no code path bypasses it.

Existing shared trades are unaffected — sharing was explicit consent; add a
"delete my shared trades from this circle" affordance later if asked.

### 1.6 Defense in depth — member-only RLS on entry rows (SQL)

Closes the platform-wide read described in §0.2. **Run only after re-verifying
the circle_members backfill** (pre-flight C from `20260610_circle_messages_strict_rls.sql`
must return 0 rows), otherwise members with missing rows lose leaderboards.

```sql
-- supabase/migrations/2026XXXX_shared_kv_entry_member_select.sql
-- Leaderboard entry rows become readable ONLY by fellow circle members.
-- All other shared_kv keys (circle meta, member rows, follow edges) keep
-- today's open-read behavior. Service role (api/*) bypasses RLS as always.

-- SECURITY DEFINER so the circle_members lookup is not subject to RLS
-- (same pattern as is_circle_member, 20260610).
create or replace function public.can_read_circle_entry(p_key text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.user_id = auth.uid()
      and cm.role <> 'banned'
      -- starts_with, NOT LIKE: circle codes derive from user-typed names and
      -- may contain '_' which is a LIKE wildcard.
      and starts_with(p_key, 'koda_circle_entry_' || cm.circle_code || '_')
  );
$$;

revoke all on function public.can_read_circle_entry(text) from public;
grant execute on function public.can_read_circle_entry(text) to authenticated;

drop policy if exists "shared_kv_select" on public.shared_kv;
create policy "shared_kv_select" on public.shared_kv
  for select to authenticated
  using (
    owner_id = auth.uid()
    or not starts_with(key, 'koda_circle_entry_')
    or public.can_read_circle_entry(key)
  );

notify pgrst, 'reload schema';

-- ROLLBACK (restores today's open read):
--   drop policy if exists "shared_kv_select" on public.shared_kv;
--   create policy "shared_kv_select" on public.shared_kv
--     for select to authenticated using (true);
--   notify pgrst, 'reload schema';
```

Realtime (`subscribeToCircle`) also flows through RLS — members keep their
events; non-members stop receiving entry events, which is the point.

---

## 2. Feature 2 — Roles + Instructor Dashboard (B2B)

### 2.1 Schema: add `moderator`, guard the role column

```sql
-- supabase/migrations/2026XXXX_circle_roles_moderator.sql

-- 1. Extend the role enum-check. (Postgres requires drop+re-add.)
alter table public.circle_members
  drop constraint if exists circle_members_role_check;
alter table public.circle_members
  add constraint circle_members_role_check
  check (role in ('owner','moderator','member','banned'));

-- 2. Required-metrics on the v2 circles table (KV meta mirrors it for the
--    live read path — see §2.4).
alter table public.circles
  add column if not exists required_metrics jsonb not null default '[]'::jsonb;

-- 3. Guard trigger: the owner-update RLS policy (cm_owner_update, 002) lets
--    the circle creator UPDATE member rows. Constrain what an update may do:
--    only `role` may change, and a circle may never lose its last owner.
create or replace function public.circle_members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id <> old.user_id or new.circle_code <> old.circle_code then
    raise exception 'circle_members: identity columns are immutable';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    if not exists (
      select 1 from public.circle_members cm
      where cm.circle_code = old.circle_code
        and cm.role = 'owner'
        and cm.user_id <> old.user_id
    ) then
      raise exception 'circle_members: cannot remove the last owner (promote a new owner first)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists circle_members_guard_trg on public.circle_members;
create trigger circle_members_guard_trg
  before update on public.circle_members
  for each row execute function public.circle_members_guard();
```

Notes:
- **Ownership transfer** = promote the other user to `owner` first, then demote
  yourself — the trigger enforces this ordering for free.
- Moderators get **no write policy** on `circle_members` — promote/demote/ban
  stays owner-only (RLS `cm_owner_update` unchanged). Moderators are a *read*
  tier (instructor dashboard) + future chat-moderation powers.
- The existing KV ban list (`koda_circle_bans_<CODE>`) stays the kick mechanism
  for the live KV path; setting `role='banned'` on the relational row should be
  done in the same action so chat RLS (which checks `role <> 'banned'`) agrees.

### 2.2 Role plumbing in the client

The join flow already reads `circle_members` for the owner lookup
(`useCircles.ts:421`). Add alongside the KV sync:

- **On create:** insert `(circle_code, uid, 'owner')` — `cm_self_join` RLS
  permits inserting your own row. *(Today this row comes from the 20260604 sync
  trigger; writing it explicitly removes the dependency on trigger timing.)*
- **On join:** insert `(circle_code, uid, 'member')` (idempotent upsert,
  `on conflict do nothing` — note the PK is `(circle_code, user_id)` so plain
  upsert works; no partial-index gotcha here).
- **`myRole(circleCode)`** helper: `select role from circle_members where ...`,
  cached per circle in `useCircles` state, drives UI gating.

### 2.3 Instructor Dashboard

A new view inside the circle screen, visible when `myRole ∈ {owner, moderator}`.
It is a **client-side re-projection of data the leaderboard already fetches** —
no new endpoint, no extra function slot:

- Source: `fetchCircleLeaderboard(circle)` entries (now carrying
  `ruleCompliancePct` + `taggedCount`, §1.2).
- Sort: `disciplineScore` desc (nulls last — reuse the `-1` sentinel from
  `METRIC_VALUE.discipline`), tiebreak `ruleCompliancePct` desc. **Not** P&L.
- Columns per student: Discipline score + grade, Rule compliance %, tagged
  trades vs total (tagging gaps = coaching signal), streak, `updatedAt`
  ("last active"), and a "withheld" marker where `viz.discipline === false`.
- Roster summary header: median discipline, % of members above 70, count not
  publishing — the at-a-glance "is my cohort following the rules" answer.

For coaches the sell is process-first: the dashboard intentionally has **no $
column at all**, regardless of toggles.

### 2.4 Required metrics (the coach/privacy tension)

A coach circle is useless if students hide discipline. Resolution = informed
consent at join time:

- Circle meta (KV blob + `circles.required_metrics`) gains
  `requiredMetrics: ("pnl"|"winRate"|"discipline"|"avgRR")[]`, set at creation
  (creator UI: "What must members share?").
- Join screen displays: *"This circle requires sharing: Discipline Score, Rule
  Compliance."* Joining = consent.
- `applyRequiredMetrics` (§1.2) forces those toggles on while publishing to
  that circle; the settings UI shows them locked with "required by this circle
  — leave the circle to stop sharing."
- Hardcoded fallback: `COMP_CIRCLE_CODE` requires `pnl, winRate, discipline`
  so competitors can't blank the 6/15 board.
- Honesty note: this is **client-enforced**. A tampered client can withhold a
  metric — the dashboard then shows "withheld/not publishing," which is itself
  visible non-compliance the coach can act on. Acceptable for v1; server-side
  attestation only becomes possible after the v2 trades read-flip.

### 2.5 Server-side role helper (for §3 and future routes)

```ts
// api/_lib/circles.ts  (new — _lib does NOT consume a function slot)
import type { SupabaseClient } from "@supabase/supabase-js";

export type CircleRole = "owner" | "moderator" | "member" | "banned";

export async function getCircleRole(
  admin: SupabaseClient, uid: string, circleCode: string,
): Promise<CircleRole | null> {
  const { data } = await admin
    .from("circle_members").select("role")
    .eq("circle_code", circleCode).eq("user_id", uid)
    .maybeSingle();
  return (data?.role as CircleRole | undefined) ?? null;
}

/** Throws-free guard: returns the role if allowed, null otherwise. */
export async function requireCircleRole(
  admin: SupabaseClient, uid: string, circleCode: string, allowed: CircleRole[],
): Promise<CircleRole | null> {
  const role = await getCircleRole(admin, uid, circleCode);
  return role && role !== "banned" && allowed.includes(role) ? role : null;
}
```

---

## 3. Feature 3 — `/api/share` discipline card + growth loop

### 3.1 Shape

**One new function** `api/share.ts` (→ 10/12), action-routed like
`api/account.ts`. v1 returns a **structured JSON payload**; the client renders
it to a PNG (offscreen canvas, DESIGN.md tokens) and invokes
`navigator.share` / download — same UX direction as `WeeklyReportCard`, no
server-side image rasterizer, no native deps, no extra function. If link
unfurls (OG images) are wanted later, that's a v2 `?action=og` on the *same*
function.

Why an endpoint at all, when the client has the data? (a) one canonical,
privacy-checked payload contract; (b) server-side share analytics; (c) v2 OG
unfurls need it anyway.

### 3.2 `api/share.ts` — production-ready

```ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · /api/share?action=discipline-card
//
// Returns a render-ready JSON payload for the shareable discipline card.
// The caller's identity comes ONLY from the JWT — there is no userId param,
// so you cannot request someone else's card. P&L is included only when the
// caller's own visibility prefs for the target circle allow it.
// One function file (Vercel Hobby 12-function budget: this is #10).
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { getAdminClient, getUserIdFromJwt } from "./_lib/supabaseAdmin.js";
import { requireCircleRole } from "./_lib/circles.js";

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown>; query: Record<string, string | string[] | undefined> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void; setHeader(k: string, v: string): void };

const APP_URL = process.env.APP_URL ?? "https://kodatrade.co.uk";

const ALLOWED_ORIGINS = new Set([
  APP_URL,
  APP_URL.replace("://", "://www."),
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: Req, res: Res) {
  const origin = (req.headers["origin"] as string | undefined) ?? "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : APP_URL);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Circle codes are NAME6-XXXX style; KODA-GLOBAL / 50K-EVAL-2026 also match.
const CIRCLE_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

const GRADE_LABEL: Record<string, string> = {
  "A+": "Elite", A: "Excellent", B: "Solid", C: "Developing", D: "At Risk", F: "Off the Rails",
};

interface VizPrefs { pnl?: boolean; winRate?: boolean; discipline?: boolean; avgRR?: boolean }

/** user_kv viz prefs: per-circle key merged over the account default. */
async function readVizPrefs(uid: string, circleCode: string): Promise<Required<VizPrefs>> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("user_kv").select("key, value")
    .eq("user_id", uid)
    .in("key", ["koda_viz_default", `koda_viz_${circleCode}`]);
  const merged: VizPrefs = {};
  // Apply default first, then the per-circle override.
  for (const key of ["koda_viz_default", `koda_viz_${circleCode}`]) {
    const row = (data ?? []).find(r => r.key === key);
    if (!row) continue;
    try {
      const v = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      Object.assign(merged, v);
    } catch { /* malformed prefs row → treat as unset */ }
  }
  // Missing prefs default to visible — matches client behavior (§1.1).
  return { pnl: true, winRate: true, discipline: true, avgRR: true, ...merged };
}

async function handleDisciplineCard(req: Req, res: Res) {
  // ── Auth: identity from JWT only ──────────────────────────────────────────
  const uid = await getUserIdFromJwt(req.headers["authorization"] as string | undefined);
  if (!uid) return res.status(401).json({ error: "Sign in to share" });

  // ── Rate limit: per-user, generous (it's a share button) ─────────────────
  const allowed = await checkRateLimit("share_card", uid, { limit: 30, windowMs: 600_000 });
  if (!allowed) return res.status(429).json({ error: "Slow down — try again in a few minutes" });

  // ── Input ─────────────────────────────────────────────────────────────────
  const circleCode = String((req.body as { circleCode?: unknown }).circleCode ?? "").toUpperCase();
  if (!CIRCLE_CODE_RE.test(circleCode)) return res.status(400).json({ error: "Invalid circle code" });

  const admin = getAdminClient();

  // ── Authorization: caller must be a non-banned member of the circle.
  //    (Also prevents using a stranger's circle code as a referral.)
  const role = await requireCircleRole(admin, uid, circleCode, ["owner", "moderator", "member"]);
  if (!role) return res.status(403).json({ error: "You are not a member of this circle" });

  // ── Identity + member code from profiles (service role, RLS bypassed) ────
  const { data: profile } = await admin
    .from("profiles").select("handle, name, avatar, member_code")
    .eq("user_id", uid).maybeSingle();
  if (!profile?.member_code) return res.status(404).json({ error: "Profile not found" });

  // ── The caller's OWN published leaderboard entry. Privacy filtering already
  //    happened at publish time; we still re-check prefs below (belt+braces).
  const { data: entryRow } = await admin
    .from("shared_kv").select("value")
    .eq("key", `koda_circle_entry_${circleCode}_${profile.member_code}`)
    .maybeSingle();
  if (!entryRow) return res.status(404).json({ error: "Publish your stats to this circle first" });

  let entry: Record<string, unknown>;
  try {
    entry = typeof entryRow.value === "string" ? JSON.parse(entryRow.value) : entryRow.value;
  } catch {
    return res.status(500).json({ error: "Corrupt leaderboard entry" });
  }

  const viz = await readVizPrefs(uid, circleCode);

  const score = entry.disciplineScore as number | null | undefined;
  const grade = (entry.disciplineGrade as string | null | undefined) ?? null;
  if (score == null || grade == null) {
    return res.status(409).json({ error: "Tag at least 3 trades this week to unlock your Discipline Card" });
  }

  // "Top followed rules" — human strings from the published compliance fields.
  const rules: string[] = [];
  const compliance = entry.ruleCompliancePct as number | null | undefined;
  if (compliance != null) rules.push(`Followed my rules on ${Math.round(compliance)}% of trades`);
  const streak = entry.streak as { type?: string; count?: number } | null;
  if (streak?.type === "win" && (streak.count ?? 0) >= 2) rules.push(`${streak.count}-trade win streak`);
  if (typeof entry.taggedCount === "number") rules.push(`${entry.taggedCount} trades reviewed & tagged`);

  // ── Render-ready payload. P&L appears ONLY behind the caller's own toggle.
  const card = {
    username: (profile.name as string) || "Trader",
    handle: (profile.handle as string) || "",          // stored WITH leading @ — render as-is
    avatar: (profile.avatar as string) || "",
    discipline: {
      score,                                            // 92
      outOf: 100,
      grade,                                            // "A"
      label: GRADE_LABEL[grade] ?? "",                  // "Excellent"
      display: `${score}/100 — ${GRADE_LABEL[grade] ?? grade}`,
    },
    rules,
    winRate: viz.winRate ? (entry.winRate as number | null) : null,
    avgRR:   viz.avgRR   ? (entry.avgRR as number | null)   : null,
    pnlDollar: viz.pnl   ? (entry.totalPnLDollar as number | null) : null,
    // Design tokens so any renderer matches DESIGN.md without hardcoding:
    theme: { bg: "#13110E", fg: "#EDEDE8", accentBlue: true, font: "Geist" },
  };

  // ── Growth loop: hardcoded tracking link back to the join funnel ─────────
  // SECURITY (see Addendum §A): the circle code IS the join code. Embedding it
  // in a public URL would publish the invite key of private circles. Public
  // circles use their code (it's discoverable anyway); private-circle cards
  // attribute to the SHARER instead via their member code — still a tracked
  // referral, zero leak.
  const { data: circleRow } = await admin
    .from("circles").select("privacy").eq("code", circleCode).maybeSingle();
  const ref = circleRow?.privacy === "private"
    ? `u_${profile.member_code}`
    : circleCode;
  const shareUrl = `${APP_URL}/join?ref=${encodeURIComponent(ref)}&utm_source=share_card`;

  // Best-effort share analytics — never block the response on it.
  void admin.from("share_events").insert({
    user_id: uid, circle_code: circleCode, kind: "discipline_card",
  }).then(() => {}, () => {});

  return res.status(200).json({
    card,
    shareUrl,
    shareText: `Discipline ${card.discipline.display} on @KodaTrade this week. Process over P&L. ${shareUrl}`,
  });
}

export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const action = String(req.query.action ?? "");
  if (action === "discipline-card") return handleDisciplineCard(req, res);
  return res.status(400).json({ error: "Unknown action" });
}
```

### 3.3 Attribution schema

```sql
-- supabase/migrations/2026XXXX_share_attribution.sql

-- Referral capture on the waitlist funnel.
alter table public.waitlist
  add column if not exists ref text;

-- Share analytics (service-role only, like waitlist).
create table if not exists public.share_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  circle_code text not null,
  kind        text not null default 'discipline_card',
  created_at  timestamptz not null default now()
);
alter table public.share_events enable row level security;
-- No policies: service-role only.

create index if not exists share_events_circle_idx
  on public.share_events(circle_code, created_at desc);
```

Plus two small edits:
1. **`api/account.ts → handleJoinWaitlist`**: accept optional `ref` from the
   body, validate against `CIRCLE_CODE_RE`, store it in the new column.
2. **Frontend `/join` capture**: on app load, if `location.pathname === "/join"`
   or `?ref=` present, stash `ref` in `localStorage("koda_ref")` and pass it to
   the waitlist/signup call. Signed-up referrals: write `ref` into auth
   `user_metadata` at signup so circle-level conversion is queryable later.

The closed loop: card seen on X/Discord → `/join?ref=CODE` → waitlist row with
`ref` → weekly query: *which coach circles are filling the funnel* — exactly
the wedge-sprint recruiting question.

---

## 4. Security check — "can a user query someone else's hidden P&L?"

| # | Attack path | Result after this design |
|---|---|---|
| 1 | Direct PostgREST `select` on `shared_kv` entry rows with own JWT | Hidden fields are **never written** to shared rows (publish-time omission). There is nothing to read. This holds even against API replay, custom clients, or future endpoint bugs. |
| 2 | Same, fishing across circles you're not in | Closed by §1.6: entry-row SELECT requires non-banned membership (SECURITY DEFINER check). Today this is wide open — ship §1.6 regardless of the rest. |
| 3 | Stale entries: P&L published *before* the user toggled hide | Scrub-on-toggle (§1.3) overwrites the row at the moment of toggling. Window ≈ seconds. |
| 4 | `/api/share` IDOR: request another user's card | Impossible by construction — no user parameter exists; identity is derived from the JWT (`getUserIdFromJwt`), entry key is built from the *caller's* `profiles.member_code`. |
| 5 | `/api/share` with someone else's circle code (referral hijack / membership probe) | `requireCircleRole` 403s non-members. Code format validated. Rate-limited 30/10min/user. |
| 6 | Server response leaking P&L despite toggle | Endpoint re-reads viz prefs and re-strips (`belt+braces`) even though the entry was already filtered at publish. |
| 7 | `circle_shared_trades.pnl` (execution logs) | Sharing a trade is explicit per-trade consent, now also gated by the `tradeLogs` toggle; member-only SELECT was already applied (`20260611_circle_shared_trades_member_select.sql`). |
| 8 | Coach forcing disclosure silently | Required metrics are **displayed at join time**; toggles for them are visibly locked. No silent flip: changing `requiredMetrics` after creation must trigger a member notification (v1: re-consent banner in the circle screen). |
| 9 | Owner self-demotion bricking a circle / role tampering | Guard trigger: identity columns immutable, last owner protected. Moderators have zero write access to roles. |
| 10 | `user_kv` viz prefs readable by others | Already self-only RLS (`20260531_user_kv_rls.sql`); prefs never leave the user + service role. |

Residual (accepted, documented): required-metrics enforcement is client-side
until the v2 trades read-flip (§2.4); a tampered client can *withhold* (visible
to the coach) but can never *read* anything extra.

---

## 5. Rollout order & test plan

Sequencing respects the 6/15 competition launch and the wedge sprint:

| Phase | Ships | Risk |
|---|---|---|
| **A (pre-6/15 safe)** | `share_events` + `waitlist.ref` migration, `api/share.ts`, share button in circle screen | Zero impact on existing reads/writes. The share card is launch-week marketing fuel. |
| **B** | Viz prefs + publish-time filtering + scrub-on-toggle + comp-circle required-metrics fallback | Touches `publishToCircle` — verify comp leaderboard still fully populated. |
| **C (after backfill pre-flight returns 0)** | §1.6 member-only entry RLS | Lockout risk if backfill gaps — run pre-flight C, keep rollback SQL handy. |
| **D (post-sprint B2B track)** | Moderator role migration + role plumbing + Instructor Dashboard + requiredMetrics UI | New surface; no existing behavior changes until UI lands. |

Tests (vitest, mirroring `stats.test.ts` conventions):
- `circleVisibility.test.ts` — merge order (default < per-circle), all-visible fallback, malformed JSON rows.
- `publishToCircle` — hidden fields are `null` in the written blob; comp circle ignores hide-pnl; `viz` flags echoed.
- SQL pre/post-flight blocks in each migration file (house style), incl. the negative leaderboard read as a non-member (pattern from `20260610`).
- `api/share` — 401 no JWT, 403 non-member, 409 no discipline score, P&L absent when toggled off, present when on, `shareUrl` contains the exact circle code.

Glossary of internal terms used above: **KV** — the `user_kv`/`shared_kv`
key-value tables backing the live app; **read-flip** — switching reads from KV
to the v2 relational tables (planned post-6/15); **publish** — a client writing
its own leaderboard entry row; **RLS** — Postgres Row Level Security;
**SECURITY DEFINER** — a SQL function that runs with its owner's permissions,
used to check membership without RLS recursion.

---
---

# Addendum (2026-06-12, second pass) — corrections & optimizations

Supersedes the matching sections above where they conflict.

## A. Design correction: the ref URL leaked private-circle join codes

In Kōda, **the circle code is the invite code** — `joinCircle` admits anyone
who knows it. v1's `join?ref=<CIRCLE_CODE>` would therefore have published the
private-circle key on X/Discord with every share. For the B2B target (paid
coach communities) that's the worst possible bug: the share button would have
given away the product the coach charges for.

Fix (now reflected in §3.2): **ref policy by circle privacy.**

| Circle privacy | `ref` value | Why it's safe |
|---|---|---|
| `public` (incl. KODA-GLOBAL, comp) | the circle code | public circles are browsable/joinable by design |
| `private` | `u_<member_code>` (the sharer) | member codes already appear in public-ish entry keys; they authorize nothing |

Side benefit: `u_<member_code>` gives **personal referral attribution** for
free — `waitlist.ref` now answers both "which circle recruits" and "which
*user* recruits," which enables a later invite-rewards program with zero new
schema. Opaque per-circle slugs (a `circle_refs(slug, circle_code)` service-
role-only table + "request to join" flow for private circles) stay v2.

## B. Leaner Phase A: the v1 share card needs ZERO new functions

§3 spends function slot 10 on `api/share.ts`. Second look: **every datum on
the card is already on the user's own device** (profile, stats, viz prefs,
discipline breakdown — the client *computes* these before publishing). The
endpoint's only irreplaceable jobs are share analytics and future OG unfurls.

- Analytics: **PostHog is already live** — `posthog.capture("share_card", { circle, ref })` replaces the `share_events` table for v1 volumes.
- OG unfurls: deferred to v2 anyway.

So Phase A shrinks to: client-side card builder (`src/lib/disciplineCard.ts`
producing the §3.2 payload shape locally) + canvas PNG render + `navigator.share`
+ the `waitlist.ref` column + ref capture in the existing
`api/account.ts → join-waitlist`. **Function budget stays 9/12**, slots stay
free for AutoJournal's webhook *and* a future `api/share.ts` when OG unfurls
earn their slot. Latency: card appears instantly (no round-trip). The §3.2
endpoint code is kept above as the v2 contract — build the client payload to
that exact shape so v2 is a lift-and-shift.

The §4 security analysis is unchanged by this: the card is built from data the
user already owns; privacy enforcement still happens at publish time + RLS.

## C. Performance optimizations (cheap, do during Phase B)

1. **Batch viz-pref reads in the publish fan-out.** Auto-publish fires for all
   N circles per stats change; naive `readVisibility` = 2 `user_kv` gets ×
   N circles. `storage.ts` already has `remoteBatchGet` — read
   `koda_viz_default` + all `koda_viz_<CODE>` keys in ONE query before the
   fan-out, pass the map into `publishToCircle`. Invalidate on toggle save.
2. **One realtime channel instead of N.** `subscribeToCircle` opens a channel
   per circle, but every channel receives the **entire `shared_kv` change
   stream** and filters client-side — N circles means every event is processed
   N times. Refactor to a single `circles-all` channel with one handler that
   dispatches by key prefix to per-circle callbacks (the reconcile loop in
   `useCircles` then manages callbacks, not channels). Fewer sockets, less
   wasted parsing, same behavior. Pairs well with §1.6: after the RLS change,
   Realtime also stops delivering entry events for circles you're not in.
3. **RLS scale note.** `can_read_circle_entry` is SECURITY DEFINER, so Postgres
   can't inline it — it runs per candidate row. The `not starts_with(key,
   'koda_circle_entry_')` arm short-circuits all non-entry traffic, and
   `circle_members_user_idx` covers the lookup. Fine to ~10⁴ entry rows;
   revisit only if `listByPrefix` latency shows up in Sentry.
4. **Scrub-on-toggle batching.** Toggling the account-wide default must
   republish to *all* circles — reuse the same batched-prefs fan-out, throttle
   bypassed (privacy changes don't wait for the 5s window).

## D. Growth-loop optimizations (product)

1. **Trigger moments, not a buried button.** Kōda is bursty-use (trade-day
   only) — put the share CTA where pride peaks: (a) Weekly Report Card
   (`WeeklyReportCard.tsx` already calls `navigator.share` with bare text —
   upgrade it to attach the card PNG); (b) post-session screen when the day's
   discipline ≥ 85 or a streak extends; (c) discipline grade *improvement*
   ("B → A this week"). Never prompt on a poor week — sharing shame kills the
   loop.
2. **Comp-circle card variant for Monday 6/15.** Same payload + rank from the
   comp leaderboard: "Rank #4 · 50K Eval Challenge · Discipline 92/100." Every
   competitor sharing rank is recruiting for the funnel during launch week.
   Client-only (rank is in the fetched leaderboard), so it rides Phase A.
   Stretch goal, not a launch blocker.
3. **`/join` landing context.** `?ref=<public-circle-code>` should render the
   circle's name/emoji/member-count ("Join 14 traders in LONDON-X3K2") rather
   than a generic waitlist. Circle meta for public circles can be exposed via
   a tiny `?action=circle-preview` on the *future* v2 share function — until
   then, generic landing + stored ref is fine; don't spend a function on it.
4. **Don't build double-sided referral rewards yet.** `waitlist.ref` +
   PostHog gives measurement; rewards are a post-wedge-verdict decision
   (Day-30 rule: 3 named users + wedge shipped + 1 surprise).

## E. B2B optimizations (Instructor Dashboard, Phase D)

1. **Discipline trend > snapshot.** A coach's first question is "improving or
   sliding?" `stats.ts` already maintains `DisciplineLogEntry[]` — publish the
   trailing 4 weekly scores as `disciplineTrend: number[]` (tiny blob growth)
   and render sparkline + Δ-vs-last-week in the roster. This single column is
   most of the dashboard's perceived value.
2. **Weekly coach digest on the EXISTING cron.** `/api/cron?job=weekly-digest`
   (Sun 18:00) already exists — add a branch that emails each circle owner a
   roster summary (median discipline, biggest riser, students not publishing,
   tagging gaps). Retention hook that makes the coach open Kōda every Monday;
   zero new function slots.
3. **Roster CSV export.** Client-side blob download, ~20 LOC, coaches live in
   spreadsheets.
4. **Monetization fit.** `createCircle` already gates >1 circle behind Pro.
   Natural packaging: roles + required-metrics + Instructor Dashboard + coach
   digest = the *Pro* (or a "Coach") tier feature set. Pricing/packaging call
   belongs to Dylon+Bruno, but the gating hook already exists in code.

## F. Implementation gotchas for the canvas renderer (Phase A)

- **Canvas taint:** drawing a remote avatar URL taints the canvas →
  `toBlob()` throws. Fetch the avatar → blob → `createImageBitmap` (data-URL
  avatars are safe as-is; verify which form `profile.avatar` actually holds
  before assuming).
- **Fonts:** await `document.fonts.load("600 32px Geist")` (and Geist Mono)
  before drawing, or first-share cards render in Times.
- **Handles:** stored WITH leading `@` — render as-is; never prepend another
  `@` (the `@@x` class of bug).
- **Size:** one export, 1200×675 (X-native 16:9, reads fine on Discord).
  Dark `#13110E` bg per DESIGN.md — also looks intentional against both X
  themes.
- **PWA caveat:** `navigator.share({ files })` support varies; fall back to
  download + "image saved — paste it with your post" toast.

## G. Revised rollout

| Phase | Ships | Δ from §5 |
|---|---|---|
| **A (pre-6/15)** | Client-only card + share CTAs + `waitlist.ref` + ref capture + PostHog event; comp-rank variant if time allows | No `api/share.ts`, no `share_events` table — both deferred to v2 |
| **B** | Viz prefs + publish filtering + scrub + comp required-metrics fallback + perf items C1/C2/C4 | C1/C2 added |
| **C** | §1.6 member-only entry RLS (after pre-flight C returns 0) | unchanged |
| **D** | Roles migration + Instructor Dashboard + trend sparkline + coach digest + CSV export | E1/E2/E3 added |
| **v2 (earn-it list)** | `api/share.ts` + OG unfurls + circle-preview landing + opaque private-circle slugs + referral rewards | explicitly deferred |
