-- ==============================================================================
-- PrivacyGuard AI - Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================
-- Table: public.scan_history
-- Purpose: Minimal audit trail and metadata telemetry for scans performed by
--          authenticated users.
--
-- STRICT ZERO-LOG PRIVACY POLICY:
-- 1. NEVER store raw source documents or prompt text.
-- 2. NEVER store detected sensitive snippets, raw values, or tokens.
-- 3. NEVER store protected or sanitized output text.
-- 4. NEVER store API keys, secrets, or credential tokens.
-- 5. Only store anonymized aggregate metadata (counts by category, mode, score, status).
-- ==============================================================================

-- 1. Create the scan_history table
create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id text not null,
  task text not null default 'Prompt Privacy Audit',
  privacy_mode text not null default 'strict',
  strictness text not null default 'gdpr-hipaa',
  status text not null default 'completed',
  findings_count integer not null default 0,
  category_counts jsonb not null default '{}'::jsonb,
  privacy_score numeric(5, 2) not null default 100.00,
  verification_passed boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add documentation comments on the table and columns
comment on table public.scan_history is 'Minimal scan metadata audit log. Zero sensitive text or PII is retained.';
comment on column public.scan_history.user_id is 'Authenticated Supabase user ID owner of this record.';
comment on column public.scan_history.scan_id is 'Client or backend generated scan identifier (e.g. SCN-...).';
comment on column public.scan_history.category_counts is 'JSON map of category names to occurrence counts (e.g. {"Contact PII": 2}). Zero raw values.';
comment on column public.scan_history.privacy_score is 'Calculated privacy compliance rating (0-100).';

-- 3. Optimization indexes
create index if not exists idx_scan_history_user_created 
  on public.scan_history (user_id, created_at desc);

create index if not exists idx_scan_history_scan_id 
  on public.scan_history (scan_id);

-- 4. Enable Row Level Security (RLS)
alter table public.scan_history enable row level security;

-- 5. RLS Policies: Ensure users can ONLY access their own records
-- Drop existing policies if re-running
drop policy if exists "Users can select own scan history" on public.scan_history;
drop policy if exists "Users can insert own scan history" on public.scan_history;
drop policy if exists "Users can delete own scan history" on public.scan_history;

-- Policy 1: SELECT - Authenticated users can read only rows where user_id matches auth.uid()
create policy "Users can select own scan history"
  on public.scan_history
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Policy 2: INSERT - Authenticated users can insert rows only for their own user_id
create policy "Users can insert own scan history"
  on public.scan_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy 3: DELETE - Authenticated users can delete their own rows
create policy "Users can delete own scan history"
  on public.scan_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 6. Disallow anonymous/public access explicitly
revoke all on public.scan_history from anon;
grant select, insert, delete on public.scan_history to authenticated;
