-- Retention core engine: email prefs, unsubscribe token, activity + idempotency stamps
alter table public.profiles
  add column if not exists weekly_recap_opt_in  boolean not null default true,
  add column if not exists winback_opt_in       boolean not null default true,
  add column if not exists product_opt_in       boolean not null default true,
  add column if not exists unsubscribe_token     uuid    not null default gen_random_uuid(),
  add column if not exists last_active_at        timestamptz,
  add column if not exists last_weekly_recap_at  timestamptz,
  add column if not exists last_winback_at       timestamptz;

create unique index if not exists profiles_unsubscribe_token_idx
  on public.profiles(unsubscribe_token);
