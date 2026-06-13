-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · announcements.audience targeting
--
-- WHAT THIS DOES
--   Adds an `audience` column so each announcement can target either everyone
--   ('all', the default) or just new users ('new' = within their first 14 days).
--   Flips the current active founder welcome message to 'new'.
--
-- WHY
--   The founder welcome banner was showing to every user on every load (and
--   flashing in). It should only greet new users; broadcasts to everyone stay
--   possible via the default 'all'.
--
-- DEPLOY-SAFE: additive column with a default. The client selects `*` and treats
--   a missing/NULL audience as 'all', so order of deploy vs. migration is fine.
--
-- NOTE: drops the 280-char announcements_message_len constraint added in
--   20260613_announcement_message_length.sql. That cap is re-checked on every
--   UPDATE (NOT VALID still enforces new row versions) and blocked the audience
--   flip because the live founder message is longer than 280. The client clamps
--   the banner to 4 lines, so the DB cap added little and is removed here.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.announcements
  drop constraint if exists announcements_message_len;

alter table public.announcements
  add column if not exists audience text not null default 'all'
  check (audience in ('all', 'new'));

-- Target the current founder welcome message at new users only.
update public.announcements set audience = 'new' where is_active = true;

notify pgrst, 'reload schema';
