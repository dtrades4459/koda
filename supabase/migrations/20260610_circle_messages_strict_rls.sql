-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · circle_messages strict RLS — second attempt (Runbook C)
--
-- WHAT THIS DOES
--   1. Rewrites cm_read_member on circle_members to be NON-recursive.
--      The 002 version queried circle_members inside its own SELECT policy,
--      which Postgres treats as recursive — the EXISTS silently returned
--      0 rows and the 2026-06-03 strict policy locked everyone out of chat.
--   2. Adds is_circle_member(text) — a SECURITY DEFINER helper that checks
--      membership while BYPASSING RLS, so policies on OTHER tables can ask
--      "is this user in circle X?" without triggering the recursion.
--   3. Re-applies the strict SELECT policy on circle_messages using the
--      helper: you can only read chat for circles you are a member of.
--
-- PRE-FLIGHT (run the read-only block at the bottom FIRST — expect 0 rows
-- from check C before applying; non-zero means the 20260604 sync triggers
-- missed someone and the strict policy would lock them out).
--
-- SERVICE ROLE NOTE
--   /api/* functions use the service-role client which bypasses RLS — all
--   server-side reads/writes (push fan-out, crons) are unaffected.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. SECURITY DEFINER membership helper ─────────────────────────────────────
-- Runs as the function owner (table owner), so the circle_members read inside
-- it is NOT subject to RLS — no recursion, no lockout.
create or replace function public.is_circle_member(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_code = p_code
      and cm.user_id = auth.uid()
      and cm.role <> 'banned'
  );
$$;

revoke all on function public.is_circle_member(text) from public;
grant execute on function public.is_circle_member(text) to authenticated;

-- ── 2. Non-recursive cm_read_member ───────────────────────────────────────────
-- Own row always visible; fellow-member rows visible via the helper (needed by
-- the join-flow owner lookup in useCircles.ts, which the old recursive policy
-- was silently breaking).
drop policy if exists "cm_read_member" on public.circle_members;
create policy "cm_read_member" on public.circle_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_circle_member(circle_code)
  );

-- ── 3. Strict circle_messages SELECT ──────────────────────────────────────────
drop policy if exists "circle_messages_select" on public.circle_messages;
create policy "circle_messages_select" on public.circle_messages
  for select to authenticated
  using (public.is_circle_member(circle_code));

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT CHECKS — run these BEFORE the migration (read-only, safe anytime)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- A. Per-circle membership counts (sanity: KODA-GLOBAL ≈ 14+, 50K-EVAL-2026 > 0
--    if anyone has joined):
--
--   select circle_code, count(*) as members
--   from public.circle_members
--   group by circle_code
--   order by circle_code;
--
-- B. Message senders with no membership row (informational — people who left
--    a circle after chatting will appear here; that is fine, they lose read
--    access by design):
--
--   select distinct m.circle_code, m.sender_handle, m.sender_id
--   from public.circle_messages m
--   left join public.circle_members cm
--     on cm.circle_code = m.circle_code and cm.user_id = m.sender_id
--   where cm.user_id is null;
--
-- C. THE BLOCKER CHECK — KV membership rows whose owner has NO circle_members
--    row (sync-trigger gaps). MUST return 0 rows before applying. If it
--    returns rows, those users would be locked out of chat:
--
--   select k.key, k.owner_id
--   from public.shared_kv k
--   where k.key like 'koda\_circle\_member\_%' escape '\'
--     and not exists (
--       select 1 from public.circle_members cm
--       where cm.user_id = k.owner_id
--         and k.key like 'koda\_circle\_member\_' || cm.circle_code || '\_%' escape '\'
--     );
--
--    Backfill any gaps it finds with (adjusting circle_code per row):
--
--   insert into public.circle_members (circle_code, user_id)
--   select '<CIRCLE_CODE>', k.owner_id
--   from public.shared_kv k
--   where k.key like 'koda\_circle\_member\_<CIRCLE_CODE>\_%' escape '\'
--   on conflict do nothing;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-FLIGHT VERIFICATION — run AFTER the migration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1. Positive (in app): open KODA-GLOBAL chat as yourself — messages load.
--
-- 2. Negative (SQL Editor, simulates a logged-in user who is in NO circles —
--    the all-zeros uuid is never a member). Expect visible_messages = 0:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
--   select count(*) as visible_messages from public.circle_messages;
--   rollback;
--
-- 3. Positive (SQL Editor, simulates YOU). Expect a non-zero count:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"f38aae7d-e953-4a00-a5aa-5370677ca876","role":"authenticated"}';
--   select count(*) as visible_messages from public.circle_messages;
--   rollback;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- EMERGENCY ROLLBACK — paste this if chat breaks (returns to today's open state)
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   drop policy if exists "circle_messages_select" on public.circle_messages;
--   create policy "circle_messages_select" on public.circle_messages
--     for select to authenticated using (true);
--   notify pgrst, 'reload schema';
--
-- (Leave the cm_read_member fix and is_circle_member in place — they are
--  strict improvements either way.)
