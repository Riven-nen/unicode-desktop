-- 20261114091300_judge0_runs.sql
--
-- Persist Judge0 executions so the professor can review what was run, and so
-- the integrity score can use real test outcomes. Runs are immutable.
--
-- Student custom runs have submission_id = null. Professor test-case runs set
-- submission_id + snapshot_id + test_case_id, which is what ICS uses for K.

create table if not exists public.code_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete cascade,
  submission_id uuid references public.submissions (id) on delete cascade,
  snapshot_id uuid references public.code_snapshots (id) on delete set null,
  test_case_id uuid references public.test_cases (id) on delete set null,
  file_name text,
  language text,
  source text not null,
  stdin text,
  expected_stdout text,
  stdout text,
  stderr text,
  compile_output text,
  status_id integer not null default 0,
  status_description text not null default 'Unknown',
  passed boolean,
  time_seconds numeric,
  memory_kb integer,
  created_at timestamptz not null default now()
);

create index if not exists code_runs_user_idx
  on public.code_runs (user_id, created_at desc);
create index if not exists code_runs_submission_idx
  on public.code_runs (submission_id, created_at desc);
create index if not exists code_runs_test_case_idx
  on public.code_runs (submission_id, test_case_id, created_at desc);

alter table public.code_runs enable row level security;

create policy "code_runs_select_own_or_class_professor" on public.code_runs
  for select to authenticated
  using (
    user_id = auth.uid()
    or (submission_id is not null and public.is_professor_of_submission(submission_id))
  );

create policy "code_runs_insert_own" on public.code_runs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      submission_id is null
      or public.owns_submission(submission_id)
      or public.is_professor_of_submission(submission_id)
    )
  );

grant select, insert on public.code_runs to authenticated;
grant all on public.code_runs to service_role;
revoke all on public.code_runs from anon;
