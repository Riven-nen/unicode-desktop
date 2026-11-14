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

-- 2. Courses & enrollment -----------------------------------------------------
-- A course is a class a professor teaches. Enrollments link students to it.
-- The student app creates one workspace folder per enrolled course, named
-- after the course code (e.g. "CS 101"), as soon as the student signs in.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null, -- short code, also the workspace folder name
  title text not null,
  term text, -- e.g. 'Fall 2026'
  professor_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists courses_professor_idx on public.courses (professor_id);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create index if not exists enrollments_student_idx on public.enrollments (student_id);

-- Security-definer helper so enrollment policies can check course ownership
-- without recursing back through the courses row-level security policy.
create or replace function public.is_course_professor(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.courses
    where courses.id = target and courses.professor_id = auth.uid()
  );
$$;

-- 3. Labs ---------------------------------------------------------------------

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  course_id uuid references public.courses (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Existing installs predate the course link; make the column idempotent.
alter table public.labs
  add column if not exists course_id uuid references public.courses (id) on delete set null;

create index if not exists labs_course_idx on public.labs (course_id);

-- 4. Snapshots: the time-travel timeline --------------------------------------
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

-- 5. Paste events: the analytics feed -----------------------------------------
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

-- 6. Row-level security --------------------------------------------------------
-- Students can insert their own rows and read only their own data.
-- Professors can read across students for the dashboard.
-- There are intentionally NO update/delete policies: the audit trail is
-- immutable, which is the whole point of paste tracking.

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
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

-- Students see courses they are enrolled in; professors see their own and
-- (for the dashboard) every course.
drop policy if exists "courses_select_enrolled_or_professor" on public.courses;
create policy "courses_select_enrolled_or_professor" on public.courses
  for select to authenticated
  using (
    professor_id = auth.uid()
    or public.is_professor()
    or exists (
      select 1
      from public.enrollments
      where enrollments.course_id = courses.id
        and enrollments.student_id = auth.uid()
    )
  );

drop policy if exists "courses_insert_professor_own" on public.courses;
create policy "courses_insert_professor_own" on public.courses
  for insert to authenticated
  with check (professor_id = auth.uid() and public.is_professor());

drop policy if exists "courses_update_professor_own" on public.courses;
create policy "courses_update_professor_own" on public.courses
  for update to authenticated
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

drop policy if exists "courses_delete_professor_own" on public.courses;
create policy "courses_delete_professor_own" on public.courses
  for delete to authenticated
  using (professor_id = auth.uid());

-- Enrollment rows: students read their own, professors manage their courses.
drop policy if exists "enrollments_select_own_or_course_professor" on public.enrollments;
create policy "enrollments_select_own_or_course_professor" on public.enrollments
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_course_professor(course_id)
    or public.is_professor()
  );

drop policy if exists "enrollments_insert_course_professor" on public.enrollments;
create policy "enrollments_insert_course_professor" on public.enrollments
  for insert to authenticated
  with check (public.is_course_professor(course_id));

drop policy if exists "enrollments_delete_course_professor" on public.enrollments;
create policy "enrollments_delete_course_professor" on public.enrollments
  for delete to authenticated
  using (public.is_course_professor(course_id));

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

-- 7. Promote a professor account (run manually as needed) ---------------------
-- update public.profiles set role = 'professor' where email = 'prof@university.edu';

-- 8. Seed a course + enrollment (optional, for local testing) ------------------
-- Requires a professor account (promoted above) and a student account.
-- insert into public.courses (code, title, term, professor_id)
-- select 'CS 101', 'Intro to Programming', 'Fall 2026', id
-- from public.profiles where email = 'prof@university.edu';
--
-- insert into public.enrollments (course_id, student_id)
-- select c.id, p.id
-- from public.courses c, public.profiles p
-- where c.code = 'CS 101' and p.email = 'student@university.edu';
