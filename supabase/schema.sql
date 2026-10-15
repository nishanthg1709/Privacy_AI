-- ==============================================================================
-- PrivacyGuard AI - Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================
-- Application Tables:
-- 1. public.profiles - User profile metadata linked to auth.users with strict RLS
-- 2. public.scan_history - Minimal audit trail and metadata telemetry
--
-- STRICT ZERO-LOG PRIVACY POLICY:
-- 1. NEVER store raw source documents or prompt text.
-- 2. NEVER store detected sensitive snippets, raw values, or tokens.
-- 3. NEVER store protected or sanitized output text.
-- 4. NEVER store API keys, secrets, or credential tokens.
-- 5. Only store anonymized aggregate metadata (counts by category, mode, score, status).
-- ==============================================================================

-- ==============================================================================
-- PART 1: public.profiles
-- ==============================================================================

-- 1. Create the profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.profiles is 'Application user profile metadata linked to Supabase Auth users.';
comment on column public.profiles.id is 'Foreign key referencing auth.users(id). Primary key.';
comment on column public.profiles.display_name is 'User full name or preferred display name.';

-- 2. Enable Row Level Security (RLS) on profiles
alter table public.profiles enable row level security;

-- 3. RLS Policies on profiles
drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- Policy: SELECT - Authenticated users can read only their own profile
create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Policy: UPDATE - Authenticated users can update only their own profile, cannot alter id
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policy: INSERT - Authenticated users can insert only their own profile
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Revoke anonymous access explicitly
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- 4. Automatically provision a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, created_at, updated_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    now(),
    now()
  )
  on conflict (id) do update
  set
    display_name = coalesce(
      excluded.display_name,
      public.profiles.display_name
    ),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Maintain updated_at timestamp on profile updates
create or replace function public.handle_profile_updated()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id then
    raise exception 'Profile ID cannot be changed.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_profile_updated();


-- ==============================================================================
-- PART 2: public.scan_history
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

-- Documentation comments
comment on table public.scan_history is 'Minimal scan metadata audit log. Zero sensitive text or PII is retained.';
comment on column public.scan_history.user_id is 'Authenticated Supabase user ID owner of this record.';
comment on column public.scan_history.scan_id is 'Client or backend generated scan identifier (e.g. SCN-...).';
comment on column public.scan_history.category_counts is 'JSON map of category names to occurrence counts (e.g. {"Contact PII": 2}). Zero raw values.';
comment on column public.scan_history.privacy_score is 'Calculated privacy compliance rating (0-100).';

-- Optimization indexes
create index if not exists idx_scan_history_user_created 
  on public.scan_history (user_id, created_at desc);

create index if not exists idx_scan_history_scan_id 
  on public.scan_history (scan_id);

-- Enable Row Level Security (RLS) on scan_history
alter table public.scan_history enable row level security;

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

-- Revoke anonymous access explicitly
revoke all on public.scan_history from anon;
grant select, insert, delete on public.scan_history to authenticated;
