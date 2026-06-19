-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · Circles chat upgrades (Phase 2)
--
-- WHAT THIS DOES
--   1. circle_message_reactions      — emoji reactions on chat messages
--   2. circle_messages.reply_to_id   — reply / quote threading
--   3. circles.pinned_message_id     — one pinned announcement per circle
--   4. toggle_message_reaction(...)  — atomic add/remove RPC (SECURITY DEFINER)
--   5. realtime publication for the new reactions table
--
-- CONVENTIONS — mirrors 20260610_circle_messages_strict_rls.sql:
--   • RLS gated by public.is_circle_member(text) (already exists)
--   • circle_code denormalised onto the reactions row (like sender_name on
--     circle_messages) so policies stay non-recursive and fast
--   • service-role (/api/*) bypasses RLS — push fan-out unaffected
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Reply threading ────────────────────────────────────────────────────────
alter table public.circle_messages
  add column if not exists reply_to_id uuid references public.circle_messages(id) on delete set null;

create index if not exists circle_messages_reply_to_idx
  on public.circle_messages (reply_to_id);

-- ── 2. Pinned announcement (one per circle) ───────────────────────────────────
alter table public.circles
  add column if not exists pinned_message_id uuid references public.circle_messages(id) on delete set null;
alter table public.circles
  add column if not exists pinned_at timestamptz;

-- Owner-only pin: relies on circles.created_by holding the owner uid.
drop policy if exists "circles_owner_pin" on public.circles;
create policy "circles_owner_pin" on public.circles
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ── 3. Reactions table ────────────────────────────────────────────────────────
create table if not exists public.circle_message_reactions (
  message_id  uuid not null references public.circle_messages(id) on delete cascade,
  circle_code text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists cmr_message_idx on public.circle_message_reactions (message_id);

alter table public.circle_message_reactions enable row level security;

-- Read: any member of the reaction's circle.
drop policy if exists "cmr_read_member" on public.circle_message_reactions;
create policy "cmr_read_member" on public.circle_message_reactions
  for select to authenticated
  using (public.is_circle_member(circle_code));

-- Write/delete: only your own reactions, and only in circles you belong to.
drop policy if exists "cmr_insert_self" on public.circle_message_reactions;
create policy "cmr_insert_self" on public.circle_message_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_circle_member(circle_code));

drop policy if exists "cmr_delete_self" on public.circle_message_reactions;
create policy "cmr_delete_self" on public.circle_message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.circle_message_reactions to authenticated;

-- ── 4. Atomic toggle RPC ──────────────────────────────────────────────────────
-- Add the reaction if absent, remove it if present. Membership-checked inside,
-- so a single round-trip is safe to call from the client.
create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_circle_code text,
  p_emoji text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_circle_member(p_circle_code) then
    raise exception 'not a member of %', p_circle_code;
  end if;

  delete from public.circle_message_reactions
   where message_id = p_message_id and user_id = v_uid and emoji = p_emoji;
  get diagnostics v_existing = row_count;

  if v_existing > 0 then
    return 'removed';
  end if;

  insert into public.circle_message_reactions (message_id, circle_code, user_id, emoji)
  values (p_message_id, p_circle_code, v_uid, p_emoji)
  on conflict do nothing;
  return 'added';
end;
$$;

revoke all on function public.toggle_message_reaction(uuid, text, text) from public;
grant execute on function public.toggle_message_reaction(uuid, text, text) to authenticated;

-- ── 5. Realtime ───────────────────────────────────────────────────────────────
alter table public.circle_message_reactions replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.circle_message_reactions;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (paste if needed)
--   drop function if exists public.toggle_message_reaction(uuid, text, text);
--   drop table if exists public.circle_message_reactions;
--   alter table public.circles drop column if exists pinned_message_id;
--   alter table public.circles drop column if exists pinned_at;
--   alter table public.circle_messages drop column if exists reply_to_id;
--   drop policy if exists "circles_owner_pin" on public.circles;
--   notify pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════════════════════
