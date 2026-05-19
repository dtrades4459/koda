-- ═══════════════════════════════════════════════════════════════════════════════
-- TRADR · Migration 005 — broker sync infrastructure
--
-- WHAT THIS DOES
--   1. Creates broker_connections — one row per user+broker, stores encrypted
--      tokens and tracks sync state.
--   2. Creates sync_events — immutable audit log of every sync attempt.
--   3. Alters public.trades — adds columns needed for auto-journaling:
--        external_id   unique fill ID from the broker (dedup key)
--        source        how the trade arrived: manual | api | csv | webhook
--        broker        which broker: tradovate | rithmic | csv | ...
--        raw_data      original broker payload (jsonb, for debugging)
--        review_status draft | published | skipped
--
-- SAFE TO RUN ON LIVE DATA
--   All ALTER TABLE statements use IF NOT EXISTS / have defaults so existing
--   rows are unaffected. The new tables are empty until the sync job runs.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste → Run.
--   Idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. BROKER CONNECTIONS ────────────────────────────────────────────────────
-- Stores one row per connected account (a user can have multiple).
-- Tokens are AES-256-GCM encrypted before insert — never stored in plaintext.

create table if not exists public.broker_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  broker           text not null,          -- 'tradovate' | 'rithmic' | ...
  env              text not null default 'live', -- 'demo' | 'live'
  account_id       text,                   -- broker's numeric account ID
  account_name     text,                   -- human label e.g. "APEX-247831"
  -- encrypted tokens (AES-256-GCM, base64 stored)
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at  timestamptz,
  -- sync state
  last_sync_at     timestamptz,
  sync_status      text not null default 'connected'
                     check (sync_status in ('connected','syncing','error','disconnected','paused')),
  sync_error       text,                   -- last error message if status=error
  -- metadata
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- A user can have at most one active connection per broker+account combination
create unique index if not exists broker_connections_user_broker_account_idx
  on public.broker_connections(user_id, broker, coalesce(account_id, ''));

-- For the cron job: quickly find all connections that need syncing
create index if not exists broker_connections_status_idx
  on public.broker_connections(sync_status)
  where sync_status = 'connected';

alter table public.broker_connections enable row level security;

-- Users can only see/manage their own connections
drop policy if exists "bc_self" on public.broker_connections;
create policy "bc_self" on public.broker_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated-at trigger (reuses existing touch_updated_at function from migration 002)
drop trigger if exists broker_connections_touch on public.broker_connections;
create trigger broker_connections_touch
  before update on public.broker_connections
  for each row execute function public.touch_updated_at();


-- ─── 2. SYNC EVENTS ───────────────────────────────────────────────────────────
-- Immutable audit log. One row per sync attempt (scheduled or manual).
-- Never deleted — useful for debugging "why did 0 trades come in on Tuesday?"

create table if not exists public.sync_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  connection_id    uuid references public.broker_connections(id) on delete set null,
  broker           text not null,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  trades_found     int not null default 0,  -- raw fills from broker
  trades_new       int not null default 0,  -- after dedup, net new rows written
  error            text                     -- null on success
);

create index if not exists sync_events_user_idx
  on public.sync_events(user_id, started_at desc);

alter table public.sync_events enable row level security;

drop policy if exists "se_self_read" on public.sync_events;
create policy "se_self_read" on public.sync_events
  for select to authenticated
  using (auth.uid() = user_id);

-- Cron job writes via service role (bypasses RLS) — no insert policy needed for users
-- but allow users to read their own history (covered above).


-- ─── 3. ALTER public.trades — sync columns ────────────────────────────────────
-- These columns let us deduplicate fills across syncs and track review state.
-- All have defaults so existing rows are untouched.

alter table public.trades
  add column if not exists external_id     text,       -- broker fill ID (dedup key)
  add column if not exists source          text not null default 'manual'
                             check (source in ('manual','api','csv','webhook')),
  add column if not exists broker          text,       -- 'tradovate' | 'rithmic' | ...
  add column if not exists raw_data        jsonb,      -- original broker payload
  add column if not exists review_status   text not null default 'published'
                             check (review_status in ('draft','published','skipped'));

-- Unique index so INSERT ... ON CONFLICT (user_id, external_id) works cleanly
create unique index if not exists trades_user_external_id_idx
  on public.trades(user_id, external_id)
  where external_id is not null;

-- Fast lookup: all drafts for a user (the Review Inbox query)
create index if not exists trades_user_review_idx
  on public.trades(user_id, review_status)
  where review_status = 'draft';
