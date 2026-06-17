-- Multi-account tracking: per-user account registry (eval-aware).
-- Trades link via trades.account_id / group_id (added in the trades blob + public.trades).
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  type             text not null default 'personal',   -- eval | funded | personal | demo
  prop_firm        text,
  account_size     numeric,
  starting_balance numeric,
  profit_target    numeric,
  max_drawdown     numeric,
  drawdown_type    text not null default 'trailing',    -- trailing | eod | static
  is_archived      boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts(user_id);

alter table public.accounts enable row level security;

drop policy if exists accounts_owner_all on public.accounts;
create policy accounts_owner_all on public.accounts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
