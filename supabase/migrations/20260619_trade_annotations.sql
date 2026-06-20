-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · trade_annotations — mentor rated notes on shared trades (Mentor Mode A)
--
-- WHAT THIS DOES (additive)
--   1. Adds circles.type text (mirrors the KV meta marker; live app reads KV).
--   2. Creates public.is_circle_owner(text) — SECURITY DEFINER, non-recursive,
--      true when auth.uid() is the OWNER of the circle (mirrors the
--      is_circle_member helper from 20260610). Owner-only on purpose (see below).
--   3. Creates public.trade_annotations, one row per (shared_trade, mentor),
--      FK to circle_shared_trades(id) ON DELETE CASCADE.
--   4. RLS: the circle owner writes; the shared trade's author OR the owner
--      reads. Mentor-type gating is enforced in the app/UI for Phase A — RLS
--      enforces the security-critical part (only the owner writes, only
--      author+owner read), not the product gate.
--
-- WHY OWNER-ONLY (not owner+moderator)
--   Moderator-coaches live in the KV blob koda_circle_mods_<code> (member CODES,
--   not uids) because the circle_members mirror trigger clobbers role. Only
--   role='owner' is authoritative in circle_members. The pilot mentor IS the
--   cohort owner, so this covers Phase A. Moderator-coach writes land with the
--   Brick B mentor API endpoint (service-role can read the KV mods list).
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. circles.type (additive; default null = ordinary circle).
alter table public.circles
  add column if not exists type text;

-- 2. Owner helper. SECURITY DEFINER bypasses RLS → no circle_members recursion.
create or replace function public.is_circle_owner(p_circle_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_code = p_circle_code
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  );
$$;
grant execute on function public.is_circle_owner(text) to authenticated;

-- 3. Table.
create table if not exists public.trade_annotations (
  id              uuid primary key default gen_random_uuid(),
  shared_trade_id uuid not null references public.circle_shared_trades(id) on delete cascade,
  mentor_uid      uuid not null references auth.users(id) on delete cascade,
  grade           text check (grade in ('A','B','C','D','F')),
  note            text not null check (char_length(note) between 1 and 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (shared_trade_id, mentor_uid)
);

create index if not exists trade_annotations_shared_trade_idx
  on public.trade_annotations (shared_trade_id);

alter table public.trade_annotations enable row level security;

-- 4. RLS. circle_code for a shared trade is fetched via a scalar subquery.
drop policy if exists "trade_annotations_select" on public.trade_annotations;
create policy "trade_annotations_select" on public.trade_annotations
  for select to authenticated
  using (
    exists (
      select 1 from public.circle_shared_trades st
      where st.id = trade_annotations.shared_trade_id
        and (
          st.author_uid = auth.uid()
          or public.is_circle_owner(st.circle_code)
        )
    )
  );

drop policy if exists "trade_annotations_write" on public.trade_annotations;
create policy "trade_annotations_write" on public.trade_annotations
  for insert to authenticated
  with check (
    mentor_uid = auth.uid()
    and exists (
      select 1 from public.circle_shared_trades st
      where st.id = trade_annotations.shared_trade_id
        and public.is_circle_owner(st.circle_code)
    )
  );

drop policy if exists "trade_annotations_update" on public.trade_annotations;
create policy "trade_annotations_update" on public.trade_annotations
  for update to authenticated
  using (mentor_uid = auth.uid() and exists (
    select 1 from public.circle_shared_trades st
    where st.id = trade_annotations.shared_trade_id
      and public.is_circle_owner(st.circle_code)
  ))
  with check (mentor_uid = auth.uid());

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-FLIGHT VERIFICATION (run AFTER applying, in SQL editor)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Table + policies exist:
--   select policyname from pg_policies where tablename = 'trade_annotations';
--   (expect: trade_annotations_select, _write, _update)
-- 2. Helper compiles:
--   select public.is_circle_owner('NONEXISTENT-CODE');  -- expect: false
-- 3. Negative read (user in no circles sees no annotations):
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
--   select count(*) from public.trade_annotations;  -- expect: 0
--   rollback;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   drop table if exists public.trade_annotations;
--   drop function if exists public.is_circle_owner(text);
--   -- leave circles.type (dropping a populated column is the real risk)
--   notify pgrst, 'reload schema';
