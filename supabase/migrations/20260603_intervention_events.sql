-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · intervention_events table
--
-- One row per in-session intervention firing. Links optionally to the trade
-- that was logged within 10 min of `fired_at` if user chose to continue.
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.intervention_events (
  id           uuid        primary key default gen_random_uuid(),
  user_uid     uuid        not null references auth.users(id) on delete cascade,
  fired_at     timestamptz not null default now(),
  signals      jsonb       not null,
  critical     boolean     not null default false,
  choice       text        not null check (choice in ('continued','cancelled')),
  trade_id     integer,
  session_date date        not null
);

create index if not exists intervention_events_user_fired_idx
  on public.intervention_events (user_uid, fired_at desc);

create index if not exists intervention_events_session_idx
  on public.intervention_events (user_uid, session_date);

alter table public.intervention_events enable row level security;

drop policy if exists "intervention_events_read_self"   on public.intervention_events;
drop policy if exists "intervention_events_insert_self" on public.intervention_events;
drop policy if exists "intervention_events_update_self" on public.intervention_events;

create policy "intervention_events_read_self"
  on public.intervention_events for select
  to authenticated
  using (auth.uid() = user_uid);

create policy "intervention_events_insert_self"
  on public.intervention_events for insert
  to authenticated
  with check (auth.uid() = user_uid);

create policy "intervention_events_update_self"
  on public.intervention_events for update
  to authenticated
  using (auth.uid() = user_uid);

grant select, insert, update on public.intervention_events to authenticated;

notify pgrst, 'reload schema';
