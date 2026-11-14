-- 20261114090100_create_classroom_tables.sql
--
-- Core professor/student schema. Purely additive: new tables, indexes, and
-- one nullable column on code_snapshots. paste_events is intentionally
-- untouched (user_id + file_name already provide the student/file join key).

-- Classes --------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  professor_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists classes_professor_idx on public.classes (professor_id);

-- Enrollments ----------------------------------------------------------------
-- Composite primary key as specified; the legacy table keeps `id` + course_id.
create table if not exists public.enrollments (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index if not exists enrollments_student_id_idx on public.enrollments (student_id);

-- Assignments ----------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  description text,
  language text,
  starter_code text,
  created_at timestamptz not null default now()
);

create index if not exists assignments_class_idx on public.assignments (class_id);

-- Test cases -----------------------------------------------------------------
create table if not exists public.test_cases (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  stdin text,
  expected_stdout text,
  ordinal integer not null default 0
);

create index if not exists test_cases_assignment_idx on public.test_cases (assignment_id);

-- Submissions ----------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  final_snapshot_id uuid references public.code_snapshots (id) on delete set null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now()
);

create index if not exists submissions_assignment_idx on public.submissions (assignment_id);
create index if not exists submissions_student_idx on public.submissions (student_id);

-- Link snapshots to submissions. Existing rows stay valid (column nullable).
alter table public.code_snapshots
  add column if not exists submission_id uuid references public.submissions (id) on delete set null;

create index if not exists code_snapshots_submission_idx on public.code_snapshots (submission_id);

-- Integrity scores -----------------------------------------------------------
create table if not exists public.ics_scores (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  paste_term numeric not null,
  cadence_term numeric not null,
  focus_term numeric not null,
  compilation_term numeric not null,
  ics numeric not null,
  band text not null check (band in ('pass', 'review', 'flag')),
  computed_at timestamptz not null default now()
);

-- Inline comments ------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  professor_id uuid not null references public.profiles (id) on delete cascade,
  snapshot_id uuid references public.code_snapshots (id) on delete set null,
  anchor_line integer,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_submission_idx on public.comments (submission_id);
create index if not exists comments_snapshot_idx on public.comments (snapshot_id);

-- API role grants ------------------------------------------------------------
-- Explicit grants so the tables are usable through PostgREST regardless of
-- project default privileges. RLS still decides which rows each role sees.
grant select, insert, update, delete on
  public.classes,
  public.enrollments,
  public.assignments,
  public.test_cases,
  public.submissions,
  public.ics_scores,
  public.comments
  to authenticated;

grant all on
  public.classes,
  public.enrollments,
  public.assignments,
  public.test_cases,
  public.submissions,
  public.ics_scores,
  public.comments
  to service_role;

-- Anonymous clients have no policies on these tables; remove the default
-- anon grants as well so least privilege matches the RLS intent.
revoke all on
  public.classes,
  public.enrollments,
  public.assignments,
  public.test_cases,
  public.submissions,
  public.ics_scores,
  public.comments
  from anon;
