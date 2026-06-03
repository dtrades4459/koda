-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · chat_reads table
--
-- WHAT THIS DOES
--   Stores the last timestamp a user read messages in each Trading Circle.
--   Used to highlight new messages since the user's last visit.
--   One row per (user_id, circle_code) pair.
--
-- WHY THIS EXISTS
--   Engagement loop: when a user returns to a circle, the UI queries this table
--   to show "new messages since 2026-06-03 14:23:15 UTC" as a visual badge.
--   Composite PK ensures exactly one read marker per user per circle.
--
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.chat_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_code text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, circle_code)
);

alter table public.chat_reads enable row level security;

drop policy if exists "chat_reads_self_select"  on public.chat_reads;
drop policy if exists "chat_reads_self_upsert"  on public.chat_reads;
drop policy if exists "chat_reads_self_update"  on public.chat_reads;
drop policy if exists "chat_reads_self_delete"  on public.chat_reads;

create policy "chat_reads_self_select"
  on public.chat_reads for select
  to authenticated
  using (auth.uid() = user_id);

create policy "chat_reads_self_upsert"
  on public.chat_reads for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chat_reads_self_update"
  on public.chat_reads for update
  to authenticated
  using (auth.uid() = user_id);

create policy "chat_reads_self_delete"
  on public.chat_reads for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.chat_reads to authenticated;

notify pgrst, 'reload schema';
