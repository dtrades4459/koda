-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · announcements.message length gate
--
-- WHAT THIS DOES
--   Caps the team-announcement banner message at 280 characters at the database
--   level, so a careless dashboard edit can't ship an essay that blows the
--   banner card layout. Pairs with the client-side 4-line clamp.
--
-- WHY NOT MORE (FCA copy-gating)
--   A keyword filter for "no profit promises" would false-positive on legitimate
--   copy and is better handled by an admin form / review step, not a DB CHECK.
--   This migration only enforces length, which is objective and safe.
--
-- `not valid` skips validation of any pre-existing rows (none should exceed 280)
-- while still enforcing the limit on every new/updated row. Run
--   alter table public.announcements validate constraint announcements_message_len;
-- later to retro-check existing rows if desired.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.announcements
  drop constraint if exists announcements_message_len;

alter table public.announcements
  add constraint announcements_message_len
  check (char_length(message) <= 280) not valid;

notify pgrst, 'reload schema';
