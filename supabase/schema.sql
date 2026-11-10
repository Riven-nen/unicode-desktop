-- ==========================================================================
-- Unicode Lab — Time-Travel Diff & Paste Tracker
--
-- Run once in the Supabase SQL editor (or as a CLI migration).
-- The student app only ever ships the anon key — row-level security
-- does the rest. Policies are dropped before (re)creation so this
-- script is safe to re-run.
-- ==========================================================================

-- 0. Extensions -------------------------------------------------------------
create extension if not exists pg_trgm; -- trigram index for paste similarity

-- 1. Profiles: separates students from professors ----------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student', 'professor')),
  created_at timestamptz not null default now()
);

-- A profile row is created automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by RLS policies to grant professors cross-student read access.
create or replace function public.is_professor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'professor'
  );
$$;

-- 2. Labs ---------------------------------------------------------------------

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Snapshots: the time-travel timeline --------------------------------------
-- One row per captured moment in a file's history.

create table if not exists public.code_snapshots (
  id uuid primary key, -- client generated (crypto.randomUUID())
  user_id uuid not null references auth.users (id) on delete cascade,
  lab_id uuid references public.labs (id) on delete set null,
  file_name text not null,
  content text not null,
  snapshot_type text not null default 'auto'
    check (snapshot_type in ('auto', 'paste', 'manual', 'restore')),
  version integer not null default 0, -- Monaco model versionId
  char_count integer not null default 0,
  line_count integer not null default 0,
  language text,
  created_at timestamptz not null default now()
);

create index if not exists code_snapshots_user_file_idx
  on public.code_snapshots (user_id, file_name, created_at desc);
create index if not exists code_snapshots_lab_idx
  on public.code_snapshots (lab_id, created_at desc);

-- 4. Paste events: the analytics feed -----------------------------------------
-- Written by the tracker's onDidPaste handler and by the typing-velocity
-- heuristic (large insert bursts without a clipboard paste).

create table if not exists public.paste_events (
  id uuid primary key, -- client generated
  snapshot_id uuid references public.code_snapshots (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  lab_id uuid references public.labs (id) on delete set null,
  file_name text not null,
  pasted_text text not null, -- full text, for similarity analytics
  pasted_chars integer not null default 0,
  paste_mode text check (paste_mode in ('single-line', 'multi-line')),
  detected_via text not null default 'onDidPaste'
    check (detected_via in ('onDidPaste', 'velocity')),
  created_at timestamptz not null default now()
);

create index if not exists paste_events_user_idx
  on public.paste_events (user_id, created_at desc);
create index if not exists paste_events_snapshot_idx
  on public.paste_events (snapshot_id);
create index if not exists paste_events_text_trgm_idx
  on public.paste_events using gin (pasted_text gin_trgm_ops);

-- 5. Row-level security --------------------------------------------------------
-- Students can insert their own rows and read only their own data.
-- Professors can read across students for the dashboard.
-- There are intentionally NO update/delete policies: the audit trail is
-- immutable, which is the whole point of paste tracking.

alter table public.profiles enable row level security;
alter table public.labs enable row level security;
alter table public.code_snapshots enable row level security;
alter table public.paste_events enable row level security;

drop policy if exists "profiles_select_own_or_professor" on public.profiles;
create policy "profiles_select_own_or_professor" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_professor());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "labs_select_authenticated" on public.labs;
create policy "labs_select_authenticated" on public.labs
  for select to authenticated
  using (true);

drop policy if exists "labs_insert_professor" on public.labs;
create policy "labs_insert_professor" on public.labs
  for insert to authenticated
  with check (public.is_professor());

drop policy if exists "labs_delete_professor" on public.labs;
create policy "labs_delete_professor" on public.labs
  for delete to authenticated
  using (public.is_professor());

drop policy if exists "snapshots_insert_own" on public.code_snapshots;
create policy "snapshots_insert_own" on public.code_snapshots
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "snapshots_select_own_or_professor" on public.code_snapshots;
create policy "snapshots_select_own_or_professor" on public.code_snapshots
  for select to authenticated
  using (auth.uid() = user_id or public.is_professor());

drop policy if exists "pastes_insert_own" on public.paste_events;
create policy "pastes_insert_own" on public.paste_events
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pastes_select_own_or_professor" on public.paste_events;
create policy "pastes_select_own_or_professor" on public.paste_events
  for select to authenticated
  using (auth.uid() = user_id or public.is_professor());

-- 6. Promote a professor account (run manually as needed) ---------------------
-- update public.profiles set role = 'professor' where email = 'prof@university.edu';
