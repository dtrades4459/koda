-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Founder dashboard metrics
--
-- Creates:
--   1. public.founder_metrics       — single-row table for manual cash/burn input
--   2. public.get_founder_metrics() — returns one JSON blob with all dashboard
--                                     numbers (WAJ, activation, signups,
--                                     waitlist, retention, dormant, runway).
--
-- All metrics are computed deterministically in SQL. No LLM ever produces a
-- number — see docs/koda-dashboard-brief.md.
--
-- Activation threshold (≥1 logged trade) is a single named constant inside the
-- function so it's trivial to bump to ≥3 later.
--
-- Engagement is measured by `trades.created_at` (when the row was journaled
-- in-app), NOT `trades.date` (which is the trade's actual date and may be
-- backfilled). The journaling action is the engagement signal.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── founder_metrics table ──────────────────────────────────────────────────
-- One row, updated by hand. Boolean PK with check constraint enforces singleton.

create table if not exists public.founder_metrics (
  id                boolean primary key default true check (id),
  cash_in_bank_gbp  numeric not null default 0,
  monthly_burn_gbp  numeric not null default 0,
  updated_at        timestamptz not null default now()
);

alter table public.founder_metrics enable row level security;
-- No policies — service-role only.

-- Seed the single row if it doesn't exist yet, so the dashboard always renders.
insert into public.founder_metrics (id, cash_in_bank_gbp, monthly_burn_gbp)
values (true, 0, 0)
on conflict (id) do nothing;


-- ─── get_founder_metrics() ──────────────────────────────────────────────────

create or replace function public.get_founder_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  -- Tunable: bump to 3 once we're ready to use a stricter activation bar.
  activation_threshold constant int := 1;

  signups_total       int;
  signups_7d          int;
  signups_prev_7d     int;
  waitlist_total      int;
  waitlist_7d         int;
  activated_total     int;
  trades_7d           int;
  trades_prev_7d      int;
  waj_this_week       int;
  waj_last_week       int;
  dormant_activated   int;

  retention           jsonb;
  sparkline           jsonb;
  runway              jsonb;
begin
  -- Signups (total + last 7d + previous 7d for WoW)
  select count(*) into signups_total from auth.users;
  select count(*) into signups_7d
    from auth.users where created_at >= now() - interval '7 days';
  select count(*) into signups_prev_7d
    from auth.users
    where created_at >= now() - interval '14 days'
      and created_at <  now() - interval '7 days';

  -- Waitlist
  select count(*) into waitlist_total from public.waitlist;
  select count(*) into waitlist_7d
    from public.waitlist where created_at >= now() - interval '7 days';

  -- Activation (users with at least `activation_threshold` trades, ever)
  select count(*) into activated_total
    from (
      select user_id
      from public.trades
      group by user_id
      having count(*) >= activation_threshold
    ) act;

  -- Weekly Active Journalers — distinct users who logged a trade in last 7d
  select count(distinct user_id) into waj_this_week
    from public.trades where created_at >= now() - interval '7 days';
  select count(distinct user_id) into waj_last_week
    from public.trades
    where created_at >= now() - interval '14 days'
      and created_at <  now() - interval '7 days';

  -- Trades logged this week / last week
  select count(*) into trades_7d
    from public.trades where created_at >= now() - interval '7 days';
  select count(*) into trades_prev_7d
    from public.trades
    where created_at >= now() - interval '14 days'
      and created_at <  now() - interval '7 days';

  -- Dormant: activated users with no trade in last 14 days
  select count(*) into dormant_activated
    from (
      select user_id, max(created_at) as last_trade_at
      from public.trades group by user_id
      having count(*) >= activation_threshold
    ) lt
    where lt.last_trade_at < now() - interval '14 days';

  -- W1 retention by weekly cohort (last 8 cohorts, newest first)
  with cohorts as (
    select id as user_id, date_trunc('week', created_at) as cohort_week
    from auth.users
  ),
  activity as (
    select distinct user_id, date_trunc('week', created_at) as active_week
    from public.trades
  ),
  agg as (
    select
      c.cohort_week,
      count(distinct c.user_id) as cohort_size,
      count(distinct a.user_id) filter (
        where a.active_week = c.cohort_week + interval '1 week'
      ) as retained_w1
    from cohorts c
    left join activity a on a.user_id = c.user_id
    group by c.cohort_week
    order by c.cohort_week desc
    limit 8
  )
  select jsonb_agg(
    jsonb_build_object(
      'cohort_week',  to_char(cohort_week, 'YYYY-MM-DD'),
      'cohort_size',  cohort_size,
      'retained_w1',  retained_w1,
      'pct',          case when cohort_size = 0 then 0
                           else round(100.0 * retained_w1 / cohort_size, 1)
                      end
    )
  ) into retention from agg;

  -- 8-week WAJ sparkline (oldest → newest)
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - interval '7 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) as week_start
  ),
  waj as (
    select w.week_start,
           count(distinct t.user_id) as waj
    from weeks w
    left join public.trades t
      on t.created_at >= w.week_start
     and t.created_at <  w.week_start + interval '1 week'
    group by w.week_start
    order by w.week_start asc
  )
  select jsonb_agg(jsonb_build_object(
    'week_start', to_char(week_start, 'YYYY-MM-DD'),
    'waj',        waj
  )) into sparkline from waj;

  -- Runway (from the single-row founder_metrics table)
  select jsonb_build_object(
    'cash_in_bank_gbp', cash_in_bank_gbp,
    'monthly_burn_gbp', monthly_burn_gbp,
    'runway_months',    case when monthly_burn_gbp = 0 then null
                             else floor(cash_in_bank_gbp / monthly_burn_gbp)
                        end,
    'updated_at',       updated_at
  )
  into runway
  from public.founder_metrics
  order by updated_at desc
  limit 1;

  return jsonb_build_object(
    'generated_at',         now(),
    'activation_threshold', activation_threshold,
    'signups', jsonb_build_object(
      'total',       signups_total,
      'last_7d',     signups_7d,
      'prev_7d',     signups_prev_7d
    ),
    'waitlist', jsonb_build_object(
      'total',   waitlist_total,
      'last_7d', waitlist_7d
    ),
    'activation', jsonb_build_object(
      'activated_total', activated_total,
      'signups_total',   signups_total,
      'pct',             case when signups_total = 0 then 0
                              else round(100.0 * activated_total / signups_total, 1)
                         end
    ),
    'waj', jsonb_build_object(
      'this_week', waj_this_week,
      'last_week', waj_last_week
    ),
    'trades', jsonb_build_object(
      'last_7d', trades_7d,
      'prev_7d', trades_prev_7d
    ),
    'dormant_activated', dormant_activated,
    'retention',         coalesce(retention,  '[]'::jsonb),
    'waj_sparkline',     coalesce(sparkline,  '[]'::jsonb),
    'runway',            runway,
    -- Revenue scaffold — lights up once a subscriptions table or Stripe sync exists.
    'revenue', jsonb_build_object(
      'active_subs', 0,
      'mrr_gbp',     0,
      'source',      'not_configured'
    )
  );
end;
$$;

revoke all on function public.get_founder_metrics() from public;
grant execute on function public.get_founder_metrics() to service_role;
