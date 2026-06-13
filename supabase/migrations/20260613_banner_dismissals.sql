-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · banner_dismissals table
--
-- WHAT THIS DOES
--   Stores per-user dismissals of in-app announcement banners so a dismissal on
--   one device is reflected on every device. One row per (user, banner_key).
--   `banner_key` examples: 'comp_2026', 'announcement:<announcement-id>'.
--
-- WHY THIS EXISTS
--   Banner dismissal was localStorage-only (per-device): dismiss on your phone,
--   it reappears on desktop. This backs it with the DB. The client keeps writing
--   localStorage too as a fast/offline path and degrades gracefully if this
--   table is absent (so the client can ship before this migration is applied).
--
-- DEPLOY-SAFE: additive. No existing table or policy is touched.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.banner_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  banner_key text not null check (char_length(banner_key) <= 200),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, banner_key)
);

alter table public.banner_dismissals enable row level security;

drop policy if exists "banner_dismissals_self_select" on public.banner_dismissals;
drop policy if exists "banner_dismissals_self_insert" on public.banner_dismissals;
drop policy if exists "banner_dismissals_self_delete" on public.banner_dismissals;

create policy "banner_dismissals_self_select"
  on public.banner_dismissals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "banner_dismissals_self_insert"
  on public.banner_dismissals for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow un-dismiss (e.g. a future "show again" / reset) without a server job.
create policy "banner_dismissals_self_delete"
  on public.banner_dismissals for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.banner_dismissals to authenticated;

notify pgrst, 'reload schema';
