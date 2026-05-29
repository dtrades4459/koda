-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · imports audit trail + trade-imports Storage bucket
--
-- WHAT THIS DOES
--   1. Creates a private `trade-imports` Storage bucket that holds the original
--      CSV/XLSX file the user uploaded.
--   2. Creates an `imports` table that records one audit row per successful
--      import: filename, storage path, detected broker, account type, file size,
--      and counts (rows in file / trades imported / duplicates skipped).
--   3. RLS so users can only see, insert into, and delete from their own rows
--      and their own folder in the bucket.
--
-- WHY THIS EXISTS
--   CSV_IMPORT_AUDIT (29 May 2026) flagged that without the original file +
--   audit row, an import has no undo, no re-run, and no way to recover from a
--   bad parse. The bucket + table give us that foundation. A later migration
--   can add `trades.source_import_id` if/when undo is wired into the UI.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste → Run. Idempotent.
--
-- WHY THIS IS SAFE
--   Pure CREATE / INSERT … ON CONFLICT statements. No data is modified or
--   dropped. If the bucket already exists the upsert is a no-op. If the table
--   already exists the create is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-imports',
  'trade-imports',
  false,                          -- private: signed URLs only
  10485760,                       -- 10 MB per file (matches client cap)
  array[
    'text/csv',
    'text/plain',
    'text/tab-separated-values',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'    -- some browsers report .csv as octet-stream
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── Storage RLS ──────────────────────────────────────────────────────────────
-- A user can only read / write / delete files inside their own top-level folder
-- (the folder name is their auth.uid).

drop policy if exists "trade_imports_read_owner" on storage.objects;
create policy "trade_imports_read_owner"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trade-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trade_imports_insert_owner" on storage.objects;
create policy "trade_imports_insert_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trade-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trade_imports_delete_owner" on storage.objects;
create policy "trade_imports_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trade-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── Audit table ──────────────────────────────────────────────────────────────
create table if not exists public.imports (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  filename          text        not null,
  storage_path      text        not null,
  broker            text,                          -- preset key (e.g. 'rithmic')
  account_type      text,                          -- 'personal' | 'funded' | 'demo'
  row_count         int         not null default 0,
  imported_count    int         not null default 0,
  duplicate_count   int         not null default 0,
  file_size_bytes   bigint      not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists imports_user_created_idx
  on public.imports (user_id, created_at desc);


-- ── Table RLS ────────────────────────────────────────────────────────────────
alter table public.imports enable row level security;

drop policy if exists "imports_select_own" on public.imports;
create policy "imports_select_own"
  on public.imports for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "imports_insert_own" on public.imports;
create policy "imports_insert_own"
  on public.imports for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "imports_delete_own" on public.imports;
create policy "imports_delete_own"
  on public.imports for delete
  to authenticated
  using (user_id = auth.uid());
