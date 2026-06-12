-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · shared_kv leaderboard entries — private circles become member-only
--
-- WHAT THIS DOES
--   Today shared_kv_select is USING (true): ANY signed-in user can read ANY
--   circle's leaderboard entries (koda_circle_entry_*), including dollar P&L,
--   member or not. This migration narrows entry-row reads:
--
--     · your own rows                       → readable (unchanged)
--     · entries of PUBLIC circles           → readable by any signed-in user
--       (public circles are freely joinable — the entries are as public as
--        the circle is; also keeps the comp browse-card member count working)
--     · entries of PRIVATE circles          → members only (non-banned)
--     · all other shared_kv keys            → unchanged (open read)
--
--   Pairs with publish-time filtering (PR #31): together, private-circle data
--   is invisible to outsiders AND hidden metrics never exist server-side.
--
-- WHY A FUNCTION (same pattern as is_circle_member, 20260610)
--   SECURITY DEFINER bypasses RLS inside the check, so the policy can read
--   circle_members and the circle meta row in shared_kv itself without
--   recursive-policy lockouts.
--
-- SERVICE ROLE NOTE
--   /api/* functions (crons, push, businesstats) use the service-role client
--   which bypasses RLS — unaffected.
--
-- REALTIME NOTE
--   subscribeToCircle's postgres_changes events flow through this policy too:
--   members keep their live updates; non-members stop receiving private-
--   circle entry events (that's the point). Public-circle events unchanged.
--
-- PREFIX-COLLISION NOTE
--   Codes are matched by starts_with('koda_circle_entry_' || code || '_').
--   Circle codes are NAME6-RAND4 / KODA-GLOBAL / 50K-EVAL-2026 — no code can
--   be a strict prefix of another code + '_', so entries cannot cross-match.
--
-- PRE-FLIGHT (run the read-only block below FIRST — check C must return
-- 0 rows before applying).  IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT CHECKS — read-only, run BEFORE applying the migration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- A. Column type of shared_kv.value (informational — the function casts via
--    ::jsonb which is a no-op when the column is already jsonb):
--
--   select data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'shared_kv' and column_name = 'value';
--
-- B. Circle roster + privacy as the policy will see it (sanity: every circle
--    you expect, with the right privacy; UNPARSEABLE must not appear):
--
--   select substring(k.key from char_length('koda_circle_') + 1) as code,
--          coalesce((k.value)::jsonb->>'privacy', 'MISSING') as privacy
--   from public.shared_kv k
--   where k.key like 'koda\_circle\_%' escape '\'
--     and k.key not like 'koda\_circle\_member\_%' escape '\'
--     and k.key not like 'koda\_circle\_entry\_%' escape '\'
--     and k.key not like 'koda\_circle\_bans\_%' escape '\'
--   order by code;
--
-- C. THE BLOCKER — members of PRIVATE circles (per KV member rows) who have
--    no circle_members row. They would lose that circle's leaderboard after
--    this migration. MUST return 0 rows:
--
--   with circles as (
--     select substring(k.key from char_length('koda_circle_') + 1) as code,
--            (k.value)::jsonb->>'privacy' as privacy
--     from public.shared_kv k
--     where k.key like 'koda\_circle\_%' escape '\'
--       and k.key not like 'koda\_circle\_member\_%' escape '\'
--       and k.key not like 'koda\_circle\_entry\_%' escape '\'
--       and k.key not like 'koda\_circle\_bans\_%' escape '\'
--   )
--   select m.key, m.owner_id, c.code, c.privacy
--   from public.shared_kv m
--   join circles c on starts_with(m.key, 'koda_circle_member_' || c.code || '_')
--   where m.key like 'koda\_circle\_member\_%' escape '\'
--     and c.privacy = 'private'
--     and not exists (
--       select 1 from public.circle_members cm
--       where cm.user_id = m.owner_id and cm.circle_code = c.code
--     );
--
--    Backfill any gaps (additive, idempotent):
--
--   insert into public.circle_members (circle_code, user_id)
--   select '<CIRCLE_CODE>', '<OWNER_UUID>'::uuid
--   on conflict do nothing;


-- ═══════════════════════════════════════════════════════════════════════════════
-- THE MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Entry-read check ────────────────────────────────────────────────────────
-- plpgsql so the public-circle arm can be exception-guarded: one malformed
-- circle meta row must degrade to "not public" for that circle, never break
-- reads for everyone. Members never hit the JSON path at all (arm 1, indexed
-- via circle_members_user_idx).
create or replace function public.can_read_circle_entry(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Arm 1: non-banned member of the circle this entry belongs to.
  if exists (
    select 1
    from public.circle_members cm
    where cm.user_id = auth.uid()
      and cm.role <> 'banned'
      and starts_with(p_key, 'koda_circle_entry_' || cm.circle_code || '_')
  ) then
    return true;
  end if;

  -- Arm 2: the circle is public (privacy from the live KV meta row).
  begin
    return exists (
      select 1
      from public.shared_kv meta
      where meta.key like 'koda\_circle\_%' escape '\'
        and meta.key not like 'koda\_circle\_member\_%' escape '\'
        and meta.key not like 'koda\_circle\_entry\_%' escape '\'
        and meta.key not like 'koda\_circle\_bans\_%' escape '\'
        and starts_with(
          p_key,
          'koda_circle_entry_' || substring(meta.key from char_length('koda_circle_') + 1) || '_'
        )
        and (meta.value)::jsonb->>'privacy' = 'public'
    );
  exception when others then
    return false;  -- malformed meta → treat that circle as private
  end;
end;
$$;

revoke all on function public.can_read_circle_entry(text) from public;
grant execute on function public.can_read_circle_entry(text) to authenticated;

-- ── 2. Narrowed SELECT policy ──────────────────────────────────────────────────
drop policy if exists "shared_kv_select" on public.shared_kv;
create policy "shared_kv_select" on public.shared_kv
  for select to authenticated
  using (
    owner_id = auth.uid()
    or not starts_with(key, 'koda_circle_entry_')
    or public.can_read_circle_entry(key)
  );

notify pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-FLIGHT VERIFICATION — run AFTER the migration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1. Simulated outsider (all-zeros uuid is never a member). Expect:
--    public_entries > 0 (comp/global boards still browsable),
--    private_entries_visible = 0:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
--   select count(*) as public_entries from public.shared_kv
--     where key like 'koda\_circle\_entry\_KODA-GLOBAL\_%' escape '\';
--   select count(*) as total_visible_entries from public.shared_kv
--     where key like 'koda\_circle\_entry\_%' escape '\';
--   rollback;
--
--    (total_visible_entries should equal the sum of PUBLIC circles' entries
--     only — compare against pre-flight B's roster.)
--
-- 2. Simulated you — expect your private circles' entries to appear:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"f38aae7d-e953-4a00-a5aa-5370677ca876","role":"authenticated"}';
--   select count(*) as my_visible_entries from public.shared_kv
--     where key like 'koda\_circle\_entry\_%' escape '\';
--   rollback;
--
-- 3. In the app: open a circle you're in → Board populates; open the browse
--    view logged in as a fresh account → comp card member count still shows.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- EMERGENCY ROLLBACK — restores today's open read
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   drop policy if exists "shared_kv_select" on public.shared_kv;
--   create policy "shared_kv_select" on public.shared_kv
--     for select to authenticated using (true);
--   notify pgrst, 'reload schema';
--
-- (can_read_circle_entry can stay — it's only referenced by the new policy.)
