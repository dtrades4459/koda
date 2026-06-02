-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · ideas + idea_likes tables
--
-- Public chronological feed of trader analysis posts ("ideas").
-- Pre-trade setups and post-trade breakdowns.
-- One like per (idea_id, user_uid).
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── ideas ───────────────────────────────────────────────────────────────────
create table if not exists public.ideas (
  id              uuid        primary key default gen_random_uuid(),
  author_uid      uuid        not null references auth.users(id) on delete cascade,
  author_handle   text        not null,
  author_name     text        not null,
  author_avatar   text,
  type            text        not null check (type in ('pre','post')),
  title           text        not null check (char_length(title) between 1 and 120),
  body            text        not null check (char_length(body) between 1 and 4000),
  instrument      text        not null check (char_length(instrument) between 1 and 32),
  timeframe       text,
  direction       text        not null check (direction in ('long','short','neutral')),
  entry_price     text,
  stop_price      text,
  target_price    text,
  chart_url       text,
  linked_trade_id integer,
  created_at      timestamptz not null default now()
);

create index if not exists ideas_created_at_idx on public.ideas (created_at desc);
create index if not exists ideas_author_uid_idx on public.ideas (author_uid);

alter table public.ideas enable row level security;

drop policy if exists "ideas_read_authed"   on public.ideas;
drop policy if exists "ideas_insert_self"   on public.ideas;
drop policy if exists "ideas_delete_self"   on public.ideas;

create policy "ideas_read_authed"
  on public.ideas for select
  to authenticated
  using (true);

create policy "ideas_insert_self"
  on public.ideas for insert
  to authenticated
  with check (auth.uid() = author_uid);

create policy "ideas_delete_self"
  on public.ideas for delete
  to authenticated
  using (auth.uid() = author_uid);

grant select, insert, delete on public.ideas to authenticated;

-- ── idea_likes ──────────────────────────────────────────────────────────────
create table if not exists public.idea_likes (
  id         uuid        primary key default gen_random_uuid(),
  idea_id    uuid        not null references public.ideas(id) on delete cascade,
  user_uid   uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, user_uid)
);

create index if not exists idea_likes_idea_id_idx on public.idea_likes (idea_id);
create index if not exists idea_likes_user_uid_idx on public.idea_likes (user_uid);

alter table public.idea_likes enable row level security;

drop policy if exists "idea_likes_read_authed"   on public.idea_likes;
drop policy if exists "idea_likes_insert_self"   on public.idea_likes;
drop policy if exists "idea_likes_delete_self"   on public.idea_likes;

create policy "idea_likes_read_authed"
  on public.idea_likes for select
  to authenticated
  using (true);

create policy "idea_likes_insert_self"
  on public.idea_likes for insert
  to authenticated
  with check (auth.uid() = user_uid);

create policy "idea_likes_delete_self"
  on public.idea_likes for delete
  to authenticated
  using (auth.uid() = user_uid);

grant select, insert, delete on public.idea_likes to authenticated;

notify pgrst, 'reload schema';
