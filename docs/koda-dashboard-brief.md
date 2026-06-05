# Kōda Founder Dashboard — Build Brief

**For:** Claude Code (implement as `/admin` route in the Kōda app)
**Stack:** React + TypeScript + Vite · Supabase · Vercel · Stripe · Sentry · PostHog
**Owner:** Dylon (solo founder, closed beta)

---

## 0. Objective

A single private `/admin` dashboard that answers one question at a glance: **is Kōda alive and growing?**

This is *not* the generic "8 startup numbers" template. At closed-beta, pre-revenue stage, most of those (CAC, LTV, sales pipeline) are noise. This dashboard tracks the numbers that actually decide Kōda: **activation, weekly active journalers, and retention** — plus cash/runway and a revenue scaffold for when the Pro tier goes live.

**Non-negotiable architecture principle:** every number is computed deterministically in **SQL/TypeScript**. No LLM ever computes a metric. (An optional Phase 3 "read" line may use Haiku to *narrate* finished numbers — it never produces them.)

---

## 1. Access & security (read first)

- Route `/admin`, lazy-loaded, **not** in any nav. Renders nothing but a 403 for non-admins.
- Admin identity via **email allowlist** in env (`ADMIN_EMAILS`), checked server-side. Do not gate on the client alone.
- **The Supabase service role key bypasses RLS. It must never touch the client bundle.** All privileged queries run inside a Vercel serverless function that reads `SUPABASE_SERVICE_ROLE_KEY` from server env only. The React route calls that function; it never holds the key.

**Data flow:**
```
/admin (React) ──► GET /api/admin/metrics  (Vercel serverless function)
                      1. verify caller's Supabase JWT
                      2. assert caller email ∈ ADMIN_EMAILS  → else 403
                      3. run metric SQL with service role (server only)
                      4. return one JSON blob
```

Serverless skeleton:
```ts
// api/admin/metrics.ts  — server-side only
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ALLOWLIST = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim());

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user }, error } = await admin.auth.getUser(token ?? "");
  if (error || !user || !ALLOWLIST.includes(user.email ?? "")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error: rpcError } = await admin.rpc("get_founder_metrics");
  if (rpcError) return res.status(500).json({ error: rpcError.message });
  return res.status(200).json(data);
}
```

**Recommended:** wrap the SQL below in a single Postgres function `get_founder_metrics()` that returns a JSON object, and call it via `admin.rpc(...)`. One round trip, all logic in the DB, easy to unit-check.

---

## 2. Before writing queries

The SQL below assumes this schema. **Confirm exact table/column names via the Supabase MCP before implementing** and adjust:

- `auth.users` — `id`, `email`, `created_at`
- `public.trades` — `id`, `user_id`, `created_at` (one row per logged trade)
- `public.waitlist` — `created_at`
- `public.subscriptions` — `status`, `amount_gbp` *(may not exist yet — see §3 Revenue)*
- `public.founder_metrics` — manual cash/burn inputs *(new table, see §3 Runway)*

Tunable constant: **activation = ≥1 logged trade.** Flag it as a named constant so it's easy to change to ≥3 later.

All intervals are UTC. Dylon is UK-based — if week boundaries matter for his reading, switch `date_trunc('week', …)` inputs to `… at time zone 'Europe/London'`.

---

## 3. Metrics spec

Grouped by what they tell you. Each has a definition, why it matters for Kōda, and SQL.

### Engagement — the hero metric

**Weekly Active Journalers (WAJ)** — distinct users who logged ≥1 trade in the last 7 days. This is Kōda's "proves people care" number: a journal nobody opens is dead, regardless of signups. Show it biggest, with week-over-week delta.

```sql
select
  count(distinct user_id) filter (where created_at >= now() - interval '7 days')                                            as waj_this_week,
  count(distinct user_id) filter (where created_at >= now() - interval '14 days'
                                    and created_at <  now() - interval '7 days')                                            as waj_last_week,
  count(*) filter (where created_at >= now() - interval '7 days')                                                          as trades_this_week
from public.trades
where created_at >= now() - interval '14 days';
```

### Activation

**Activation rate** — % of signed-up users who have ever logged a trade. The gap between signup and first trade is where Kōda leaks hardest; this is the number to obsess over in beta.

```sql
with first_trade as (
  select user_id, min(created_at) as first_trade_at
  from public.trades group by user_id
)
select
  (select count(*) from auth.users)                                                            as signups_total,
  (select count(*) from first_trade)                                                           as activated_total,
  round(100.0 * (select count(*) from first_trade)
        / nullif((select count(*) from auth.users), 0), 1)                                     as activation_pct;
```

### Growth — top of funnel

**Signups** (total + new this week) and **Waitlist** (total + new this week). Leading indicators; cheap to track.

```sql
-- signups
select
  count(*)                                                          as signups_total,
  count(*) filter (where created_at >= now() - interval '7 days')   as signups_7d
from auth.users;

-- waitlist
select
  count(*)                                                          as waitlist_total,
  count(*) filter (where created_at >= now() - interval '7 days')   as waitlist_7d
from public.waitlist;
```

### Retention — the moat

**W1 retention by weekly cohort** — of users who signed up in week N, what % logged a trade in week N+1. This is the Strava-analog defensibility metric: if early users keep coming back, the behavioral-data moat is real. Render the most recent ~8 cohorts as a small table or bar row.

```sql
with cohorts as (
  select id as user_id, date_trunc('week', created_at) as cohort_week
  from auth.users
),
activity as (
  select distinct user_id, date_trunc('week', created_at) as active_week
  from public.trades
)
select
  c.cohort_week,
  count(distinct c.user_id)                                                                    as cohort_size,
  count(distinct a.user_id) filter (where a.active_week = c.cohort_week + interval '1 week')    as retained_w1,
  round(100.0 * count(distinct a.user_id) filter (where a.active_week = c.cohort_week + interval '1 week')
        / nullif(count(distinct c.user_id), 0), 1)                                              as w1_retention_pct
from cohorts c
left join activity a on a.user_id = c.user_id
group by c.cohort_week
order by c.cohort_week desc
limit 8;
```

**At-risk (dormant) users** — activated users with no trade in 14 days. Pre-revenue, this *is* your churn signal. (Color this card so that *down is good*.)

```sql
with last_trade as (
  select user_id, max(created_at) as last_trade_at
  from public.trades group by user_id
)
select count(*) as dormant_activated
from last_trade
where last_trade_at < now() - interval '14 days';
```

### Revenue — scaffold now, live later

Pro tier (£24.99/mo) isn't live, so this reads ~£0 today. Build the query anyway so it lights up on day one of paid.

- **If a `subscriptions` table exists** (synced from Stripe via webhook):
```sql
select
  count(*) filter (where status = 'active')                              as active_subs,
  coalesce(sum(amount_gbp) filter (where status = 'active'), 0)          as mrr_gbp
from public.subscriptions;
```
- **If not:** fetch live in the serverless function via the Stripe API (`stripe.subscriptions.list({ status: 'active' })`), sum monthly amounts → MRR. Keep the Stripe secret key server-side only, same as the service role key.

### Cash & Runway — manual, honest

Cash isn't in Supabase. Create a one-row table Dylon updates by hand; runway computes from it. Don't fake precision.

```sql
create table if not exists public.founder_metrics (
  id boolean primary key default true check (id),   -- enforces single row
  cash_in_bank_gbp numeric not null,
  monthly_burn_gbp numeric not null,
  updated_at timestamptz not null default now()
);

select
  cash_in_bank_gbp,
  monthly_burn_gbp,
  floor(cash_in_bank_gbp / nullif(monthly_burn_gbp, 0)) as runway_months,
  updated_at
from public.founder_metrics
order by updated_at desc
limit 1;
```

---

## 4. UI / layout

Use the existing Kōda design system — don't invent new tokens:

- **Theme:** dark. **Accent:** royal blue `#264FC7` (fills), `#4A7CF0` (text/lines/sparklines).
- **Type:** IBM Plex Mono throughout. Card labels uppercase, muted, small. Values large.
- **Mobile-first** — Dylon checks from his phone; the PWA must render this cleanly on a narrow screen (single-column stack, hero card on top).

Layout:
- **Hero card** (full width): Weekly Active Journalers — big number, WoW delta, 8-week sparkline.
- **Card grid** below: Activation %, Signups, Trades this week, Waitlist, At-risk, Runway, (MRR + Active subs once live).
- **Retention** as its own small cohort table/bar row.
- Each card shows the value + a WoW delta. **Color by good/bad, not by direction** — a falling "at-risk" or "churn" number is green, not red.
- **Manual refresh button** + a "last updated HH:MM" timestamp. No need for realtime; on-load fetch + manual refresh is fine. Optionally cache the serverless response ~60s.

---

## 5. Build order

**Phase 1 (ship first):** `/admin` route + auth gate + `/api/admin/metrics` function + `get_founder_metrics()` SQL + 5 cards — WAJ (hero), Activation %, Signups, Trades this week, Waitlist.

**Phase 2:** Retention cohort table, WoW deltas + sparklines, At-risk card, `founder_metrics` table + Runway card.

**Phase 3:** Stripe MRR / active subs / churn once Pro is live; optional one-line AI "read" (Haiku narrates the finished JSON — never computes); optional Sentry "unresolved errors, last 24h" health card via the Sentry API.

---

## 6. Explicitly out of scope

- **CAC, LTV, Sales Pipeline** — wrong stage and wrong motion. Kōda is self-serve SaaS with a content-led funnel, not sales-led B2B. Revisit CAC only once paid acquisition spend exists.
- Realtime streaming, multi-user admin roles, historical data warehousing — none needed for a solo founder at this stage.

---

## 7. Open questions to confirm before/while building

1. Exact table + column names (verify via Supabase MCP) — especially the trades table name and its timestamp column.
2. Does a `subscriptions` table exist, or pull Stripe live in the function?
3. Activation threshold: ≥1 trade (assumed) or ≥3?
4. Admin identity: email allowlist (assumed) or a `role` column on profiles?
