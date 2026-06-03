-- supabase/migrations/20260603_chat_reads.sql
create table if not exists public.chat_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_code text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, circle_code)
);

create index if not exists chat_reads_user_idx on public.chat_reads (user_id);

alter table public.chat_reads enable row level security;

create policy chat_reads_self_select on public.chat_reads
  for select using (auth.uid() = user_id);

create policy chat_reads_self_upsert on public.chat_reads
  for insert with check (auth.uid() = user_id);

create policy chat_reads_self_update on public.chat_reads
  for update using (auth.uid() = user_id);
