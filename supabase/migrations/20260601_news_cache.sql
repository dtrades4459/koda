-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · news_cache table
--
-- System-owned cache for ForexFactory calendar + Marketaux headlines.
-- One row per kind; refreshed by api/cron.ts (news-calendar | news-headlines).
-- Public read; writes only via service role.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.news_cache (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.news_cache enable row level security;

drop policy if exists "news_cache_read_all" on public.news_cache;
create policy "news_cache_read_all"
  on public.news_cache
  for select
  using (true);

-- Writes are intentionally NOT permitted via RLS — only the service role
-- (used by api/cron.ts) can upsert into this table. The service role
-- bypasses RLS, so no insert/update/delete policy is needed.

notify pgrst, 'reload schema';
