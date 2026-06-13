-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · circle roles — add 'moderator', required_metrics, last-owner guard
--
-- WHAT THIS DOES (all ADDITIVE — no existing row changes)
--   1. Widens circle_members.role check to allow 'moderator'.
--   2. Adds circles.required_metrics jsonb (mirrors the KV meta blob's
--      requiredMetrics; the live app reads the KV copy, this is for the
--      eventual read-flip + any server-side checks).
--   3. Adds circle_members_guard BEFORE UPDATE: identity columns are
--      immutable, and a circle can never lose its last owner. Protects the
--      owner-only cm_owner_update path (002) when role-editing lands.
--
-- WHAT THIS DOES NOT DO
--   No data is written. No promotion happens here. The 'moderator' value
--   simply becomes legal. Nothing in the app writes circle_members yet — KV
--   member rows are mirrored into this table by a DB trigger; this migration
--   does not touch that trigger.
--
-- COEXISTENCE NOTE
--   The KV→circle_members mirror upserts on (circle_code, user_id) and never
--   mutates those key columns, so the identity-immutable guard below is a
--   no-op for it. The guard only bites on a genuine role UPDATE.
--
-- SERVICE ROLE NOTE
--   /api/* use the service-role client (bypasses RLS) — unaffected.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT — read-only, run BEFORE applying (informational, no blocker)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- A. Current role distribution (sanity — expect owner + member only today):
--   select role, count(*) from public.circle_members group by role order by role;
--
-- B. Confirm the role check constraint name before we drop/re-add it:
--   select conname from pg_constraint
--   where conrelid = 'public.circle_members'::regclass and contype = 'c';
--   (Expected: circle_members_role_check. If different, adjust line below.)


-- ═══════════════════════════════════════════════════════════════════════════════
-- THE MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Allow 'moderator'. (Postgres needs drop + re-add to widen a CHECK.)
alter table public.circle_members
  drop constraint if exists circle_members_role_check;
alter table public.circle_members
  add constraint circle_members_role_check
  check (role in ('owner','moderator','member','banned'));

-- 2. required_metrics on the v2 circles table (KV meta is the live source).
alter table public.circles
  add column if not exists required_metrics jsonb not null default '[]'::jsonb;

-- 3. Guard: identity immutable + never remove the last owner.
create or replace function public.circle_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-FLIGHT — run AFTER applying
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1. 'moderator' is now legal (expect: no error, 0 rows changed):
--   begin;
--   update public.circle_members set role = role where false;  -- no-op compile check
--   rollback;
--
-- 2. Last-owner guard works (expect: EXCEPTION on the update). Replace <CODE>
--    with a circle that has exactly one owner; this runs as the table owner so
--    it bypasses RLS but still fires the guard trigger:
--   begin;
--   update public.circle_members set role = 'member'
--   where circle_code = '<CODE>' and role = 'owner';
--   rollback;  -- expect: "cannot remove the last owner" before reaching here
--
-- 3. required_metrics column exists and defaults to []:
--   select column_default from information_schema.columns
--   where table_name = 'circles' and column_name = 'required_metrics';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   drop trigger if exists circle_members_guard_trg on public.circle_members;
--   drop function if exists public.circle_members_guard();
--   alter table public.circle_members drop constraint if exists circle_members_role_check;
--   alter table public.circle_members add constraint circle_members_role_check
--     check (role in ('owner','member','banned'));
--   -- (leave required_metrics; dropping a populated column is the real risk)
--   notify pgrst, 'reload schema';
