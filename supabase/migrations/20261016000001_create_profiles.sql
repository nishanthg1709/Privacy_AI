-- ==============================================================================
-- Migration: 20261016000001_create_profiles.sql
-- Description: Create public.profiles table linked to auth.users with strict RLS
--              and auto-provisioning trigger on signup.
-- ==============================================================================

-- 1. Create public.profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Documentation comments
comment on table public.profiles is 'Application user profile metadata linked to Supabase Auth users.';
comment on column public.profiles.id is 'Foreign key referencing auth.users(id). Primary key.';
comment on column public.profiles.display_name is 'User display name or full name.';

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. RLS Policies: Ensure users can ONLY access and update their own profile
drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- Policy 1: SELECT - Authenticated users can read only their own profile
create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Policy 2: UPDATE - Authenticated users can update only their own profile and CANNOT alter the profile id
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policy 3: INSERT - Authenticated users can insert only their own profile
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Revoke anonymous access explicitly
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- 4. Automatically create a profile for new Supabase Auth users
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

-- Trigger to execute handle_new_user on auth.users after insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Automatically maintain updated_at timestamp on profile updates
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
