-- ==============================================================================
-- Migration: 20261015000001_create_scan_history.sql
-- Description: Create scan_history table with strict RLS and Zero-Log policies
-- ==============================================================================

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

create index if not exists idx_scan_history_user_created 
  on public.scan_history (user_id, created_at desc);

create index if not exists idx_scan_history_scan_id 
  on public.scan_history (scan_id);

alter table public.scan_history enable row level security;

create policy "Users can select own scan history"
  on public.scan_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own scan history"
  on public.scan_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own scan history"
  on public.scan_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.scan_history from anon;
grant select, insert, delete on public.scan_history to authenticated;
