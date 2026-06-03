-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · notification_feed table
--
-- WHAT THIS DOES
--   Stores the engagement loop's paper trail: one row per push notification sent
--   to a user. Records the kind (follow, circle_join, reaction, idea_like, digest),
--   a JSON blob of context data, and read/aggregation timestamps.
--
-- WHY THIS EXISTS
--   Users see their activity history in the in-app inbox even if they missed the push.
--   The `read_at` column powers the unread badge in the nav.
--   The `aggregated_at` column marks which rows have been included in a weekly digest.
--   Inserts and deletes are server-managed (via service role background jobs only);
--   authenticated users can only SELECT their own rows and UPDATE read_at.
--
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.notification_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('follow', 'circle_join', 'reaction', 'idea_like', 'digest')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  aggregated_at timestamptz
);

-- Unread count for nav badge: only rows where read_at is null
create index if not exists notification_feed_user_unread_idx
  on public.notification_feed (user_id, created_at desc)
  where read_at is null;

-- Weekly digest cron: only rows where aggregated_at is null
create index if not exists notification_feed_digest_idx
  on public.notification_feed (user_id, created_at)
  where aggregated_at is null;

alter table public.notification_feed enable row level security;

drop policy if exists "notif_feed_self_select"  on public.notification_feed;
drop policy if exists "notif_feed_self_update"  on public.notification_feed;
drop policy if exists "notif_feed_self_insert"  on public.notification_feed;
drop policy if exists "notif_feed_self_delete"  on public.notification_feed;

create policy "notif_feed_self_select"
  on public.notification_feed for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notif_feed_self_update"
  on public.notification_feed for update
  to authenticated
  using (auth.uid() = user_id);

-- NOTE: No insert or delete policy for authenticated users.
-- Inserts and deletes are server-managed via background jobs (service role).
-- This prevents users from forging their own notifications or deleting activity history.

grant select, update on public.notification_feed to authenticated;

notify pgrst, 'reload schema';
