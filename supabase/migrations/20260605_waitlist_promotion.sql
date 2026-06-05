-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Waitlist promotion mechanism
--
-- Adds the columns + helper RPC needed to make "you moved up the waitlist"
-- emails honest. Once an admin promotes a waitlister, their `promoted_at`
-- is set and the active-queue position recomputes for everyone behind.
--
-- Active position = rank() over (order by id) over rows where promoted_at is
-- null. Cached snapshot per email lives in `last_emailed_position` so the
-- weekly cron can decide whether to send a position-update email.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.waitlist
  add column if not exists promoted_at             timestamptz,
  add column if not exists last_emailed_position   int,
  add column if not exists last_emailed_at         timestamptz;

create index if not exists waitlist_active_idx
  on public.waitlist (id)
  where promoted_at is null;


-- ─── current_waitlist_position(email) — what number am I in line? ───────────
create or replace function public.current_waitlist_position(target_email text)
returns int
language sql
security definer
set search_path = public
as $$
  with active as (
    select id, row_number() over (order by id asc) as rn
    from public.waitlist
    where promoted_at is null
  )
  select rn::int from active
  join public.waitlist w using (id)
  where lower(w.email) = lower(target_email)
  limit 1;
$$;

revoke all on function public.current_waitlist_position(text) from public;
grant execute on function public.current_waitlist_position(text) to service_role;


-- ─── promote_waitlister(email) — admin call, marks promoted_at = now() ──────
create or replace function public.promote_waitlister(target_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.waitlist
  set promoted_at = now()
  where lower(email) = lower(target_email)
    and promoted_at is null;
$$;

revoke all on function public.promote_waitlister(text) from public;
grant execute on function public.promote_waitlister(text) to service_role;
